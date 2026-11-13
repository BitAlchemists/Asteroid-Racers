import { Checkpoint, CheckpointState, Entity, EntityType, getLogger } from "@ar/shared";
import type { CollisionMode, IGameServer, IServerService } from "../contracts";
import { GameServer } from "../game-server";
import { LocalServerConnection, type LocalConnectionOptions } from "../local-connection";
import type { Random } from "../random";
import { AIGameClient } from "./ai-game-client";
import { ArenaScript, type CrashMode, type PlacedEpisode } from "./arena-script";
import { sameSpec, type ModelSpec } from "./model-spec";
import {
  heldOutScenarios,
  mixEasyEpisodes,
  noiseSeed,
  reevaluationScenarios,
  SCENARIO_STREAM,
  trainingScenarios,
  type ArenaConfig,
  type ArenaRun,
  type Scenario,
} from "./arenas";
import type { ModelStore } from "./model-store";
import { MajorTom, type CrossoverKind } from "./network";
import {
  LEGACY_SCORING,
  scoreEpisodes,
  successRate,
  type EpisodeRecord,
  type ScoringWeights,
} from "./scoring";
import { ScriptState, type Script, type ScriptHost } from "./scripts";
import { buildTraces, type ArenaTrace } from "./trace";

/**
 * Runs bot scripts inside a game server: bots connect in-process, step their vehicle controllers
 * before physics (preUpdate) and their scripts after it (postUpdate).
 */
export abstract class AIDirector implements IServerService, ScriptHost {
  server: GameServer | undefined;
  protected readonly clients = new Set<AIGameClient>();
  protected readonly scripts = new Set<Script>();

  constructor(protected readonly connectionOptions: LocalConnectionOptions = {}) {}

  attach(server: IGameServer): void {
    if (!(server instanceof GameServer)) throw new Error("AI directors need an in-process GameServer");
    this.server = server;
  }

  abstract start(): void | Promise<void>;

  createClient(name?: string): AIGameClient {
    if (!this.server) throw new Error("director is not attached to a server");
    const client = new AIGameClient(new LocalServerConnection(this.server, this.connectionOptions), name);
    this.clients.add(client);
    return client;
  }

  destroyClient(client: AIGameClient): void {
    this.clients.delete(client);
  }

  schedule(seconds: number, callback: () => void): void {
    this.server?.schedule(seconds, callback);
  }

  /** Runs a script to its end. */
  async runScript(script: Script): Promise<void> {
    script.host = this;
    this.scripts.add(script);
    try {
      await script.run();
    } finally {
      this.scripts.delete(script);
    }
  }

  /** Stops every running script (and so disconnects all bots). */
  stopAll(): void {
    for (const script of [...this.scripts]) script.stop();
  }

  get botCount(): number {
    return this.clients.size;
  }

  preUpdate(dt: number): void {
    for (const client of this.clients) client.step(dt);
  }

  postUpdate(dt: number): void {
    for (const script of [...this.scripts]) if (script.state === ScriptState.RUNNING) script.step(dt);
  }
}

const demoLog = getLogger("services.ai.DemoDirector");
/** A script run shorter than this is treated as a failure, and the next attempt waits a bit. */
const MIN_HEALTHY_RUN_SECONDS = 1;
const RETRY_DELAY_SECONDS = 5;

/**
 * Shows off the latest model: each script factory runs in a loop with the newest network from the
 * store, so a demo picks up improvements while training continues elsewhere.
 */
export class DemoDirector extends AIDirector {
  readonly scriptFactories: ((network: MajorTom) => Script)[] = [];
  private stopped = false;

  constructor(
    readonly networkName: string,
    private readonly store: ModelStore,
    connectionOptions: LocalConnectionOptions = {},
  ) {
    super(connectionOptions);
  }

  start(): void {
    for (const factory of this.scriptFactories) void this.loop(factory);
  }

  stop(): void {
    this.stopped = true;
    this.stopAll();
  }

  private async loop(factory: (network: MajorTom) => Script): Promise<void> {
    while (!this.stopped) {
      const network = this.store.load(this.networkName)?.[0];
      if (!network) {
        demoLog.info(`No AI networks named ${this.networkName}. Not going to show a demo.`);
        return;
      }
      const startedAt = this.server?.gameTime ?? 0;
      await this.runScript(factory(network));
      if ((this.server?.gameTime ?? 0) - startedAt < MIN_HEALTHY_RUN_SECONDS) {
        await new Promise<void>((resolve) => this.schedule(RETRY_DELAY_SECONDS, resolve));
      }
    }
  }
}

const trainLog = getLogger("services.ai.TrainingDirector");

export interface GenerationReport {
  /** 1-based number of this generation within the run (continues after a resume). */
  generation: number;
  /** Generation number stored in the winning model (continues across runs). */
  modelGeneration: number;
  bestScore: number;
  meanScore: number;
  worstScore: number;
  /** Share of training targets the winner reached (0..1). */
  success: number;
  /** The winner's flights through this generation's training scenarios, for drawing. */
  trace: ArenaTrace[];
  /** The winner's score on the held-out scenarios (when there are any). */
  heldOutScore?: number;
  /** Share of held-out targets the winner reached (0..1). */
  heldOutSuccess?: number;
  winner: MajorTom;
  /** The models kept for the next generation, best first (just the winner unless `parents` > 1). */
  parents: MajorTom[];
  /** With a curriculum: the level this generation flew, and the level and streak for the next one. */
  curriculum?: { level: number; nextLevel: number; streak: number };
  /** With `reevaluate`: the winner's score and success share on the re-evaluation scenarios alone. */
  reevaluation?: { score: number; success: number };
  /**
   * With curriculum mixing: the arena runs this generation flew (regular runs, then the easy ones),
   * as configs, so a replay builds the same scenarios. Absent when no episodes were mixed.
   */
  trainingArenas?: ArenaConfig[];
  sampleSize: number;
  gameSeconds: number;
}

export interface TrainingOptions {
  store: ModelStore;
  networkName: string;
  layout: readonly number[];
  /** Inputs and outputs of new models; stored parents must have the same spec. */
  spec: ModelSpec;
  /** Models per generation, all flown simultaneously. */
  sampleSize: number;
  /** Applied to every offspring of the previous winner; `g` is the generation the child flies in. */
  mutate: (network: MajorTom, random: Random, g: number) => void;
  /** Self-adaptive mutation: the σ the first random models start with (absent = they carry none). */
  initialSigma?: number;
  /** Drives mutation and the first random models. */
  random: Random;
  /**
   * Models kept per generation (μ in (μ + λ)): the best `parents` survive, and each gets
   * (sampleSize − parents) / parents mutated children. Default 1: one winner, sampleSize − 1 children.
   */
  parents?: number;
  /** Range of the random starting weights of the first generation (default 1). */
  initRange?: number;
  /**
   * Crossover (needs `parents` > 1): each child is, with probability `rate`, its parent crossed
   * with another parent (drawn uniformly from the others) before it mutates. All draws come from
   * `random`. Absent or rate 0 = mutation only.
   */
  crossover?: { kind: CrossoverKind; rate: number };
  /**
   * A staged curriculum: the arena runs of every level (`arenas` is ignored for training, held-out
   * scenarios use the last level). `level` and `streak` are where the run stands (for resume).
   */
  curriculum?: {
    levels: readonly (readonly ArenaRun[])[];
    success: number;
    streak: number;
    level: number;
    streakCount: number;
    /** Share of each arena's episodes from an earlier level (see `mixEasyEpisodes`; absent = 0). */
    keepEasy?: number;
  };
  /**
   * Re-evaluation against the winner's curse: the best `top` candidates plus the previous parents fly
   * about `episodes` extra scenarios (their own seed stream, derived from the seed and generation),
   * and the order among them, so the winner and the kept parents, follows the sum of both rounds.
   * Absent = selection on the training round alone.
   */
  reevaluate?: { top: number; episodes: number };
  /**
   * Latency and noise of every bot's inputs (`inputDelay` steps, Gaussian `inputNoise`), with the
   * noise from its own stream per scenario (see `noiseSeed`). Absent or 0 = none.
   */
  perception?: { inputDelay?: number; inputNoise?: number };
  /** Every candidate flies every arena, one arena after the other. */
  arenas: readonly ArenaRun[];
  /** Run seed: scenario seeds are derived from it, the stream, the arena index and the generation. */
  scenarioSeed: number;
  /** Held-out scenarios per arena: fixed for the whole run, flown by the winner only, never used for selection. */
  heldOut?: number;
  scoring?: ScoringWeights;
  collisions?: CollisionMode;
  crashMode?: CrashMode;
  /** With `respawn`: an episode ends at its N-th crash, charged like `end` (default: no limit). */
  crashLimit?: number;
  /** Number of the first generation this director runs (default 1; a resumed run passes g + 1). */
  firstGeneration?: number;
  /** Stop after this many generations (default: run forever). */
  maxGenerations?: number;
  onGeneration?: (report: GenerationReport) => void;
}

/**
 * Neuro-evolution: each generation the best model from the store (or random ones, the first time) is
 * cloned and mutated into `sampleSize` candidates. All candidates fly each arena's scenario at once,
 * one arena after the other; the lowest total score wins and is saved for the next generation.
 */
export class TrainingDirector extends AIDirector {
  private stopped = false;
  private generation: number;
  private running: Promise<void> | undefined;
  private readonly scoring: ScoringWeights;
  private readonly heldOutScenarios: Scenario[];

  constructor(readonly options: TrainingOptions) {
    // Bots get their messages synchronously so they react in the same frame even when the server runs
    // flat out, and never respawn on their own: the arena script decides what a crash means.
    super({ delivery: "sync", collisions: options.collisions ?? "none", autoRespawn: false });
    if (options.arenas.length === 0) throw new Error("training needs at least one arena");
    this.generation = (options.firstGeneration ?? 1) - 1;
    this.scoring = options.scoring ?? { ...LEGACY_SCORING };
    const curriculum = options.curriculum;
    this.level = curriculum?.level ?? 0;
    this.streak = curriculum?.streakCount ?? 0;
    // Held-out scenarios measure the target task: the last level of a curriculum.
    this.heldOutScenarios = heldOutScenarios(
      curriculum ? curriculum.levels.at(-1)! : options.arenas,
      options.scenarioSeed,
      options.heldOut ?? 0,
    );
  }

  /** Curriculum level of the next generation (0 without a curriculum). */
  private level: number;
  /** Generations in a row whose winner reached the curriculum's success share. */
  private streak: number;

  /** The previous generation's parents (empty before the first generation). */
  private lastParents: readonly MajorTom[] = [];

  /** The arena runs generation `g` trains on, and how many of them are on the current level. */
  private runsFor(g: number): { runs: readonly ArenaRun[]; hard: number } {
    const curriculum = this.options.curriculum;
    if (!curriculum) return { runs: this.options.arenas, hard: this.options.arenas.length };
    if (curriculum.keepEasy === undefined)
      return { runs: curriculum.levels[this.level]!, hard: curriculum.levels[this.level]!.length };
    return mixEasyEpisodes(curriculum.levels, this.level, curriculum.keepEasy, this.options.scenarioSeed, g);
  }

  start(): void {
    this.running ??= this.trainLoop();
  }

  /** Resolves when training stopped (after maxGenerations, or when stop() was called). */
  get done(): Promise<void> {
    return this.running ?? Promise.resolve();
  }

  stop(): void {
    this.stopped = true;
    this.stopAll();
  }

  /** The training scenarios of generation `g` (1-based), one per arena. */
  scenariosFor(g: number): Scenario[] {
    return trainingScenarios(this.runsFor(g).runs, this.options.scenarioSeed, g);
  }

  private async trainLoop(): Promise<void> {
    let remaining = this.options.maxGenerations ?? Infinity;
    while (!this.stopped && remaining-- > 0) {
      await this.runGeneration();
    }
  }

  /** Candidates for the next generation: each stored model plus mutated copies of it. */
  createCandidates(): MajorTom[] {
    const { store, networkName, layout, spec, sampleSize, mutate, random } = this.options;
    const parents = store.load(networkName);
    this.lastParents = parents ?? [];
    if (!parents || parents.length === 0) {
      trainLog.info(`no networks named ${networkName} yet, starting with ${sampleSize} random ones`);
      return Array.from({ length: sampleSize }, (_, i) => {
        const network =
          this.options.initRange === undefined
            ? MajorTom.random(layout, random, `Luke #${i}`, spec)
            : MajorTom.random(layout, random, `Luke #${i}`, spec, this.options.initRange);
        if (this.options.initialSigma !== undefined) network.sigma = this.options.initialSigma;
        return network;
      });
    }
    for (const parent of parents) {
      if (!sameSpec(parent.spec, spec))
        throw new Error(
          `stored model ${networkName} has inputs ${parent.spec.inputs.join(",")}, but training is configured for ${spec.inputs.join(",")}`,
        );
    }
    const candidates: MajorTom[] = [];
    const childrenEach = Math.floor((sampleSize - parents.length) / parents.length);
    const crossover = this.options.crossover;
    const crossing = crossover !== undefined && crossover.rate > 0 && parents.length > 1;
    let index = 0;
    for (const [p, parent] of parents.entries()) {
      candidates.push(parent);
      for (let i = 0; i < childrenEach; i++) {
        const child = parent.clone();
        if (crossing && random() < crossover.rate) {
          let mate = Math.floor(random() * (parents.length - 1));
          if (mate >= p) mate++;
          child.crossover(parents[mate]!, crossover.kind, random);
        }
        child.name = `Major Tom #${index++}`;
        child.generation = parent.generation + 1;
        mutate(child, random, this.generation + 1);
        candidates.push(child);
      }
    }
    return candidates;
  }

  /** Flies `networks` through `scenarios` (one after the other) and returns each network's episode records. */
  async fly(
    networks: readonly MajorTom[],
    scenarios: readonly Scenario[],
    round: number = SCENARIO_STREAM.training,
  ): Promise<EpisodeRecord[][]> {
    return (await this.flyWithPaths(networks, scenarios, round)).records;
  }

  /** Like {@link fly}, plus each network's path per episode. */
  async flyWithPaths(
    networks: readonly MajorTom[],
    scenarios: readonly Scenario[],
    round: number = SCENARIO_STREAM.training,
  ): Promise<{ records: EpisodeRecord[][]; paths: number[][][] }> {
    const records = networks.map((): EpisodeRecord[] => []);
    const paths = networks.map((): number[][] => []);
    const perception = this.options.perception;
    const perceiving = !!perception && ((perception.inputDelay ?? 0) > 0 || (perception.inputNoise ?? 0) > 0);
    for (const [index, scenario] of scenarios.entries()) {
      if (this.stopped) break;
      const placed = this.place(scenario);
      try {
        const scripts = networks.map((network) => {
          const script = new ArenaScript(
            network,
            placed.episodes,
            this.options.crashMode,
            this.tickSeconds,
            this.options.crashLimit,
          );
          if (perceiving)
            script.perception = {
              ...perception,
              noiseSeed: noiseSeed(this.options.scenarioSeed, round, this.generation + 1, index),
            };
          return script;
        });
        await Promise.all(scripts.map((script) => this.runScript(script)));
        scripts.forEach((script, i) => {
          records[i]!.push(...script.records);
          paths[i]!.push(...script.paths);
        });
      } finally {
        placed.remove();
      }
    }
    return { records, paths };
  }

  private get tickSeconds(): number {
    return this.server?.tickSeconds ?? 0.015;
  }

  private place(scenario: Scenario): PlacedScenario {
    if (!this.server) throw new Error("director is not attached to a server");
    return placeScenario(this.server, scenario);
  }

  private async runGeneration(): Promise<void> {
    const startedAt = this.server?.gameTime ?? 0;
    const g = this.generation + 1;
    const candidates = this.createCandidates();
    const { runs, hard } = this.runsFor(g);
    const scenarios = trainingScenarios(runs, this.options.scenarioSeed, g);
    const { records, paths } = await this.flyWithPaths(candidates, scenarios);
    if (this.stopped) return;
    /** Episode records on the current level (mixed-in easy episodes come after them). */
    const hardEpisodes = scenarios.slice(0, hard).reduce((n, s) => n + s.episodes.length, 0);

    let scored: {
      network: MajorTom;
      records: EpisodeRecord[];
      paths: number[][];
      score: number;
      reeval?: EpisodeRecord[];
    }[] = candidates
      .map((network, i) => ({
        network,
        records: records[i]!,
        paths: paths[i]!,
        score: scoreEpisodes(records[i]!, this.scoring, this.tickSeconds),
      }))
      .sort((a, b) => a.score - b.score);

    const reevaluate = this.options.reevaluate;
    if (reevaluate) {
      // Finalists: the best `top` of the training round plus the previous parents, in training order.
      const finalists = scored.filter((s, i) => i < reevaluate.top || this.lastParents.includes(s.network));
      const reevalRuns = this.options.curriculum
        ? this.options.curriculum.levels[this.level]!
        : this.options.arenas;
      const extra = reevaluationScenarios(reevalRuns, this.options.scenarioSeed, g, reevaluate.episodes);
      const reevalRecords = await this.fly(
        finalists.map((s) => s.network),
        extra,
        SCENARIO_STREAM.reevaluate,
      );
      if (this.stopped) return;
      const total = finalists.map(
        (s, i) => s.score + scoreEpisodes(reevalRecords[i]!, this.scoring, this.tickSeconds),
      );
      const order = finalists
        .map((s, i) => ({ s: { ...s, reeval: reevalRecords[i]! }, total: total[i]!, i }))
        .sort((a, b) => a.total - b.total || a.i - b.i)
        .map((x) => x.s);
      scored = [...order, ...scored.filter((s) => !finalists.includes(s))];
    }
    const best = scored[0]!;
    best.network.name = "Winner from last round";
    const parents = scored.slice(0, this.options.parents ?? 1).map((s) => s.network);
    this.options.store.save(this.options.networkName, parents);

    let heldOut: { heldOutScore: number; heldOutSuccess: number } | undefined;
    if (this.heldOutScenarios.length > 0) {
      const [winnerRecords] = await this.fly([best.network], this.heldOutScenarios, SCENARIO_STREAM.heldOut);
      if (this.stopped) return;
      heldOut = {
        heldOutScore: scoreEpisodes(winnerRecords!, this.scoring, this.tickSeconds),
        heldOutSuccess: successRate(winnerRecords!),
      };
    }

    this.generation = g;
    let curriculum: GenerationReport["curriculum"];
    const plan = this.options.curriculum;
    if (plan) {
      const level = this.level;
      // Judged on the current level only (mixed-in easy episodes do not count), and with
      // re-evaluation on both rounds.
      const judged = [...best.records.slice(0, hardEpisodes), ...(best.reeval ?? [])];
      this.streak = successRate(judged) >= plan.success ? this.streak + 1 : 0;
      if (this.streak >= plan.streak && this.level < plan.levels.length - 1) {
        this.level++;
        this.streak = 0;
      }
      curriculum = { level, nextLevel: this.level, streak: this.streak };
    }
    const report: GenerationReport = {
      generation: g,
      modelGeneration: best.network.generation,
      bestScore: best.score,
      meanScore: scored.reduce((sum, s) => sum + s.score, 0) / scored.length,
      worstScore: scored.at(-1)!.score,
      success: successRate(best.records),
      trace: buildTraces(
        runs.map((run) => run.arena.name),
        scenarios,
        best.records,
        best.paths,
      ),
      ...heldOut,
      winner: best.network,
      parents,
      ...(curriculum ? { curriculum } : {}),
      ...(best.reeval
        ? {
            reevaluation: {
              score: scoreEpisodes(best.reeval, this.scoring, this.tickSeconds),
              success: successRate(best.reeval),
            },
          }
        : {}),
      // Mixed-in easy runs come after the regular ones: record the runs so a replay matches.
      ...(runs.length !== hard
        ? { trainingArenas: runs.map((run) => ({ name: run.arena.name, params: { ...run.params } })) }
        : {}),
      sampleSize: scored.length,
      gameSeconds: (this.server?.gameTime ?? 0) - startedAt,
    };
    trainLog.info(
      `generation ${report.generation} (model gen ${report.modelGeneration}): best ${report.bestScore.toFixed(0)}, ` +
        `mean ${report.meanScore.toFixed(0)} over ${report.sampleSize}`,
    );
    this.options.onGeneration?.(report);
  }
}

/** A scenario placed in the world: its obstacles and checkpoints exist until `remove()`. */
export interface PlacedScenario {
  episodes: PlacedEpisode[];
  remove(): void;
}

/** Spawns a scenario's obstacles and target checkpoints into `server`; `remove()` takes them out again. */
export function placeScenario(server: GameServer, scenario: Scenario): PlacedScenario {
  const obstacles = scenario.obstacles.map((o) => {
    const rock = new Entity({ type: EntityType.ASTEROID, position: o.position.clone(), radius: o.radius });
    server.addObstacle(rock);
    return rock;
  });
  const checkpoints: Checkpoint[] = [];
  const episodes = scenario.episodes.map((spec) => ({
    spec,
    targets: spec.targets.map((t) => {
      const checkpoint = new Checkpoint({ position: t.position.clone(), radius: t.radius });
      checkpoint.state = CheckpointState.FUTURE;
      server.spawnEntity(checkpoint);
      checkpoints.push(checkpoint);
      return checkpoint;
    }),
  }));
  return {
    episodes,
    remove: () => {
      for (const rock of obstacles) server.removeObstacle(rock);
      for (const checkpoint of checkpoints) server.despawnEntity(checkpoint);
    },
  };
}

import { Checkpoint, CheckpointState, Entity, EntityType, getLogger } from "@ar/shared";
import type { CollisionMode, IGameServer, IServerService } from "../contracts";
import { GameServer } from "../game-server";
import { LocalServerConnection, type LocalConnectionOptions } from "../local-connection";
import type { Random } from "../random";
import { AIGameClient } from "./ai-game-client";
import { ArenaScript, type CrashMode, type PlacedEpisode } from "./arena-script";
import { sameSpec, type ModelSpec } from "./model-spec";
import { heldOutScenarios, trainingScenarios, type ArenaRun, type Scenario } from "./arenas";
import type { ModelStore } from "./model-store";
import { MajorTom } from "./network";
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
  /** Applied to every offspring of the previous winner. */
  mutate: (network: MajorTom, random: Random) => void;
  /** Drives mutation and the first random models. */
  random: Random;
  /**
   * Models kept per generation (μ in (μ + λ)): the best `parents` survive, and each gets
   * (sampleSize − parents) / parents mutated children. Default 1: one winner, sampleSize − 1 children.
   */
  parents?: number;
  /** Range of the random starting weights of the first generation (default 1). */
  initRange?: number;
  /** Every candidate flies every arena, one arena after the other. */
  arenas: readonly ArenaRun[];
  /** Run seed: scenario seeds are derived from it, the stream, the arena index and the generation. */
  scenarioSeed: number;
  /** Held-out scenarios per arena: fixed for the whole run, flown by the winner only, never used for selection. */
  heldOut?: number;
  scoring?: ScoringWeights;
  collisions?: CollisionMode;
  crashMode?: CrashMode;
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
    this.heldOutScenarios = heldOutScenarios(options.arenas, options.scenarioSeed, options.heldOut ?? 0);
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
    return trainingScenarios(this.options.arenas, this.options.scenarioSeed, g);
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
    if (!parents || parents.length === 0) {
      trainLog.info(`no networks named ${networkName} yet, starting with ${sampleSize} random ones`);
      return Array.from({ length: sampleSize }, (_, i) =>
        this.options.initRange === undefined
          ? MajorTom.random(layout, random, `Luke #${i}`, spec)
          : MajorTom.random(layout, random, `Luke #${i}`, spec, this.options.initRange),
      );
    }
    for (const parent of parents) {
      if (!sameSpec(parent.spec, spec))
        throw new Error(
          `stored model ${networkName} has inputs ${parent.spec.inputs.join(",")}, but training is configured for ${spec.inputs.join(",")}`,
        );
    }
    const candidates: MajorTom[] = [];
    const childrenEach = Math.floor((sampleSize - parents.length) / parents.length);
    let index = 0;
    for (const parent of parents) {
      candidates.push(parent);
      for (let i = 0; i < childrenEach; i++) {
        const child = parent.clone();
        child.name = `Major Tom #${index++}`;
        child.generation = parent.generation + 1;
        mutate(child, random);
        candidates.push(child);
      }
    }
    return candidates;
  }

  /** Flies `networks` through `scenarios` (one after the other) and returns each network's episode records. */
  async fly(networks: readonly MajorTom[], scenarios: readonly Scenario[]): Promise<EpisodeRecord[][]> {
    return (await this.flyWithPaths(networks, scenarios)).records;
  }

  /** Like {@link fly}, plus each network's path per episode. */
  async flyWithPaths(
    networks: readonly MajorTom[],
    scenarios: readonly Scenario[],
  ): Promise<{ records: EpisodeRecord[][]; paths: number[][][] }> {
    const records = networks.map((): EpisodeRecord[] => []);
    const paths = networks.map((): number[][] => []);
    for (const scenario of scenarios) {
      if (this.stopped) break;
      const placed = this.place(scenario);
      try {
        const scripts = networks.map(
          (network) => new ArenaScript(network, placed.episodes, this.options.crashMode, this.tickSeconds),
        );
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
    const scenarios = this.scenariosFor(g);
    const { records, paths } = await this.flyWithPaths(candidates, scenarios);
    if (this.stopped) return;

    const scored = candidates
      .map((network, i) => ({
        network,
        records: records[i]!,
        paths: paths[i]!,
        score: scoreEpisodes(records[i]!, this.scoring, this.tickSeconds),
      }))
      .sort((a, b) => a.score - b.score);
    const best = scored[0]!;
    best.network.name = "Winner from last round";
    const parents = scored.slice(0, this.options.parents ?? 1).map((s) => s.network);
    this.options.store.save(this.options.networkName, parents);

    let heldOut: { heldOutScore: number; heldOutSuccess: number } | undefined;
    if (this.heldOutScenarios.length > 0) {
      const [winnerRecords] = await this.fly([best.network], this.heldOutScenarios);
      if (this.stopped) return;
      heldOut = {
        heldOutScore: scoreEpisodes(winnerRecords!, this.scoring, this.tickSeconds),
        heldOutSuccess: successRate(winnerRecords!),
      };
    }

    this.generation = g;
    const report: GenerationReport = {
      generation: g,
      modelGeneration: best.network.generation,
      bestScore: best.score,
      meanScore: scored.reduce((sum, s) => sum + s.score, 0) / scored.length,
      worstScore: scored.at(-1)!.score,
      success: successRate(best.records),
      trace: buildTraces(
        this.options.arenas.map((run) => run.arena.name),
        scenarios,
        best.records,
        best.paths,
      ),
      ...heldOut,
      winner: best.network,
      parents,
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

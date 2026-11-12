import { getLogger } from "@ar/shared";
import type { IGameServer, IServerService } from "../contracts";
import { GameServer } from "../game-server";
import { LocalServerConnection, type LocalConnectionOptions } from "../local-connection";
import type { Random } from "../random";
import { AIGameClient } from "./ai-game-client";
import type { BrainStore } from "./brain-store";
import { MajorTom } from "./network";
import { ScriptState, type RaceTargetTrainingScript, type Script, type ScriptHost } from "./scripts";

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
 * Shows off the latest brain: each script factory runs in a loop with the newest network from the
 * store, so a demo picks up improvements while training continues elsewhere.
 */
export class DemoDirector extends AIDirector {
  readonly scriptFactories: ((network: MajorTom) => Script)[] = [];
  private stopped = false;

  constructor(
    readonly networkName: string,
    private readonly store: BrainStore,
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
  generation: number;
  /** Generation number stored in the winning brain (continues across runs). */
  brainGeneration: number;
  bestScore: number;
  meanScore: number;
  worstScore: number;
  winner: MajorTom;
  sampleSize: number;
  gameSeconds: number;
}

export interface TrainingOptions {
  store: BrainStore;
  networkName: string;
  layout: readonly number[];
  /** Brains per generation, all flown simultaneously. */
  sampleSize: number;
  scriptFactory: (network: MajorTom) => RaceTargetTrainingScript;
  /** Applied to every offspring of the previous winner. */
  mutate: (network: MajorTom, random: Random) => void;
  random: Random;
  /** Stop after this many generations (default: run forever). */
  maxGenerations?: number;
  onGeneration?: (report: GenerationReport) => void;
}

/**
 * Neuro-evolution: each generation the best brain from the store (or random ones, the first time) is
 * cloned and mutated into `sampleSize` candidates, all fly the training course at once, and the one
 * with the lowest score is saved as the new winner.
 */
export class TrainingDirector extends AIDirector {
  private stopped = false;
  private generation = 0;
  private running: Promise<void> | undefined;

  constructor(readonly options: TrainingOptions) {
    // Training bots are ghosts (no crashes) and get their messages synchronously so they react in the
    // same frame even when the server runs flat out.
    super({ delivery: "sync", canCollide: false });
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

  private async trainLoop(): Promise<void> {
    const max = this.options.maxGenerations ?? Infinity;
    while (!this.stopped && this.generation < max) {
      await this.runGeneration();
    }
  }

  /** Candidates for the next generation: each stored brain plus mutated copies of it. */
  createCandidates(): MajorTom[] {
    const { store, networkName, layout, sampleSize, mutate, random } = this.options;
    const parents = store.load(networkName);
    if (!parents || parents.length === 0) {
      trainLog.info(`no networks named ${networkName} yet, starting with ${sampleSize} random ones`);
      return Array.from({ length: sampleSize }, (_, i) => MajorTom.random(layout, random, `Luke #${i}`));
    }
    const candidates: MajorTom[] = [];
    let index = 0;
    for (const parent of parents) {
      candidates.push(parent);
      for (let i = 0; i < sampleSize - 1; i++) {
        const child = parent.clone();
        child.name = `Major Tom #${index++}`;
        child.generation = parent.generation + 1;
        mutate(child, random);
        candidates.push(child);
      }
    }
    return candidates;
  }

  private async runGeneration(): Promise<void> {
    const startedAt = this.server?.gameTime ?? 0;
    const candidates = this.createCandidates();
    const scripts = candidates.map((network) => this.options.scriptFactory(network));
    // Score from evaluators: run all flights at once and collect when each ends.
    await Promise.all(scripts.map((script) => this.runScript(script)));
    if (this.stopped) return;

    const scored = scripts
      .map((script) => ({ network: script.network, score: script.evaluator.finalScore }))
      .sort((a, b) => a.score - b.score);
    const best = scored[0]!;
    best.network.name = "Winner from last round";
    this.options.store.save(this.options.networkName, [best.network]);

    this.generation++;
    const report: GenerationReport = {
      generation: this.generation,
      brainGeneration: best.network.generation,
      bestScore: best.score,
      meanScore: scored.reduce((sum, s) => sum + s.score, 0) / scored.length,
      worstScore: scored.at(-1)!.score,
      winner: best.network,
      sampleSize: scored.length,
      gameSeconds: (this.server?.gameTime ?? 0) - startedAt,
    };
    trainLog.info(
      `generation ${report.generation} (brain gen ${report.brainGeneration}): best ${report.bestScore.toFixed(0)}, ` +
        `mean ${report.meanScore.toFixed(0)} over ${report.sampleSize}`,
    );
    this.options.onGeneration?.(report);
  }

  /** Evaluate every running flight before the scripts step (Dart order). */
  override postUpdate(dt: number): void {
    for (const script of this.scripts) {
      if (script.state === ScriptState.RUNNING)
        (script as RaceTargetTrainingScript).evaluator.evaluate(script as RaceTargetTrainingScript, dt);
    }
    super.postUpdate(dt);
  }
}

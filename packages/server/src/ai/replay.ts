import type { Entity, Movable } from "@ar/shared";
import type { CollisionMode, IClientProxy } from "../contracts";
import { GameServer } from "../game-server";
import type { LocalConnectionOptions } from "../local-connection";
import { seededRandom } from "../random";
import { ArenaScript, type CrashMode } from "./arena-script";
import { resolveArenas, trainingScenarios, type ArenaConfig } from "./arenas";
import { AIDirector, placeScenario } from "./directors";
import type { MajorTom } from "./network";
import type { EpisodeRecord } from "./scoring";
import { ScriptState, type Script } from "./scripts";
import type { SensorPrimitive } from "./sensors";

/** Where a replay stands, for a HUD. */
export interface ReplayStatus {
  /** `episode` for training arenas, `flight` for exam races. */
  kind: "episode" | "flight";
  /** Current episode (0-based); always 0 for a flight. */
  index: number;
  count: number;
  /** Targets (or race checkpoints) reached in the current episode or flight, out of `total`. */
  reached: number;
  total: number;
  crashes: number;
  /** Game seconds since the current episode or flight started. */
  seconds: number;
  done: boolean;
}

/**
 * A flight re-simulated frame by frame, exactly as it was measured. Draw `server.world`; call
 * `step()` to advance. Seeking means creating a new replay and stepping it forward (fast: the
 * simulation runs far faster than real time).
 */
export interface Replay {
  readonly server: GameServer;
  /** Frames stepped so far. */
  readonly frame: number;
  readonly done: boolean;
  /** The flying ship as the server sees it. */
  readonly ship: Movable | undefined;
  /** What the ship flies to now. */
  readonly target: Entity | undefined;
  status(): ReplayStatus;
  /** What the model's obstacle sensors see now, in world coordinates (empty without sensors). */
  sensors?(): SensorPrimitive[];
  /** Advances up to `frames` frames (stops early when done). */
  step(frames?: number): void;
  dispose(): void;
}

/** Hosts the one bot of a replay. */
export class ReplayDirector extends AIDirector {
  constructor(options: LocalConnectionOptions) {
    super({ delivery: "sync", ...options });
  }
  start(): void {}
}

/** Starts `script` in `director` and waits (microtasks only) until its bot is connected. */
export async function startScript(
  director: AIDirector,
  script: Script,
): Promise<{ running: Promise<void>; proxy: IClientProxy }> {
  const running = director.runScript(script);
  for (let i = 0; i < 100 && script.state === ScriptState.READY; i++) await Promise.resolve();
  const ship = script.client?.ship;
  const proxy = [...(director.server?.clients ?? [])].find((c) => c.movable?.id === ship?.id);
  if (!ship || !proxy) throw new Error("the replay bot could not connect");
  return { running, proxy };
}

export interface ArenaReplayOptions {
  model: MajorTom;
  /** From the run's config. */
  arenas: readonly ArenaConfig[];
  /** The config's `frames` (default `frames` param of every arena). */
  frames: number;
  collisions: CollisionMode;
  crashMode: CrashMode;
  /** The run's seed (scenario seeds derive from it). */
  seed: number;
  /** Generation whose scenarios to fly (1-based). */
  g: number;
  /** Which arena of the config (default 0). */
  arenaIndex?: number;
}

/**
 * One model flying one arena's scenario of generation `g`, set up exactly like a training
 * generation: the training server settings, the scenario from the same seed, the same script.
 */
export class ArenaReplay implements Replay {
  frame = 0;

  private constructor(
    readonly server: GameServer,
    readonly script: ArenaScript,
    private readonly proxy: IClientProxy,
    private readonly running: Promise<void>,
  ) {}

  static async create(o: ArenaReplayOptions): Promise<ArenaReplay> {
    const runs = resolveArenas(o.arenas, o.frames);
    const scenario = trainingScenarios(runs, o.seed, o.g)[o.arenaIndex ?? 0];
    if (!scenario) throw new Error(`the config has no arena ${o.arenaIndex}`);
    // Same settings as createTrainingServer; its seed only decides spawn points, which the arena
    // script overrides at once.
    const server = new GameServer({
      random: seededRandom(1),
      entityUpdatesPerTick: 0,
      sendOwnShipEveryTick: true,
    });
    const director = new ReplayDirector({ collisions: o.collisions, autoRespawn: false });
    server.registerService(director);
    await server.start();
    const placed = placeScenario(server, scenario);
    const script = new ArenaScript(o.model, placed.episodes, o.crashMode, server.tickSeconds);
    const { running, proxy } = await startScript(director, script);
    return new ArenaReplay(server, script, proxy, running);
  }

  get done(): boolean {
    return this.script.state === ScriptState.ENDED;
  }

  get ship(): Movable | undefined {
    return this.proxy.movable;
  }

  get target(): Entity | undefined {
    return this.script.currentTarget;
  }

  /** Finished episodes, plus the one being flown. */
  get records(): readonly EpisodeRecord[] {
    const current = this.script.currentRecord;
    return current ? [...this.script.records, current] : this.script.records;
  }

  status(): ReplayStatus {
    const record = this.script.currentRecord ?? this.script.records.at(-1);
    return {
      kind: "episode",
      index: Math.min(this.script.episodeIndex, this.script.episodes.length - 1),
      count: this.script.episodes.length,
      reached: record?.reached ?? 0,
      total: record?.targets ?? 0,
      crashes: record?.crashes ?? 0,
      seconds: (record?.frames ?? 0) * this.server.tickSeconds,
      done: this.done,
    };
  }

  sensors(): SensorPrimitive[] {
    return this.script.vehicleController?.sensorPrimitives() ?? [];
  }

  step(frames = 1): void {
    for (let i = 0; i < frames && !this.done; i++) {
      this.server.tick();
      this.frame++;
    }
  }

  /** Steps until episode `index` starts (or the replay ends). */
  skipToEpisode(index: number): void {
    while (!this.done && this.script.episodeIndex < index) this.step();
  }

  dispose(): void {
    this.script.stop();
    void this.running;
    this.server.stop();
  }
}

/**
 * What a viewer can watch: a list of segments (training episodes or exam flights), each opened as
 * a fresh replay. For a training arena all episodes run in one replay, so `open(i)` may return a
 * replay stepped to the start of episode i that later moves on to i + 1 by itself.
 */
export interface ReplaySource {
  /** One label per segment, e.g. "point-to-point · episode 3". */
  readonly segments: readonly string[];
  /** A replay positioned at the start of segment `index`. */
  open(index: number): Promise<Replay>;
  /** Length of segment `index` in frames (its time limit), for a time slider. */
  segmentFrames(index: number): number;
  /** Which segment `replay` is in now. */
  segmentOf?(replay: Replay): number;
}

/** Every episode of every arena of generation `g`, one segment each. */
export function arenaReplaySource(o: Omit<ArenaReplayOptions, "arenaIndex">): ReplaySource {
  const runs = resolveArenas(o.arenas, o.frames);
  const scenarios = trainingScenarios(runs, o.seed, o.g);
  const segments: { arena: number; episode: number; label: string; frames: number }[] = [];
  scenarios.forEach((scenario, arena) =>
    scenario.episodes.forEach((spec, episode) =>
      segments.push({
        arena,
        episode,
        label: `${runs[arena]!.arena.name} · episode ${episode + 1}/${scenario.episodes.length}`,
        frames: spec.timeLimitFrames + 1,
      }),
    ),
  );
  const offsets = scenarios.map((_, arena) => segments.findIndex((s) => s.arena === arena));
  const arenaOf = new WeakMap<Replay, number>();
  return {
    segments: segments.map((s) => s.label),
    async open(index) {
      const segment = segments[index];
      if (!segment) throw new Error(`no episode ${index}`);
      const replay = await ArenaReplay.create({ ...o, arenaIndex: segment.arena });
      replay.skipToEpisode(segment.episode);
      arenaOf.set(replay, segment.arena);
      return replay;
    },
    segmentFrames: (index) => segments[index]?.frames ?? 0,
    segmentOf(replay) {
      const arena = arenaOf.get(replay) ?? 0;
      return (offsets[arena] ?? 0) + replay.status().index;
    },
  };
}

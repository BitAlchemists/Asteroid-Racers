import type { Entity, Movable } from "@ar/shared";
import type { IClientProxy } from "../contracts";
import { GameServer } from "../game-server";
import { seededRandom } from "../random";
import { trackByName } from "../tracks";
import { deriveSeed } from "./arenas";
import { AIDirector } from "./directors";
import type { MajorTom } from "./network";
import { startScript, type Replay, type ReplaySource, type ReplayStatus } from "./replay";
import { RaceTargetScript } from "./scripts";
import type { SensorPrimitive } from "./sensors";
import { addPathPoint, PATH_EVERY } from "./trace";

/** Weights of the exam score (lower is better). */
export interface ExamWeights {
  /** Per checkpoint missed (the finish counts as a checkpoint). */
  checkpoint: number;
  /** Per second of game time used. */
  second: number;
  /** Per unit of distance left to the next checkpoint when time ran out. */
  distance: number;
}

export interface ExamConfig {
  /** Tracks flown once each (with a seed derived from the exam seed). */
  tracks: string[];
  /** Seeds of the `random` track flown in addition. */
  randomTracks: number;
  /** Game-time limit per flight. */
  timeLimitSeconds: number;
  weights: ExamWeights;
  /** Decides the asteroids and random tracks. Keep it fixed so every model flies the same exam. */
  seed: number;
}

export const DEFAULT_EXAM: Readonly<ExamConfig> = Object.freeze({
  tracks: ["demo", "short"],
  randomTracks: 5,
  timeLimitSeconds: 180,
  weights: Object.freeze({ checkpoint: 1000, second: 1, distance: 0.01 }),
  seed: 1,
});

export interface FlightResult {
  track: string;
  seed: number;
  /** Checkpoints touched, the finish included. */
  checkpoints: number;
  totalCheckpoints: number;
  finished: boolean;
  /** Game seconds flown: the finish time, or the time limit. */
  seconds: number;
  crashes: number;
  /** Distance to the next checkpoint at the end (0 when finished). */
  distanceLeft: number;
  score: number;
}

/** One exam flight as drawn in a thumbnail. */
export interface FlightTrace {
  track: string;
  seed: number;
  /** [x, y, radius] per race checkpoint: the portal first, the finish last. */
  checkpoints: [number, number, number][];
  /** Flat [x0, y0, x1, y1, …], a point every {@link EXAM_PATH_EVERY} frames. */
  path: number[];
  reached: number;
  finished: boolean;
  crashes: number;
}

/** Exam flights are long (up to 3 minutes): a path point every 20 frames (0.3 s). */
export const EXAM_PATH_EVERY = 2 * PATH_EVERY;

export interface ExamResult {
  flights: FlightResult[];
  /** Paths of the flights, for drawing (kept out of result files). */
  traces: FlightTrace[];
  /** Sum of the flights' scores. */
  score: number;
  /** Share of all checkpoints reached (0..1). */
  checkpoints: number;
  /** Share of flights that reached the finish (0..1). */
  finished: number;
  crashes: number;
}

/** Hosts the one racing bot of an exam flight. */
class ExamDirector extends AIDirector {
  constructor() {
    super({ delivery: "sync" });
  }
  start(): void {}
}

export function flightScore(f: Omit<FlightResult, "score">, w: ExamWeights): number {
  return (
    w.checkpoint * (f.totalCheckpoints - f.checkpoints) + w.second * f.seconds + w.distance * f.distanceLeft
  );
}

/**
 * One model, one track, the game's own rules: crashes into asteroids, respawn after 1 s at the last
 * checkpoint touched, the real racing bot (with no start delay). The ship starts on the race portal
 * and so joins the race at once. Ends at the finish or the time limit. As a {@link Replay} it can be
 * stepped frame by frame for watching; {@link examFlight} runs it to the end.
 */
export class ExamReplay implements Replay {
  frame = 0;
  crashes = 0;
  finishedAt: number | undefined;
  /** The ship's path (flat [x, y, …], a point every EXAM_PATH_EVERY frames and the last position). */
  readonly path: number[] = [];
  readonly maxFrames: number;

  private constructor(
    readonly server: GameServer,
    readonly track: string,
    readonly seed: number,
    readonly script: RaceTargetScript,
    private readonly proxy: IClientProxy,
    private readonly running: Promise<void>,
    timeLimitSeconds: number,
  ) {
    this.maxFrames = Math.round(timeLimitSeconds / server.tickSeconds);
  }

  static async create(
    model: MajorTom,
    trackName: string,
    seed: number,
    timeLimitSeconds: number,
  ): Promise<ExamReplay> {
    const server = new GameServer({ random: seededRandom(seed) }).loadTrack(trackByName(trackName));
    const race = server.raceController!;
    const director = new ExamDirector();
    server.registerService(director);
    await server.start();

    const script = new RaceTargetScript(model, 0, model.name);
    const { running, proxy } = await startScript(director, script);
    const replay = new ExamReplay(server, trackName, seed, script, proxy, running, timeLimitSeconds);
    script.client!.onCrash = () => replay.crashes++;
    race.onCheckpoint = (racer: IClientProxy, index: number) => {
      if (racer === proxy && index === race.checkpoints.length - 1) replay.finishedAt ??= server.gameTime;
    };
    server.teleportPlayerTo(proxy, race.start!.position, race.start!.orientation);
    return replay;
  }

  get done(): boolean {
    return this.finishedAt !== undefined || this.frame >= this.maxFrames;
  }

  get ship(): Movable | undefined {
    return this.proxy.movable;
  }

  get start(): { x: number; y: number } | undefined {
    const portal = this.server.raceController?.start;
    return portal && { x: portal.position.x, y: portal.position.y };
  }

  /** The next race checkpoint (the finish last). */
  get target(): Entity | undefined {
    const race = this.server.raceController!;
    return race.checkpoints[(race.progressOf(this.proxy) ?? 0) + 1];
  }

  /** Checkpoints touched so far, the finish included. */
  get reached(): number {
    const race = this.server.raceController!;
    return this.finishedAt !== undefined ? race.checkpoints.length - 1 : (race.progressOf(this.proxy) ?? 0);
  }

  status(): ReplayStatus {
    return {
      kind: "flight",
      index: 0,
      count: 1,
      reached: this.reached,
      total: this.server.raceController!.checkpoints.length - 1, // checkpoint 0 is the portal
      crashes: this.crashes,
      seconds: this.frame * this.server.tickSeconds,
      done: this.done,
    };
  }

  sensors(): SensorPrimitive[] {
    return this.script.vehicleController?.sensorPrimitives() ?? [];
  }

  step(frames = 1): void {
    for (let i = 0; i < frames && !this.done; i++) {
      const ship = this.proxy.movable;
      if (ship && this.frame % EXAM_PATH_EVERY === 0)
        addPathPoint(this.path, ship.position.x, ship.position.y);
      this.server.tick();
      this.frame++;
    }
  }

  trace(): FlightTrace {
    const ship = this.proxy.movable;
    const path = [...this.path];
    if (ship) addPathPoint(path, ship.position.x, ship.position.y);
    const round = (v: number) => Math.round(v * 10) / 10;
    return {
      track: this.track,
      seed: this.seed,
      checkpoints: this.server.raceController!.checkpoints.map((c) => [
        round(c.position.x),
        round(c.position.y),
        round(c.radius),
      ]),
      path,
      reached: this.reached,
      finished: this.finishedAt !== undefined,
      crashes: this.crashes,
    };
  }

  result(weights: ExamWeights): FlightResult {
    const race = this.server.raceController!;
    const totalCheckpoints = race.checkpoints.length - 1;
    const finished = this.finishedAt !== undefined;
    const reached = this.reached;
    const next = race.checkpoints[reached + 1];
    const movable = this.proxy.movable;
    const result: Omit<FlightResult, "score"> = {
      track: this.track,
      seed: this.seed,
      checkpoints: reached,
      totalCheckpoints,
      finished,
      seconds: finished
        ? this.finishedAt! + this.server.tickSeconds
        : this.maxFrames * this.server.tickSeconds,
      crashes: this.crashes,
      distanceLeft: finished || !next || !movable ? 0 : movable.position.distanceTo(next.position),
    };
    return { ...result, score: flightScore(result, weights) };
  }

  dispose(): void {
    this.script.stop();
    void this.running;
    this.server.stop();
  }
}

/** Flies one exam flight to the end and returns its result. */
export async function examFlight(
  model: MajorTom,
  trackName: string,
  seed: number,
  timeLimitSeconds: number,
  weights: ExamWeights,
): Promise<FlightResult> {
  return (await examFlightWithTrace(model, trackName, seed, timeLimitSeconds, weights)).result;
}

async function examFlightWithTrace(
  model: MajorTom,
  trackName: string,
  seed: number,
  timeLimitSeconds: number,
  weights: ExamWeights,
): Promise<{ result: FlightResult; trace: FlightTrace }> {
  const replay = await ExamReplay.create(model, trackName, seed, timeLimitSeconds);
  while (!replay.done) replay.step();
  const out = { result: replay.result(weights), trace: replay.trace() };
  replay.dispose();
  return out;
}

/** The flights of an exam: each named track once, then `randomTracks` random tracks. */
export function examFlights(config: ExamConfig): { track: string; seed: number }[] {
  return [
    ...config.tracks.map((track, i) => ({ track, seed: deriveSeed(config.seed, 1, i) })),
    ...Array.from({ length: config.randomTracks }, (_, k) => ({
      track: "random",
      seed: deriveSeed(config.seed, 2, k),
    })),
  ];
}

export async function runExam(model: MajorTom, config: ExamConfig = DEFAULT_EXAM): Promise<ExamResult> {
  const flights: FlightResult[] = [];
  const traces: FlightTrace[] = [];
  for (const { track, seed } of examFlights(config)) {
    const flight = await examFlightWithTrace(model, track, seed, config.timeLimitSeconds, config.weights);
    flights.push(flight.result);
    traces.push(flight.trace);
  }
  const total = flights.reduce((n, f) => n + f.totalCheckpoints, 0);
  return {
    flights,
    traces,
    score: flights.reduce((s, f) => s + f.score, 0),
    checkpoints: total === 0 ? 0 : flights.reduce((n, f) => n + f.checkpoints, 0) / total,
    finished: flights.length === 0 ? 0 : flights.filter((f) => f.finished).length / flights.length,
    crashes: flights.reduce((n, f) => n + f.crashes, 0),
  };
}

export function parseExamConfig(raw: unknown): ExamConfig {
  const r = (raw ?? {}) as Partial<Record<keyof ExamConfig, unknown>>;
  if (typeof r !== "object") throw new Error("exam config must be an object");
  const config: ExamConfig = {
    tracks: (r.tracks as string[] | undefined) ?? [...DEFAULT_EXAM.tracks],
    randomTracks: (r.randomTracks as number | undefined) ?? DEFAULT_EXAM.randomTracks,
    timeLimitSeconds: (r.timeLimitSeconds as number | undefined) ?? DEFAULT_EXAM.timeLimitSeconds,
    weights: { ...DEFAULT_EXAM.weights, ...(r.weights as Partial<ExamWeights> | undefined) },
    seed: (r.seed as number | undefined) ?? DEFAULT_EXAM.seed,
  };
  if (!Array.isArray(config.tracks) || !config.tracks.every((t) => typeof t === "string"))
    throw new Error("exam.tracks must be a list of track names");
  config.tracks.forEach(trackByName);
  if (!Number.isInteger(config.randomTracks) || config.randomTracks < 0)
    throw new Error("exam.randomTracks must be an integer ≥ 0");
  if (config.tracks.length + config.randomTracks === 0) throw new Error("the exam has no flights");
  if (!(config.timeLimitSeconds > 0)) throw new Error("exam.timeLimitSeconds must be > 0");
  for (const [k, v] of Object.entries(config.weights))
    if (!(k in DEFAULT_EXAM.weights) || typeof v !== "number" || !(v >= 0))
      throw new Error(`exam.weights.${k} must be a known weight ≥ 0`);
  if (!Number.isInteger(config.seed) || config.seed < 0) throw new Error("exam.seed must be an integer ≥ 0");
  return config;
}

/** The flights of an exam as replay segments (one ExamReplay each). */
export function examReplaySource(
  model: MajorTom,
  flights: readonly { track: string; seed: number }[],
  timeLimitSeconds: number,
  tickSeconds = 0.015,
): ReplaySource {
  let random = 0;
  return {
    segments: flights.map((f) => (f.track === "random" ? `random #${++random}` : f.track)),
    open(index) {
      const flight = flights[index];
      if (!flight) throw new Error(`no flight ${index}`);
      return ExamReplay.create(model, flight.track, flight.seed, timeLimitSeconds);
    },
    segmentFrames: () => Math.round(timeLimitSeconds / tickSeconds),
  };
}

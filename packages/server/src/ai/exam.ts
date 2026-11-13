import type { IClientProxy } from "../contracts";
import { GameServer } from "../game-server";
import { seededRandom } from "../random";
import { trackByName } from "../tracks";
import { deriveSeed } from "./arenas";
import { AIDirector } from "./directors";
import type { MajorTom } from "./network";
import { RaceTargetScript, ScriptState } from "./scripts";

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

export interface ExamResult {
  flights: FlightResult[];
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
 * and so joins the race at once. Ends at the finish or the time limit.
 */
export async function examFlight(
  model: MajorTom,
  trackName: string,
  seed: number,
  timeLimitSeconds: number,
  weights: ExamWeights,
): Promise<FlightResult> {
  const server = new GameServer({ random: seededRandom(seed) }).loadTrack(trackByName(trackName));
  const race = server.raceController!;
  const director = new ExamDirector();
  server.registerService(director);
  await server.start();

  const script = new RaceTargetScript(model, 0, model.name);
  const running = director.runScript(script);
  for (let i = 0; i < 100 && script.state === ScriptState.READY; i++) await Promise.resolve();
  const client = script.client;
  const ship = client?.ship;
  const proxy = [...server.clients].find((c) => c.movable?.id === ship?.id);
  if (!client || !ship || !proxy) throw new Error("the exam bot could not connect");

  let crashes = 0;
  let finishedAt: number | undefined;
  client.onCrash = () => crashes++;
  race.onCheckpoint = (racer: IClientProxy, index: number) => {
    if (racer === proxy && index === race.checkpoints.length - 1) finishedAt ??= server.gameTime;
  };
  server.teleportPlayerTo(proxy, race.start!.position, race.start!.orientation);

  const maxFrames = Math.round(timeLimitSeconds / server.tickSeconds);
  for (let frame = 0; frame < maxFrames && finishedAt === undefined; frame++) server.tick();

  const totalCheckpoints = race.checkpoints.length - 1; // checkpoint 0 is the portal
  const finished = finishedAt !== undefined;
  const reached = finished ? totalCheckpoints : (race.progressOf(proxy) ?? 0);
  const next = race.checkpoints[reached + 1];
  const movable = proxy.movable;
  const result: Omit<FlightResult, "score"> = {
    track: trackName,
    seed,
    checkpoints: reached,
    totalCheckpoints,
    finished,
    seconds: finished ? finishedAt! + server.tickSeconds : maxFrames * server.tickSeconds,
    crashes,
    distanceLeft: finished || !next || !movable ? 0 : movable.position.distanceTo(next.position),
  };

  script.stop();
  await running;
  server.stop();
  return { ...result, score: flightScore(result, weights) };
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
  for (const { track, seed } of examFlights(config))
    flights.push(await examFlight(model, track, seed, config.timeLimitSeconds, config.weights));
  const total = flights.reduce((n, f) => n + f.totalCheckpoints, 0);
  return {
    flights,
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

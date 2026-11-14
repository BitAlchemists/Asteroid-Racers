import type { CollisionMode } from "../contracts";
import { TRACKS } from "../tracks";
import type { CrashMode } from "../ai/arena-script";
import { DEFAULT_EXAM, ExamReplay, examFlights, examReplaySource, type FlightResult } from "../ai/exam";
import type { MajorTom } from "../ai/network";
import { ArenaReplay, arenaReplaySource, type Replay, type ReplaySource } from "../ai/replay";
import { DEFAULT_SKILLS, skillFlights } from "../ai/skills";

/**
 * The showcase's challenges (D1): every registered race track, the skills exam's arenas and exam v2,
 * each flown exactly like the exam and the skills exam fly them, so watching one in the replay viewer
 * and running it headless give the same flight.
 */
export type ChallengeKind = "track" | "skill" | "exam";

export interface Challenge {
  /** `track:<name>`, `skill:<Key>` or `exam:v2`. */
  id: string;
  kind: ChallengeKind;
  label: string;
  description: string;
  /** Races or episodes the challenge has. */
  segments: number;
  /** For the replay viewer. */
  source(model: MajorTom): ReplaySource;
}

/** A challenge's outcome: race checkpoints (tracks, exam) or arena targets (skills). */
export interface ChallengeResult {
  id: string;
  /** Checkpoints or targets reached, out of `total`. */
  reached: number;
  total: number;
  /** Races or episodes done, and how many of them reached their goal. */
  runs: number;
  completed: number;
  /** Game seconds: a race's finish time (or the time limit); summed over the runs otherwise. */
  seconds: number;
  crashes: number;
}

/** Time limit of a showcase race, as in the race exam. */
export const SHOWCASE_TIME_LIMIT = DEFAULT_EXAM.timeLimitSeconds;
/** Seed of the asteroid belts of every showcase track race (the watch page's default seed too). */
export const SHOWCASE_TRACK_SEED = 1;
/** Exam v2: the race exam of the M4/M6 training runs (demo, short and 100 random tracks). */
export const EXAM_V2 = Object.freeze({ ...DEFAULT_EXAM, randomTracks: 100 });
/** How the skills fly: the skills exam's scenarios with the M4 default run's physics settings. */
export const SKILL_SETUP: Readonly<{
  seed: number;
  frames: number;
  collisions: CollisionMode;
  crashMode: CrashMode;
}> = Object.freeze({ seed: DEFAULT_EXAM.seed, frames: 600, collisions: "obstacles", crashMode: "respawn" });

function trackChallenge(name: string, description: string): Challenge {
  return {
    id: `track:${name}`,
    kind: "track",
    label: name,
    description,
    segments: 1,
    source: (model) =>
      examReplaySource(model, [{ track: name, seed: SHOWCASE_TRACK_SEED }], SHOWCASE_TIME_LIMIT),
  };
}

const SKILL_LABELS: Readonly<Record<string, string>> = {
  Stop: "stop",
  TurnAndGo: "turn-and-go",
  Chain: "chain",
  Corridor: "corridor",
  Field: "field",
  RaceLegs: "race-legs",
  Rock1: "rock-in-line (1 rock)",
  Rock2: "rock-in-line (2 rocks)",
  Field80: "point-to-point, 80 rocks",
};

/** Every challenge, in showing order: tracks, then skills, then exam v2. */
export function showcaseChallenges(): Challenge[] {
  const tracks = Object.values(TRACKS)
    .filter((t) => t.name !== "random")
    .map((t) => trackChallenge(t.name, t.description));
  const skills = skillFlights(DEFAULT_SKILLS, SKILL_SETUP.seed).map(({ skill, arena, seed }): Challenge => ({
    id: `skill:${skill.key}`,
    kind: "skill",
    label: SKILL_LABELS[skill.key] ?? skill.key,
    description: `Training arena ${arena.name}, the skills exam's ${DEFAULT_SKILLS.episodes} fixed episodes`,
    segments: DEFAULT_SKILLS.episodes,
    source: (model) => arenaReplaySource({ model, arenas: [arena], ...SKILL_SETUP, seed, g: 1 }),
  }));
  const flights = examFlights(EXAM_V2);
  const exam: Challenge = {
    id: "exam:v2",
    kind: "exam",
    label: "exam v2 (102 races)",
    description: "The training runs' race exam: demo, short and 100 random tracks, 180 s each",
    segments: flights.length,
    source: (model) => examReplaySource(model, flights, EXAM_V2.timeLimitSeconds),
  };
  return [...tracks, ...skills, exam];
}

function addFlight(into: ChallengeResult, f: FlightResult): void {
  into.reached += f.checkpoints;
  into.total += f.totalCheckpoints;
  into.runs++;
  if (f.finished) into.completed++;
  into.seconds += f.seconds;
  into.crashes += f.crashes;
}

function empty(id: string): ChallengeResult {
  return { id, reached: 0, total: 0, runs: 0, completed: 0, seconds: 0, crashes: 0 };
}

/** The result of a finished (or partly flown) replay of one race or one arena run. */
export function replayResult(id: string, replay: Replay): ChallengeResult {
  const out = empty(id);
  if (replay instanceof ExamReplay) addFlight(out, replay.result(DEFAULT_EXAM.weights));
  else if (replay instanceof ArenaReplay)
    for (const r of replay.records) {
      out.reached += r.reached;
      out.total += r.targets;
      out.runs++;
      if (r.reached >= r.targets) out.completed++;
      out.seconds += r.frames * replay.server.tickSeconds;
      out.crashes += r.crashes;
    }
  return out;
}

/** Adds `b` into `a` (for challenges made of several races). */
export function mergeResults(a: ChallengeResult, b: ChallengeResult): ChallengeResult {
  return {
    id: a.id,
    reached: a.reached + b.reached,
    total: a.total + b.total,
    runs: a.runs + b.runs,
    completed: a.completed + b.completed,
    seconds: a.seconds + b.seconds,
    crashes: a.crashes + b.crashes,
  };
}

/**
 * Flies `model` through `challenge` headless, to the end, and returns its result: the same
 * replays the viewer shows, stepped without drawing. `onSegment` is called after each race.
 */
export async function runChallenge(
  model: MajorTom,
  challenge: Challenge,
  onSegment?: (done: number) => void | Promise<void>,
): Promise<ChallengeResult> {
  const source = challenge.source(model);
  let total = empty(challenge.id);
  if (challenge.kind === "skill") {
    // One replay flies all episodes of an arena.
    const replay = await source.open(0);
    try {
      while (!replay.done) replay.step(1000);
      total = replayResult(challenge.id, replay);
    } finally {
      replay.dispose();
    }
    await onSegment?.(challenge.segments);
    return total;
  }
  for (let i = 0; i < source.segments.length; i++) {
    const replay = await source.open(i);
    try {
      while (!replay.done) replay.step(1000);
      total = mergeResults(total, replayResult(challenge.id, replay));
    } finally {
      replay.dispose();
    }
    await onSegment?.(i + 1);
  }
  return total;
}

/** One line of a results table, e.g. `12/12 · finished 1/1 · 63.4 s · 2 crashes`. */
export function formatResult(r: ChallengeResult, kind: ChallengeKind): string {
  const what = kind === "skill" ? "targets" : "checkpoints";
  const share = r.total === 0 ? 0 : Math.round((100 * r.reached) / r.total);
  const done = kind === "skill" ? "episodes cleared" : "finished";
  const time = kind === "track" ? ` · ${r.seconds.toFixed(1)} s` : "";
  return `${what} ${r.reached}/${r.total} (${share} %) · ${done} ${r.completed}/${r.runs}${time} · ${r.crashes} crash${r.crashes === 1 ? "" : "es"}`;
}

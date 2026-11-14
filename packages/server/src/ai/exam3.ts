import { GameServer } from "../game-server";
import type { RaceRules } from "../race-controller";
import { seededRandom } from "../random";
import { withRaceRules } from "../race-modes";
import { generatedTrack, generateTrack, type GeneratedTrack, type TrackBand } from "../track-generator";
import { trackByName, type Track } from "../tracks";
import { deriveSeed } from "./arenas";
import { DEFAULT_EXAM, examFlight, type FlightResult } from "./exam";
import type { MajorTom } from "./network";
import { runSkills, type SkillResult } from "./skills";

/**
 * Exam v3 (M7 S4): a fixed benchmark of races that look like the races we want the AI to win, with
 * one pre-registered primary score `exam3` (0–100, higher is better) that doesn't saturate, and a
 * profile per difficulty band, goal type and skill. Everything is fixed in {@link EXAM3}: the track
 * list, the seeds, the par times, the weights. A change to any of it is a new version (and a new
 * score name), so scores stay comparable. Exam v2 (exam.ts) is unchanged and keeps running next to it.
 *
 * Score:
 * - per race: v = 0.6 × progress + 0.2 × goal met + 0.2 × min(1, par ÷ time), the time factor only
 *   when finished (progress = checkpoints reached ÷ checkpoints over all laps; goal met = finished
 *   under the race's rules);
 * - per category: the mean of v over its races; skills: mean success over the skill arenas − 0.05 ×
 *   mean crashes per episode, clamped to [0, 1];
 * - exam3 = 100 × the weighted mean of the categories.
 * Crashes are not in the score: `exam3Crashes` (crashes per race) is a separate veto metric.
 */

export type Exam3Category = "easy" | "medium" | "hard" | "handmade" | "goals";
export type Exam3Goal = "race" | "stop" | "gates" | "laps";
export const EXAM3_CATEGORIES: readonly (Exam3Category | "skills")[] = [
  "easy",
  "medium",
  "hard",
  "handmade",
  "goals",
  "skills",
];

export interface Exam3Definition {
  /** Version tag; part of every result. */
  version: string;
  /** World seeds of the flights and the skill scenarios derive from it. */
  seed: number;
  timeLimitSeconds: number;
  /** Race value weights: progress, goal met, time factor. */
  race: { progress: number; goal: number; time: number };
  /** Skills category: success − this × crashes per episode. */
  skillCrashPenalty: number;
  /** Episodes per skill arena. */
  skillEpisodes: number;
  /** Category weights (sum 1). */
  weights: Readonly<Record<Exam3Category | "skills", number>>;
  /** Generated-track seeds per band. */
  generated: Readonly<Record<TrackBand, readonly number[]>>;
  /** Hand-made tracks without a goal (their par from the file, or {@link handmadePar}). */
  handmade: readonly string[];
  /** Par (s) of hand-made tracks whose file has none (the v1 tracks). */
  handmadePar: Readonly<Record<string, number>>;
  /** Hand-made goal tracks (their goals and par from the file). */
  goalTracks: readonly { track: string; goal: Exam3Goal }[];
  /** Generated goal races: band, seeds and the rules put on the track. */
  goalRaces: readonly { goal: Exam3Goal; band: TrackBand; seeds: readonly number[]; rules: RaceRules }[];
  /** Par of a generated track: its centre-line length ÷ this speed (units/s), rounded up. */
  parSpeed: number;
}

const range = (from: number, count: number) =>
  Object.freeze(Array.from({ length: count }, (_, i) => from + i));

/** Exam v3.0, frozen 2026-11-14 after the one calibration (doc/experiments.md, "Exam v3"). */
export const EXAM3: Readonly<Exam3Definition> = Object.freeze({
  version: "3.0",
  seed: 3,
  timeLimitSeconds: 180,
  race: Object.freeze({ progress: 0.6, goal: 0.2, time: 0.2 }),
  skillCrashPenalty: 0.05,
  skillEpisodes: 8,
  weights: Object.freeze({ easy: 0.1, medium: 0.2, hard: 0.25, handmade: 0.2, goals: 0.15, skills: 0.1 }),
  generated: Object.freeze({
    easy: range(300_001, 20),
    medium: range(310_001, 20),
    hard: range(320_001, 20),
  }),
  handmade: Object.freeze([
    "slalom",
    "gauntlet",
    "canyon",
    "hairpins",
    "straight-to-turn",
    "dense-belt",
    "chicane",
  ]),
  // S3's rule: the fastest finish of the scripted controller, train-327 (luke.txt) and train-501 g150,
  // × 1.2, rounded up (measured in this exam's flights).
  handmadePar: Object.freeze({ slalom: 50, gauntlet: 40, canyon: 19 }),
  goalTracks: Object.freeze([
    { track: "gate-row", goal: "gates" },
    { track: "pit-stop", goal: "stop" },
    { track: "circuit", goal: "laps" },
  ] as const),
  // Generated lap races are left out: generated tracks are open, so lap 2's way back from the finish
  // to the first checkpoint isn't validated (it may cross walls). The circuit is the lap race.
  goalRaces: Object.freeze([
    { goal: "stop", band: "easy", seeds: range(330_001, 5), rules: Object.freeze({ finishMaxSpeed: 100 }) },
    { goal: "gates", band: "easy", seeds: range(340_001, 5), rules: Object.freeze({ gates: true }) },
  ] as const),
  // The scripted controller's median clean easy finish: length ÷ (1.2 × time) ≈ 248 units/s.
  parSpeed: 250,
});

/** One race of exam v3. */
export interface Exam3Race {
  /** Unique within the exam, e.g. `hard/generated:hard:320001` or `goals/stop/generated:easy:330001`. */
  id: string;
  category: Exam3Category;
  goal: Exam3Goal;
  /** The track flown (with the goal's rules on top for generated goal races). */
  track: Track;
  /** World seed of the flight. */
  seed: number;
  /** Par time in seconds. */
  par: number;
}

/** Length of a generated track's centre line, start to finish. */
export function generatedLength(track: GeneratedTrack): number {
  let length = 0;
  for (const leg of track.legs)
    for (let i = 1; i < leg.path.length; i++)
      length += Math.hypot(leg.path[i]!.x - leg.path[i - 1]!.x, leg.path[i]!.y - leg.path[i - 1]!.y);
  return length;
}

/** Par of the generated track `(seed, band)` under `def`. */
export function generatedPar(band: TrackBand, seed: number, def: Exam3Definition = EXAM3): number {
  return Math.ceil(generatedLength(generateTrack(seed, band)) / def.parSpeed);
}

/** Par (s) of a hand-made track: from its file, else from the exam's table. */
function handmadePar(name: string, def: Exam3Definition): number {
  const par = parOfTrack(trackByName(name)) ?? def.handmadePar[name];
  if (par === undefined) throw new Error(`exam v3: hand-made track ${name} has no par`);
  return par;
}

const FILE_PARS = new Map<string, number | undefined>();

/** A file track's own par: built once into a scratch server to read its race rules. */
function parOfTrack(track: Track): number | undefined {
  if (!FILE_PARS.has(track.name))
    FILE_PARS.set(
      track.name,
      new GameServer({ random: seededRandom(0) }).loadTrack(track).raceController!.rules.par,
    );
  return FILE_PARS.get(track.name);
}

/**
 * The races of exam v3 in order: easy, medium, hard (generated), hand-made, goal races (hand-made
 * goal tracks, then generated goal races). Every flight's world seed derives from the exam seed and
 * the race's index.
 */
export function exam3Races(def: Exam3Definition = EXAM3): Exam3Race[] {
  const races: Omit<Exam3Race, "seed">[] = [];
  for (const band of ["easy", "medium", "hard"] as const)
    for (const seed of def.generated[band]) {
      const track = generatedTrack(band, seed);
      races.push({
        id: `${band}/${track.name}`,
        category: band,
        goal: "race",
        track,
        par: generatedPar(band, seed, def),
      });
    }
  for (const name of def.handmade)
    races.push({
      id: `handmade/${name}`,
      category: "handmade",
      goal: "race",
      track: trackByName(name),
      par: handmadePar(name, def),
    });
  for (const { track: name, goal } of def.goalTracks)
    races.push({
      id: `goals/${goal}/${name}`,
      category: "goals",
      goal,
      track: trackByName(name),
      par: handmadePar(name, def),
    });
  for (const { goal, band, seeds, rules } of def.goalRaces)
    for (const seed of seeds) {
      const base = generatedTrack(band, seed);
      const par = generatedPar(band, seed, def) * (rules.laps ?? 1);
      races.push({
        id: `goals/${goal}/${base.name}`,
        category: "goals",
        goal,
        track: withRaceRules(base, { ...rules, par }),
        par,
      });
    }
  return races.map((r, i) => ({ ...r, seed: deriveSeed(def.seed, EXAM3_STREAM, i) }));
}

/** Stream id of exam v3 flights (exam v2 uses 1 and 2, the skills 7). */
const EXAM3_STREAM = 31;

export interface Exam3Flight extends FlightResult {
  id: string;
  category: Exam3Category;
  goal: Exam3Goal;
  /** Par used by the score (s). */
  exam3Par: number;
  /** min(1, par ÷ time) when finished, else 0. */
  timeFactor: number;
  /** Race value 0..1. */
  value: number;
}

export interface Exam3Result {
  version: string;
  /** The primary score, 0..100. */
  score: number;
  /** Category values 0..100. */
  categories: Record<Exam3Category | "skills", number>;
  /** Mean race value per goal type, 0..100 (over all races of that type, any category). */
  goals: Record<Exam3Goal, number>;
  /** Crashes per race (all races; the veto metric). */
  crashes: number;
  /** Share of races finished. */
  finished: number;
  /** Mean time ÷ par over finished races (NaN when none finished). */
  timeVsPar: number;
  flights: Exam3Flight[];
  skills: SkillResult[];
  /** The skills category before clamping: mean success, mean crashes per episode. */
  skillSuccess: number;
  skillCrashes: number;
}

/** Race value of one flight: 0.6 × progress + 0.2 × goal met + 0.2 × time factor. */
export function raceValue(
  f: Pick<FlightResult, "checkpoints" | "totalCheckpoints" | "finished" | "seconds">,
  par: number,
  def: Exam3Definition = EXAM3,
): { value: number; timeFactor: number } {
  const progress = f.totalCheckpoints === 0 ? 0 : f.checkpoints / f.totalCheckpoints;
  const goal = f.finished ? 1 : 0;
  const timeFactor = f.finished ? Math.min(1, par / f.seconds) : 0;
  return {
    value: def.race.progress * progress + def.race.goal * goal + def.race.time * timeFactor,
    timeFactor,
  };
}

/** The skills category value (0..1) from the skill results. */
export function skillsValue(
  skills: readonly SkillResult[],
  def: Exam3Definition = EXAM3,
): { value: number; success: number; crashes: number } {
  const n = skills.length;
  const success = n === 0 ? 0 : skills.reduce((s, r) => s + r.success, 0) / n;
  const crashes = n === 0 ? 0 : skills.reduce((s, r) => s + r.crashesPerEpisode, 0) / n;
  return { value: Math.min(1, Math.max(0, success - def.skillCrashPenalty * crashes)), success, crashes };
}

const meanOf = (values: readonly number[]) =>
  values.length === 0 ? NaN : values.reduce((s, v) => s + v, 0) / values.length;

/** Scores flown races and skills under `def` (pure: the tool re-scores stored results with it). */
export function scoreExam3(
  flights: readonly Exam3Flight[],
  skills: readonly SkillResult[],
  def: Exam3Definition = EXAM3,
): Exam3Result {
  const sv = skillsValue(skills, def);
  const categories = {} as Record<Exam3Category | "skills", number>;
  for (const c of EXAM3_CATEGORIES)
    categories[c] =
      100 * (c === "skills" ? sv.value : meanOf(flights.filter((f) => f.category === c).map((f) => f.value)));
  let score = 0;
  let total = 0;
  for (const c of EXAM3_CATEGORIES) {
    const w = def.weights[c];
    if (w > 0 && !Number.isNaN(categories[c])) {
      score += w * categories[c];
      total += w;
    }
  }
  const goals = {} as Record<Exam3Goal, number>;
  for (const g of ["race", "stop", "gates", "laps"] as const)
    goals[g] = 100 * meanOf(flights.filter((f) => f.goal === g).map((f) => f.value));
  const finished = flights.filter((f) => f.finished);
  return {
    version: def.version,
    score: total === 0 ? 0 : score / total,
    categories,
    goals,
    crashes: flights.length === 0 ? 0 : flights.reduce((n, f) => n + f.crashes, 0) / flights.length,
    finished: flights.length === 0 ? 0 : finished.length / flights.length,
    timeVsPar: meanOf(finished.map((f) => f.seconds / f.exam3Par)),
    flights: [...flights],
    skills: [...skills],
    skillSuccess: sv.success,
    skillCrashes: sv.crashes,
  };
}

/** Flies one race of exam v3. */
export async function exam3Flight(
  model: MajorTom,
  race: Exam3Race,
  def: Exam3Definition = EXAM3,
): Promise<Exam3Flight> {
  const flight = await examFlight(model, race.track, race.seed, def.timeLimitSeconds, DEFAULT_EXAM.weights);
  const { value, timeFactor } = raceValue(flight, race.par, def);
  return {
    ...flight,
    track: race.track.name,
    id: race.id,
    category: race.category,
    goal: race.goal,
    exam3Par: race.par,
    timeFactor,
    value,
  };
}

/** The skills of exam v3: fixed scenarios with the M4 default physics (obstacles, respawn, 600 frames). */
export function exam3Skills(model: MajorTom, def: Exam3Definition = EXAM3): Promise<SkillResult[]> {
  return runSkills(
    model,
    { episodes: def.skillEpisodes },
    { seed: def.seed, frames: 600, collisions: "obstacles", crashMode: "respawn" },
  );
}

/** Flies exam v3: every race, then the skills. */
export async function runExam3(model: MajorTom, def: Exam3Definition = EXAM3): Promise<Exam3Result> {
  const flights: Exam3Flight[] = [];
  for (const race of exam3Races(def)) flights.push(await exam3Flight(model, race, def));
  return scoreExam3(flights, def.weights.skills > 0 ? await exam3Skills(model, def) : [], def);
}

const CATEGORY_METRIC: Record<Exam3Category | "skills", string> = {
  easy: "exam3Easy",
  medium: "exam3Medium",
  hard: "exam3Hard",
  handmade: "exam3Handmade",
  goals: "exam3Goals",
  skills: "exam3Skills",
};

/** Gen-event metrics of exam v3. `exam3TimeVsPar` is left out when no race was finished. */
export function exam3Metrics(result: Exam3Result): Record<string, number> {
  const out: Record<string, number> = { exam3: result.score };
  for (const c of EXAM3_CATEGORIES) out[CATEGORY_METRIC[c]] = result.categories[c];
  out.exam3Finished = result.finished;
  out.exam3Crashes = result.crashes;
  if (!Number.isNaN(result.timeVsPar)) out.exam3TimeVsPar = result.timeVsPar;
  return out;
}

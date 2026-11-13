import { deriveSeed, type ArenaConfig } from "./arenas";
import type { CollisionMode } from "../contracts";
import type { CrashMode } from "./arena-script";
import type { MajorTom } from "./network";
import { ArenaReplay } from "./replay";

/**
 * The skills exam (M6): next to the race exam, a model flies fixed scenarios of every training arena
 * on its own, so its skill profile shows what it can and cannot do (braking, turning around, chains,
 * corridors, fields, race legs, rocks in line). Every model meets exactly the same scenarios: they
 * are seeded from the exam seed only. Each arena flies on its own server (an ArenaReplay), so a
 * skills exam never touches training state.
 */
export interface SkillArena {
  /** Metric suffix: `skill<Key>` and `skill<Key>Crashes`. */
  key: string;
  arena: ArenaConfig;
}

/** The skills, in report order. Arena params are their defaults plus the episode count. */
export const SKILL_ARENAS: readonly SkillArena[] = Object.freeze([
  { key: "Stop", arena: { name: "stop", params: {} } },
  { key: "TurnAndGo", arena: { name: "turn-and-go", params: {} } },
  { key: "Chain", arena: { name: "chain", params: {} } },
  { key: "Corridor", arena: { name: "corridor", params: {} } },
  { key: "Field", arena: { name: "field", params: {} } },
  { key: "RaceLegs", arena: { name: "race-legs", params: {} } },
  { key: "Rock1", arena: { name: "rock-in-line", params: { rocks: 1 } } },
  { key: "Rock2", arena: { name: "rock-in-line", params: { rocks: 2 } } },
  { key: "Field80", arena: { name: "point-to-point", params: { asteroids: 80 } } },
]);

export interface SkillsConfig {
  /** Episodes per skill (default 8). */
  episodes: number;
}

export const DEFAULT_SKILLS: Readonly<SkillsConfig> = Object.freeze({ episodes: 8 });

/** The `skills` key of an exam config: `{}` or `{ episodes }`. */
export function parseSkillsConfig(raw: unknown): SkillsConfig {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    throw new Error("exam.skills must be an object ({ episodes? })");
  const { episodes = DEFAULT_SKILLS.episodes, ...rest } = raw as Record<string, unknown>;
  if (Object.keys(rest).length > 0)
    throw new Error(`unknown exam.skills keys ${Object.keys(rest).join(", ")}`);
  if (!Number.isInteger(episodes) || (episodes as number) < 1)
    throw new Error("exam.skills.episodes must be an integer ≥ 1");
  return { episodes: episodes as number };
}

/** How the skills are flown: the training run's physics settings. */
export interface SkillsSetup {
  /** The exam seed: every model of every run meets the same skill scenarios. */
  seed: number;
  /** Default `frames` param (frames per episode, or per target in chained arenas). */
  frames: number;
  collisions: CollisionMode;
  crashMode: CrashMode;
  crashLimit?: number;
}

export interface SkillResult {
  key: string;
  arena: string;
  episodes: number;
  targets: number;
  reached: number;
  /** Share of targets reached (0..1). */
  success: number;
  crashes: number;
  /** Crashes per episode. */
  crashesPerEpisode: number;
}

/** Stream id of skill scenarios (training is 1, held-out 2 in arenas.ts; the exam uses 1 and 2 too). */
const SKILLS_STREAM = 7;

/** The arena configs a skills exam flies, with their seeds (for replays). */
export function skillFlights(
  config: SkillsConfig,
  seed: number,
): { skill: SkillArena; arena: ArenaConfig; seed: number }[] {
  return SKILL_ARENAS.map((skill, i) => ({
    skill,
    arena: { name: skill.arena.name, params: { ...skill.arena.params, episodes: config.episodes } },
    seed: deriveSeed(seed, SKILLS_STREAM, i),
  }));
}

/** Flies `model` through every skill and returns one result per skill, in SKILL_ARENAS order. */
export async function runSkills(
  model: MajorTom,
  config: SkillsConfig,
  setup: SkillsSetup,
): Promise<SkillResult[]> {
  const results: SkillResult[] = [];
  for (const { skill, arena, seed } of skillFlights(config, setup.seed)) {
    const replay = await ArenaReplay.create({
      model,
      arenas: [arena],
      frames: setup.frames,
      collisions: setup.collisions,
      crashMode: setup.crashMode,
      ...(setup.crashLimit === undefined ? {} : { crashLimit: setup.crashLimit }),
      seed,
      g: 1,
    });
    try {
      while (!replay.done) replay.step(1000);
      const records = replay.records;
      const targets = records.reduce((n, r) => n + r.targets, 0);
      const reached = records.reduce((n, r) => n + r.reached, 0);
      const crashes = records.reduce((n, r) => n + r.crashes, 0);
      results.push({
        key: skill.key,
        arena: arena.name,
        episodes: records.length,
        targets,
        reached,
        success: targets === 0 ? 0 : reached / targets,
        crashes,
        crashesPerEpisode: records.length === 0 ? 0 : crashes / records.length,
      });
    } finally {
      replay.dispose();
    }
  }
  return results;
}

/** Gen-event metrics of a skills exam: `skill<Key>` and `skill<Key>Crashes`. */
export function skillMetrics(results: readonly SkillResult[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of results) {
    out[`skill${r.key}`] = r.success;
    out[`skill${r.key}Crashes`] = r.crashesPerEpisode;
  }
  return out;
}

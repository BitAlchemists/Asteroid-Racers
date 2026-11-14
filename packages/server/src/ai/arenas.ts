import { Vector2 } from "@ar/shared";
import { seededRandom, type Random } from "../random";
import { between, numberParam, rangeParam, type ArenaParams } from "./arena-params";
import { TIER_ARENAS } from "./tier-arenas";

/** One place the ship has to fly to. */
export interface TargetSpec {
  position: Vector2;
  radius: number;
  /** When set, the target counts only if the ship is at most this fast inside it ("stop here"). */
  maxSpeed?: number;
  /** Ship orientation when it respawns here (episodes with `respawn: "last-target"`; default: the start's). */
  orientation?: number;
  /**
   * Directional gate (M7): the target counts only when the ship's centre crosses the line through
   * `position`, across `orientation` (the game's radians, travel direction (−sin, cos)) and `width`
   * wide, in that direction — not when it is merely inside `radius`. With `maxSpeed` both apply.
   */
  gate?: { orientation: number; width: number };
}

/** One flight: the ship is placed at `start` and has `timeLimitFrames` to reach the targets in order. */
export interface EpisodeSpec {
  start: { position: Vector2; orientation: number; velocity?: Vector2 };
  targets: TargetSpec[];
  timeLimitFrames: number;
  /**
   * Where a crash respawns the ship (with `crashMode: "respawn"`): `"last-target"` = at the last target
   * reached, at rest, as in a race (the start until the first one). Absent = always at the start.
   */
  respawn?: "last-target";
  /**
   * Laps (M7, integer ≥ 1, default 1): the targets are flown this many times in order; the episode
   * has `targets.length × laps` targets. `maxSpeed` and `gate` apply on every pass.
   */
  laps?: number;
  /** Par time in frames (M7, time trials): copied to the episode's record for scoring. */
  parFrames?: number;
}

export interface ObstacleSpec {
  position: Vector2;
  radius: number;
}

/** Everything one candidate flies in one arena: obstacles stay for all episodes. */
export interface Scenario {
  obstacles: ObstacleSpec[];
  episodes: EpisodeSpec[];
}

export type { ArenaParams };
export { numberParam };

/**
 * A family of training scenarios. `generate` must use only `random` (no Math.random, no clock), so a
 * scenario is fully determined by its seed.
 */
export interface Arena {
  readonly name: string;
  readonly description: string;
  /**
   * Difficulty tier (M5): 0 = point to point, 1 = one flying skill (braking, turning, chains),
   * 2 = obstacles to fly through, 3 = race-like. Absent for `legacy`.
   */
  readonly tier?: number;
  /** The same scenario every generation (the seed does not depend on the generation). */
  readonly fixed?: boolean;
  generate(random: Random, params: ArenaParams): Scenario;
}

/**
 * The original training course ("flux compensator"): targets at the center and three on each ring at
 * 200, 400, … 1000 units. Every target is its own episode: the ship restarts at the center, facing a
 * random direction. Params: `frames` per target.
 */
export const legacyArena: Arena = {
  name: "legacy",
  description: "The original course: 16 targets around the origin, one per episode, no obstacles",
  fixed: true,
  generate(random, params) {
    const frames = numberParam(params, "frames", 600, 1);
    const positions = [Vector2.zero()];
    for (const distance of [200, 400, 600, 800, 1000]) {
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        positions.push(new Vector2(Math.cos(angle) * distance, Math.sin(angle) * distance));
      }
    }
    return {
      obstacles: [],
      episodes: positions.map((position) => ({
        start: { position: Vector2.zero(), orientation: random() * Math.PI * 2 },
        targets: [{ position, radius: 30 }],
        timeLimitFrames: frames,
      })),
    };
  },
};

/**
 * Point to point: `episodes` flights from the origin, each to one target at a random angle and a
 * distance in `distance`, starting with a random heading. Optional `asteroids` are scattered around
 * the flight area (never on the start or a target).
 * Params: `episodes`, `distance` [min, max], `radius`, `frames` per episode, `asteroids`,
 * `asteroidRadius` [min, max].
 */
export const pointToPointArena: Arena = {
  name: "point-to-point",
  description: "Fly from the origin to one random target per episode, optionally through asteroids",
  tier: 0,
  generate(random, params) {
    const episodes = numberParam(params, "episodes", 8, 1);
    const distance = rangeParam(params, "distance", [300, 1500]);
    const radius = numberParam(params, "radius", 50, 1);
    const frames = numberParam(params, "frames", 600, 1);
    const asteroids = numberParam(params, "asteroids", 0, 0);
    const asteroidRadius = rangeParam(params, "asteroidRadius", [20, 60]);

    const episodeSpecs: EpisodeSpec[] = [];
    for (let i = 0; i < episodes; i++) {
      const angle = random() * Math.PI * 2;
      const d = between(random, distance);
      episodeSpecs.push({
        start: { position: Vector2.zero(), orientation: random() * Math.PI * 2 },
        targets: [{ position: new Vector2(Math.cos(angle) * d, Math.sin(angle) * d), radius }],
        timeLimitFrames: frames,
      });
    }

    const obstacles: ObstacleSpec[] = [];
    const reach = distance[1];
    const keepClear = [
      { position: Vector2.zero(), radius: 150 },
      ...episodeSpecs.flatMap((e) => e.targets.map((t) => ({ position: t.position, radius: t.radius + 60 }))),
    ];
    for (let placed = 0, attempts = 0; placed < asteroids && attempts < asteroids * 50; attempts++) {
      const position = new Vector2(random() * 2 - 1, random() * 2 - 1).scale(reach);
      const r = between(random, asteroidRadius);
      if (keepClear.some((c) => c.position.distanceTo(position) < c.radius + r)) continue;
      obstacles.push({ position, radius: r });
      placed++;
    }
    return { obstacles, episodes: episodeSpecs };
  },
};

/**
 * Rock in line: like point to point, but every episode puts `rocks` asteroids across the direct line
 * to its target (between 35 % and 75 % of the way, shifted sideways by up to `offset` units), so
 * flying straight crashes. Rocks keep clear of the start and of every target. Optional scattered
 * `asteroids` as in point-to-point.
 * Params: `episodes`, `distance` [min, max], `radius`, `frames`, `rocks`, `rockRadius` [min, max],
 * `offset`, `asteroids`.
 */
export const rockInLineArena: Arena = {
  name: "rock-in-line",
  description: "Point to point with rocks across the direct line: flying straight crashes",
  tier: 0,
  generate(random, params) {
    const episodes = numberParam(params, "episodes", 8, 1);
    const distance = rangeParam(params, "distance", [600, 1400]);
    const radius = numberParam(params, "radius", 50, 1);
    const frames = numberParam(params, "frames", 600, 1);
    const rocks = numberParam(params, "rocks", 1, 0);
    const rockRadius = rangeParam(params, "rockRadius", [30, 70]);
    const offset = numberParam(params, "offset", 30, 0);
    const scattered = numberParam(params, "asteroids", 0, 0);

    const specs: EpisodeSpec[] = [];
    const lines: { angle: number; d: number }[] = [];
    for (let i = 0; i < episodes; i++) {
      const angle = random() * Math.PI * 2;
      const d = between(random, distance);
      lines.push({ angle, d });
      specs.push({
        start: { position: Vector2.zero(), orientation: random() * Math.PI * 2 },
        targets: [{ position: new Vector2(Math.cos(angle) * d, Math.sin(angle) * d), radius }],
        timeLimitFrames: frames,
      });
    }
    const keepClear = [
      { position: Vector2.zero(), radius: 120 },
      ...specs.map((e) => ({ position: e.targets[0]!.position, radius: radius + 60 })),
    ];
    const clear = (position: Vector2, r: number, placed: ObstacleSpec[]) =>
      !keepClear.some((c) => c.position.distanceTo(position) < c.radius + r) &&
      !placed.some((o) => o.position.distanceTo(position) < o.radius + r);

    const obstacles: ObstacleSpec[] = [];
    for (const { angle, d } of lines) {
      const along = new Vector2(Math.cos(angle), Math.sin(angle));
      const side = new Vector2(-along.y, along.x);
      for (let k = 0; k < rocks; k++) {
        for (let attempt = 0; attempt < 20; attempt++) {
          const r = between(random, rockRadius);
          const t = 0.35 + random() * 0.4;
          const position = along.scale(t * d).plus(side.scale((random() * 2 - 1) * offset));
          if (!clear(position, r, obstacles)) continue;
          obstacles.push({ position, radius: r });
          break;
        }
      }
    }
    const reach = distance[1];
    for (let placed = 0, attempts = 0; placed < scattered && attempts < scattered * 50; attempts++) {
      const position = new Vector2(random() * 2 - 1, random() * 2 - 1).scale(reach);
      const r = between(random, rockRadius);
      if (!clear(position, r, obstacles)) continue;
      obstacles.push({ position, radius: r });
      placed++;
    }
    return { obstacles, episodes: specs };
  },
};

export const ARENAS: Readonly<Record<string, Arena>> = {
  [legacyArena.name]: legacyArena,
  [pointToPointArena.name]: pointToPointArena,
  [rockInLineArena.name]: rockInLineArena,
  // M5's tiered arenas: opt-in by name.
  ...Object.fromEntries(TIER_ARENAS.map((arena) => [arena.name, arena])),
};

export function arenaByName(name: string): Arena {
  const arena = ARENAS[name];
  if (!arena)
    throw new Error(`unknown arena ${JSON.stringify(name)}; known: ${Object.keys(ARENAS).join(", ")}`);
  return arena;
}

/** Seed streams, so training and held-out scenarios never share seeds. */
export const SCENARIO_STREAM = { training: 1, heldOut: 2, reevaluate: 3, keepEasy: 4, noise: 5 } as const;

/**
 * Seed of the input-noise stream for scenario `index` of a flight round in generation `g`: `round`
 * is the scenarios' own stream (training, held-out or re-evaluation). Every candidate flying that
 * scenario gets the same noise (common random numbers), and nothing needs saving for a resume.
 */
export function noiseSeed(seed: number, round: number, g: number, index: number): number {
  return deriveSeed(seed, SCENARIO_STREAM.noise, round, g, index);
}

/**
 * A 32-bit seed from a list of integers (FNV-1a over their bytes, then a murmur finalizer). Lets every
 * scenario get its own seed from (run seed, stream, arena index, generation) — so a resumed run makes
 * exactly the same scenarios without saving any generator state.
 */
export function deriveSeed(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    let v = part >>> 0;
    for (let i = 0; i < 4; i++) {
      h ^= v & 0xff;
      h = Math.imul(h, 0x01000193);
      v >>>= 8;
    }
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** An arena by name, as it appears in a training config. */
export interface ArenaConfig {
  name: string;
  params?: ArenaParams;
}

/** One arena of the training set, with its params. */
export interface ArenaRun {
  arena: Arena;
  params: ArenaParams;
}

/** The `arenas` list of a training config (default: the original course). */
export function parseArenas(value: unknown): ArenaConfig[] {
  if (value === undefined) return [{ name: "legacy", params: {} }];
  if (!Array.isArray(value) || value.length === 0)
    throw new Error("config.arenas must be a non-empty list of { name, params }");
  return value.map((entry: unknown, i) => {
    const { name, params = {} } = (entry ?? {}) as { name?: unknown; params?: unknown };
    if (typeof name !== "string") throw new Error(`config.arenas[${i}].name must be a string`);
    if (typeof params !== "object" || params === null || Array.isArray(params))
      throw new Error(`config.arenas[${i}].params must be an object`);
    arenaByName(name); // unknown names fail here, before the run starts
    return { name, params: params as ArenaParams };
  });
}

/** Arena configs → runs; `frames` is the default `frames` param of every arena. */
export function resolveArenas(configs: readonly ArenaConfig[], frames: number): ArenaRun[] {
  return configs.map((a) => ({ arena: arenaByName(a.name), params: { frames, ...a.params } }));
}

/**
 * A staged curriculum: `levels[i]` overrides arena params by arena name. A run moves to the next
 * level once the winner reaches at least `success` of the training targets in `streak` generations
 * in a row.
 */
/**
 * One curriculum level: either arena param overrides by arena name (on top of `config.arenas`), or a
 * tiered level `{ arenas: [...] }` that replaces the arena list at that level (e.g. M5's tier arenas).
 */
export type CurriculumLevel = Record<string, ArenaParams> | { arenas: ArenaConfig[] };

/** True for a tiered level (`{ arenas: [...] }`), which replaces the arena list. */
export function isTieredLevel(level: CurriculumLevel): level is { arenas: ArenaConfig[] } {
  return Array.isArray((level as { arenas?: unknown }).arenas);
}

/**
 * The plateau rule (`curriculum.plateau`): besides the fixed `success` threshold, a run also moves up
 * when its judged success has stopped improving: an exponential moving average (`alpha`) of the
 * judged success that has not beaten its best by more than `minGain` for `patience` generations,
 * while at or above `floor`.
 */
export interface PlateauRule {
  floor: number;
  patience: number;
  alpha: number;
  minGain: number;
}

/** Where the plateau rule stands on the current level (reset at every level-up). */
export interface PlateauState {
  ema: number;
  best: number;
  since: number;
}

export const PLATEAU_START: Readonly<PlateauState> = Object.freeze({ ema: 0, best: 0, since: 0 });

/** One generation of the plateau rule: the new state, and whether the run should move up. */
export function stepPlateau(
  state: PlateauState,
  success: number,
  rule: PlateauRule,
): { state: PlateauState; up: boolean } {
  const ema = state.ema + rule.alpha * (success - state.ema);
  const improved = ema > state.best + rule.minGain;
  const next = { ema, best: improved ? ema : state.best, since: improved ? 0 : state.since + 1 };
  return { state: next, up: next.since >= rule.patience && ema >= rule.floor };
}

export interface CurriculumConfig {
  levels: CurriculumLevel[];
  success: number;
  streak: number;
  /** Plateau rule: also level up when success stops improving (absent = only the fixed threshold). */
  plateau?: PlateauRule;
  /**
   * Also fly the held-out scenarios at the current level and report them as `heldOutCurrent*`
   * (absent = held-out on the last level only, as before).
   */
  heldOutCurrent?: boolean;
  /**
   * Share of each arena's episodes drawn from an earlier level once the run is past level 0
   * (absent = 0: all episodes on the current level). See {@link mixEasyEpisodes}.
   */
  keepEasy?: number;
}

/** The default levels: a clear line of sight first, then more and more rocks (the v2 task last). */
export const DEFAULT_CURRICULUM_LEVELS: readonly Record<string, ArenaParams>[] = Object.freeze([
  { "rock-in-line": { rocks: 0 }, "point-to-point": { asteroids: 0 } },
  { "rock-in-line": { rocks: 1 }, "point-to-point": { asteroids: 0 } },
  { "rock-in-line": { rocks: 1 }, "point-to-point": { asteroids: 20 } },
  { "rock-in-line": { rocks: 2 }, "point-to-point": { asteroids: 40 } },
  { "rock-in-line": { rocks: 2 }, "point-to-point": { asteroids: 80 } },
]);

/**
 * The `curriculum` section of a training config: `{ levels?, success?, streak? }` (`{}` = the default
 * levels, success 0.8, streak 3). Every arena a level names must be in `arenas`; arenas a level does
 * not name keep their own params.
 */
export function parseCurriculum(raw: unknown, arenas: readonly ArenaConfig[]): CurriculumConfig {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    throw new Error("config.curriculum must be an object ({ levels?, success?, streak? })");
  const {
    levels = DEFAULT_CURRICULUM_LEVELS,
    success = 0.8,
    streak = 3,
    keepEasy,
    plateau,
    heldOutCurrent,
    ...rest
  } = raw as Record<string, unknown>;
  if (Object.keys(rest).length > 0)
    throw new Error(`unknown config.curriculum keys ${Object.keys(rest).join(", ")}`);
  if (typeof success !== "number" || !(success > 0 && success <= 1))
    throw new Error("config.curriculum.success must be in (0, 1]");
  if (!Number.isInteger(streak) || (streak as number) < 1)
    throw new Error("config.curriculum.streak must be an integer ≥ 1");
  if (!Array.isArray(levels) || levels.length < 2)
    throw new Error("config.curriculum.levels must be a list of at least 2 levels");
  if (keepEasy !== undefined && (typeof keepEasy !== "number" || !(keepEasy > 0 && keepEasy < 1)))
    throw new Error("config.curriculum.keepEasy must be in (0, 1)");
  if (heldOutCurrent !== undefined && heldOutCurrent !== true)
    throw new Error("config.curriculum.heldOutCurrent must be true (or absent)");
  const plateauRule = plateau === undefined ? undefined : parsePlateau(plateau);
  const names = new Set(arenas.map((a) => a.name));
  const parsed = levels.map((level: unknown, i): CurriculumLevel => {
    if (typeof level !== "object" || level === null || Array.isArray(level))
      throw new Error(`config.curriculum.levels[${i}] must be an object of arena params by arena name`);
    if ("arenas" in level) {
      const { arenas: tier, ...extra } = level as { arenas: unknown };
      if (Object.keys(extra).length > 0)
        throw new Error(`config.curriculum.levels[${i}]: a tiered level has only "arenas"`);
      try {
        return { arenas: parseArenas(tier) };
      } catch (error) {
        throw new Error(`config.curriculum.levels[${i}].arenas: ${(error as Error).message}`, {
          cause: error,
        });
      }
    }
    for (const [name, params] of Object.entries(level)) {
      if (!names.has(name))
        throw new Error(
          `config.curriculum.levels[${i}] names arena ${JSON.stringify(name)}, which is not in config.arenas`,
        );
      if (typeof params !== "object" || params === null || Array.isArray(params))
        throw new Error(`config.curriculum.levels[${i}].${name} must be an object of params`);
    }
    return level as Record<string, ArenaParams>;
  });
  return {
    levels: parsed.map((l) => ({ ...l })),
    success,
    streak: streak as number,
    ...(keepEasy === undefined ? {} : { keepEasy }),
    ...(plateauRule ? { plateau: plateauRule } : {}),
    ...(heldOutCurrent ? { heldOutCurrent: true } : {}),
  };
}

/** `curriculum.plateau`: `{ floor?, patience?, alpha?, minGain? }`, defaults 0.5, 10, 0.2, 0.02. */
function parsePlateau(raw: unknown): PlateauRule {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    throw new Error("config.curriculum.plateau must be an object ({ floor?, patience?, alpha?, minGain? })");
  const { floor = 0.5, patience = 10, alpha = 0.2, minGain = 0.02, ...rest } = raw as Record<string, unknown>;
  if (Object.keys(rest).length > 0)
    throw new Error(`unknown config.curriculum.plateau keys ${Object.keys(rest).join(", ")}`);
  if (typeof floor !== "number" || !(floor >= 0 && floor <= 1))
    throw new Error("config.curriculum.plateau.floor must be in [0, 1]");
  if (!Number.isInteger(patience) || (patience as number) < 1)
    throw new Error("config.curriculum.plateau.patience must be an integer ≥ 1");
  if (typeof alpha !== "number" || !(alpha > 0 && alpha <= 1))
    throw new Error("config.curriculum.plateau.alpha must be in (0, 1]");
  if (typeof minGain !== "number" || !(minGain >= 0))
    throw new Error("config.curriculum.plateau.minGain must be ≥ 0");
  return { floor, patience: patience as number, alpha, minGain };
}

/**
 * Curriculum mixing: the arena runs of one generation at `level`, with about `keepEasy` of each
 * arena's episodes moved to an earlier level. Each arena with a numeric `episodes` param keeps
 * `n − k` episodes on the current level, k = round(keepEasy × n), and gets an extra run with `k`
 * episodes at an earlier level, picked uniformly from 0..level−1 with a seed derived from
 * (seed, keepEasy stream, arena index, generation). The extra runs come after the regular ones, so
 * the regular runs keep their arena index (and their scenario seed stream). Arenas without a numeric
 * `episodes` param (e.g. `legacy`), k = 0 or k = n stay as they are. `hard` is the number of runs on
 * the current level (the first `hard` runs).
 */
export function mixEasyEpisodes(
  levels: readonly (readonly ArenaRun[])[],
  level: number,
  keepEasy: number,
  seed: number,
  g: number,
): { runs: ArenaRun[]; hard: number } {
  const current = levels[level]!;
  if (level === 0 || !(keepEasy > 0)) return { runs: [...current], hard: current.length };
  const regular: ArenaRun[] = [];
  const easy: ArenaRun[] = [];
  current.forEach((run, a) => {
    const n = run.params.episodes;
    const k = typeof n === "number" ? Math.round(keepEasy * n) : 0;
    if (typeof n !== "number" || k < 1 || k >= n) {
      regular.push(run);
      return;
    }
    const earlier = Math.floor(seededRandom(deriveSeed(seed, SCENARIO_STREAM.keepEasy, a, g))() * level);
    // Tiered levels may have a different number of arenas: wrap around the earlier level's list.
    const earlierRuns = levels[earlier]!;
    const from = earlierRuns[a % earlierRuns.length]!;
    regular.push({ arena: run.arena, params: { ...run.params, episodes: n - k } });
    easy.push({ arena: from.arena, params: { ...from.params, episodes: k } });
  });
  return { runs: [...regular, ...easy], hard: regular.length };
}

/**
 * Re-evaluation scenarios of generation `g`: one per arena, from their own seed stream, with about
 * `episodes` episodes in total, split over the arenas in proportion to their `episodes` params
 * (at least 1 each). Arenas without a numeric `episodes` param fly their scenario as configured.
 * Fixed arenas (e.g. `legacy`) give their fixed course again.
 */
export function reevaluationScenarios(
  runs: readonly ArenaRun[],
  seed: number,
  g: number,
  episodes: number,
): Scenario[] {
  const counted = runs.map((run) => (typeof run.params.episodes === "number" ? run.params.episodes : 0));
  const total = counted.reduce((a, b) => a + b, 0);
  return runs.map((run, a) => {
    const n = counted[a]!;
    const params =
      n > 0 && total > 0
        ? { ...run.params, episodes: Math.max(1, Math.round((episodes * n) / total)) }
        : run.params;
    return run.arena.generate(seededRandom(deriveSeed(seed, SCENARIO_STREAM.reevaluate, a, g)), params);
  });
}

/** The arena configs of one curriculum level: each arena's params with the level's overrides on top. */
export function applyLevel(arenas: readonly ArenaConfig[], level: CurriculumLevel): ArenaConfig[] {
  if (isTieredLevel(level)) return level.arenas.map((a) => ({ name: a.name, params: { ...a.params } }));
  return arenas.map((a) => ({ name: a.name, params: { ...a.params, ...level[a.name] } }));
}

/** The training scenarios of generation `g` (1-based), one per arena; fixed arenas ignore `g`. */
export function trainingScenarios(runs: readonly ArenaRun[], seed: number, g: number): Scenario[] {
  return runs.map((run, a) =>
    run.arena.generate(
      seededRandom(deriveSeed(seed, SCENARIO_STREAM.training, a, run.arena.fixed ? 0 : g)),
      run.params,
    ),
  );
}

/** `count` held-out scenarios per arena: the same for the whole run. */
export function heldOutScenarios(runs: readonly ArenaRun[], seed: number, count: number): Scenario[] {
  return runs.flatMap((run, a) =>
    Array.from({ length: count }, (_, k) =>
      run.arena.generate(seededRandom(deriveSeed(seed, SCENARIO_STREAM.heldOut, a, k)), run.params),
    ),
  );
}

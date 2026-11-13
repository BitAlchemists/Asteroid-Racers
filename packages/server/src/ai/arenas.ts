import { Vector2 } from "@ar/shared";
import { seededRandom, type Random } from "../random";

/** One place the ship has to fly to. */
export interface TargetSpec {
  position: Vector2;
  radius: number;
  /** When set, the target counts only if the ship is at most this fast inside it ("stop here"). */
  maxSpeed?: number;
}

/** One flight: the ship is placed at `start` and has `timeLimitFrames` to reach the targets in order. */
export interface EpisodeSpec {
  start: { position: Vector2; orientation: number; velocity?: Vector2 };
  targets: TargetSpec[];
  timeLimitFrames: number;
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

export type ArenaParams = Record<string, unknown>;

/**
 * A family of training scenarios. `generate` must use only `random` (no Math.random, no clock), so a
 * scenario is fully determined by its seed.
 */
export interface Arena {
  readonly name: string;
  readonly description: string;
  /** The same scenario every generation (the seed does not depend on the generation). */
  readonly fixed?: boolean;
  generate(random: Random, params: ArenaParams): Scenario;
}

/** Reads a number param, with a default and a range check. */
export function numberParam(params: ArenaParams, key: string, fallback: number, min = -Infinity): number {
  const value = params[key] ?? fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min)
    throw new Error(`arena param ${key} must be a number ≥ ${min}, got ${JSON.stringify(value)}`);
  return value;
}

function rangeParam(params: ArenaParams, key: string, fallback: [number, number]): [number, number] {
  const value = params[key] ?? fallback;
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !value.every((v) => typeof v === "number" && Number.isFinite(v)) ||
    (value[0] as number) > (value[1] as number)
  )
    throw new Error(`arena param ${key} must be [min, max], got ${JSON.stringify(value)}`);
  return value as [number, number];
}

const between = (random: Random, [min, max]: [number, number]) => min + random() * (max - min);

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

export const ARENAS: Readonly<Record<string, Arena>> = {
  [legacyArena.name]: legacyArena,
  [pointToPointArena.name]: pointToPointArena,
};

export function arenaByName(name: string): Arena {
  const arena = ARENAS[name];
  if (!arena)
    throw new Error(`unknown arena ${JSON.stringify(name)}; known: ${Object.keys(ARENAS).join(", ")}`);
  return arena;
}

/** Seed streams, so training and held-out scenarios never share seeds. */
export const SCENARIO_STREAM = { training: 1, heldOut: 2 } as const;

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

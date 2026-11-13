import { EntityType, Vector2, World } from "@ar/shared";
import type { IGameServer } from "../contracts";
import { RaceController } from "../race-controller";
import { seededRandom, type Random } from "../random";
import { trackByName } from "../tracks";
import {
  between,
  intBetween,
  intRangeParam,
  numberParam,
  rangeParam,
  type ArenaParams,
} from "./arena-params";
import type { Arena, EpisodeSpec, ObstacleSpec, TargetSpec } from "./arenas";

// The tiered training arenas of M5 (see doc/plans/M5-content.md, step 4). Each asks for one skill;
// all are opt-in by name and deterministic per seed (they use only `random`).

const DEG = Math.PI / 180;

/** The ship orientation that points its nose (thrust) along the direction angle `angle`. */
export const headingToOrientation = (angle: number) => angle - Math.PI / 2;

/**
 * A chain of `count` points from `from`: the first leg goes in a random direction, each further leg
 * turns by an angle in `turn` (degrees, random side) from the previous one; leg lengths in `legs`.
 */
export function chainPoints(
  random: Random,
  from: Vector2,
  count: number,
  legs: [number, number],
  turn: [number, number],
): Vector2[] {
  const points: Vector2[] = [];
  let angle = random() * Math.PI * 2;
  let at = from;
  for (let i = 0; i < count; i++) {
    if (i > 0) {
      const side = random() < 0.5 ? -1 : 1;
      angle += side * between(random, turn) * DEG;
    }
    at = at.plus(new Vector2(Math.cos(angle), Math.sin(angle)).scale(between(random, legs)));
    points.push(at);
  }
  return points;
}

/**
 * Chain: every episode is a row of 3–5 targets, like the legs of a race. The ship starts at the
 * origin with a random heading; each leg turns from the previous one, so a good racer plans its exit
 * from one target towards the next. No obstacles.
 * Params: `episodes`, `targets` [min, max] per episode, `distance` [min, max] per leg, `turn`
 * [min, max] degrees between legs, `radius`, `frames` per target (time limit = frames × targets).
 */
export const chainArena: Arena = {
  name: "chain",
  description: "Rows of 3–5 targets per episode, each leg turning from the last (planning the next turn)",
  tier: 1,
  generate(random, params) {
    const episodes = numberParam(params, "episodes", 6, 1);
    const targets = intRangeParam(params, "targets", [3, 5], 1);
    const distance = rangeParam(params, "distance", [300, 900]);
    const turn = rangeParam(params, "turn", [0, 120]);
    const radius = numberParam(params, "radius", 50, 1);
    const frames = numberParam(params, "frames", 600, 1);

    const specs: EpisodeSpec[] = [];
    for (let i = 0; i < episodes; i++) {
      const orientation = random() * Math.PI * 2;
      const count = intBetween(random, targets);
      const points = chainPoints(random, Vector2.zero(), count, distance, turn);
      specs.push({
        start: { position: Vector2.zero(), orientation },
        targets: points.map((position): TargetSpec => ({ position, radius })),
        timeLimitFrames: frames * count,
      });
    }
    return { obstacles: [], episodes: specs };
  },
};

/**
 * Stop: point to point, but a target counts only when the ship is at most `maxSpeed` fast inside
 * it, so the ship has to brake in time (at 400 units/s² it needs about 1.25 s to lose 500 units/s).
 * Params: `episodes`, `distance` [min, max], `radius`, `maxSpeed`, `frames` per episode.
 */
export const stopArena: Arena = {
  name: "stop",
  description: "Reach a target and be slower than maxSpeed inside it (braking)",
  tier: 1,
  generate(random, params) {
    const episodes = numberParam(params, "episodes", 8, 1);
    const distance = rangeParam(params, "distance", [300, 1200]);
    const radius = numberParam(params, "radius", 60, 1);
    const maxSpeed = numberParam(params, "maxSpeed", 100, 1);
    const frames = numberParam(params, "frames", 600, 1);
    const specs: EpisodeSpec[] = [];
    for (let i = 0; i < episodes; i++) {
      const angle = random() * Math.PI * 2;
      const d = between(random, distance);
      specs.push({
        start: { position: Vector2.zero(), orientation: random() * Math.PI * 2 },
        targets: [{ position: new Vector2(Math.cos(angle), Math.sin(angle)).scale(d), radius, maxSpeed }],
        timeLimitFrames: frames,
      });
    }
    return { obstacles: [], episodes: specs };
  },
};

/**
 * Turn and go: the ship starts already moving fast, nose first, away from its target (within
 * `spread` degrees of straight away) and has to turn around, kill its speed and come back.
 * Params: `episodes`, `distance` [min, max], `radius`, `speed` [min, max] start speed, `spread`
 * degrees, `frames` per episode.
 */
export const turnAndGoArena: Arena = {
  name: "turn-and-go",
  description: "Start moving fast away from the target, then turn around and reach it",
  tier: 1,
  generate(random, params) {
    const episodes = numberParam(params, "episodes", 8, 1);
    const distance = rangeParam(params, "distance", [300, 1200]);
    const radius = numberParam(params, "radius", 50, 1);
    const speed = rangeParam(params, "speed", [200, 400]);
    const spread = numberParam(params, "spread", 45, 0);
    const frames = numberParam(params, "frames", 600, 1);
    if (speed[0] < 0) throw new Error(`arena param speed must be ≥ 0, got ${JSON.stringify(speed)}`);
    const specs: EpisodeSpec[] = [];
    for (let i = 0; i < episodes; i++) {
      const angle = random() * Math.PI * 2;
      const d = between(random, distance);
      const away = angle + Math.PI + (random() * 2 - 1) * spread * DEG;
      const v = between(random, speed);
      specs.push({
        start: {
          position: Vector2.zero(),
          orientation: headingToOrientation(away),
          velocity: new Vector2(Math.cos(away), Math.sin(away)).scale(v),
        },
        targets: [{ position: new Vector2(Math.cos(angle), Math.sin(angle)).scale(d), radius }],
        timeLimitFrames: frames,
      });
    }
    return { obstacles: [], episodes: specs };
  },
};

/**
 * Episode `i` of `n` gets its own cell of a square grid (`size` units per cell), so episodes whose
 * obstacles would overlap can share one scenario. Cell 0 is at the origin.
 */
export function cellOrigin(i: number, n: number, size: number): Vector2 {
  const cols = Math.ceil(Math.sqrt(n));
  return new Vector2((i % cols) * size, Math.floor(i / cols) * size);
}

/** Distance from `p` to the segment a–b. */
export function distanceToSegment(p: Vector2, a: Vector2, b: Vector2): number {
  const ab = b.minus(a);
  const len2 = ab.dot(ab);
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, p.minus(a).dot(ab) / len2));
  return p.distanceTo(a.plus(ab.scale(t)));
}

/** Distance from `p` to the polyline through `points`. */
export function distanceToPolyline(p: Vector2, points: readonly Vector2[]): number {
  if (points.length === 1) return p.distanceTo(points[0]!);
  let best = Infinity;
  for (let i = 1; i < points.length; i++)
    best = Math.min(best, distanceToSegment(p, points[i - 1]!, points[i]!));
  return best;
}

/** A keep-clear zone: an obstacle of radius r at p must be at least `radius + r` from `position`. */
interface Clearance {
  position: Vector2;
  radius: number;
}
const isClear = (zones: readonly Clearance[], p: Vector2, r: number) =>
  !zones.some((c) => c.position.distanceTo(p) < c.radius + r);

/** Room kept free around every start, and beyond the radius of every target. */
export const START_CLEARANCE = 150;
export const TARGET_CLEARANCE = 60;

/**
 * Corridor: the target sits at the end of a bent corridor whose walls are rows of asteroids. The
 * corridor has `segments` straight pieces, each turning by `bend` degrees (random side) from the
 * last, so the direct line from start to target runs through a wall. The ship starts at the
 * corridor's mouth, nose down the first piece. Each episode has its own corridor in its own cell.
 * Params: `episodes`, `segments` [min, max], `length` [min, max] per piece, `bend` [min, max] degrees,
 * `width` (free space between the walls), `rockRadius` [min, max], `radius`, `frames` per episode.
 */
export const corridorArena: Arena = {
  name: "corridor",
  description: "Reach a target at the end of a bent corridor of asteroid walls",
  tier: 2,
  generate(random, params) {
    const episodes = numberParam(params, "episodes", 4, 1);
    const segments = intRangeParam(params, "segments", [2, 3], 1);
    const length = rangeParam(params, "length", [400, 700]);
    const bend = rangeParam(params, "bend", [40, 100]);
    const width = numberParam(params, "width", 260, 1);
    const rockRadius = rangeParam(params, "rockRadius", [30, 45]);
    const radius = numberParam(params, "radius", 50, 1);
    const frames = numberParam(params, "frames", 600, 1);
    if (length[0] <= 0) throw new Error(`arena param length must be > 0, got ${JSON.stringify(length)}`);
    if (rockRadius[0] < 5)
      throw new Error(`arena param rockRadius must be ≥ 5, got ${JSON.stringify(rockRadius)}`);
    if (width < 2 * (radius + TARGET_CLEARANCE))
      throw new Error(`arena param width must be ≥ 2 × (radius + ${TARGET_CLEARANCE}), got ${width}`);

    const extent = segments[1] * length[1] + 2 * width + 2 * rockRadius[1];
    const size = 2 * extent + 2000;
    const step = rockRadius[0] * 1.5; // the rocks of a wall overlap: no gaps
    const specs: EpisodeSpec[] = [];
    const obstacles: ObstacleSpec[] = [];
    for (let i = 0; i < episodes; i++) {
      const origin = cellOrigin(i, episodes, size);
      const heading = random() * Math.PI * 2;
      const count = intBetween(random, segments);
      const points = [origin];
      let angle = heading;
      for (let s = 0; s < count; s++) {
        if (s > 0) angle += (random() < 0.5 ? -1 : 1) * between(random, bend) * DEG;
        const leg = new Vector2(Math.cos(angle), Math.sin(angle)).scale(between(random, length));
        points.push(points[s]!.plus(leg));
      }
      const target = points.at(-1)!;
      specs.push({
        start: { position: origin, orientation: headingToOrientation(heading) },
        targets: [{ position: target, radius }],
        timeLimitFrames: frames,
      });
      const zones: Clearance[] = [
        { position: origin, radius: START_CLEARANCE },
        { position: target, radius: radius + TARGET_CLEARANCE },
      ];
      // Walls: rows along both sides of every piece, extended by `width` past its ends to close the
      // outer side of the bends; rocks that would reach into the corridor are dropped.
      for (let s = 1; s < points.length; s++) {
        const a = points[s - 1]!;
        const b = points[s]!;
        const along = b.minus(a).normalized();
        const normal = new Vector2(-along.y, along.x);
        const len = a.distanceTo(b);
        for (const side of [-1, 1]) {
          for (let t = -width; t <= len + width; t += step) {
            const r = between(random, rockRadius);
            const p = a.plus(along.times(t)).plus(normal.times(side * (width / 2 + r)));
            if (distanceToPolyline(p, points) < width / 2 + r - 1e-6 || !isClear(zones, p, r)) continue;
            obstacles.push({ position: p, radius: r });
          }
        }
      }
    }
    return { obstacles, episodes: specs };
  },
};

/**
 * Field: a chain of targets (as in `chain`) through a dense asteroid field around it. Rocks keep
 * clear of the start, of every target and (with `lane` > 0) of a lane of that width along each leg.
 * Each episode has its own field in its own cell. The default density (10 rocks per million square
 * units) is about that of point-to-point with 80 asteroids, the hardest level of the M4 curriculum.
 * Params: `episodes`, `targets` [min, max], `distance` [min, max] per leg, `turn` [min, max] degrees,
 * `radius`, `density` (rocks per 1,000 × 1,000 units), `rockRadius` [min, max], `margin` (field
 * beyond the chain), `lane`, `frames` per target.
 */
export const fieldArena: Arena = {
  name: "field",
  description: "A chain of targets through a dense asteroid field",
  tier: 2,
  generate(random, params) {
    const episodes = numberParam(params, "episodes", 4, 1);
    const targets = intRangeParam(params, "targets", [3, 5], 1);
    const distance = rangeParam(params, "distance", [400, 800]);
    const turn = rangeParam(params, "turn", [0, 90]);
    const radius = numberParam(params, "radius", 60, 1);
    const density = numberParam(params, "density", 10, 0);
    const rockRadius = rangeParam(params, "rockRadius", [30, 70]);
    const margin = numberParam(params, "margin", 500, 0);
    const lane = numberParam(params, "lane", 0, 0);
    const frames = numberParam(params, "frames", 600, 1);
    if (rockRadius[0] < 5)
      throw new Error(`arena param rockRadius must be ≥ 5, got ${JSON.stringify(rockRadius)}`);

    const size = 2 * (targets[1] * distance[1] + margin + rockRadius[1]) + 2000;
    const specs: EpisodeSpec[] = [];
    const obstacles: ObstacleSpec[] = [];
    for (let i = 0; i < episodes; i++) {
      const origin = cellOrigin(i, episodes, size);
      const orientation = random() * Math.PI * 2;
      const count = intBetween(random, targets);
      const points = chainPoints(random, origin, count, distance, turn);
      specs.push({
        start: { position: origin, orientation },
        targets: points.map((position): TargetSpec => ({ position, radius })),
        timeLimitFrames: frames * count,
      });
      const path = [origin, ...points];
      const zones: Clearance[] = [
        { position: origin, radius: START_CLEARANCE },
        ...points.map((position) => ({ position, radius: radius + TARGET_CLEARANCE })),
      ];
      const xs = path.map((p) => p.x);
      const ys = path.map((p) => p.y);
      const minX = Math.min(...xs) - margin;
      const minY = Math.min(...ys) - margin;
      const w = Math.max(...xs) + margin - minX;
      const h = Math.max(...ys) + margin - minY;
      const wanted = Math.round((density * w * h) / 1e6);
      const placed: ObstacleSpec[] = [];
      for (let attempts = 0; placed.length < wanted && attempts < wanted * 30; attempts++) {
        const p = new Vector2(minX + random() * w, minY + random() * h);
        const r = between(random, rockRadius);
        if (!isClear(zones, p, r)) continue;
        if (lane > 0 && distanceToPolyline(p, path) < lane / 2 + r) continue;
        if (placed.some((o) => o.position.distanceTo(p) < o.radius + r)) continue;
        placed.push({ position: p, radius: r });
      }
      obstacles.push(...placed);
    }
    return { obstacles, episodes: specs };
  },
};

/** The `tracks` param of race-legs: a non-empty list of known track names. */
function tracksParam(params: ArenaParams, fallback: string[]): string[] {
  const value = params.tracks ?? fallback;
  if (!Array.isArray(value) || value.length === 0 || !value.every((t) => typeof t === "string"))
    throw new Error(
      `arena param tracks must be a non-empty list of track names, got ${JSON.stringify(value)}`,
    );
  for (const name of value as string[]) trackByName(name);
  return value as string[];
}

/** A server stand-in for building a track's race: building never talks to the server. */
const NO_SERVER = {} as IGameServer;

/**
 * Race legs: pieces of real race tracks from the track registry. Each scenario builds one track
 * (picked from `tracks`, with its own seed, so `random` makes a new race every time); each episode
 * starts at one of its checkpoints, facing as a racer respawning there would, and flies the next
 * `legs` checkpoints among the track's asteroids. Crashes respawn at the last checkpoint reached,
 * at rest, as in a race (with `crashMode: "respawn"`). Default `tracks`: `["random"]`, so the exam's
 * fixed tracks stay out of training unless named.
 * Params: `tracks`, `episodes`, `legs` per episode, `frames` per leg.
 */
export const raceLegsArena: Arena = {
  name: "race-legs",
  description: "Legs of real race tracks among their asteroids; crashes respawn at the last checkpoint",
  tier: 3,
  generate(random, params) {
    const tracks = tracksParam(params, ["random"]);
    const episodes = numberParam(params, "episodes", 6, 1);
    const legs = numberParam(params, "legs", 3, 1);
    const frames = numberParam(params, "frames", 600, 1);
    if (!Number.isInteger(legs)) throw new Error(`arena param legs must be an integer, got ${legs}`);

    const track = trackByName(tracks[intBetween(random, [0, tracks.length - 1])]!);
    const world = new World();
    const race = new RaceController(NO_SERVER);
    track.build(world, race, seededRandom(Math.floor(random() * 2 ** 32)));
    const checkpoints = race.checkpoints;
    const available = checkpoints.length - 1;
    if (available < 1) throw new Error(`track ${track.name} has no legs`);
    const n = Math.min(legs, available);
    const specs: EpisodeSpec[] = [];
    for (let i = 0; i < episodes; i++) {
      const from = intBetween(random, [0, available - n]);
      const start = checkpoints[from]!;
      specs.push({
        start: { position: start.position.clone(), orientation: start.orientation },
        targets: checkpoints.slice(from + 1, from + 1 + n).map((c): TargetSpec => ({
          position: c.position.clone(),
          radius: c.radius,
          orientation: c.orientation,
        })),
        timeLimitFrames: frames * n,
        respawn: "last-target",
      });
    }
    const obstacles = world.passiveCollisionEntities
      .filter((e) => e.type === EntityType.ASTEROID)
      .map((e): ObstacleSpec => ({ position: e.position.clone(), radius: e.radius }));
    return { obstacles, episodes: specs };
  },
};

/** The tiered arenas, in tier order. */
export const TIER_ARENAS: readonly Arena[] = [
  stopArena,
  turnAndGoArena,
  chainArena,
  corridorArena,
  fieldArena,
  raceLegsArena,
];

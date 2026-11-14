import { EntityType, Vector2, World } from "@ar/shared";
import type { IGameServer } from "../contracts";
import { RaceController } from "../race-controller";
import { seededRandom, type Random } from "../random";
import { TICK_SECONDS } from "../game-loop";
import {
  buildGeneratedTrack,
  generateTrack,
  isTrackBand,
  TRACK_BAND_NAMES,
  type TrackBand,
} from "../track-generator";
import { trackByName, type Track } from "../tracks";
import {
  between,
  intBetween,
  intRangeParam,
  numberParam,
  rangeParam,
  type ArenaParams,
} from "./arena-params";
import type { Arena, EpisodeSpec, ObstacleSpec, Scenario, TargetSpec } from "./arenas";

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
 * Goal params of the arenas (M7 S5), all absent = off (the scenarios stay byte-identical):
 * - `gates`: `"track"` = the track's own gates count only when crossed in their direction (generated
 *   tracks: the gate and chicane checkpoints; file tracks: checkpoints with a `width`); `"all"` =
 *   every checkpoint between the start and the finish, as the race's `gates` rule (width 2 × radius
 *   unless the track gives one);
 * - `stop`: the episode's final target counts only at most this fast (`finishMaxSpeed`);
 * - `laps`: the episode's targets are flown this many times (integer ≥ 1);
 * - `parSpeed`: a par time from this speed (units/s) over the straight path start → targets (all
 *   laps), for `scoring.par`.
 */
export interface GoalParams {
  gates?: "track" | "all";
  stop?: number;
  laps?: number;
  parSpeed?: number;
}

/** Reads the goal params (absent keys stay absent). `gates` only where `gateModes` allows it. */
export function goalParams(params: ArenaParams, gateModes: readonly string[] = []): GoalParams {
  const goals: GoalParams = {};
  if (params.gates !== undefined) {
    if (!gateModes.includes(params.gates as string))
      throw new Error(
        `arena param gates must be ${gateModes.map((m) => JSON.stringify(m)).join(" or ") || "absent here"}, got ${JSON.stringify(params.gates)}`,
      );
    goals.gates = params.gates as "track" | "all";
  }
  if (params.stop !== undefined) goals.stop = positiveParam(params, "stop");
  if (params.laps !== undefined) goals.laps = lapsParam(params, 1);
  if (params.parSpeed !== undefined) goals.parSpeed = positiveParam(params, "parSpeed");
  return goals;
}

/** A number param > 0 that has no default. */
function positiveParam(params: ArenaParams, key: string): number {
  const value = params[key];
  if (typeof value !== "number" || !Number.isFinite(value) || !(value > 0))
    throw new Error(`arena param ${key} must be a number > 0, got ${JSON.stringify(value)}`);
  return value;
}

/** The `laps` param: an integer ≥ 1. */
function lapsParam(params: ArenaParams, fallback: number): number {
  const laps = numberParam(params, "laps", fallback, 1);
  if (!Number.isInteger(laps)) throw new Error(`arena param laps must be an integer ≥ 1, got ${laps}`);
  return laps;
}

/**
 * Par time in frames of flying from `start` through `targets` `laps` times along straight lines at
 * `speed` units/s (rounded up).
 */
export function parFramesOf(
  start: Vector2,
  targets: readonly TargetSpec[],
  laps: number,
  speed: number,
): number {
  let length = 0;
  let at = start;
  for (let lap = 0; lap < laps; lap++)
    for (const t of targets) {
      length += at.distanceTo(t.position);
      at = t.position;
    }
  return Math.ceil(length / speed / TICK_SECONDS);
}

/**
 * The episode-level goals (stop, laps, par) on `spec`; `perLap` is the time limit of one lap. Without
 * goals the spec is returned unchanged (no keys added).
 */
function withEpisodeGoals(spec: EpisodeSpec, goals: GoalParams, perLap: number): EpisodeSpec {
  const laps = goals.laps ?? spec.laps ?? 1;
  return {
    ...spec,
    ...(goals.laps === undefined ? {} : { laps, timeLimitFrames: perLap * laps }),
    ...(goals.stop === undefined ? {} : { finishMaxSpeed: goals.stop }),
    ...(goals.parSpeed === undefined
      ? {}
      : { parFrames: parFramesOf(spec.start.position, spec.targets, laps, goals.parSpeed) }),
  };
}

/**
 * Builds a track into `world` and `race` with the given random; returns the track's own directional
 * gates (checkpoint index → width).
 */
type TrackBuilder = (world: World, race: RaceController, random: Random) => ReadonlyMap<number, number>;

/** A registry track as a builder: its own gates are the checkpoints the track gives a width. */
function registryBuilder(track: Track): TrackBuilder {
  return (world, race, random) => {
    track.build(world, race, random);
    const gates = new Map<number, number>();
    race.checkpoints.forEach((_, i) => {
      const width = race.gateWidth(i);
      if (width !== undefined) gates.set(i, width);
    });
    return gates;
  };
}

/**
 * Race legs: pieces of real race tracks from the track registry. Each scenario builds one track
 * (picked from `tracks`, with its own seed, so `random` makes a new race every time); each episode
 * starts at one of its checkpoints, facing as a racer respawning there would, and flies the next
 * `legs` checkpoints among the track's asteroids. Crashes respawn at the last checkpoint reached,
 * at rest, as in a race (with `crashMode: "respawn"`). Default `tracks`: `["random"]`, so the exam's
 * fixed tracks stay out of training unless named.
 * Params: `tracks`, `episodes`, `legs` per episode, `frames` per leg; goals (M7 S5, see
 * {@link GoalParams}): `gates`, `stop`, `laps`, `parSpeed`.
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
    const goals = goalParams(params, ["track", "all"]);

    const track = trackByName(tracks[intBetween(random, [0, tracks.length - 1])]!);
    return trackLegs(track.name, registryBuilder(track), random, episodes, legs, frames, goals);
  },
};

/**
 * Builds a track with a seed drawn from `random` and cuts `episodes` runs of `legs` consecutive
 * checkpoints from it (race-legs and generated-legs), with the goals on top.
 */
function trackLegs(
  name: string,
  build: TrackBuilder,
  random: Random,
  episodes: number,
  legs: number,
  frames: number,
  goals: GoalParams,
): Scenario {
  const world = new World();
  const race = new RaceController(NO_SERVER);
  const ownGates = build(world, race, seededRandom(Math.floor(random() * 2 ** 32)));
  const checkpoints = race.checkpoints;
  const available = checkpoints.length - 1;
  if (available < 1) throw new Error(`track ${name} has no legs`);
  // The gate width of checkpoint i under the `gates` goal, or undefined.
  const gateWidth = (i: number): number | undefined => {
    if (goals.gates === undefined) return undefined;
    const own = ownGates.get(i);
    if (own !== undefined || goals.gates === "track") return own;
    return i > 0 && i < checkpoints.length - 1 ? 2 * checkpoints[i]!.radius : undefined;
  };
  const n = Math.min(legs, available);
  const specs: EpisodeSpec[] = [];
  for (let i = 0; i < episodes; i++) {
    const from = intBetween(random, [0, available - n]);
    const start = checkpoints[from]!;
    const spec: EpisodeSpec = {
      start: { position: start.position.clone(), orientation: start.orientation },
      targets: checkpoints.slice(from + 1, from + 1 + n).map((c, k): TargetSpec => {
        const width = gateWidth(from + 1 + k);
        return {
          position: c.position.clone(),
          radius: c.radius,
          orientation: c.orientation,
          ...(width === undefined ? {} : { gate: { orientation: c.orientation, width } }),
        };
      }),
      timeLimitFrames: frames * n,
      respawn: "last-target",
    };
    specs.push(withEpisodeGoals(spec, goals, frames * n));
  }
  const obstacles = world.passiveCollisionEntities
    .filter((e) => e.type === EntityType.ASTEROID)
    .map((e): ObstacleSpec => ({ position: e.position.clone(), radius: e.radius }));
  return { obstacles, episodes: specs };
}

/** The `bands` param of generated-legs: a non-empty list of difficulty bands. */
function bandsParam(params: ArenaParams, fallback: TrackBand[]): TrackBand[] {
  const value = params.bands ?? fallback;
  if (!Array.isArray(value) || value.length === 0 || !value.every(isTrackBand))
    throw new Error(
      `arena param bands must be a non-empty list of ${TRACK_BAND_NAMES.join(" / ")}, got ${JSON.stringify(value)}`,
    );
  return value as TrackBand[];
}

/**
 * A generated track of `band` as a builder, drawing its seed from the world random exactly as the
 * registry's `generated:<band>` does; its own gates are the gate and chicane checkpoints (width
 * 2 × radius, as the race's `gates` rule would give them).
 */
function generatedBuilder(band: TrackBand): TrackBuilder {
  return (world, race, random) => {
    const track = generateTrack(Math.floor(random() * 2 ** 32), band);
    buildGeneratedTrack(track, world, race);
    return new Map(track.gates.map((g) => [g.point, 2 * track.points[g.point]!.radius]));
  };
}

/**
 * Generated legs (M7): like race-legs, but on procedurally generated tracks (track-generator.ts).
 * Each scenario generates one track of a band picked from `bands`, with its own seed; episodes are
 * runs of `legs` consecutive checkpoints among its corridors, gates, fields and belts. Crashes respawn
 * at the last checkpoint reached (with `crashMode: "respawn"`).
 * Params: `bands` (default all three), `episodes`, `legs` per episode, `frames` per leg; goals (M7
 * S5, see {@link GoalParams}): `gates` (`"track"` = the generator's gates and chicanes, `"all"`),
 * `stop`, `laps`, `parSpeed`.
 */
export const generatedLegsArena: Arena = {
  name: "generated-legs",
  description:
    "Legs of generated race tracks (easy/medium/hard bands); crashes respawn at the last checkpoint",
  tier: 3,
  generate(random, params) {
    const bands = bandsParam(params, [...TRACK_BAND_NAMES]);
    const episodes = numberParam(params, "episodes", 6, 1);
    const legs = numberParam(params, "legs", 3, 1);
    const frames = numberParam(params, "frames", 600, 1);
    if (!Number.isInteger(legs)) throw new Error(`arena param legs must be an integer, got ${legs}`);
    const goals = goalParams(params, ["track", "all"]);
    const band = bands[intBetween(random, [0, bands.length - 1])]!;
    return trackLegs(`generated:${band}`, generatedBuilder(band), random, episodes, legs, frames, goals);
  },
};

/** The direction angle (radians, x towards y) of the vector `v`. */
const angleOf = (v: Vector2) => Math.atan2(v.y, v.x);

/**
 * Gates (M7 S5): a chain of directional gates, no obstacles. Each target counts only when the ship's
 * centre crosses its line in its direction; the gate's direction differs from the leg that leads to
 * it by up to `skew` degrees (random side), so the ship has to line up instead of cutting across.
 * Params: `episodes`, `targets` [min, max], `distance` [min, max] per leg, `turn` [min, max] degrees
 * between legs, `width` of a gate, `skew` [min, max] degrees, `frames` per target; goals: `stop`,
 * `laps`, `parSpeed`.
 */
export const gatesArena: Arena = {
  name: "gates",
  description: "A chain of directional gates: each counts only when crossed in its direction",
  tier: 1,
  generate(random, params) {
    const episodes = numberParam(params, "episodes", 6, 1);
    const targets = intRangeParam(params, "targets", [3, 5], 1);
    const distance = rangeParam(params, "distance", [400, 900]);
    const turn = rangeParam(params, "turn", [0, 90]);
    const width = numberParam(params, "width", 200, 1);
    const skew = rangeParam(params, "skew", [0, 45]);
    const frames = numberParam(params, "frames", 600, 1);
    const goals = goalParams(params);

    const specs: EpisodeSpec[] = [];
    for (let i = 0; i < episodes; i++) {
      const orientation = random() * Math.PI * 2;
      const count = intBetween(random, targets);
      const points = chainPoints(random, Vector2.zero(), count, distance, turn);
      const specTargets = points.map((position, k): TargetSpec => {
        const side = random() < 0.5 ? -1 : 1;
        const leg = position.minus(k === 0 ? Vector2.zero() : points[k - 1]!);
        const gate = headingToOrientation(angleOf(leg) + side * between(random, skew) * DEG);
        return { position, radius: width / 2, orientation: gate, gate: { orientation: gate, width } };
      });
      const spec: EpisodeSpec = {
        start: { position: Vector2.zero(), orientation },
        targets: specTargets,
        timeLimitFrames: frames * count,
      };
      specs.push(withEpisodeGoals(spec, goals, frames * count));
    }
    return { obstacles: [], episodes: specs };
  },
};

/**
 * Laps (M7 S5): a small circuit flown several times, no obstacles. The ship starts at rest on the
 * circuit's start line facing the first target; the targets sit round a ring (`ring` radius, ±15 %
 * per target), the last one back on the start, like a lap race's finish. With `gates: true` every
 * target is a directional gate along the circuit (width 2 × `radius`).
 * Params: `episodes`, `targets` [min, max] per lap, `ring` [min, max] radius, `radius`, `laps`
 * (default 3), `gates`, `frames` per target (time limit = frames × targets × laps); goals: `stop`,
 * `parSpeed`.
 */
export const lapsArena: Arena = {
  name: "laps",
  description: "A small circuit of targets flown several laps",
  tier: 1,
  generate(random, params) {
    const episodes = numberParam(params, "episodes", 4, 1);
    const targets = intRangeParam(params, "targets", [3, 5], 2);
    const ring = rangeParam(params, "ring", [400, 700]);
    const radius = numberParam(params, "radius", 50, 1);
    const laps = lapsParam(params, 3);
    const frames = numberParam(params, "frames", 600, 1);
    if (params.gates !== undefined && typeof params.gates !== "boolean")
      throw new Error(`arena param gates must be true or false, got ${JSON.stringify(params.gates)}`);
    const gates = params.gates === true;
    if (ring[0] <= 2 * radius)
      throw new Error(`arena param ring must be > 2 × radius, got ${JSON.stringify(ring)}`);
    const { gates: _gates, laps: _laps, ...rest } = params;
    const goals = goalParams(rest);

    const specs: EpisodeSpec[] = [];
    for (let i = 0; i < episodes; i++) {
      const count = intBetween(random, targets);
      const r = between(random, ring);
      const start = random() * Math.PI * 2;
      const direction = random() < 0.5 ? -1 : 1;
      // The start (origin) is on the ring at angle `start` round the centre.
      const centre = new Vector2(-Math.cos(start), -Math.sin(start)).scale(r);
      const points = Array.from({ length: count }, (_, k) => {
        if (k === count - 1) return Vector2.zero();
        const a = start + (direction * 2 * Math.PI * (k + 1)) / count;
        return centre.plus(new Vector2(Math.cos(a), Math.sin(a)).scale(r * (0.85 + random() * 0.3)));
      });
      const specTargets = points.map((position, k): TargetSpec => {
        const along = points[(k + 1) % count]!.minus(points[(k + count - 1) % count]!);
        const orientation = headingToOrientation(angleOf(along));
        return {
          position,
          radius,
          orientation,
          ...(gates ? { gate: { orientation, width: 2 * radius } } : {}),
        };
      });
      const spec: EpisodeSpec = {
        start: { position: Vector2.zero(), orientation: headingToOrientation(angleOf(points[0]!)) },
        targets: specTargets,
        timeLimitFrames: frames * count * laps,
        laps,
      };
      specs.push(withEpisodeGoals(spec, goals, frames * count));
    }
    return { obstacles: [], episodes: specs };
  },
};

/** The tiered arenas, in tier order within M5's and M7's (new arenas at the end). */
export const TIER_ARENAS: readonly Arena[] = [
  stopArena,
  turnAndGoArena,
  chainArena,
  corridorArena,
  fieldArena,
  raceLegsArena,
  generatedLegsArena,
  gatesArena,
  lapsArena,
];

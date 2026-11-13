import { Entity, EntityType, Vector2 } from "@ar/shared";
import { createArrow, generateAsteroidBelt } from "./scene-controller";
import type { Track } from "./tracks";

/** The format tag every track file starts with. A new, incompatible format gets a new version. */
export const TRACK_FORMAT = "asteroid-racers/track/v1";

/** Radius of the start portal, the checkpoints (default) and the finish, as in `RaceController`. */
const RACE_RADIUS = 100;
/** Players without a race spawn here (`GameServer`'s world spawn): it must be free of rocks. */
const WORLD_SPAWN = { x: 0, y: 0, radius: 100 };

/**
 * A point of the race. `heading` is in degrees as seen on screen, clockwise: 0 = up (−y), 90 = right
 * (+x), 180 = down, 270 = left. Left out, the point faces the next point of the race (the finish
 * faces along the last leg).
 */
export interface TrackPoint {
  x: number;
  y: number;
  heading?: number;
}

export interface TrackCheckpoint extends TrackPoint {
  /** Default 100. */
  radius?: number;
}

/**
 * A rectangle filled with random asteroids from the track's seed (like the code tracks' belts):
 * `count` rocks, or the default density times `density` (default 1).
 */
export interface TrackBelt {
  x: number;
  y: number;
  width: number;
  height: number;
  count?: number;
  density?: number;
}

/** A track file (`packages/server/src/tracks/*.json`), format {@link TRACK_FORMAT}. */
export interface TrackFile {
  format: typeof TRACK_FORMAT;
  /** Lower case, digits and dashes; the file is `<name>.json`. */
  name: string;
  description: string;
  author?: string;
  race: {
    start: TrackPoint;
    checkpoints: TrackCheckpoint[];
    finish: TrackPoint;
  };
  /** Fixed asteroids: `[x, y, radius]`. */
  asteroids?: [number, number, number][];
  /** Random asteroids per seed, added before the fixed ones. */
  belts?: TrackBelt[];
  /** Guiding arrows (decoration, no collision): `[x, y, heading]`. */
  arrows?: [number, number, number][];
}

/** A track file that fails validation. The message names the file and the offending field. */
export class TrackFileError extends Error {
  override name = "TrackFileError";
}

/**
 * Checks `raw` (parsed JSON) against the format and the track rules and returns it typed. Throws a
 * {@link TrackFileError} that names the field: unknown keys, wrong types, no checkpoints, a race
 * point overlapping an asteroid or a belt, the world spawn (0, 0) not clear.
 */
export function parseTrackFile(raw: unknown, source = "track file"): TrackFile {
  const fail = (path: string, message: string): never => {
    throw new TrackFileError(`${source}: ${path} ${message}`);
  };
  const object = (v: unknown, path: string, required: string[], optional: string[] = []) => {
    if (typeof v !== "object" || v === null || Array.isArray(v)) return fail(path, "must be an object");
    const o = v as Record<string, unknown>;
    for (const key of required) if (!(key in o)) fail(path, `is missing "${key}"`);
    for (const key of Object.keys(o))
      if (!required.includes(key) && !optional.includes(key))
        fail(path, `has an unknown key "${key}" (allowed: ${[...required, ...optional].join(", ")})`);
    return o;
  };
  const number = (v: unknown, path: string, { positive = false, nonZero = false } = {}) => {
    if (typeof v !== "number" || !Number.isFinite(v)) return fail(path, "must be a finite number");
    if (positive && !(v > 0)) fail(path, "must be > 0");
    if (nonZero && v === 0) fail(path, "must not be 0");
    return v;
  };
  const string = (v: unknown, path: string) => (typeof v === "string" ? v : fail(path, "must be a string"));
  const list = (v: unknown, path: string) =>
    Array.isArray(v) ? (v as unknown[]) : fail(path, "must be a list");
  const tuple = (v: unknown, path: string, names: string[], positiveLast: boolean) => {
    const t = list(v, path);
    if (t.length !== names.length) fail(path, `must be [${names.join(", ")}]`);
    return t.map((n, i) =>
      number(n, `${path}[${i}] (${names[i]})`, { positive: positiveLast && i === names.length - 1 }),
    ) as [number, number, number];
  };
  const point = (v: unknown, path: string, withRadius: boolean): TrackCheckpoint => {
    const o = object(v, path, ["x", "y"], withRadius ? ["heading", "radius"] : ["heading"]);
    const p: TrackCheckpoint = { x: number(o.x, `${path}.x`), y: number(o.y, `${path}.y`) };
    if (o.heading !== undefined) p.heading = number(o.heading, `${path}.heading`);
    if (o.radius !== undefined) p.radius = number(o.radius, `${path}.radius`, { positive: true });
    return p;
  };

  const top = object(
    raw,
    "the track",
    ["format", "name", "description", "race"],
    ["author", "asteroids", "belts", "arrows"],
  );
  if (top.format !== TRACK_FORMAT)
    fail("format", `must be ${JSON.stringify(TRACK_FORMAT)}, not ${JSON.stringify(top.format)}`);
  const name = string(top.name, "name");
  if (!/^[a-z][a-z0-9-]*$/.test(name)) fail("name", "must be lower case letters, digits and dashes");
  const raceRaw = object(top.race, "race", ["start", "checkpoints", "finish"]);
  const checkpointsRaw = list(raceRaw.checkpoints, "race.checkpoints");
  if (checkpointsRaw.length === 0) fail("race.checkpoints", "must have at least one checkpoint");

  const file: TrackFile = {
    format: TRACK_FORMAT,
    name,
    description: string(top.description, "description"),
    race: {
      start: point(raceRaw.start, "race.start", false),
      checkpoints: checkpointsRaw.map((c, i) => point(c, `race.checkpoints[${i}]`, true)),
      finish: point(raceRaw.finish, "race.finish", false),
    },
  };
  if (top.author !== undefined) file.author = string(top.author, "author");
  if (top.asteroids !== undefined)
    file.asteroids = list(top.asteroids, "asteroids").map((a, i) =>
      tuple(a, `asteroids[${i}]`, ["x", "y", "radius"], true),
    );
  if (top.arrows !== undefined)
    file.arrows = list(top.arrows, "arrows").map((a, i) =>
      tuple(a, `arrows[${i}]`, ["x", "y", "heading"], false),
    );
  if (top.belts !== undefined)
    file.belts = list(top.belts, "belts").map((b, i) => {
      const path = `belts[${i}]`;
      const o = object(b, path, ["x", "y", "width", "height"], ["count", "density"]);
      const belt: TrackBelt = {
        x: number(o.x, `${path}.x`),
        y: number(o.y, `${path}.y`),
        width: number(o.width, `${path}.width`, { nonZero: true }),
        height: number(o.height, `${path}.height`, { nonZero: true }),
      };
      if (o.count !== undefined) {
        belt.count = number(o.count, `${path}.count`);
        if (!Number.isInteger(belt.count) || belt.count < 0) fail(`${path}.count`, "must be an integer ≥ 0");
      }
      if (o.density !== undefined) belt.density = number(o.density, `${path}.density`, { positive: true });
      return belt;
    });

  // Every circle that must stay free of rocks: the race points and the world spawn.
  const circles: { path: string; x: number; y: number; radius: number }[] = [
    { path: "race.start (the portal)", ...file.race.start, radius: RACE_RADIUS },
    ...file.race.checkpoints.map((c, i) => ({
      path: `race.checkpoints[${i}]`,
      x: c.x,
      y: c.y,
      radius: c.radius ?? RACE_RADIUS,
    })),
    { path: "race.finish", ...file.race.finish, radius: RACE_RADIUS },
    { path: "the world spawn (0, 0)", ...WORLD_SPAWN },
  ];
  for (const c of circles) {
    file.asteroids?.forEach(([x, y, r], i) => {
      if (Math.hypot(c.x - x, c.y - y) < c.radius + r)
        fail(c.path, `overlaps asteroids[${i}] at (${x}, ${y}) with radius ${r}`);
    });
    file.belts?.forEach((b, i) => {
      const [x0, x1] = b.width > 0 ? [b.x, b.x + b.width] : [b.x + b.width, b.x];
      const [y0, y1] = b.height > 0 ? [b.y, b.y + b.height] : [b.y + b.height, b.y];
      const dx = Math.max(x0 - c.x, 0, c.x - x1);
      const dy = Math.max(y0 - c.y, 0, c.y - y1);
      if (Math.hypot(dx, dy) < c.radius) fail(c.path, `overlaps belts[${i}]`);
    });
  }
  return file;
}

/** Degrees on screen (0 = up, clockwise) → the game's orientation in radians (π = up). */
export function headingToOrientation(heading: number): number {
  return ((((heading + 180) % 360) + 360) % 360) * (Math.PI / 180);
}

/** The game's orientation of a ship at `from` facing `to`. */
function facing(from: TrackPoint, to: TrackPoint): number {
  const orientation = Math.atan2(to.x - from.x, -(to.y - from.y)) + Math.PI;
  return orientation >= 2 * Math.PI ? orientation - 2 * Math.PI : orientation;
}

/**
 * A registry track built from a (validated) file. Order of entities: belts, fixed asteroids, arrows,
 * then the race (checkpoints, portal, finish), the same order as the code tracks.
 */
export function trackFromFile(file: TrackFile): Track {
  const { start, checkpoints, finish } = file.race;
  const points: TrackPoint[] = [start, ...checkpoints, finish];
  const orientationAt = (i: number): number => {
    const p = points[i]!;
    if (p.heading !== undefined) return headingToOrientation(p.heading);
    return i < points.length - 1 ? facing(p, points[i + 1]!) : facing(points[i - 1]!, p);
  };
  return {
    name: file.name,
    description: file.description,
    build(world, race, random) {
      const rocks: Entity[] = [];
      for (const b of file.belts ?? []) {
        const options: { count?: number; densityFactor?: number } = {};
        if (b.count !== undefined) options.count = b.count;
        if (b.density !== undefined) options.densityFactor = b.density;
        rocks.push(...generateAsteroidBelt(random, b.x, b.y, b.width, b.height, options));
      }
      for (const [x, y, radius] of file.asteroids ?? [])
        rocks.push(new Entity({ type: EntityType.ASTEROID, position: new Vector2(x, y), radius }));
      world.addEntities(rocks);
      world.passiveCollisionEntities.push(...rocks);
      for (const [x, y, heading] of file.arrows ?? [])
        world.addEntity(createArrow(x, y, headingToOrientation(heading)));

      race.addStart(start.x, start.y, orientationAt(0));
      checkpoints.forEach((c, i) => race.addCheckpoint(c.x, c.y, orientationAt(i + 1), c.radius));
      race.addFinish(finish.x, finish.y, orientationAt(points.length - 1));
      world.addEntities(race.checkpoints);
      if (race.start) world.addEntity(race.start);
      if (race.finish) world.addEntity(race.finish);
    },
  };
}

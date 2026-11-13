import { Vector2, type Entity, type Movable } from "@ar/shared";
import type { ObstacleGrid } from "./obstacle-grid";

/**
 * Obstacle sensors: extra model inputs that describe nearby asteroids. Each sensor type has a size
 * (number of inputs), a reader that fills them from what the bot knows (its ship, its target and the
 * asteroids it has been told about) and a geometry for drawing. All values are deterministic and
 * scaled to roughly −1..1. Angles are relative to the ship's nose, in half turns, like the classic
 * inputs.
 */

export interface WhiskersSpec {
  type: "whiskers";
  /** Number of rays. */
  count: number;
  /** Fan width in degrees, centred on the nose (180 = from left to right). */
  spread: number;
  range: number;
  /** Time mode (seconds): closeness by time to impact instead of distance. Absent = distance. */
  horizon?: number;
}
export interface SectorsSpec {
  type: "sectors";
  /** Number of equal sectors around the ship; sector 0 is centred on the nose. */
  count: number;
  range: number;
  /** Time mode, as for whiskers. */
  horizon?: number;
}
export interface NearestSpec {
  type: "nearest";
  /** Number of nearest obstacles reported. */
  k: number;
  range: number;
  /** 1: every slot gets a leading "present" input and empty slots read all 0. Absent = the old padding. */
  flag?: number;
}
export interface LineCheckSpec {
  type: "lineCheck";
  range: number;
  /** Time mode, as for whiskers (the first value only; the offset stays as it is). */
  horizon?: number;
}
export type SensorSpec = WhiskersSpec | SectorsSpec | NearestSpec | LineCheckSpec;
export type SensorType = SensorSpec["type"];

export interface SensorContext {
  ship: Movable;
  target: Vector2;
  obstacles: ObstacleGrid;
}

/** Something to draw for a sensor reading: a segment (lit = it found something) or a marked rock. */
export type SensorPrimitive =
  | { kind: "segment"; x1: number; y1: number; x2: number; y2: number; lit: boolean }
  | { kind: "rock"; x: number; y: number; r: number };

const TURN = Math.PI;

function wrapUnit(angle: number): number {
  if (angle > 1) return angle - 2;
  if (angle < -1) return angle + 2;
  return angle;
}

/** Angle of (dx, dy) relative to the nose, in half turns (same as the classic inputs). */
function relative(dx: number, dy: number, orientation: number): number {
  let towards = Math.atan2(dy, dx) / Math.PI - 0.5;
  if (towards < -1) towards += 2;
  return wrapUnit(towards - orientation / Math.PI);
}

/** The world direction at `angle` half turns from the nose. */
function direction(orientation: number, angle: number): Vector2 {
  return new Vector2(0, 1).rotated(orientation + angle * TURN);
}

/** Distance along a ray (from p, unit direction d) to where it enters a circle, or Infinity. */
function rayCircle(
  px: number,
  py: number,
  dx: number,
  dy: number,
  cx: number,
  cy: number,
  r: number,
): number {
  const ox = cx - px;
  const oy = cy - py;
  const c = ox * ox + oy * oy - r * r;
  if (c <= 0) return 0; // already inside
  const b = ox * dx + oy * dy;
  if (b <= 0) return Infinity;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  return b - Math.sqrt(disc);
}

/**
 * Closing speeds below this count as this, so a slow or resting ship still sees rocks within
 * `horizon × MIN_CLOSING_SPEED` units.
 */
export const MIN_CLOSING_SPEED = 100;
/** Search range of a time-mode sensor when the config gives no `range`. */
export const TIME_MODE_RANGE = 2500;

/**
 * The 0..1 closeness of an obstacle `distance` away in direction (dx, dy): by distance
 * (1 − distance / range) or, in time mode, by time to impact (1 − time / horizon). 0 = nothing.
 */
function closeness(
  s: { range: number; horizon?: number },
  ship: Movable,
  distance: number,
  dx: number,
  dy: number,
): number {
  if (!(distance < s.range)) return 0;
  if (s.horizon === undefined) return 1 - distance / s.range;
  const closing = Math.max(MIN_CLOSING_SPEED, ship.velocity.x * dx + ship.velocity.y * dy);
  const time = distance / closing;
  return time < s.horizon ? 1 - time / s.horizon : 0;
}

const edgeDistance = (ship: Movable, o: Entity) =>
  Math.max(0, ship.position.distanceTo(o.position) - o.radius - ship.radius);

function whiskerAngles(s: WhiskersSpec): number[] {
  const spread = s.spread / 180; // half turns
  if (s.count === 1) return [0];
  return Array.from({ length: s.count }, (_, i) => -spread / 2 + (i * spread) / (s.count - 1));
}

interface SensorKind<S extends SensorSpec> {
  size(spec: S): number;
  read(spec: S, ctx: SensorContext, out: Float64Array, offset: number): void;
  draw(spec: S, ctx: SensorContext): SensorPrimitive[];
}

const whiskers: SensorKind<WhiskersSpec> = {
  size: (s) => s.count,
  read(s, ctx, out, offset) {
    whiskerHits(s, ctx).forEach(({ t, d }, i) => (out[offset + i] = closeness(s, ctx.ship, t, d.x, d.y)));
  },
  draw(s, ctx) {
    const { x, y } = ctx.ship.position;
    return whiskerHits(s, ctx).map(({ t, d }) => {
      const lit = closeness(s, ctx.ship, t, d.x, d.y) > 0;
      const length = lit ? t : s.range;
      return {
        kind: "segment",
        x1: x,
        y1: y,
        x2: x + d.x * length,
        y2: y + d.y * length,
        lit,
      };
    });
  },
};

/** Per ray: its world direction and the distance to the first rock it hits (Infinity if none). */
function whiskerHits(s: WhiskersSpec, { ship, obstacles }: SensorContext): { t: number; d: Vector2 }[] {
  const { x, y } = ship.position;
  // Unsorted is fine: each ray takes a minimum over all rocks.
  const near = obstacles.nearUnsorted(x, y, s.range);
  return whiskerAngles(s).map((a) => {
    const d = direction(ship.orientation, a);
    let t = Infinity;
    for (const o of near)
      t = Math.min(t, rayCircle(x, y, d.x, d.y, o.position.x, o.position.y, o.radius + ship.radius));
    return { t, d };
  });
}

function sectorOf(s: SectorsSpec, angle: number): number {
  const width = 2 / s.count;
  const shifted = (((angle + width / 2) % 2) + 2) % 2;
  return Math.min(s.count - 1, Math.floor(shifted / width));
}

const sectors: SensorKind<SectorsSpec> = {
  size: (s) => s.count,
  read(s, ctx, out, offset) {
    sectorReadings(s, ctx).forEach(({ value }, i) => (out[offset + i] = value));
  },
  draw(s, ctx) {
    const { x, y } = ctx.ship.position;
    return sectorReadings(s, ctx).map(({ value, edge }, i): SensorPrimitive => {
      const d = direction(ctx.ship.orientation, i * (2 / s.count));
      const length = value > 0 ? edge : s.range;
      return { kind: "segment", x1: x, y1: y, x2: x + d.x * length, y2: y + d.y * length, lit: value > 0 };
    });
  },
};

/** Per sector: the highest closeness of a rock in it, and that rock's edge distance. */
function sectorReadings(
  s: SectorsSpec,
  { ship, obstacles }: SensorContext,
): { value: number; edge: number }[] {
  const readings = Array.from({ length: s.count }, () => ({ value: 0, edge: Infinity }));
  const { x, y } = ship.position;
  for (const o of obstacles.near(x, y, s.range + ship.radius)) {
    const edge = edgeDistance(ship, o);
    if (edge >= s.range) continue;
    const ox = o.position.x - x;
    const oy = o.position.y - y;
    const length = Math.hypot(ox, oy) || 1;
    const value = closeness(s, ship, edge, ox / length, oy / length);
    const r = readings[sectorOf(s, relative(ox, oy, ship.orientation))]!;
    if (value > r.value) {
      r.value = value;
      r.edge = edge;
    }
  }
  return readings;
}

function nearestRocks(s: NearestSpec, { ship, obstacles }: SensorContext): Entity[] {
  // Unsorted is fine: the sort below orders by (edge, id), a total order for a world's unique ids.
  return obstacles
    .nearUnsorted(ship.position.x, ship.position.y, s.range + ship.radius)
    .map((o) => ({ o, edge: edgeDistance(ship, o) }))
    .filter((e) => e.edge < s.range)
    .sort((a, b) => a.edge - b.edge || a.o.id - b.o.id)
    .slice(0, s.k)
    .map((e) => e.o);
}

const nearest: SensorKind<NearestSpec> = {
  size: (s) => (s.flag ? 4 : 3) * s.k,
  read(s, ctx, out, offset) {
    const { ship } = ctx;
    const rocks = nearestRocks(s, ctx);
    for (let i = 0; i < s.k; i++) {
      const o = rocks[i];
      if (s.flag) {
        const j = offset + 4 * i;
        out[j] = o ? 1 : 0;
        out[j + 1] = o
          ? relative(o.position.x - ship.position.x, o.position.y - ship.position.y, ship.orientation)
          : 0;
        out[j + 2] = o ? edgeDistance(ship, o) / s.range : 0;
        out[j + 3] = o ? o.radius / 100 : 0;
        continue;
      }
      const j = offset + 3 * i;
      if (!o) {
        out[j] = 0;
        out[j + 1] = 1;
        out[j + 2] = 0;
        continue;
      }
      out[j] = relative(o.position.x - ship.position.x, o.position.y - ship.position.y, ship.orientation);
      out[j + 1] = edgeDistance(ship, o) / s.range;
      out[j + 2] = o.radius / 100;
    }
  },
  draw(s, ctx) {
    const { x, y } = ctx.ship.position;
    return nearestRocks(s, ctx).flatMap((o): SensorPrimitive[] => [
      { kind: "segment", x1: x, y1: y, x2: o.position.x, y2: o.position.y, lit: true },
      { kind: "rock", x: o.position.x, y: o.position.y, r: o.radius },
    ]);
  },
};

/** The first obstacle in the ship-wide corridor on the way to the target: [distance along, offset]. */
function firstOnLine(s: LineCheckSpec, { ship, target, obstacles }: SensorContext) {
  const { x, y } = ship.position;
  const tx = target.x - x;
  const ty = target.y - y;
  const distance = Math.hypot(tx, ty);
  const length = Math.min(distance, s.range);
  if (length === 0) return undefined;
  const dx = tx / distance;
  const dy = ty / distance;
  let bestAlong = Infinity;
  let bestOffset = 0;
  let bestRock: Entity | undefined;
  // Unsorted candidates; the smallest `along` wins and ties go to the smaller id: the same rock the
  // id-sorted scan with a strict "<" picks (ids are unique in a world).
  for (const o of obstacles.nearUnsorted(
    x + (dx * length) / 2,
    y + (dy * length) / 2,
    length / 2 + ship.radius,
  )) {
    const ox = o.position.x - x;
    const oy = o.position.y - y;
    const t = ox * dx + oy * dy;
    const lateral = ox * dy - oy * dx;
    const reach = o.radius + ship.radius;
    if (t < -reach || t > length + reach || Math.abs(lateral) >= reach) continue;
    const along = Math.max(0, t - Math.sqrt(reach * reach - lateral * lateral));
    if (along > length) continue;
    if (!bestRock || along < bestAlong || (along === bestAlong && o.id < bestRock.id)) {
      bestAlong = along;
      bestOffset = lateral / reach;
      bestRock = o;
    }
  }
  return bestRock
    ? { along: bestAlong, offset: bestOffset, rock: bestRock, dx, dy, length }
    : { along: Infinity, offset: 0, rock: undefined, dx, dy, length };
}

const lineCheck: SensorKind<LineCheckSpec> = {
  size: () => 2,
  read(s, ctx, out, offset) {
    const hit = firstOnLine(s, ctx);
    const found = hit && Number.isFinite(hit.along);
    out[offset] = found ? closeness(s, ctx.ship, hit.along, hit.dx, hit.dy) : 0;
    out[offset + 1] = found ? hit.offset : 0;
  },
  draw(s, ctx) {
    const hit = firstOnLine(s, ctx);
    if (!hit) return [];
    const { x, y } = ctx.ship.position;
    const found = Number.isFinite(hit.along);
    const length = found ? hit.along : hit.length;
    const segment: SensorPrimitive = {
      kind: "segment",
      x1: x,
      y1: y,
      x2: x + hit.dx * length,
      y2: y + hit.dy * length,
      lit: found,
    };
    return hit.rock
      ? [segment, { kind: "rock", x: hit.rock.position.x, y: hit.rock.position.y, r: hit.rock.radius }]
      : [segment];
  },
};

const KINDS: { [T in SensorType]: SensorKind<Extract<SensorSpec, { type: T }>> } = {
  whiskers,
  sectors,
  nearest,
  lineCheck,
};

const kindOf = (s: SensorSpec) => KINDS[s.type] as SensorKind<SensorSpec>;

export function sensorSize(spec: SensorSpec): number {
  return kindOf(spec).size(spec);
}

/** Fills `out` from `offset` with every sensor's inputs, in order. */
export function readSensors(
  specs: readonly SensorSpec[],
  ctx: SensorContext,
  out: Float64Array,
  offset: number,
): void {
  for (const s of specs) {
    kindOf(s).read(s, ctx, out, offset);
    offset += kindOf(s).size(s);
  }
}

export function drawSensors(specs: readonly SensorSpec[], ctx: SensorContext): SensorPrimitive[] {
  return specs.flatMap((s) => kindOf(s).draw(s, ctx));
}

/** Default parameters, and the order sensors are appended in. */
export const SENSOR_DEFAULTS: { [T in SensorType]: Omit<Extract<SensorSpec, { type: T }>, "type"> } = {
  whiskers: { count: 7, spread: 180, range: 600 },
  sectors: { count: 8, range: 600 },
  nearest: { k: 3, range: 800 },
  lineCheck: { range: 1000 },
};

/** Optional parameters per sensor: absent = off, so older specs stay exactly as they were. */
const SENSOR_OPTIONAL: { [T in SensorType]: readonly string[] } = {
  whiskers: ["horizon"],
  sectors: ["horizon"],
  nearest: ["flag"],
  lineCheck: ["horizon"],
};

/**
 * The `sensors` section of a training config: `{ whiskers: { count, spread, range }, sectors: {...},
 * nearest: {...}, lineCheck: {...} }`, each optional, `{}` meaning the defaults. Absent = no sensors.
 * Optional: `horizon` (seconds) switches whiskers, sectors and lineCheck to time to impact, with a
 * default range of {@link TIME_MODE_RANGE}; `nearest.flag: 1` adds a "present" input per slot.
 */
export function parseSensors(raw: unknown): SensorSpec[] {
  if (raw === undefined) return [];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    throw new Error("sensors must be an object");
  const entries = raw as Record<string, unknown>;
  for (const key of Object.keys(entries))
    if (!(key in SENSOR_DEFAULTS))
      throw new Error(
        `unknown sensor ${JSON.stringify(key)}; known: ${Object.keys(SENSOR_DEFAULTS).join(", ")}`,
      );
  const specs: SensorSpec[] = [];
  for (const type of Object.keys(SENSOR_DEFAULTS) as SensorType[]) {
    const params = entries[type];
    if (params === undefined) continue;
    if (typeof params !== "object" || params === null || Array.isArray(params))
      throw new Error(`sensors.${type} must be an object of parameters`);
    const defaults = SENSOR_DEFAULTS[type] as Record<string, number>;
    const spec: Record<string, unknown> = { type, ...defaults };
    for (const [key, value] of Object.entries(params)) {
      if (!(key in defaults) && !SENSOR_OPTIONAL[type].includes(key))
        throw new Error(`unknown parameter sensors.${type}.${key}`);
      if (key === "flag" && value !== 1) throw new Error(`sensors.${type}.flag must be 1 (or absent)`);
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
        throw new Error(`sensors.${type}.${key} must be a number > 0`);
      if ((key === "count" || key === "k") && !Number.isInteger(value))
        throw new Error(`sensors.${type}.${key} must be an integer`);
      spec[key] = value;
    }
    // Time mode looks further by default: at 1,000 units/s a 2 s horizon needs 2,000 units.
    if ("horizon" in params && !("range" in params)) spec.range = TIME_MODE_RANGE;
    specs.push(spec as unknown as SensorSpec);
  }
  return specs;
}

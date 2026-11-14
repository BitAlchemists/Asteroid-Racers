import { Entity, EntityType, Vector2, type World } from "@ar/shared";
import type { RaceController } from "./race-controller";
import { seededRandom, type Random } from "./random";
import { createArrow } from "./scene-controller";
import type { Track } from "./tracks";

// The procedural track generator of M7 (doc/plans/M7-benchmark-v2.md, step S1). A track is a chain
// of legs from race point to race point; each leg is one element (an open straight, a walled
// corridor with bends or a hairpin, a gate of two rocks, a chicane of gates, a rock field along the
// racing line, an asteroid belt across it). A difficulty band sets the leg lengths, turn angles,
// corridor and gate widths and rock densities. Everything is decided by `(seed, band)`, and every
// track is checked geometrically before it is returned (see `validateGeneratedTrack`).

/** The difficulty bands. */
export type TrackBand = "easy" | "medium" | "hard";
export const TRACK_BAND_NAMES: readonly TrackBand[] = ["easy", "medium", "hard"];
export const isTrackBand = (v: unknown): v is TrackBand =>
  typeof v === "string" && (TRACK_BAND_NAMES as readonly string[]).includes(v);

/** The elements a leg can be. */
export type LegKind = "straight" | "corridor" | "gate" | "chicane" | "field" | "belt";
const LEG_KINDS: readonly LegKind[] = ["straight", "corridor", "gate", "chicane", "field", "belt"];

/** What a band sets. Lengths in units, angles in degrees, densities in rocks per 1,000 × 1,000 units. */
export interface BandSpec {
  /** Legs per track (race points − 1). */
  legs: number;
  /** Length of an ordinary leg. */
  legLength: [number, number];
  /** Turn at an ordinary race point. */
  turn: [number, number];
  /** A long straight is `legLength[1] × straightFactor` long ... */
  straightFactor: number;
  /** ... and is followed by a turn in this range. */
  sharpTurn: [number, number];
  /** Free width between the walls of a corridor. */
  corridorWidth: number;
  /** Bend between the pieces of a corridor. */
  bend: [number, number];
  /** Chance that a corridor is a hairpin (two 90° bends to the same side: the corridor turns back). */
  hairpinChance: number;
  /** Free gap between the two rocks of a gate. */
  gateGap: number;
  /** Turn between the gates of a chicane (alternating sides). */
  chicaneTurn: number;
  /** Rock density of a field along the racing line, and its half width across the line. */
  fieldDensity: number;
  fieldHalfWidth: number;
  /** Rock density of a belt across the line, and its thickness along the line. */
  beltDensity: number;
  beltThickness: number;
  /** Radius of field, belt and wall rocks. */
  rockRadius: [number, number];
  /** Relative weight of each element. */
  weights: Readonly<Record<LegKind, number>>;
}

/**
 * The bands. Harder means: more and shorter legs, sharper turns (and sharper turns after the long
 * straights), narrower corridors with sharper bends and hairpins, narrower gates and chicanes with
 * bigger swings, denser fields and thicker, denser belts with bigger rocks.
 */
export const TRACK_BANDS: Readonly<Record<TrackBand, Readonly<BandSpec>>> = {
  easy: {
    legs: 6,
    legLength: [700, 1000],
    turn: [10, 50],
    straightFactor: 1.5,
    sharpTurn: [60, 90],
    corridorWidth: 360,
    bend: [20, 45],
    hairpinChance: 0,
    gateGap: 300,
    chicaneTurn: 25,
    fieldDensity: 40,
    fieldHalfWidth: 200,
    beltDensity: 40,
    beltThickness: 200,
    rockRadius: [20, 45],
    weights: { straight: 3, corridor: 3, gate: 2, chicane: 0.5, field: 2, belt: 1 },
  },
  medium: {
    legs: 8,
    legLength: [550, 900],
    turn: [30, 90],
    straightFactor: 1.8,
    sharpTurn: [90, 120],
    corridorWidth: 280,
    bend: [35, 75],
    hairpinChance: 0.25,
    gateGap: 220,
    chicaneTurn: 35,
    fieldDensity: 70,
    fieldHalfWidth: 250,
    beltDensity: 55,
    beltThickness: 300,
    rockRadius: [20, 55],
    weights: { straight: 2, corridor: 3, gate: 2, chicane: 0.7, field: 2, belt: 2 },
  },
  hard: {
    legs: 10,
    legLength: [450, 800],
    turn: [60, 135],
    straightFactor: 2.2,
    sharpTurn: [120, 150],
    corridorWidth: 210,
    bend: [60, 90],
    hairpinChance: 0.5,
    gateGap: 150,
    chicaneTurn: 45,
    fieldDensity: 100,
    fieldHalfWidth: 300,
    beltDensity: 70,
    beltThickness: 400,
    rockRadius: [20, 60],
    weights: { straight: 2, corridor: 4, gate: 2, chicane: 1, field: 2, belt: 2 },
  },
};

/**
 * Track seeds reserved for exam v3 (M8 step 1): every generated race of exam v3.0 (easy 300001–20,
 * medium 310001–20, hard 320001–20, goal races 330001–5 and 340001–5) lies in this range, whatever
 * its band. Training never draws a seed from it (`drawTrainingTrackSeed`), so the exam's tracks stay
 * unseen. A test keeps the exam's seeds inside the range.
 */
export const EXAM_TRACK_SEEDS: Readonly<{ from: number; to: number }> = Object.freeze({
  from: 300_001,
  to: 340_005,
});

/** Whether `seed` is in the range reserved for the exam ({@link EXAM_TRACK_SEEDS}). */
export const isExamTrackSeed = (seed: number): boolean =>
  seed >= EXAM_TRACK_SEEDS.from && seed <= EXAM_TRACK_SEEDS.to;

/**
 * A generated track's seed for training: a 32-bit draw from `random`, drawn again while it falls in
 * the exam's range. A draw outside the range is returned as is, so the stream is unchanged unless
 * a draw hits the range (about 1 in 10⁵).
 */
export function drawTrainingTrackSeed(random: Random): number {
  let seed = Math.floor(random() * 2 ** 32);
  while (isExamTrackSeed(seed)) seed = Math.floor(random() * 2 ** 32);
  return seed;
}

/** The ship's radius (`SHIP_RADIUS` in game-server.ts; a test keeps them equal). */
export const GENERATOR_SHIP_RADIUS = 20;
/** Free room a validated track keeps beyond the ship's radius along every leg's centre line. */
export const CENTRE_LINE_MARGIN = 20;
/** The default radius of race points (the portal, checkpoints, the finish), as in RaceController. */
const RACE_RADIUS = 100;
/** Rocks keep this much room around the start (its start slots spread over 70 units). */
const START_CLEARANCE = 150;
/** Field and belt rocks keep this much room beyond the radius of every race point. */
const RACE_MARGIN = 60;
/** Half width of the lane kept free of other legs' rocks along every leg (and of all rocks on open legs). */
const LANE_HALF = 50;
/** The turn at a gate is at most this, so its rocks stay off both legs. */
const GATE_MAX_TURN = 60;
/** Rocks of gates. */
const GATE_ROCK_RADIUS: [number, number] = [25, 40];
/** Legs of a chicane. */
const CHICANE_LEG: [number, number] = [350, 450];
/** Half length of a belt across the line. */
const BELT_HALF_LENGTH = 700;
/** Legs two apart keep at least this distance (all further legs keep the band's separation). */
const NEAR_SEPARATION = 250;
/** Grid cell of the flyability check, and the generation attempts before giving up. */
const GRID = 16;
const ROCK_ATTEMPTS = 12;
const LINE_ATTEMPTS = 500;

const DEG = Math.PI / 180;

interface Point {
  x: number;
  y: number;
}

/** A race point: the start (index 0), the checkpoints, the finish (last). */
export interface GeneratedRacePoint extends Point {
  radius: number;
}

export interface GeneratedLeg {
  kind: LegKind;
  /** The centre line from race point `i` to race point `i + 1`, with the bends in between. */
  path: Point[];
  /** Corridor legs: the free width between the walls. */
  width?: number;
  /** Corridor legs: the corridor turns back (two 90° bends). Straight legs: a long straight. */
  hairpin?: boolean;
  long?: boolean;
}

export interface GeneratedRock extends Point {
  radius: number;
  role: "wall" | "gate" | "field" | "belt";
  /** The leg the rock belongs to (a gate's rocks belong to the leg that ends at the gate). */
  leg: number;
}

/** A gate: the checkpoint `point` (index into `points`) between the rocks `rocks` (indices into `rocks`). */
export interface GeneratedGate {
  point: number;
  rocks: [number, number];
  /** Free gap between the rocks. */
  gap: number;
}

export interface GeneratedTrack {
  band: TrackBand;
  seed: number;
  points: GeneratedRacePoint[];
  legs: GeneratedLeg[];
  rocks: GeneratedRock[];
  gates: GeneratedGate[];
}

// ---------------------------------------------------------------------------------------------
// Geometry

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function segmentDistance(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2));
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}

const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** Distance between the segments a–b and c–d (0 when they cross). */
function segmentsDistance(a: Point, b: Point, c: Point, d: Point): number {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
  return Math.min(
    segmentDistance(a, c, d),
    segmentDistance(b, c, d),
    segmentDistance(c, a, b),
    segmentDistance(d, a, b),
  );
}

function polylineDistance(p: Point, path: readonly Point[]): number {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) best = Math.min(best, segmentDistance(p, path[i - 1]!, path[i]!));
  return best;
}

const between = (random: Random, [min, max]: readonly [number, number]) => min + random() * (max - min);
const heading = (a: Point, b: Point) => Math.atan2(b.y - a.y, b.x - a.x);
/** An angle in (−π, π]. */
const wrap = (a: number) => {
  let r = a % (2 * Math.PI);
  if (r <= -Math.PI) r += 2 * Math.PI;
  if (r > Math.PI) r -= 2 * Math.PI;
  return r;
};
const step = (at: Point, angle: number, length: number): Point => ({
  x: at.x + Math.cos(angle) * length,
  y: at.y + Math.sin(angle) * length,
});

/** The absolute turn in degrees at race point `i` (0 for the start and the finish). */
export function turnAtPoint(track: GeneratedTrack, i: number): number {
  if (i <= 0 || i >= track.points.length - 1) return 0;
  const inPath = track.legs[i - 1]!.path;
  const outPath = track.legs[i]!.path;
  const a = heading(inPath.at(-2)!, inPath.at(-1)!);
  const b = heading(outPath[0]!, outPath[1]!);
  return Math.abs(wrap(b - a)) / DEG;
}

// ---------------------------------------------------------------------------------------------
// Generation

/** The generator's random stream for `(seed, band)`. */
function bandRandom(seed: number, band: TrackBand): Random {
  const salt = [0x2545f491, 0x9e3779b9, 0x85ebca6b][TRACK_BAND_NAMES.indexOf(band)]!;
  return seededRandom((Math.imul(seed >>> 0, 0x27d4eb2d) ^ salt) >>> 0);
}

function pickKind(random: Random, spec: BandSpec, allowed: (k: LegKind) => boolean): LegKind {
  const kinds = LEG_KINDS.filter(allowed);
  const total = kinds.reduce((sum, k) => sum + spec.weights[k], 0);
  let r = random() * total;
  for (const k of kinds) {
    r -= spec.weights[k];
    if (r < 0) return k;
  }
  return kinds.at(-1)!;
}

const isGateKind = (k: LegKind | undefined) => k === "gate" || k === "chicane";

/** Radius of the race point at the end of a leg of this kind. */
function endRadius(kind: LegKind, spec: BandSpec): number {
  if (isGateKind(kind)) return Math.min(RACE_RADIUS, spec.gateGap / 2 - 10);
  if (kind === "corridor") return Math.min(RACE_RADIUS, spec.corridorWidth / 2 - 10);
  return RACE_RADIUS;
}

/** The centre line: legs with their kinds and bends, and the race points. */
function centreLine(random: Random, spec: BandSpec): { legs: GeneratedLeg[]; points: GeneratedRacePoint[] } {
  const rockMax = spec.rockRadius[1];
  const legs: GeneratedLeg[] = [];
  const points: GeneratedRacePoint[] = [{ x: 0, y: 0, radius: RACE_RADIUS }];
  const h0 = random() * 2 * Math.PI;
  let angle = h0;
  let at: Point = { x: 0, y: 0 };
  let chicaneLeft = 0;
  let chicaneSide = 1;
  // Turn towards the general direction more often than away from it, so tracks snake forward.
  const side = () => {
    const drift = wrap(angle - h0);
    if (Math.abs(drift) < 20 * DEG) return random() < 0.5 ? -1 : 1;
    const back = drift > 0 ? -1 : 1;
    return random() < 0.7 ? back : -back;
  };
  while (legs.length < spec.legs) {
    const remaining = spec.legs - legs.length;
    const prev = legs.at(-1);
    let kind: LegKind;
    if (chicaneLeft > 0) kind = "chicane";
    else if (!prev) kind = "straight";
    else
      kind = pickKind(random, spec, (k) => {
        if (k === "corridor") return !isGateKind(prev.kind); // gate rocks would stand in its walls
        if (k === "gate") return remaining >= 2; // the finish is no gate
        if (k === "chicane") return remaining >= 4;
        return true;
      });
    if (kind === "chicane" && chicaneLeft === 0) chicaneLeft = 3;

    if (prev) {
      let turn: number;
      let s: number;
      if (kind === "chicane" && chicaneLeft < 3) {
        chicaneSide = -chicaneSide;
        turn = spec.chicaneTurn * between(random, [0.8, 1.2]);
        s = chicaneSide;
      } else {
        const range: [number, number] = isGateKind(prev.kind)
          ? [Math.min(spec.turn[0], 40), Math.min(spec.turn[1], GATE_MAX_TURN)]
          : prev.long
            ? spec.sharpTurn
            : spec.turn;
        turn = between(random, range);
        s = side();
        chicaneSide = s;
      }
      angle += s * turn * DEG;
    }

    let length = between(random, spec.legLength);
    const leg: GeneratedLeg = { kind, path: [at] };
    if (kind === "straight") {
      if (random() < 0.5) {
        leg.long = true;
        length = spec.legLength[1] * spec.straightFactor;
      }
      at = step(at, angle, length);
      leg.path.push(at);
    } else if (kind === "corridor") {
      const width = spec.corridorWidth;
      leg.width = width;
      if (random() < spec.hairpinChance) {
        leg.hairpin = true;
        const s = random() < 0.5 ? -1 : 1;
        const arm = Math.max(length / 2, width + 100);
        at = step(at, angle, arm);
        leg.path.push(at);
        angle += s * 90 * DEG;
        at = step(at, angle, width + 4 * rockMax + 60);
        leg.path.push(at);
        angle += s * 90 * DEG;
        at = step(at, angle, arm);
        leg.path.push(at);
      } else {
        const pieces = random() < 0.5 ? 2 : 3;
        const total = Math.max(length, pieces * (width + 100));
        for (let p = 0; p < pieces; p++) {
          if (p > 0) angle += (random() < 0.5 ? -1 : 1) * between(random, spec.bend) * DEG;
          at = step(at, angle, (total / pieces) * between(random, [0.8, 1.2]));
          leg.path.push(at);
        }
      }
    } else if (kind === "chicane") {
      at = step(at, angle, between(random, CHICANE_LEG));
      leg.path.push(at);
      chicaneLeft--;
    } else {
      if (kind === "field") length = Math.max(length, 2 * (RACE_RADIUS + RACE_MARGIN + rockMax) + 300);
      if (kind === "belt")
        length = Math.max(length, spec.beltThickness + 2 * (RACE_RADIUS + RACE_MARGIN + rockMax) + 100);
      at = step(at, angle, length);
      leg.path.push(at);
    }
    legs.push(leg);
    points.push({ ...at, radius: legs.length === spec.legs ? RACE_RADIUS : endRadius(kind, spec) });
  }
  return { legs, points };
}

/** Do segments of different, non-neighbouring legs come closer than `separation`? */
function crowded(legs: readonly GeneratedLeg[], separation: number): boolean {
  const segments: { a: Point; b: Point; leg: number }[] = [];
  legs.forEach((leg, l) => {
    for (let i = 1; i < leg.path.length; i++) segments.push({ a: leg.path[i - 1]!, b: leg.path[i]!, leg: l });
  });
  for (let i = 0; i < segments.length; i++)
    for (let j = i + 1; j < segments.length; j++) {
      const s = segments[i]!;
      const t = segments[j]!;
      const apart = t.leg - s.leg;
      if (apart < 2) continue;
      // Legs two apart meet at the ends of the leg between them: only keep them from touching.
      if (segmentsDistance(s.a, s.b, t.a, t.b) < (apart === 2 ? NEAR_SEPARATION : separation)) return true;
    }
  return false;
}

/** Free half width along a leg's centre line that a rock of leg `rockLeg` must keep. */
function freeHalf(leg: GeneratedLeg, legIndex: number, rockLeg: number): number {
  if (leg.kind === "corridor") return leg.width! / 2;
  if (legIndex === rockLeg && (leg.kind === "field" || leg.kind === "belt")) return 0;
  return LANE_HALF;
}

function placeRocks(
  random: Random,
  spec: BandSpec,
  legs: readonly GeneratedLeg[],
  points: readonly GeneratedRacePoint[],
  densityScale: number,
): { rocks: GeneratedRock[]; gates: GeneratedGate[] } {
  const rocks: GeneratedRock[] = [];
  const gates: GeneratedGate[] = [];
  const allowed = (p: Point, r: number, legIndex: number, role: GeneratedRock["role"]) => {
    if (dist(p, points[0]!) < START_CLEARANCE + r) return false;
    const margin = role === "wall" ? 0 : RACE_MARGIN;
    if (points.some((c) => dist(p, c) < c.radius + margin + r)) return false;
    for (let l = 0; l < legs.length; l++) {
      const free = freeHalf(legs[l]!, l, legIndex);
      if (free > 0 && polylineDistance(p, legs[l]!.path) < free + r - 1e-9) return false;
    }
    if (role !== "wall" && rocks.some((o) => dist(o, p) < o.radius + r)) return false;
    return true;
  };

  legs.forEach((leg, l) => {
    const a = leg.path[0]!;
    const b = leg.path.at(-1)!;
    if (leg.kind === "corridor") {
      const width = leg.width!;
      const spacing = spec.rockRadius[0] * 1.5; // the rocks of a wall overlap: no holes
      for (let i = 1; i < leg.path.length; i++) {
        const p0 = leg.path[i - 1]!;
        const p1 = leg.path[i]!;
        const len = dist(p0, p1);
        const ux = (p1.x - p0.x) / len;
        const uy = (p1.y - p0.y) / len;
        for (const s of [-1, 1])
          for (let t = -width; t <= len + width; t += spacing) {
            const r = between(random, spec.rockRadius);
            const off = s * (width / 2 + r);
            const p = { x: p0.x + ux * t - uy * off, y: p0.y + uy * t + ux * off };
            if (allowed(p, r, l, "wall")) rocks.push({ ...p, radius: r, role: "wall", leg: l });
          }
      }
    } else if (leg.kind === "field" || leg.kind === "belt") {
      const len = dist(a, b);
      const ux = (b.x - a.x) / len;
      const uy = (b.y - a.y) / len;
      const end = RACE_RADIUS + RACE_MARGIN;
      const [t0, t1, half, density] =
        leg.kind === "field"
          ? [end, len - end, spec.fieldHalfWidth, spec.fieldDensity]
          : [
              (len - spec.beltThickness) / 2,
              (len + spec.beltThickness) / 2,
              BELT_HALF_LENGTH,
              spec.beltDensity,
            ];
      const wanted = Math.round((density * densityScale * (t1 - t0) * 2 * half) / 1e6);
      let placed = 0;
      for (let attempt = 0; placed < wanted && attempt < wanted * 30; attempt++) {
        const t = t0 + random() * (t1 - t0);
        const c = (random() * 2 - 1) * half;
        const r = between(random, spec.rockRadius);
        const p = { x: a.x + ux * t - uy * c, y: a.y + uy * t + ux * c };
        if (!allowed(p, r, l, leg.kind)) continue;
        rocks.push({ ...p, radius: r, role: leg.kind, leg: l });
        placed++;
      }
    }
    if (isGateKind(leg.kind)) {
      // Two rocks across the mean direction of the two legs, the checkpoint between them.
      const next = legs[l + 1]!;
      const hin = heading(leg.path.at(-2)!, b);
      const hout = heading(b, next.path[1]!);
      const mean = hin + wrap(hout - hin) / 2;
      const gap = spec.gateGap;
      const index = rocks.length;
      for (const s of [-1, 1]) {
        const r = between(random, GATE_ROCK_RADIUS);
        const p = step(b, mean + (s * Math.PI) / 2, gap / 2 + r);
        rocks.push({ ...p, radius: r, role: "gate", leg: l });
      }
      gates.push({ point: l + 1, rocks: [index, index + 1], gap });
    }
  });
  return { rocks, gates };
}

/**
 * Generates the track for `(seed, band)`: the same arguments always give the same track. The track
 * passes {@link validateGeneratedTrack}; generation retries (with thinner fields) until it does.
 */
export function generateTrack(seed: number, band: TrackBand): GeneratedTrack {
  if (!isTrackBand(band)) throw new Error(`unknown track band ${JSON.stringify(band)}`);
  if (!Number.isInteger(seed) || seed < 0 || seed >= 2 ** 32)
    throw new Error(`track seed must be an integer in [0, 2^32), got ${seed}`);
  const spec = TRACK_BANDS[band];
  const random = bandRandom(seed, band);
  const separation = Math.max(400, spec.corridorWidth + 2 * spec.rockRadius[1] + 100);
  let last: string[] = [];
  for (let attempt = 0; attempt < ROCK_ATTEMPTS; attempt++) {
    let line = centreLine(random, spec);
    for (let tries = 1; crowded(line.legs, separation); tries++) {
      if (tries >= LINE_ATTEMPTS) throw new Error(`no uncrowded centre line for ${band}:${seed}`);
      line = centreLine(random, spec);
    }
    const { rocks, gates } = placeRocks(random, spec, line.legs, line.points, 0.85 ** attempt);
    const track: GeneratedTrack = { band, seed, points: line.points, legs: line.legs, rocks, gates };
    last = validateGeneratedTrack(track);
    if (last.length === 0) return track;
  }
  throw new Error(`no valid track for ${band}:${seed}: ${last.join("; ")}`);
}

// ---------------------------------------------------------------------------------------------
// Validation

/**
 * A grid over the box around `path` (`pad` beyond it): a cell is blocked when its centre is closer
 * than `inflate` to a rock's surface, i.e. a ship of that radius centred there would touch the rock.
 */
function rockGrid(rocks: readonly GeneratedRock[], path: readonly Point[], pad: number, inflate: number) {
  const minX = Math.min(...path.map((p) => p.x)) - pad;
  const minY = Math.min(...path.map((p) => p.y)) - pad;
  const cols = Math.ceil((Math.max(...path.map((p) => p.x)) + pad - minX) / GRID);
  const rows = Math.ceil((Math.max(...path.map((p) => p.y)) + pad - minY) / GRID);
  const blocked = new Uint8Array(cols * rows);
  for (const rock of rocks) {
    const reach = rock.radius + inflate;
    const c0 = Math.max(0, Math.floor((rock.x - reach - minX) / GRID));
    const c1 = Math.min(cols - 1, Math.floor((rock.x + reach - minX) / GRID));
    const r0 = Math.max(0, Math.floor((rock.y - reach - minY) / GRID));
    const r1 = Math.min(rows - 1, Math.floor((rock.y + reach - minY) / GRID));
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++)
        if (Math.hypot(minX + (c + 0.5) * GRID - rock.x, minY + (r + 0.5) * GRID - rock.y) < reach)
          blocked[r * cols + c] = 1;
  }
  return {
    cols,
    rows,
    blocked,
    centre: (i: number): Point => ({
      x: minX + ((i % cols) + 0.5) * GRID,
      y: minY + (Math.floor(i / cols) + 0.5) * GRID,
    }),
    cell: (p: Point) => Math.floor((p.y - minY) / GRID) * cols + Math.floor((p.x - minX) / GRID),
  };
}

/**
 * Breadth-first search over free cells from the cells `from`, entering only cells `enter` accepts;
 * returns the first cell `goal` accepts, or −1.
 */
function search(
  grid: ReturnType<typeof rockGrid>,
  from: readonly number[],
  enter: (i: number) => boolean,
  goal: (i: number) => boolean,
): number {
  const { cols, rows, blocked } = grid;
  const seen = new Uint8Array(cols * rows);
  const queue = new Int32Array(cols * rows);
  let head = 0;
  let tail = 0;
  for (const i of from)
    if (!blocked[i] && !seen[i]) {
      seen[i] = 1;
      queue[tail++] = i;
    }
  while (head < tail) {
    const i = queue[head++]!;
    if (goal(i)) return i;
    const c = i % cols;
    for (const n of [c > 0 ? i - 1 : -1, c < cols - 1 ? i + 1 : -1, i - cols, i + cols]) {
      if (n < 0 || n >= cols * rows || seen[n] || blocked[n]) continue;
      seen[n] = 1;
      if (enter(n)) queue[tail++] = n;
    }
  }
  return -1;
}

/**
 * Can the ship fly leg `l` from race point to race point without touching a rock? A grid search in
 * the box around the leg (500 units beyond it). Rocks are inflated by the ship's radius plus 3/4 of
 * a cell, so the search never squeezes through a gap that is too narrow.
 */
function legFlyable(track: GeneratedTrack, l: number): boolean {
  const path = track.legs[l]!.path;
  const grid = rockGrid(track.rocks, path, 500, GENERATOR_SHIP_RADIUS + GRID * 0.75);
  const to = grid.cell(path.at(-1)!);
  if (grid.blocked[to]) return false;
  return (
    search(
      grid,
      [grid.cell(path[0]!)],
      () => true,
      (i) => i === to,
    ) >= 0
  );
}

/**
 * A hole in the walls of corridor leg `l`: a place where a ship (a grid search with rocks inflated by
 * exactly the ship's radius) gets from inside the corridor through a wall to beyond it. The mouths
 * (beyond the corridor's two ends) and places where another leg passes don't count.
 */
function corridorHole(track: GeneratedTrack, l: number): Point | undefined {
  const leg = track.legs[l]!;
  const rockMax = TRACK_BANDS[track.band].rockRadius[1];
  const half = leg.width! / 2;
  const outer = half + 2 * rockMax + 2 * GENERATOR_SHIP_RADIUS;
  const grid = rockGrid(track.rocks, leg.path, outer + GRID, GENERATOR_SHIP_RADIUS);
  // The mouths: the half planes beyond the corridor's first and last point.
  const caps = [
    [leg.path[0]!, leg.path[1]!],
    [leg.path.at(-1)!, leg.path.at(-2)!],
  ] as const;
  const beyond = (p: Point) =>
    caps.some(([end, from]) => (p.x - end.x) * (end.x - from.x) + (p.y - end.y) * (end.y - from.y) > 0);
  const n = grid.cols * grid.rows;
  const distance = new Float64Array(n);
  const open = new Uint8Array(n);
  const inside: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = grid.centre(i);
    distance[i] = polylineDistance(p, leg.path);
    if (distance[i]! < half) inside.push(i);
    if (
      beyond(p) ||
      track.legs.some(
        (o, m) => m !== l && polylineDistance(p, o.path) < freeHalf(o, m, l) + GENERATOR_SHIP_RADIUS,
      )
    )
      open[i] = 1;
  }
  const hole = search(
    grid,
    inside,
    (i) => !open[i] && distance[i]! <= outer,
    (i) => distance[i]! > outer - GRID,
  );
  return hole >= 0 ? grid.centre(hole) : undefined;
}

/**
 * The geometric checks of a generated track; returns the problems found (empty = valid):
 * - every race point is clear of every rock (and the start keeps its start slots clear);
 * - every gate's free gap is at least the ship's width plus {@link CENTRE_LINE_MARGIN}, and its
 *   checkpoint lies between its rocks;
 * - along every leg's centre line a ship-wide lane is free: every rock keeps the ship's radius plus
 *   {@link CENTRE_LINE_MARGIN} from it, except the rocks of the leg's own field or belt;
 * - every leg is flyable: a grid search finds a path for the ship from race point to race point;
 * - corridor walls have no holes: a grid search finds no way for the ship out through the walls.
 */
export function validateGeneratedTrack(track: GeneratedTrack): string[] {
  const problems: string[] = [];
  const { points, legs, rocks } = track;
  const lane = GENERATOR_SHIP_RADIUS + CENTRE_LINE_MARGIN;
  rocks.forEach((rock, k) => {
    if (dist(rock, points[0]!) < START_CLEARANCE + rock.radius - 1e-9)
      problems.push(`rock ${k} is too close to the start`);
    points.forEach((p, i) => {
      if (dist(rock, p) < p.radius + rock.radius - 1e-9) problems.push(`rock ${k} overlaps race point ${i}`);
    });
  });
  for (const gate of track.gates) {
    const [a, b] = gate.rocks.map((i) => rocks[i]!) as [GeneratedRock, GeneratedRock];
    const gap = dist(a, b) - a.radius - b.radius;
    if (gap < 2 * GENERATOR_SHIP_RADIUS + CENTRE_LINE_MARGIN)
      problems.push(`gate at race point ${gate.point} is only ${gap.toFixed(0)} wide`);
    if (segmentDistance(points[gate.point]!, a, b) > 1e-6)
      problems.push(`gate at race point ${gate.point} is not between its rocks`);
  }
  legs.forEach((leg, l) => {
    const open = leg.kind !== "field" && leg.kind !== "belt";
    for (const [k, rock] of rocks.entries()) {
      if (!open && rock.leg === l) continue;
      if (polylineDistance(rock, leg.path) < lane + rock.radius - 1e-9) {
        problems.push(`rock ${k} blocks the centre line of leg ${l} (${leg.kind})`);
        break;
      }
    }
    if (!legFlyable(track, l)) problems.push(`leg ${l} (${leg.kind}) is not flyable`);
    if (leg.kind === "corridor") {
      const hole = corridorHole(track, l);
      if (hole)
        problems.push(`corridor of leg ${l} has a hole at (${hole.x.toFixed(0)}, ${hole.y.toFixed(0)})`);
    }
  });
  return problems;
}

// ---------------------------------------------------------------------------------------------
// Summaries and the game track

/** Numbers that tell the bands apart (tests, the history). */
export interface TrackSummary {
  legs: number;
  rocks: number;
  /** Rocks on or across the racing line: fields, belts and gates (all rocks but the corridor walls). */
  obstacleRocks: number;
  /** Mean absolute turn at the race points between legs, degrees. */
  meanTurn: number;
  /** Total length of the centre line. */
  length: number;
  gates: number;
  /** Minimum free gap of a gate (Infinity without gates). */
  minGateGap: number;
  kinds: Record<LegKind, number>;
}

export function trackSummary(track: GeneratedTrack): TrackSummary {
  const kinds = Object.fromEntries(LEG_KINDS.map((k) => [k, 0])) as Record<LegKind, number>;
  let length = 0;
  for (const leg of track.legs) {
    kinds[leg.kind]++;
    for (let i = 1; i < leg.path.length; i++) length += dist(leg.path[i - 1]!, leg.path[i]!);
  }
  let turns = 0;
  for (let i = 1; i < track.points.length - 1; i++) turns += turnAtPoint(track, i);
  return {
    legs: track.legs.length,
    rocks: track.rocks.length,
    obstacleRocks: track.rocks.filter((r) => r.role !== "wall").length,
    meanTurn: turns / Math.max(1, track.points.length - 2),
    length,
    gates: track.gates.length,
    minGateGap: Math.min(...track.gates.map((g) => g.gap)),
    kinds,
  };
}

/** The game's orientation (π = up) of a ship at `from` facing `to`. */
function facing(from: Point, to: Point): number {
  const orientation = Math.atan2(to.x - from.x, -(to.y - from.y)) + Math.PI;
  return orientation >= 2 * Math.PI ? orientation - 2 * Math.PI : orientation;
}

/**
 * Puts a generated track into a world and a race. Order of entities: rocks, arrows, then the race
 * (checkpoints, portal, finish), as the file tracks. Race points face along the next leg (the
 * finish along the last one), where a respawned racer looks.
 */
export function buildGeneratedTrack(track: GeneratedTrack, world: World, race: RaceController): void {
  const rocks = track.rocks.map(
    (r) => new Entity({ type: EntityType.ASTEROID, position: new Vector2(r.x, r.y), radius: r.radius }),
  );
  world.addEntities(rocks);
  world.passiveCollisionEntities.push(...rocks);
  const { points, legs } = track;
  const orientationAt = (i: number) =>
    i < legs.length ? facing(points[i]!, legs[i]!.path[1]!) : facing(legs[i - 1]!.path.at(-2)!, points[i]!);
  for (let i = 0; i < legs.length; i++) {
    const [a, b] = legs[i]!.path as [Point, Point];
    if (dist(a, b) > 400) {
      const p = step(a, heading(a, b), 200);
      world.addEntity(createArrow(p.x, p.y, facing(a, b)));
    }
  }
  race.addStart(points[0]!.x, points[0]!.y, orientationAt(0));
  for (let i = 1; i < points.length - 1; i++)
    race.addCheckpoint(points[i]!.x, points[i]!.y, orientationAt(i), points[i]!.radius);
  const finish = points.at(-1)!;
  race.addFinish(finish.x, finish.y, orientationAt(points.length - 1));
  world.addEntities(race.checkpoints);
  if (race.start) world.addEntity(race.start);
  if (race.finish) world.addEntity(race.finish);
}

/**
 * A generated track for the registry. Without `seed` (`generated:<band>`) the world's random decides
 * the track, like the `random` track: one number from `random` is the generator seed. With `seed`
 * (`generated:<band>:<seed>`) it is always the same track.
 */
export function generatedTrack(band: TrackBand, seed?: number): Track {
  const spec = TRACK_BANDS[band];
  return {
    name: seed === undefined ? `generated:${band}` : `generated:${band}:${seed}`,
    description:
      `A generated ${band} track (${spec.legs} legs: corridors, gates, chicanes, rock fields, belts)` +
      (seed === undefined ? ", a new one per seed" : `, seed ${seed}`),
    build(world, race, random) {
      buildGeneratedTrack(generateTrack(seed ?? Math.floor(random() * 2 ** 32), band), world, race);
    },
  };
}

/** `generated:<band>:<seed>` → the fixed generated track; anything else → undefined. */
export function parseGeneratedTrackName(name: string): Track | undefined {
  const m = /^generated:(easy|medium|hard):(\d+)$/.exec(name);
  if (!m) return undefined;
  const seed = Number(m[2]);
  if (!Number.isSafeInteger(seed) || seed >= 2 ** 32) return undefined;
  return generatedTrack(m[1] as TrackBand, seed);
}

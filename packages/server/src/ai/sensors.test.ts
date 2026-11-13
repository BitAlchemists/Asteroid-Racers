import { Entity, EntityType, Movable, Vector2 } from "@ar/shared";
import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import { inputCount, LEGACY_SPEC, layoutFor } from "./model-spec";
import { MajorTom } from "./network";
import { ObstacleGrid } from "./obstacle-grid";
import {
  drawSensors,
  parseSensors,
  readSensors,
  sensorSize,
  type SensorContext,
  type SensorSpec,
} from "./sensors";

const rock = (x: number, y: number, radius: number) =>
  new Entity({ type: EntityType.ASTEROID, position: new Vector2(x, y), radius });

/** A ship of radius 20 at the origin; orientation 0 points its nose along +y. */
function ctx(rocks: Entity[], { orientation = 0, target = new Vector2(0, 1000) } = {}): SensorContext {
  const ship = new Movable({ position: Vector2.zero(), radius: 20, orientation });
  return { ship, target, obstacles: new ObstacleGrid(rocks) };
}

function read(spec: SensorSpec, c: SensorContext): number[] {
  const out = new Float64Array(sensorSize(spec));
  readSensors([spec], c, out, 0);
  return [...out];
}

describe("sensors", () => {
  it("whiskers: a rock dead ahead lights the middle ray by how close its edge is", () => {
    const spec: SensorSpec = { type: "whiskers", count: 3, spread: 90, range: 600 };
    // Rock centre 300 ahead, radius 30; with the ship's radius the ray hits at 300 − 50 = 250.
    const values = read(spec, ctx([rock(0, 300, 30)]));
    expect(values[1]).toBeCloseTo(1 - 250 / 600, 9);
    expect(values[0]).toBe(0);
    expect(values[2]).toBe(0);
    expect(read(spec, ctx([]))).toEqual([0, 0, 0]);
    expect(read(spec, ctx([rock(0, 1000, 30)]))).toEqual([0, 0, 0]); // out of range
  });

  it("whiskers turn with the ship: a quarter turn moves the rock to a side ray", () => {
    const spec: SensorSpec = { type: "whiskers", count: 3, spread: 180, range: 600 };
    const ahead = read(spec, ctx([rock(0, 300, 30)]));
    const turned = read(spec, ctx([rock(0, 300, 30)], { orientation: Math.PI / 2 }));
    expect(ahead[1]).toBeGreaterThan(0);
    expect(turned[1]).toBe(0);
    expect(turned[0]! + turned[2]!).toBeGreaterThan(0);
  });

  it("sectors: sector 0 is centred on the nose, and the closest edge wins", () => {
    const spec: SensorSpec = { type: "sectors", count: 4, range: 500 };
    const values = read(spec, ctx([rock(0, 200, 30), rock(0, 400, 30), rock(0, -300, 30)]));
    expect(values[0]).toBeCloseTo(1 - (200 - 50) / 500, 9);
    expect(values[2]).toBeCloseTo(1 - (300 - 50) / 500, 9); // behind
    expect(values[1]).toBe(0);
    expect(values[3]).toBe(0);
  });

  it("nearest: the k closest rocks by edge distance, padded when there are fewer", () => {
    const spec: SensorSpec = { type: "nearest", k: 2, range: 800 };
    const values = read(spec, ctx([rock(0, 500, 10), rock(300, 0, 50)]));
    // Closest edge first: the rock to the side (300 − 70 = 230) before the one ahead (500 − 30 = 470).
    expect(values[1]).toBeCloseTo(230 / 800, 9);
    expect(Math.abs(values[0]!)).toBeCloseTo(0.5, 9); // a quarter turn from the nose
    expect(values[2]).toBeCloseTo(0.5, 9);
    expect(values[3]).toBeCloseTo(0, 9); // dead ahead
    expect(values[4]).toBeCloseTo(470 / 800, 9);
    expect(read(spec, ctx([]))).toEqual([0, 1, 0, 0, 1, 0]);
  });

  it("lineCheck: the first rock in the ship-wide corridor to the target, with its sideways offset", () => {
    const spec: SensorSpec = { type: "lineCheck", range: 1000 };
    const [near, offset] = read(spec, ctx([rock(20, 400, 30), rock(0, 700, 30)]));
    expect(near).toBeGreaterThan(1 - 400 / 1000);
    expect(Math.abs(offset!)).toBeCloseTo(20 / 50, 9);
    expect(read(spec, ctx([rock(200, 400, 30)]))).toEqual([0, 0]); // beside the corridor
    expect(read(spec, ctx([rock(0, 400, 30)], { target: new Vector2(0, 200) }))).toEqual([0, 0]); // beyond the target
  });

  it("draws what it reads: rays shortened at hits, nearest rocks marked", () => {
    const c = ctx([rock(0, 300, 30)]);
    const prims = drawSensors(
      [
        { type: "whiskers", count: 3, spread: 90, range: 600 },
        { type: "nearest", k: 1, range: 800 },
      ],
      c,
    );
    const rays = prims.filter((p) => p.kind === "segment").slice(0, 3);
    expect(rays.map((r) => r.kind === "segment" && r.lit)).toEqual([false, true, false]);
    expect(prims.some((p) => p.kind === "rock")).toBe(true);
  });

  it("parses the config with defaults, in a fixed order, and rejects mistakes", () => {
    expect(parseSensors(undefined)).toEqual([]);
    expect(parseSensors({ lineCheck: {}, whiskers: { count: 5 } })).toEqual([
      { type: "whiskers", count: 5, spread: 180, range: 600 },
      { type: "lineCheck", range: 1000 },
    ]);
    expect(() => parseSensors({ sonar: {} })).toThrow(/unknown sensor/);
    expect(() => parseSensors({ whiskers: { length: 3 } })).toThrow(/unknown parameter/);
    expect(() => parseSensors({ whiskers: { count: 2.5 } })).toThrow(/integer/);
    expect(() => parseSensors({ nearest: { range: -1 } })).toThrow(/> 0/);
  });

  it("a spec with sensors needs more inputs and is saved with the model; one without stays as before", () => {
    const spec = {
      ...LEGACY_SPEC,
      inputs: [...LEGACY_SPEC.inputs],
      sensors: parseSensors({ whiskers: {}, lineCheck: {} }),
    };
    expect(inputCount(spec)).toBe(4 + 7 + 2);
    const model = MajorTom.random(layoutFor(spec, [8]), seededRandom(1), "Seer", spec);
    expect(model.layout).toEqual([13, 8, 2]);
    expect(MajorTom.fromJson(model.toJson()).spec).toEqual(spec);
    const blind = MajorTom.random([4, 3, 2], seededRandom(1));
    expect(Object.keys(blind.toJson().spec!)).toEqual(["inputs", "outputs"]);
  });
});

describe("sensors with the unsorted grid query", () => {
  it("read exactly what an id-sorted scan reads (random fields, ships and targets)", () => {
    const random = seededRandom(11);
    const all = Array.from({ length: 300 }, (_, i) =>
      Object.assign(
        new Entity({
          type: EntityType.ASTEROID,
          position: new Vector2((random() * 2 - 1) * 2000, (random() * 2 - 1) * 2000),
          radius: 20 + random() * 50,
        }),
        { id: i + 1 }, // Entity ignores id in its constructor; worlds assign unique ids
      ),
    );
    const grid = new ObstacleGrid(all);
    /** The old behaviour: every query sorted by id. */
    const sorted = {
      near: (x: number, y: number, r: number) => grid.near(x, y, r),
      nearUnsorted: (x: number, y: number, r: number) => grid.near(x, y, r),
    } as unknown as ObstacleGrid;
    // Reversed candidate order: the result must not depend on it.
    const reversed = {
      near: (x: number, y: number, r: number) => grid.near(x, y, r),
      nearUnsorted: (x: number, y: number, r: number) => [...grid.near(x, y, r)].reverse(),
    } as unknown as ObstacleGrid;
    const specs = parseSensors({ whiskers: {}, nearest: { k: 3 }, lineCheck: {} });
    const specsTime = parseSensors({ whiskers: { horizon: 2 }, lineCheck: { horizon: 2 } });
    for (const set of [specs, specsTime]) {
      const n = set.reduce((sum, s) => sum + sensorSize(s), 0);
      for (let k = 0; k < 2000; k++) {
        const ship = new Movable({
          position: new Vector2((random() * 2 - 1) * 2000, (random() * 2 - 1) * 2000),
          radius: 20,
          orientation: random() * 6,
        });
        ship.velocity = new Vector2(random() * 600 - 300, random() * 600 - 300);
        const target = new Vector2((random() * 2 - 1) * 2500, (random() * 2 - 1) * 2500);
        const outs = [grid, sorted, reversed].map((obstacles) => {
          const out = new Float64Array(n);
          readSensors(set, { ship, target, obstacles }, out, 0);
          return [...out];
        });
        expect(outs[0]).toEqual(outs[1]);
        expect(outs[2]).toEqual(outs[1]);
      }
    }
  });
});

import { Entity, EntityType, Movable, Vector2 } from "@ar/shared";
import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import { DEFAULT_EXAM, ExamReplay, runExam } from "./exam";
import { createTrainingServer, DEFAULT_MODEL_NAME, registerAITrainingService } from "./index";
import { ENCODINGS, INPUTS, inputCount, layoutFor, type ModelSpec } from "./model-spec";
import { MemoryModelStore } from "./model-store";
import { MajorTom, mutateGaussian } from "./network";
import { ObstacleGrid } from "./obstacle-grid";
import {
  MIN_CLOSING_SPEED,
  parseSensors,
  readSensors,
  sensorSize,
  TIME_MODE_RANGE,
  type SensorSpec,
} from "./sensors";

/** A ship at the origin, nose along +y (orientation 0). */
function ship(velocity = Vector2.zero(), orientation = 0): Movable {
  const s = new Movable({ position: Vector2.zero(), radius: 20, orientation });
  s.velocity = velocity;
  return s;
}

const input = (name: string, s: Movable, target: Vector2) => INPUTS[name]!({ ship: s, target });

describe("encoding v2", () => {
  it("angles are smooth: sin/cos of the target angle, no jump behind the ship", () => {
    const ahead = new Vector2(0, 500);
    expect(input("targetSin", ship(), ahead)).toBeCloseTo(0, 9);
    expect(input("targetCos", ship(), ahead)).toBeCloseTo(1, 9);
    // Just left and just right of straight behind: the legacy angle jumps from about +1 to −1 ...
    const behindA = new Vector2(1, -500);
    const behindB = new Vector2(-1, -500);
    expect(
      Math.abs(input("targetAngle", ship(), behindA) - input("targetAngle", ship(), behindB)),
    ).toBeGreaterThan(1.9);
    // ... the v2 inputs barely move.
    for (const name of ["targetSin", "targetCos"])
      expect(Math.abs(input(name, ship(), behindA) - input(name, ship(), behindB))).toBeLessThan(0.01);
    // A quarter turn to one side reads ±1 on sin, 0 on cos.
    expect(Math.abs(input("targetSin", ship(), new Vector2(500, 0)))).toBeCloseTo(1, 9);
    expect(input("targetCos", ship(), new Vector2(500, 0))).toBeCloseTo(0, 9);
  });

  it("distance is squashed into 0..1 (0.5 at 500), speeds are split along and across the nose ÷ 500", () => {
    expect(input("targetDistanceSoft", ship(), new Vector2(0, 500))).toBeCloseTo(0.5, 9);
    expect(input("targetDistanceSoft", ship(), new Vector2(0, 1e6))).toBeLessThan(1);
    expect(input("forwardSpeed", ship(new Vector2(0, 250)), Vector2.zero())).toBeCloseTo(0.5, 9);
    expect(input("sideSpeed", ship(new Vector2(0, 250)), Vector2.zero())).toBeCloseTo(0, 9);
    expect(input("forwardSpeed", ship(new Vector2(0, -500)), Vector2.zero())).toBeCloseTo(-1, 9);
    expect(Math.abs(input("sideSpeed", ship(new Vector2(500, 0)), Vector2.zero()))).toBeCloseTo(1, 9);
    expect(input("forwardSpeed", ship(), Vector2.zero())).toBe(0); // at rest: 0, not noise
    // sideSpeed uses the same sign convention as targetSin.
    const side = new Vector2(300, 0);
    expect(Math.sign(input("sideSpeed", ship(side), Vector2.zero()))).toBe(
      Math.sign(input("targetSin", ship(), side)),
    );
  });

  it("a v2 model flies the race exam (the game's own bot) exactly as its replay does", async () => {
    const spec: ModelSpec = {
      inputs: [...ENCODINGS.v2!],
      outputs: "thrustTurn",
      sensors: parseSensors({ lineCheck: { horizon: 2 } }),
    };
    const model = MajorTom.random(layoutFor(spec, [6]), seededRandom(5), "V2", spec);
    const loaded = MajorTom.fromJson(JSON.parse(JSON.stringify(model.toJson())));
    expect(loaded.spec).toEqual(spec);
    expect(loaded.layout[0]).toBe(5 + 2);
    const exam = { ...DEFAULT_EXAM, tracks: ["short"], randomTracks: 0, timeLimitSeconds: 10 };
    const result = await runExam(loaded, exam);
    const replay = await ExamReplay.create(loaded, "short", result.flights[0]!.seed, 10);
    while (!replay.status().done) replay.step(100);
    expect(replay.crashes).toBe(result.flights[0]!.crashes);
    expect(replay.status().reached).toBe(result.flights[0]!.checkpoints);
  });
});

describe("Gaussian mutation", () => {
  it("is unbiased, can flip signs and leaves weights alone at the given rate", () => {
    const random = seededRandom(3);
    let sum = 0;
    let flips = 0;
    let unchanged = 0;
    const n = 20_000;
    for (let i = 0; i < n; i++) {
      const next = mutateGaussian(0.1, 0.5, 0.2, random);
      if (next === 0.1) unchanged++;
      else {
        sum += next - 0.1;
        if (next < 0) flips++;
      }
    }
    expect(unchanged / n).toBeCloseTo(0.5, 1);
    expect(Math.abs(sum / (n - unchanged))).toBeLessThan(0.01); // mean change about 0
    expect(flips).toBeGreaterThan(0.2 * (n - unchanged)); // 0.1 with σ 0.2 crosses 0 about 31 % of the time
  });

  it("rate 1 changes every weight (the standard all-weights form)", () => {
    const model = MajorTom.random([4, 6, 2], seededRandom(2), "All");
    const before = model.weights.flatMap((l) => [...l]);
    model.mutate(1, 0.03, mutateGaussian, seededRandom(3));
    const after = model.weights.flatMap((l) => [...l]);
    expect(after.every((w, i) => w !== before[i])).toBe(true);
    expect(Math.max(...after.map((w, i) => Math.abs(w - before[i]!)))).toBeLessThan(0.2); // σ 0.03
  });

  it("starting weights follow initRange", () => {
    const model = MajorTom.random([4, 8, 2], seededRandom(1), "Wide", undefined, 3);
    const all = model.weights.flatMap((l) => [...l]);
    expect(Math.max(...all.map(Math.abs))).toBeGreaterThan(1);
    expect(Math.max(...all.map(Math.abs))).toBeLessThanOrEqual(3);
  });
});

describe("(μ + λ) selection", () => {
  async function train(options: { parents?: number; sampleSize: number }, generations: number) {
    const store = new MemoryModelStore();
    const server = createTrainingServer(2);
    const reports: { parents: number; sampleSize: number }[] = [];
    const director = registerAITrainingService(server, {
      store,
      sampleSize: options.sampleSize,
      framesPerTarget: 30,
      maxGenerations: generations,
      random: seededRandom(3),
      mutation: { kind: "gaussian", sigma: 0.2 },
      ...(options.parents === undefined ? {} : { parents: options.parents }),
      onGeneration: (r) => reports.push({ parents: r.parents.length, sampleSize: r.sampleSize }),
    });
    await server.start();
    let done = false;
    void director.done.then(() => (done = true));
    for (let guard = 0; !done && guard < 200_000; guard++) {
      server.tick();
      if (guard % 20 === 0) await new Promise<void>((r) => setTimeout(r, 0));
    }
    expect(done).toBe(true);
    return { reports, stored: store.load(DEFAULT_MODEL_NAME)! };
  }

  it("keeps the best μ and gives each (sample − μ) / μ children; the default keeps one", async () => {
    const many = await train({ parents: 3, sampleSize: 9 }, 3);
    expect(many.reports.map((r) => r.parents)).toEqual([3, 3, 3]);
    expect(many.reports.map((r) => r.sampleSize)).toEqual([9, 9, 9]); // 3 parents + 3 × 2 children
    expect(many.stored).toHaveLength(3);
    const one = await train({ sampleSize: 5 }, 2);
    expect(one.reports.map((r) => [r.parents, r.sampleSize])).toEqual([
      [1, 5],
      [1, 5],
    ]);
  }, 60_000);
});

describe("sensor time mode and nearest flag", () => {
  const rockAhead = new Entity({ type: EntityType.ASTEROID, position: new Vector2(0, 340), radius: 20 });
  const read = (
    spec: SensorSpec,
    s: Movable,
    rocks: Entity[] = [rockAhead],
    target = new Vector2(0, 2000),
  ) => {
    const out = new Float64Array(sensorSize(spec));
    readSensors([spec], { ship: s, target, obstacles: new ObstacleGrid(rocks) }, out, 0);
    return [...out];
  };

  it("time mode: closeness by time to impact, so the same rock reads closer when flying faster", () => {
    // The rock's edge is 340 − 20 − 20 = 300 ahead; a 2 s horizon.
    for (const type of ["whiskers", "sectors"] as const) {
      const spec = parseSensors({ [type]: { count: type === "whiskers" ? 3 : 4, horizon: 2 } })[0]!;
      const i = type === "whiskers" ? 1 : 0;
      expect(read(spec, ship(new Vector2(0, 300)))[i]).toBeCloseTo(1 - 1 / 2, 9); // 1 s away
      expect(read(spec, ship(new Vector2(0, 600)))[i]).toBeCloseTo(1 - 0.5 / 2, 9); // 0.5 s away
      // At rest or flying away, closing speed counts as MIN_CLOSING_SPEED: 3 s away, beyond the horizon.
      expect(300 / MIN_CLOSING_SPEED).toBeGreaterThan(2);
      expect(read(spec, ship())[i]).toBe(0);
      expect(read(spec, ship(new Vector2(0, -300)))[i]).toBe(0);
    }
    const line = parseSensors({ lineCheck: { horizon: 2 } })[0]!;
    expect(read(line, ship(new Vector2(0, 300)))[0]).toBeCloseTo(0.5, 9);
  });

  it("time mode looks further by default, and specs without the new options stay as they were", () => {
    expect(parseSensors({ whiskers: { horizon: 2 } })[0]).toEqual({
      type: "whiskers",
      count: 7,
      spread: 180,
      range: TIME_MODE_RANGE,
      horizon: 2,
    });
    expect(parseSensors({ whiskers: { horizon: 2, range: 900 } })[0]).toMatchObject({ range: 900 });
    expect(parseSensors({ whiskers: {} })[0]).toEqual({
      type: "whiskers",
      count: 7,
      spread: 180,
      range: 600,
    });
    expect(() => parseSensors({ nearest: { horizon: 2 } })).toThrow(/unknown parameter/);
    expect(() => parseSensors({ nearest: { flag: 2 } })).toThrow(/flag must be 1/);
  });

  it("nearest flag: a present input per slot, and an empty slot reads all 0", () => {
    const spec = parseSensors({ nearest: { k: 2, flag: 1 } })[0]!;
    expect(sensorSize(spec)).toBe(8);
    const values = read(spec, ship());
    expect(values[0]).toBe(1);
    expect(values[1]).toBeCloseTo(0, 9); // dead ahead
    expect(values[2]).toBeCloseTo(300 / 800, 9);
    expect(values[3]).toBeCloseTo(0.2, 9);
    expect(values.slice(4)).toEqual([0, 0, 0, 0]);
    const spec2: ModelSpec = { inputs: [...ENCODINGS.v2!], outputs: "thrustTurn", sensors: [spec] };
    expect(inputCount(spec2)).toBe(5 + 8);
  });
});

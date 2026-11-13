import { Movable, Vector2 } from "@ar/shared";
import { describe, expect, it } from "vitest";
import type { AIGameClient } from "./ai-game-client";
import { ExamReplay } from "./exam";
import { parseController, sameSpec, type ModelSpec } from "./model-spec";
import { MajorTom } from "./network";
import { ObstacleGrid } from "./obstacle-grid";
import { SCRIPTED_SPEC, scriptedModel } from "./scripted-controller";
import { MAX_BOT_ROTATION_SPEED, TargetVehicleController } from "./target-vehicle-controller";
import { seededRandom } from "../random";

/** A linear [6, 2] model on the scripted inputs whose outputs are the constants `out` (bias only). */
function constantModel(controller: ModelSpec["controller"], out: [number, number]): MajorTom {
  const spec: ModelSpec = { ...SCRIPTED_SPEC, inputs: [...SCRIPTED_SPEC.inputs], controller };
  const model = MajorTom.random([6, 2], seededRandom(1), "Const", spec);
  const w = model.weights[0]!;
  w.fill(0);
  w[0] = Math.atanh(out[0]); // row 0: [bias, 6 inputs]
  w[7] = Math.atanh(out[1]);
  return model;
}

/** One controller step for a ship at rest at the origin, nose up, target straight ahead. */
function oneStep(model: MajorTom) {
  const ship = new Movable({ position: Vector2.zero(), radius: 20, orientation: 0 });
  let moved: { accelerationFactor?: number; rotationSpeed?: number } = {};
  const client = { ship, obstacles: new ObstacleGrid([]), move: (m: typeof moved) => (moved = m) };
  const c = new TargetVehicleController(client as unknown as AIGameClient, model);
  c.target = { position: new Vector2(0, 800) } as never;
  c.step(0.015);
  return moved;
}

describe("controller switch", () => {
  it("residual with a zero network flies exactly like the scripted controller, frame by frame", async () => {
    const zero = constantModel({ kind: "residual", scale: 0.5 }, [0, 0]);
    const runs: number[][] = [];
    for (const model of [scriptedModel(), zero]) {
      const replay = await ExamReplay.create(model, "short", 7, 20);
      const path: number[] = [];
      while (!replay.done && replay.frame < 1200) {
        replay.step(1);
        const s = replay.ship!;
        path.push(s.position.x, s.position.y, s.orientation);
      }
      runs.push(path);
      replay.dispose();
    }
    expect(runs[0]!.length).toBeGreaterThan(300);
    expect(runs[1]).toEqual(runs[0]);
  });

  it("residual adds scale × output to the scripted action and clamps", () => {
    const base = oneStep(constantModel({ kind: "residual", scale: 0.5 }, [0, 0]));
    const pushed = oneStep(constantModel({ kind: "residual", scale: 0.5 }, [0.4, 0.6]));
    const baseTurn = base.rotationSpeed! / MAX_BOT_ROTATION_SPEED;
    const baseThrust = base.accelerationFactor! * 2 - 1;
    expect(pushed.rotationSpeed! / MAX_BOT_ROTATION_SPEED).toBeCloseTo(Math.min(1, baseTurn + 0.3), 12);
    expect(pushed.accelerationFactor! * 2 - 1).toBeCloseTo(Math.min(1, baseThrust + 0.2), 12);
  });

  it("heading: output 0 is a heading offset turned at gain × offset (clamped), output 1 the throttle", () => {
    const small = oneStep(constantModel({ kind: "heading", gain: 3 }, [0.1, 0.5]));
    expect(small.rotationSpeed).toBeCloseTo(0.3 * MAX_BOT_ROTATION_SPEED, 12);
    expect(small.accelerationFactor).toBeCloseTo(0.75, 12);
    const big = oneStep(constantModel({ kind: "heading", gain: 3 }, [-0.9, -0.2]));
    expect(big.rotationSpeed).toBeCloseTo(-MAX_BOT_ROTATION_SPEED, 12);
    expect(big.accelerationFactor).toBeCloseTo(0.4, 12);
  });

  it("is stored in the spec, round-trips, and old specs stay as they were", () => {
    const model = constantModel({ kind: "heading", gain: 2 }, [0, 0]);
    const back = MajorTom.fromJson(JSON.parse(JSON.stringify(model.toJson())));
    expect(back.spec.controller).toEqual({ kind: "heading", gain: 2 });
    expect(sameSpec(back.spec, { ...SCRIPTED_SPEC, inputs: [...SCRIPTED_SPEC.inputs] })).toBe(false);
    expect("controller" in scriptedModel().toJson().spec!).toBe(false);
    expect(() =>
      MajorTom.fromJson({
        ...model.toJson(),
        spec: { ...model.toJson().spec!, controller: { kind: "pid" } as never },
      }),
    ).toThrow(/controller/);
  });

  it("parses the config with defaults and rejects mistakes", () => {
    expect(parseController({ kind: "residual" })).toEqual({ kind: "residual", scale: 0.5 });
    expect(parseController({ kind: "heading" })).toEqual({ kind: "heading", gain: 3 });
    expect(parseController({ kind: "residual", scale: 0.25 })).toEqual({ kind: "residual", scale: 0.25 });
    expect(() => parseController({ kind: "pid" })).toThrow(/kind/);
    expect(() => parseController({ kind: "residual", gain: 2 })).toThrow(/unknown/);
    expect(() => parseController({ kind: "heading", gain: 0 })).toThrow(/> 0/);
    expect(() => parseController("residual")).toThrow(/object/);
  });
});

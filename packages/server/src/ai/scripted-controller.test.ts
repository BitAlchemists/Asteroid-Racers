import { describe, expect, it } from "vitest";
import { inputCount, validateSpec } from "./model-spec";
import { SCRIPTED_SPEC, scriptedModel, scriptedPolicy } from "./scripted-controller";

// Inputs: targetAngle, targetDistance/1000, velocityAngle, speed/1000, lineCheck.near, lineCheck.offset.
describe("scripted controller", () => {
  it("thrusts at a target straight ahead without turning", () => {
    const [thrust, turn] = scriptedPolicy([0, 0.8, 0, 0, 0, 0]);
    expect(thrust).toBe(1);
    expect(turn).toBeCloseTo(0, 9);
  });

  it("turns towards a target to the side (a positive turn reduces a positive angle) before thrusting", () => {
    const [thrust, turn] = scriptedPolicy([0.4, 0.8, 0, 0, 0, 0]);
    expect(turn).toBeGreaterThan(0);
    expect(thrust).toBe(-1); // not aligned yet: no thrust
    expect(scriptedPolicy([-0.4, 0.8, 0, 0, 0, 0])[1]).toBeLessThan(0);
  });

  it("brakes near the target: at speed towards it, it turns to thrust the other way", () => {
    const [, turn] = scriptedPolicy([0, 0.03, 0, 0.5, 0, 0]);
    expect(Math.abs(turn)).toBe(1);
  });

  it("steers sideways when lineCheck reports a rock in the corridor", () => {
    const clear = scriptedPolicy([0, 0.8, 0, 0.3, 0, 0])[1];
    const blocked = scriptedPolicy([0, 0.8, 0, 0.3, 0.8, 0.2])[1];
    expect(clear).toBeCloseTo(0, 9);
    expect(Math.abs(blocked)).toBeGreaterThan(0.1);
  });

  it("is a valid model for every evaluation path, with outputs in the network range", () => {
    const model = scriptedModel();
    validateSpec(model.spec, model.layout);
    expect(inputCount(SCRIPTED_SPEC)).toBe(6);
    const out = model.activate([0.2, 0.5, -0.1, 0.2, 0, 0]);
    expect(out[0]).toBeGreaterThanOrEqual(-1);
    expect(out[0]).toBeLessThanOrEqual(1);
    expect(Math.abs(out[1]!)).toBeLessThanOrEqual(1);
  });
});

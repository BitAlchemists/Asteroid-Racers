import { seededRandom } from "../random";
import { LEGACY_SPEC, type ModelSpec } from "./model-spec";
import { MajorTom } from "./network";
import { parseSensors } from "./sensors";

/**
 * A hand-written steering controller: the baseline a learned model should beat. It uses only what a
 * bot sees (the legacy inputs plus `lineCheck`), so it flies through exactly the same code path as a
 * network (`TargetVehicleController`) and can later serve as the base of a residual policy.
 *
 * Inputs, in {@link SCRIPTED_SPEC} order: targetAngle, targetDistance (/1000), velocityAngle,
 * speed (/1000), lineCheck.near (0..1), lineCheck.offset (−1..1). Angles are half turns from the nose;
 * a positive turn output reduces a positive angle. Output: [thrust, turn] in the network's −1..1 range.
 */
export const SCRIPTED_SPEC: Readonly<ModelSpec> = Object.freeze({
  inputs: [...LEGACY_SPEC.inputs],
  outputs: LEGACY_SPEC.outputs,
  sensors: parseSensors({ lineCheck: {} }),
});

/** Thrust in units/s² at full throttle (game-server MAX_ACCELERATION). */
const ACCEL = 400;
/** Top cruising speed the controller aims for, units/s. */
const CRUISE = 450;
/** Sideways speed added to steer around a rock in the corridor, units/s at near = 1. */
const DODGE = 450;

export function scriptedPolicy(x: ArrayLike<number>): [number, number] {
  const angle = Math.PI * x[0]!;
  const dist = 1000 * x[1]!;
  const vAngle = Math.PI * x[2]!;
  const speed = 1000 * x[3]!;
  const near = x[4] ?? 0;
  const offset = x[5] ?? 0;
  // Ship frame: f = along the nose, s = sideways (same sign convention as targetSin).
  const vf = speed * Math.cos(vAngle);
  const vs = speed * Math.sin(vAngle);
  // Desired velocity: towards the target, slowing so it can still stop (braking at 60 % of thrust).
  const want = Math.min(CRUISE, Math.sqrt(2 * ACCEL * 0.6 * Math.max(0, dist - 20)));
  let df = want * Math.cos(angle);
  let ds = want * Math.sin(angle);
  if (near > 0) {
    // A rock in the corridor: add sideways speed away from it (perpendicular to the target line).
    const away = offset >= 0 ? 1 : -1;
    df += -away * DODGE * near * Math.sin(angle);
    ds += away * DODGE * near * Math.cos(angle);
  }
  // Thrust towards the velocity error; turn the nose onto it.
  const ef = df - vf;
  const es = ds - vs;
  const error = Math.hypot(ef, es);
  const errorAngle = Math.atan2(es, ef) / Math.PI; // half turns, 0 = ahead
  const turn = Math.max(-1, Math.min(1, 3 * errorAngle));
  const aligned = Math.abs(errorAngle) < 0.12;
  const throttle = aligned ? Math.min(1, error / 150) : 0;
  return [2 * throttle - 1, turn];
}

/**
 * The scripted controller dressed as a model, so every evaluation path (training flights, held-out,
 * exam, replays) runs it unchanged. Its weights are unused; `activate` calls {@link scriptedPolicy}.
 */
export function scriptedModel(name = "Scripted"): MajorTom {
  const model = MajorTom.random([6, 2], seededRandom(1), name, { ...SCRIPTED_SPEC });
  const out = new Float64Array(2);
  model.activate = (inputs: ArrayLike<number>) => {
    const [thrust, turn] = scriptedPolicy(inputs);
    out[0] = thrust;
    out[1] = turn;
    return out;
  };
  return model;
}

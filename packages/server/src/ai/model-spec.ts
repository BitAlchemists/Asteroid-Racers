import type { Movable, Vector2 } from "@ar/shared";
import type { ObstacleGrid } from "./obstacle-grid";

/** Scales distances and speeds into a range the network handles well. */
export const INPUT_SCALE = 1 / 1000;

/**
 * What a model sees and what its outputs mean. Stored with every model, so the game and the trainer
 * always feed a network the inputs it was trained with.
 */
export interface ModelSpec {
  /** Names from {@link INPUTS}, in input-neuron order. */
  inputs: string[];
  /** How the outputs drive the ship; see {@link OUTPUTS}. */
  outputs: string;
}

/** What an input function may look at. */
export interface InputContext {
  ship: Movable;
  /** Position of the current target. */
  target: Vector2;
  /** The asteroids the bot knows of (what a player sees on screen); empty when not needed. */
  obstacles?: ObstacleGrid;
}

/** Wraps a half-turn-normalised angle (1 = π) into [-1, 1]. */
function wrapUnit(angle: number): number {
  if (angle > 1) return angle - 2;
  if (angle < -1) return angle + 2;
  return angle;
}

/** Angle of `dx, dy` relative to the ship's nose, in half turns (−1..1). The nose points along +y at orientation 0. */
export function relativeAngle(dx: number, dy: number, orientation: number): number {
  let towards = Math.atan2(dy, dx) / Math.PI - 0.5;
  if (towards < -1) towards += 2;
  return wrapUnit(towards - orientation / Math.PI);
}

/**
 * The input registry. Angles are relative to the ship's nose in half turns, lengths scaled by 1/1000.
 * Adding a sensor means adding an entry here; models name the inputs they use.
 */
export const INPUTS: Readonly<Record<string, (ctx: InputContext) => number>> = {
  /** Angle to the current target. */
  targetAngle: ({ ship, target }) =>
    relativeAngle(target.x - ship.position.x, target.y - ship.position.y, ship.orientation),
  /** Distance to the current target. */
  targetDistance: ({ ship, target }) =>
    Math.hypot(target.x - ship.position.x, target.y - ship.position.y) * INPUT_SCALE,
  /** Direction of travel. */
  velocityAngle: ({ ship }) => relativeAngle(ship.velocity.x, ship.velocity.y, ship.orientation),
  /** Speed. */
  speed: ({ ship }) => ship.velocity.length * INPUT_SCALE,
};

/** Output mappings and how many output neurons each needs. */
export const OUTPUTS: Readonly<Record<string, { count: number; description: string }>> = {
  thrustTurn: { count: 2, description: "thrust (tanh −1..1 → 0..1), turn rate (±1 → ±5 rad/s)" },
};

/** The four inputs and two outputs of every model trained before model specs existed. */
export const LEGACY_SPEC: Readonly<ModelSpec> = Object.freeze({
  inputs: ["targetAngle", "targetDistance", "velocityAngle", "speed"],
  outputs: "thrustTurn",
});

/** The original hidden layers (4-10-8-6-4-2 with the legacy spec). */
export const DEFAULT_HIDDEN: readonly number[] = [10, 8, 6, 4];

/** Throws unless every input and the output mapping are known and they fit `layout`. */
export function validateSpec(spec: ModelSpec, layout: readonly number[]): void {
  const unknown = spec.inputs.filter((name) => !(name in INPUTS));
  if (unknown.length > 0)
    throw new Error(`unknown model inputs ${unknown.join(", ")}; known: ${Object.keys(INPUTS).join(", ")}`);
  const output = OUTPUTS[spec.outputs];
  if (!output) throw new Error(`unknown model outputs ${JSON.stringify(spec.outputs)}`);
  if (layout[0] !== spec.inputs.length || layout.at(-1) !== output.count)
    throw new Error(
      `model spec needs ${spec.inputs.length} inputs and ${output.count} outputs, network layout is ${JSON.stringify(layout)}`,
    );
}

export function layoutFor(spec: ModelSpec, hidden: readonly number[]): number[] {
  const output = OUTPUTS[spec.outputs];
  if (!output) throw new Error(`unknown model outputs ${JSON.stringify(spec.outputs)}`);
  return [spec.inputs.length, ...hidden, output.count];
}

export function sameSpec(a: ModelSpec, b: ModelSpec): boolean {
  return (
    a.outputs === b.outputs &&
    a.inputs.length === b.inputs.length &&
    a.inputs.every((x, i) => x === b.inputs[i])
  );
}

/** The `model` section of a training config: `{ inputs?, hidden?, outputs? }`, defaults = the original model. */
export function parseModelConfig(raw: unknown): { spec: ModelSpec; hidden: number[] } {
  if (raw === undefined)
    return { spec: { ...LEGACY_SPEC, inputs: [...LEGACY_SPEC.inputs] }, hidden: [...DEFAULT_HIDDEN] };
  if (typeof raw !== "object" || raw === null) throw new Error("model must be an object");
  const { inputs, hidden, outputs, ...rest } = raw as Record<string, unknown>;
  if (Object.keys(rest).length > 0) throw new Error(`unknown model keys ${Object.keys(rest).join(", ")}`);
  if (
    inputs !== undefined &&
    (!Array.isArray(inputs) || inputs.length === 0 || !inputs.every((i) => typeof i === "string"))
  )
    throw new Error("model.inputs must be a non-empty list of input names");
  if (
    hidden !== undefined &&
    (!Array.isArray(hidden) || !hidden.every((n) => Number.isInteger(n) && (n as number) >= 1))
  )
    throw new Error("model.hidden must be a list of layer sizes ≥ 1");
  if (outputs !== undefined && typeof outputs !== "string") throw new Error("model.outputs must be a string");
  const spec: ModelSpec = {
    inputs: (inputs as string[] | undefined) ?? [...LEGACY_SPEC.inputs],
    outputs: (outputs as string | undefined) ?? LEGACY_SPEC.outputs,
  };
  const layers = (hidden as number[] | undefined) ?? [...DEFAULT_HIDDEN];
  validateSpec(spec, layoutFor(spec, layers));
  return { spec, hidden: layers };
}

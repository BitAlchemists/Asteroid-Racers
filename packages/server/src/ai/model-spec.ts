import type { Movable, Vector2 } from "@ar/shared";
import type { ObstacleGrid } from "./obstacle-grid";
import { sensorSize, type SensorSpec } from "./sensors";

/** Display names of one sensor's inputs, in input order, e.g. `whiskers[0]` or `nearest[1].dist`. */
export function sensorInputNames(s: SensorSpec): string[] {
  const indexed = (n: number) => Array.from({ length: n }, (_, i) => `${s.type}[${i}]`);
  switch (s.type) {
    case "lineCheck":
      return ["lineCheck.near", "lineCheck.offset"];
    case "whiskers":
    case "sectors":
      return indexed(s.count);
    case "nearest": {
      const fields = s.flag ? ["present", "angle", "dist", "radius"] : ["angle", "dist", "radius"];
      return Array.from({ length: s.k }, (_, i) => fields.map((f) => `nearest[${i}].${f}`)).flat();
    }
  }
}

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
  /** Obstacle sensors, whose inputs follow `inputs` (absent = none). */
  sensors?: SensorSpec[];
}

/** Number of input neurons a spec needs: its named inputs plus every sensor's inputs. */
export function inputCount(spec: ModelSpec): number {
  return spec.inputs.length + (spec.sensors ?? []).reduce((n, s) => n + sensorSize(s), 0);
}

/** Display names of every input neuron: the spec's input names, then each sensor's inputs. */
export function inputNames(spec: ModelSpec): string[] {
  return [...spec.inputs, ...(spec.sensors ?? []).flatMap(sensorInputNames)];
}

/** What an input function may look at. */
export interface InputContext {
  ship: Movable;
  /** Position of the current target. */
  target: Vector2;
  /** The asteroids the bot knows of (what a player sees on screen); empty when not needed. */
  obstacles?: ObstacleGrid;
  /**
   * Lookahead: position of the k-th target after the current one (k = 1 is the next one), or
   * undefined when there is none. Absent = no upcoming targets known.
   */
  next?: ((k: number) => Vector2 | undefined) | undefined;
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

/** Encoding v2: the distance at which `targetDistanceSoft` reads 0.5. */
export const V2_DISTANCE_HALF = 500;
/** Encoding v2: speeds are divided by this (typical race speeds 200–600 read 0.4–1.2). */
export const V2_SPEED_SCALE = 500;

/**
 * Lookahead inputs for leg `k` (k = 1: from the current target to the one after it; k = 2: the leg
 * after that), encoded like v2: `present` (1 when that target exists, else 0 and the rest 0), the
 * sine and cosine of the leg's direction relative to the ship's nose, and the leg length squashed
 * like `targetDistanceSoft`. The leg, not the ship-to-target line: it says how sharp the turn at the
 * current target will be, which the ship-to-target angle hardly shows while the target is far away.
 */
function lookaheadLeg(k: number): {
  present: (ctx: InputContext) => number;
  sin: (ctx: InputContext) => number;
  cos: (ctx: InputContext) => number;
  distanceSoft: (ctx: InputContext) => number;
} {
  const leg = ({ target, next }: InputContext): { dx: number; dy: number } | undefined => {
    const to = next?.(k);
    if (!to) return undefined;
    const from = k === 1 ? target : next?.(k - 1);
    if (!from) return undefined;
    return { dx: to.x - from.x, dy: to.y - from.y };
  };
  const angle = (ctx: InputContext, f: (a: number) => number): number => {
    const l = leg(ctx);
    return l ? f(Math.PI * relativeAngle(l.dx, l.dy, ctx.ship.orientation)) : 0;
  };
  return {
    present: (ctx) => (leg(ctx) ? 1 : 0),
    sin: (ctx) => angle(ctx, Math.sin),
    cos: (ctx) => angle(ctx, Math.cos),
    distanceSoft: (ctx) => {
      const l = leg(ctx);
      if (!l) return 0;
      const d = Math.hypot(l.dx, l.dy);
      return d / (d + V2_DISTANCE_HALF);
    },
  };
}

/** Longest lookahead the `lookahead` switch offers (legs to `next2` and `next3`). */
export const MAX_LOOKAHEAD = 2;

/** The lookahead entries of {@link INPUTS}: `next2*` for leg 1, `next3*` for leg 2. */
function lookaheadEntries(): Record<string, (ctx: InputContext) => number> {
  const entries: Record<string, (ctx: InputContext) => number> = {};
  for (let k = 1; k <= MAX_LOOKAHEAD; k++) {
    const leg = lookaheadLeg(k);
    const prefix = `next${k + 1}`;
    entries[`${prefix}Present`] = leg.present;
    entries[`${prefix}Sin`] = leg.sin;
    entries[`${prefix}Cos`] = leg.cos;
    entries[`${prefix}DistanceSoft`] = leg.distanceSoft;
  }
  return entries;
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

  // Encoding v2: smooth angles, velocity in the ship's frame, bounded distance; values about −1..1.
  /** Sine of the angle to the target: + to one side, − to the other, 0 ahead and behind. */
  targetSin: (ctx) => Math.sin(Math.PI * INPUTS.targetAngle!(ctx)),
  /** Cosine of the angle to the target: 1 ahead, −1 behind. No jump anywhere. */
  targetCos: (ctx) => Math.cos(Math.PI * INPUTS.targetAngle!(ctx)),
  /** Distance to the target squashed into 0..1: d / (d + 500); 0.5 at 500 units. */
  targetDistanceSoft: ({ ship, target }) => {
    const d = Math.hypot(target.x - ship.position.x, target.y - ship.position.y);
    return d / (d + V2_DISTANCE_HALF);
  },
  /** Speed along the nose ÷ 500 (negative when drifting backwards). */
  forwardSpeed: ({ ship }) =>
    (ship.velocity.length / V2_SPEED_SCALE) *
    Math.cos(Math.PI * relativeAngle(ship.velocity.x, ship.velocity.y, ship.orientation)),
  /** Sideways speed ÷ 500, same sign convention as `targetSin`. */
  sideSpeed: ({ ship }) =>
    (ship.velocity.length / V2_SPEED_SCALE) *
    Math.sin(Math.PI * relativeAngle(ship.velocity.x, ship.velocity.y, ship.orientation)),

  // Lookahead (the `lookahead` switch): the legs after the current target, encoded like v2.
  ...lookaheadEntries(),
};

/**
 * The inputs the `lookahead: n` switch appends to a spec's inputs: for each of the next `n` legs,
 * `next{k+1}Present`, `…Sin`, `…Cos`, `…DistanceSoft`.
 */
export function lookaheadInputs(n: number): string[] {
  if (!Number.isInteger(n) || n < 1 || n > MAX_LOOKAHEAD)
    throw new Error(`lookahead must be an integer from 1 to ${MAX_LOOKAHEAD}, got ${JSON.stringify(n)}`);
  return Array.from({ length: n }, (_, i) =>
    ["Present", "Sin", "Cos", "DistanceSoft"].map((f) => `next${i + 2}${f}`),
  ).flat();
}

/** Named input sets: `v1` is the original four, `v2` the smooth, frame-relative encoding. */
export const ENCODINGS: Readonly<Record<string, readonly string[]>> = {
  v1: ["targetAngle", "targetDistance", "velocityAngle", "speed"],
  v2: ["targetSin", "targetCos", "targetDistanceSoft", "forwardSpeed", "sideSpeed"],
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
  if (layout[0] !== inputCount(spec) || layout.at(-1) !== output.count)
    throw new Error(
      `model spec needs ${inputCount(spec)} inputs and ${output.count} outputs, network layout is ${JSON.stringify(layout)}`,
    );
}

export function layoutFor(spec: ModelSpec, hidden: readonly number[]): number[] {
  const output = OUTPUTS[spec.outputs];
  if (!output) throw new Error(`unknown model outputs ${JSON.stringify(spec.outputs)}`);
  return [inputCount(spec), ...hidden, output.count];
}

export function sameSpec(a: ModelSpec, b: ModelSpec): boolean {
  return (
    a.outputs === b.outputs &&
    a.inputs.length === b.inputs.length &&
    a.inputs.every((x, i) => x === b.inputs[i]) &&
    JSON.stringify(a.sensors ?? []) === JSON.stringify(b.sensors ?? [])
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

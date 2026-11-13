import type { Entity, Movable, Vector2 } from "@ar/shared";
import type { AIGameClient, VehicleController } from "./ai-game-client";
import { inputCount, inputNames, INPUTS, LEGACY_SPEC, validateSpec, type InputContext } from "./model-spec";
import { drawSensors, readSensors, type SensorPrimitive } from "./sensors";
import type { MajorTom } from "./network";
import { seededRandom, type Random } from "../random";

export { INPUT_SCALE } from "./model-spec";

/** Network output 1 maps to this rotation speed (rad/s), like the human controls. */
export const MAX_BOT_ROTATION_SPEED = 5;

/**
 * The four legacy network inputs, exactly as the Dart TargetVehicleController computed them:
 * angle to the target, distance to the target, angle of the velocity, speed.
 */
export function targetInputs(ship: Movable, target: Vector2): [number, number, number, number] {
  const ctx: InputContext = { ship, target };
  const [a, b, c, d] = LEGACY_SPEC.inputs.map((name) => INPUTS[name]!(ctx));
  return [a!, b!, c!, d!];
}

/**
 * Latency and noise between the world and the network (the `inputDelay` / `inputNoise` switches).
 * Values of 0 change nothing.
 */
export interface Perception {
  /** The network sees the inputs of this many controller steps ago (integer ≥ 0). */
  inputDelay?: number;
  /** Standard deviation of the Gaussian noise added to each input the network sees (≥ 0). */
  inputNoise?: number;
  /** Seed of the noise stream (one generator per controller). */
  noiseSeed?: number;
}

/** A standard normal number from two draws (Box–Muller). */
function gaussian(random: Random): number {
  const u1 = 1 - random(); // (0, 1], so the log is finite
  const u2 = random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Flies the bot's ship towards `target`: every frame it computes the inputs the model's spec names,
 * and turns the outputs into thrust and turn rate.
 */
export class TargetVehicleController implements VehicleController {
  target: Entity | undefined;
  /**
   * The targets after `target`, for lookahead inputs: k = 1 is the next one. Set by the script that
   * knows them (a training episode's list, a race's checkpoint chain); absent = none known.
   */
  next: ((k: number) => Vector2 | undefined) | undefined;
  private readonly inputs: ((ctx: InputContext) => number)[];
  private readonly buffer: Float64Array;
  /** The network's output array of the last step (a reference, not a copy); undefined before. */
  private lastOutputs: Float64Array | undefined;
  private names: string[] | undefined;
  /** With latency: the last `inputDelay + 1` input vectors, a ring written at `head`. */
  private readonly history: Float64Array[] = [];
  private head = 0;
  private filled = false;
  /** With latency or noise: what the network sees (else it sees `buffer` itself). */
  private readonly seen: Float64Array | undefined;
  private readonly noise: { sigma: number; random: Random } | undefined;

  constructor(
    private readonly client: AIGameClient,
    readonly network: MajorTom,
    perception: Perception = {},
  ) {
    validateSpec(network.spec, network.layout);
    this.inputs = network.spec.inputs.map((name) => INPUTS[name]!);
    this.buffer = new Float64Array(inputCount(network.spec));
    const delay = perception.inputDelay ?? 0;
    const sigma = perception.inputNoise ?? 0;
    if (!Number.isInteger(delay) || delay < 0) throw new Error("inputDelay must be an integer ≥ 0");
    if (!(sigma >= 0)) throw new Error("inputNoise must be ≥ 0");
    for (let i = 0; delay > 0 && i <= delay; i++) this.history.push(new Float64Array(this.buffer.length));
    if (sigma > 0) this.noise = { sigma, random: seededRandom(perception.noiseSeed ?? 0) };
    if (delay > 0 || sigma > 0) this.seen = new Float64Array(this.buffer.length);
  }

  /** Forgets the delayed inputs (a new episode): the next step sees its own inputs at first. */
  resetHistory(): void {
    this.filled = false;
  }

  /** What the network sees: the inputs of `inputDelay` steps ago, plus noise. */
  private perceive(): Float64Array {
    const seen = this.seen;
    if (!seen) return this.buffer;
    if (this.history.length > 0) {
      const ring = this.history;
      if (!this.filled) {
        for (const slot of ring) slot.set(this.buffer);
        this.filled = true;
      } else ring[this.head]!.set(this.buffer);
      // The oldest slot holds the inputs of `inputDelay` steps ago.
      this.head = (this.head + 1) % ring.length;
      seen.set(ring[this.head]!);
    } else seen.set(this.buffer);
    const noise = this.noise;
    if (noise)
      for (let i = 0; i < seen.length; i++) seen[i] = seen[i]! + noise.sigma * gaussian(noise.random);
    return seen;
  }

  /** What the sensors see now, for drawing (empty without sensors or a target). */
  sensorPrimitives(): SensorPrimitive[] {
    const ship = this.client.ship;
    const sensors = this.network.spec.sensors;
    if (!ship || !this.target || !sensors?.length) return [];
    return drawSensors(sensors, { ship, target: this.target.position, obstacles: this.client.obstacles });
  }

  /**
   * What the network saw and answered in the last step, for a viewer: the input names (built on the
   * first call), the input buffer and the raw outputs (tanh −1..1). Live views of the controller's
   * own arrays, valid until the next step; undefined before the first step.
   */
  lastActivation(): { names: string[]; values: Float64Array; outputs: Float64Array } | undefined {
    if (!this.lastOutputs) return undefined;
    this.names ??= inputNames(this.network.spec);
    return { names: this.names, values: this.seen ?? this.buffer, outputs: this.lastOutputs };
  }

  step(_dt: number): void {
    const ship = this.client.ship;
    if (!this.target || !ship) return;

    const ctx: InputContext = { ship, target: this.target.position, next: this.next };
    for (let i = 0; i < this.inputs.length; i++) this.buffer[i] = this.inputs[i]!(ctx);
    const sensors = this.network.spec.sensors;
    if (sensors?.length)
      readSensors(
        sensors,
        { ship, target: ctx.target, obstacles: this.client.obstacles },
        this.buffer,
        this.inputs.length,
      );
    const outputs = this.network.activate(this.perceive());
    this.lastOutputs = outputs;
    const [thrust, turn] = outputs;
    this.client.proxy.movePlayer({
      accelerationFactor: (thrust! + 1) / 2, // tanh −1..1 → 0..1
      rotationSpeed: turn! * MAX_BOT_ROTATION_SPEED,
      // no newOrientation: the server keeps the orientation and integrates the rotation speed
    });
  }
}

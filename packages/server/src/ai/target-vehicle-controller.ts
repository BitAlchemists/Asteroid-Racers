import type { Entity, Movable, Vector2 } from "@ar/shared";
import type { AIGameClient, VehicleController } from "./ai-game-client";
import { inputCount, inputNames, INPUTS, LEGACY_SPEC, validateSpec, type InputContext } from "./model-spec";
import { drawSensors, readSensors, type SensorPrimitive } from "./sensors";
import type { MajorTom } from "./network";

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
 * Flies the bot's ship towards `target`: every frame it computes the inputs the model's spec names,
 * and turns the outputs into thrust and turn rate.
 */
export class TargetVehicleController implements VehicleController {
  target: Entity | undefined;
  private readonly inputs: ((ctx: InputContext) => number)[];
  private readonly buffer: Float64Array;
  /** The network's output array of the last step (a reference, not a copy); undefined before. */
  private lastOutputs: Float64Array | undefined;
  private names: string[] | undefined;

  constructor(
    private readonly client: AIGameClient,
    readonly network: MajorTom,
  ) {
    validateSpec(network.spec, network.layout);
    this.inputs = network.spec.inputs.map((name) => INPUTS[name]!);
    this.buffer = new Float64Array(inputCount(network.spec));
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
    return { names: this.names, values: this.buffer, outputs: this.lastOutputs };
  }

  step(_dt: number): void {
    const ship = this.client.ship;
    if (!this.target || !ship) return;

    const ctx: InputContext = { ship, target: this.target.position };
    for (let i = 0; i < this.inputs.length; i++) this.buffer[i] = this.inputs[i]!(ctx);
    const sensors = this.network.spec.sensors;
    if (sensors?.length)
      readSensors(
        sensors,
        { ship, target: ctx.target, obstacles: this.client.obstacles },
        this.buffer,
        this.inputs.length,
      );
    const outputs = this.network.activate(this.buffer);
    this.lastOutputs = outputs;
    const [thrust, turn] = outputs;
    this.client.proxy.movePlayer({
      accelerationFactor: (thrust! + 1) / 2, // tanh −1..1 → 0..1
      rotationSpeed: turn! * MAX_BOT_ROTATION_SPEED,
      // no newOrientation: the server keeps the orientation and integrates the rotation speed
    });
  }
}

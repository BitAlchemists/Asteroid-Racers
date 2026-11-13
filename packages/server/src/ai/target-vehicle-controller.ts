import type { Entity, Movable, Vector2 } from "@ar/shared";
import type { AIGameClient, VehicleController } from "./ai-game-client";
import { INPUTS, inputCount, LEGACY_SPEC, validateSpec, type InputContext } from "./model-spec";
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
    const [thrust, turn] = this.network.activate(this.buffer);
    this.client.proxy.movePlayer({
      accelerationFactor: (thrust! + 1) / 2, // tanh −1..1 → 0..1
      rotationSpeed: turn! * MAX_BOT_ROTATION_SPEED,
      // no newOrientation: the server keeps the orientation and integrates the rotation speed
    });
  }
}

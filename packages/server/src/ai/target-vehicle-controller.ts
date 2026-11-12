import type { Entity, Movable, Vector2 } from "@ar/shared";
import type { AIGameClient, VehicleController } from "./ai-game-client";
import type { MajorTom } from "./network";

/** Scales distances and speeds into a range the network handles well. */
export const INPUT_SCALE = 1 / 1000;
/** Network output 1 maps to this rotation speed (rad/s), like the human controls. */
export const MAX_BOT_ROTATION_SPEED = 5;

/** Wraps a half-turn-normalised angle (1 = π) into [-1, 1]. */
function wrapUnit(angle: number): number {
  if (angle > 1) return angle - 2;
  if (angle < -1) return angle + 2;
  return angle;
}

/** Angle of `dx, dy` relative to the ship's nose, in half turns (−1..1). The nose points along +y at orientation 0. */
function relativeAngle(dx: number, dy: number, orientation: number): number {
  let towards = Math.atan2(dy, dx) / Math.PI - 0.5;
  if (towards < -1) towards += 2;
  return wrapUnit(towards - orientation / Math.PI);
}

/**
 * The four network inputs, exactly as the Dart TargetVehicleController computed them:
 * angle to the target, distance to the target, angle of the velocity, speed — angles relative to the
 * ship's nose in half turns, lengths scaled by 1/1000.
 */
export function targetInputs(ship: Movable, target: Vector2): [number, number, number, number] {
  const dx = target.x - ship.position.x;
  const dy = target.y - ship.position.y;
  return [
    relativeAngle(dx, dy, ship.orientation),
    Math.hypot(dx, dy) * INPUT_SCALE,
    relativeAngle(ship.velocity.x, ship.velocity.y, ship.orientation),
    ship.velocity.length * INPUT_SCALE,
  ];
}

/** Flies the bot's ship towards `target` by asking the network for thrust and turn rate every frame. */
export class TargetVehicleController implements VehicleController {
  target: Entity | undefined;

  constructor(
    private readonly client: AIGameClient,
    readonly network: MajorTom,
  ) {}

  step(_dt: number): void {
    const ship = this.client.ship;
    if (!this.target || !ship) return;

    const [thrust, turn] = this.network.activate(targetInputs(ship, this.target.position));
    this.client.proxy.movePlayer({
      accelerationFactor: (thrust! + 1) / 2, // tanh −1..1 → 0..1
      rotationSpeed: turn! * MAX_BOT_ROTATION_SPEED,
      // no newOrientation: the server keeps the orientation and integrates the rotation speed
    });
  }
}

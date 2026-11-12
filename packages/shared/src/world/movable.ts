import { Vector2 } from "../math/vector2";
import { Entity, EntityType, type EntityInit } from "./entity";

/**
 * Player steering intent sent from client to server. A missing (or NaN) field means "leave unchanged".
 */
export interface MovementInput {
  /** 0..1 thrust. */
  accelerationFactor?: number;
  /** Absolute orientation in radians. */
  newOrientation?: number;
  /** Radians per second. */
  rotationSpeed?: number;
}

export class Movable extends Entity {
  canMove = false;
  /** Radians per second. */
  rotationSpeed = 0;
  acceleration = Vector2.zero();
  velocity = Vector2.zero();

  constructor(init: EntityInit = {}) {
    super({ type: EntityType.SHIP, ...init });
  }

  override copyFrom(other: Entity): this {
    super.copyFrom(other);
    if (other instanceof Movable) {
      this.canMove = other.canMove;
      this.rotationSpeed = other.rotationSpeed;
      this.acceleration = other.acceleration.clone();
      this.velocity = other.velocity.clone();
    }
    return this;
  }

  override clone(): Movable {
    return new Movable().copyFrom(this);
  }
}

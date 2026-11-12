import type { Entity } from "@ar/shared";
import { Checkpoint, EntityType, Movable, RacePortal, Vector2 } from "@ar/shared";

/** Thrust at full throttle (units/s²); must match the server's MAX_ACCELERATION. */
export const SHIP_ACCELERATION = 400;
/** Turn rate while a rotate key is held (rad/s). */
export const SHIP_ROTATION_SPEED = 5;

/**
 * Client-side state for one replicated entity. Pure logic; the renderer keeps its own display
 * object per controller.
 */
export class EntityController<E extends Entity = Entity> {
  constructor(readonly entity: E) {}

  /** Applies a server update. Returns true when the view should be refreshed. */
  updateFromServer(update: Entity): boolean {
    this.entity.copyFrom(update);
    return true;
  }

  get isNamedShip(): boolean {
    return this.entity.type === EntityType.SHIP && !!this.entity.displayName;
  }

  static create(entity: Entity): EntityController {
    if (entity instanceof Movable) return new PlayerController(entity);
    if (entity instanceof Checkpoint) return new CheckpointController(entity);
    if (entity instanceof RacePortal) return new RacePortalController(entity);
    return new EntityController(entity);
  }
}

/** A ship: the local player's (steerable) or another player's / bot's. */
export class PlayerController extends EntityController<Movable> {
  /** 0 (coasting) or 1 (thrust), driven by the keyboard for the local player. */
  accelerationFactor = 0;
  isLocalPlayer = false;

  rotateLeft(): void {
    this.entity.rotationSpeed = -SHIP_ROTATION_SPEED;
  }

  rotateRight(): void {
    this.entity.rotationSpeed = SHIP_ROTATION_SPEED;
  }

  stopRotation(): void {
    this.entity.rotationSpeed = 0;
  }

  /** Local prediction of the server's thrust: along the ship's +y axis, rotated by its orientation. */
  applyThrust(): void {
    this.entity.acceleration =
      this.accelerationFactor !== 0
        ? new Vector2(0, SHIP_ACCELERATION * this.accelerationFactor).rotated(this.entity.orientation)
        : Vector2.zero();
  }

  /**
   * The local player keeps its own orientation and rotation speed while it can move, so turning stays
   * smooth despite network latency; everything else follows the server.
   */
  override updateFromServer(update: Entity): boolean {
    if (this.isLocalPlayer && update instanceof Movable && update.canMove) {
      const { orientation, rotationSpeed } = this.entity;
      super.updateFromServer(update);
      this.entity.orientation = orientation;
      this.entity.rotationSpeed = rotationSpeed;
      return true;
    }
    return super.updateFromServer(update);
  }
}

export class CheckpointController extends EntityController<Checkpoint> {}

export class RacePortalController extends EntityController<RacePortal> {
  /** True while the local player is in this race: clicking the portal then leaves it. */
  showLeaveButton = false;
}

import { wrapAngle } from "../math/angle";
import { Vector2 } from "../math/vector2";

/** Numeric values are the wire format (Dart `EntityType.index`) — never reorder. */
export enum EntityType {
  UNKNOWN = 0,
  ASTEROID = 1,
  SHIP = 2,
  CHECKPOINT = 3,
  LAUNCH_PLATFORM = 4,
  ARROWS = 5,
  FINISH = 6,
}

/** Numeric values are the wire format (Dart `CheckpointState.index`) — never reorder. */
export enum CheckpointState {
  CLEARED = 0,
  CURRENT = 1,
  FUTURE = 2,
}

export function isEntityType(value: number): value is EntityType {
  return Number.isInteger(value) && value >= EntityType.UNKNOWN && value <= EntityType.FINISH;
}

export function isCheckpointState(value: number): value is CheckpointState {
  return Number.isInteger(value) && value >= CheckpointState.CLEARED && value <= CheckpointState.FUTURE;
}

/** Id of an entity that has not been added to a {@link World} yet. */
export const NO_ID = -1;

export interface EntityInit {
  type?: EntityType;
  position?: Vector2;
  radius?: number;
  orientation?: number;
  displayName?: string;
}

export class Entity {
  type: EntityType;
  id = NO_ID;
  displayName: string | undefined;
  position: Vector2;
  radius: number;
  /** Server-side replication priority: entities with rank > 0 are sent in the next update, highest first. */
  updateRank = 0;

  private _orientation = 0;

  constructor(init: EntityInit = {}) {
    this.type = init.type ?? EntityType.UNKNOWN;
    this.position = init.position?.clone() ?? Vector2.zero();
    this.radius = init.radius ?? 1;
    this.displayName = init.displayName;
    if (init.orientation !== undefined) this.orientation = init.orientation;
  }

  /** Radians, kept within [-π, π]. */
  get orientation(): number {
    return this._orientation;
  }

  set orientation(value: number) {
    this._orientation = wrapAngle(value);
  }

  /** Copies replicated state (not `updateRank`). Vectors are cloned. */
  copyFrom(other: Entity): this {
    this.type = other.type;
    this.id = other.id;
    this.displayName = other.displayName;
    this.position = other.position.clone();
    this.orientation = other.orientation;
    this.radius = other.radius;
    return this;
  }

  clone(): Entity {
    return new Entity().copyFrom(this);
  }
}

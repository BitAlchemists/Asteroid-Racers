import { Entity, EntityType, type EntityInit } from "./entity";

/** Start platform of a race. `positions` are the starting slots (replicated to clients). */
export class RacePortal extends Entity {
  positions: Entity[] = [];
  /** Server-side owner (the race controller). Never replicated. */
  raceController: unknown = undefined;

  constructor(init: EntityInit = {}) {
    super({ type: EntityType.LAUNCH_PLATFORM, ...init });
  }

  override copyFrom(other: Entity): this {
    super.copyFrom(other);
    if (other instanceof RacePortal) {
      // Shallow, like the Dart original: the slot entities are shared.
      this.positions = other.positions;
    }
    return this;
  }

  override clone(): RacePortal {
    return new RacePortal().copyFrom(this);
  }
}

import { CheckpointState, Entity, EntityType, type EntityInit } from "./entity";

export class Checkpoint extends Entity {
  state = CheckpointState.FUTURE;

  constructor(init: EntityInit = {}) {
    super({ type: EntityType.CHECKPOINT, ...init });
  }

  override copyFrom(other: Entity): this {
    super.copyFrom(other);
    if (other instanceof Checkpoint) {
      this.state = other.state;
    }
    return this;
  }

  override clone(): Checkpoint {
    return new Checkpoint().copyFrom(this);
  }
}

import type { Entity } from "./entity";

export class World {
  readonly entities = new Map<number, Entity>();
  /** Static obstacles (asteroids, planets, stations) that ships can crash into. */
  readonly passiveCollisionEntities: Entity[] = [];
  private nextEntityId = 0;

  /** Assigns a fresh id and registers the entity. */
  addEntity(entity: Entity): void {
    entity.id = this.nextEntityId++;
    this.entities.set(entity.id, entity);
  }

  addEntities(entities: Iterable<Entity>): void {
    for (const entity of entities) this.addEntity(entity);
  }

  removeEntity(entity: Entity): void {
    this.entities.delete(entity.id);
  }
}

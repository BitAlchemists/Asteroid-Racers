import type { Entity } from "@ar/shared";

export type CollisionHandler = (colliding: Entity, other: Entity, penetration: number) => void;

/**
 * Circle-vs-circle collision between "active" entities (ships) and "passive" ones (asteroids, the
 * race portal). All collisions of a frame are collected first and handlers run afterwards, so
 * handlers may safely modify the entity lists.
 */
export class CollisionDetector {
  /** When true, active entities also collide with each other (both sides get a callback). */
  activeEntitiesCanCollide = false;
  readonly passiveEntities: Entity[] = [];
  readonly activeEntities: Entity[] = [];

  detectCollisions(handler: CollisionHandler): void {
    const collisions: [Entity, Entity, number][] = [];
    const active = this.activeEntities;

    if (this.activeEntitiesCanCollide) {
      for (let i = 0; i < active.length; i++) {
        const a = active[i]!;
        for (let j = i + 1; j < active.length; j++) {
          const b = active[j]!;
          const penetration = CollisionDetector.penetration(a, b);
          if (penetration > 0) {
            collisions.push([a, b, penetration], [b, a, penetration]);
          }
        }
      }
    }

    for (const passive of this.passiveEntities) {
      for (const entity of active) {
        const penetration = CollisionDetector.penetration(passive, entity);
        if (penetration > 0) collisions.push([entity, passive, penetration]);
      }
    }

    for (const [colliding, other, penetration] of collisions) handler(colliding, other, penetration);
  }

  /** How deep two circles overlap; > 0 means they collide. */
  static penetration(a: Entity, b: Entity): number {
    return a.radius + b.radius - a.position.distanceTo(b.position);
  }

  /** Removes `entity` from the active list; returns whether it was there. */
  deactivate(entity: Entity): boolean {
    const index = this.activeEntities.indexOf(entity);
    if (index === -1) return false;
    this.activeEntities.splice(index, 1);
    return true;
  }

  activate(entity: Entity): void {
    if (!this.activeEntities.includes(entity)) this.activeEntities.push(entity);
  }
}

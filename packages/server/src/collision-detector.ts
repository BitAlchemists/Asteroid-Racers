import type { Entity } from "@ar/shared";
import { ObstacleGrid } from "./ai/obstacle-grid";

/** From this many passive entities on, ship-vs-passive checks go through a spatial grid. */
const GRID_FROM = 32;

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
  /** Active entities that collide only with passive ones, never with other active entities. */
  readonly passiveOnly = new Set<Entity>();

  /**
   * Grid over the passive entities (they don't move). Rebuilt after {@link invalidate} or when the
   * list's length changes; undefined = check every pair.
   */
  private passiveGrid:
    { grid: ObstacleGrid; index: Map<Entity, number>; length: number; maxRadius: number } | undefined;
  /** List length the last (re)build decision was made for (a grid or "use the loop"). */
  private builtLength = -1;
  private passiveVersion = 0;
  private gridVersion = -1;

  /** Call after changing {@link passiveEntities} (add, remove, move). */
  invalidate(): void {
    this.passiveVersion++;
  }

  detectCollisions(handler: CollisionHandler): void {
    const collisions: [Entity, Entity, number][] = [];
    const active = this.activeEntities;

    if (this.activeEntitiesCanCollide) {
      for (let i = 0; i < active.length; i++) {
        const a = active[i]!;
        if (this.passiveOnly.has(a)) continue;
        for (let j = i + 1; j < active.length; j++) {
          const b = active[j]!;
          if (this.passiveOnly.has(b)) continue;
          const penetration = CollisionDetector.penetration(a, b);
          if (penetration > 0) {
            collisions.push([a, b, penetration], [b, a, penetration]);
          }
        }
      }
    }

    const grid = active.length > 0 ? this.gridForPassives() : undefined;
    if (grid) {
      // Same pairs as the loop below (a passive entity that can overlap the ship has its centre in
      // the queried square), reported in the same order: by passive index, then active index.
      const found: [number, number, Entity, Entity, number][] = [];
      for (let j = 0; j < active.length; j++) {
        const entity = active[j]!;
        const ex = entity.position.x;
        const ey = entity.position.y;
        for (const passive of grid.grid.nearUnsorted(ex, ey, entity.radius + grid.maxRadius)) {
          const reach = passive.radius + entity.radius;
          if (Math.abs(passive.position.x - ex) > reach || Math.abs(passive.position.y - ey) > reach)
            continue;
          const penetration = CollisionDetector.penetration(passive, entity);
          if (penetration > 0) found.push([grid.index.get(passive)!, j, entity, passive, penetration]);
        }
      }
      if (found.length > 1) found.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      for (const [, , entity, passive, penetration] of found) collisions.push([entity, passive, penetration]);
    } else {
      for (const passive of this.passiveEntities) {
        const px = passive.position.x;
        const py = passive.position.y;
        for (const entity of active) {
          // Exact shortcut: hypot(dx, dy) ≥ max(|dx|, |dy|), so a pair that is further apart than the
          // radii on one axis cannot overlap. Every other pair gets the full computation.
          const reach = passive.radius + entity.radius;
          if (Math.abs(px - entity.position.x) > reach || Math.abs(py - entity.position.y) > reach) continue;
          const penetration = CollisionDetector.penetration(passive, entity);
          if (penetration > 0) collisions.push([entity, passive, penetration]);
        }
      }
    }

    for (const [colliding, other, penetration] of collisions) handler(colliding, other, penetration);
  }

  /** The passive grid, (re)built if needed; undefined when the plain loop is used. */
  private gridForPassives(): CollisionDetector["passiveGrid"] {
    const list = this.passiveEntities;
    if (list.length < GRID_FROM) return undefined;
    if (this.gridVersion === this.passiveVersion && this.builtLength === list.length) return this.passiveGrid;
    this.gridVersion = this.passiveVersion;
    this.builtLength = list.length;
    const index = new Map<Entity, number>();
    let maxRadius = 0;
    let usable = true;
    for (let i = 0; i < list.length; i++) {
      const e = list[i]!;
      if (index.has(e)) usable = false; // the same entity twice: keep the plain loop's double report
      index.set(e, i);
      if (!Number.isFinite(e.radius) || !Number.isFinite(e.position.x) || !Number.isFinite(e.position.y))
        usable = false;
      else if (e.radius > maxRadius) maxRadius = e.radius;
    }
    this.passiveGrid = usable
      ? { grid: new ObstacleGrid(list), index, length: list.length, maxRadius }
      : undefined;
    return this.passiveGrid;
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

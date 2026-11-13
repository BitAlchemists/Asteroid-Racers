import { Entity, EntityType, Movable, Vector2 } from "@ar/shared";
import { describe, expect, it } from "vitest";
import { CollisionDetector } from "./collision-detector";
import { seededRandom } from "./random";

/** The original all-pairs loop (ship vs passive), as reference. */
function reference(passives: Entity[], active: Entity[]): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const passive of passives)
    for (const entity of active) {
      const reach = passive.radius + entity.radius;
      if (
        Math.abs(passive.position.x - entity.position.x) > reach ||
        Math.abs(passive.position.y - entity.position.y) > reach
      )
        continue;
      const penetration = CollisionDetector.penetration(passive, entity);
      if (penetration > 0) out.push([entity.id, passive.id, penetration]);
    }
  return out;
}

describe("CollisionDetector with a passive grid", () => {
  it("reports exactly the all-pairs loop's collisions, in the same order", () => {
    const random = seededRandom(4);
    let id = 1;
    const rock = () =>
      Object.assign(
        new Entity({
          type: EntityType.ASTEROID,
          position: new Vector2((random() * 2 - 1) * 1500, (random() * 2 - 1) * 1500),
          radius: 20 + random() * 50,
        }),
        { id: id++ },
      );
    const detector = new CollisionDetector();
    detector.passiveEntities.push(...Array.from({ length: 120 }, rock));
    detector.invalidate();
    const ships = Array.from({ length: 100 }, () => Object.assign(new Movable({ radius: 20 }), { id: id++ }));
    let total = 0;
    for (let frame = 0; frame < 200; frame++) {
      for (const ship of ships)
        ship.position = new Vector2((random() * 2 - 1) * 1500, (random() * 2 - 1) * 1500);
      detector.activeEntities.length = 0;
      detector.activeEntities.push(...ships);
      if (frame === 100) {
        detector.passiveEntities.splice(7, 3); // a change the grid must notice
        detector.passiveEntities.push(rock());
        detector.invalidate();
      }
      const got: [number, number, number][] = [];
      detector.detectCollisions((a, b, p) => got.push([a.id, b.id, p]));
      expect(got).toEqual(reference(detector.passiveEntities, ships));
      total += got.length;
    }
    expect(total).toBeGreaterThan(100);
  });

  it("falls back to the loop when an entity is listed twice (both reports kept)", () => {
    const detector = new CollisionDetector();
    const rocks = Array.from({ length: 40 }, (_, i) =>
      Object.assign(
        new Entity({ type: EntityType.ASTEROID, position: new Vector2(i * 300, 0), radius: 30 }),
        {
          id: i + 1,
        },
      ),
    );
    detector.passiveEntities.push(...rocks, rocks[0]!);
    const ship = Object.assign(new Movable({ radius: 20, position: new Vector2(10, 0) }), { id: 99 });
    detector.activeEntities.push(ship);
    const got: number[] = [];
    detector.detectCollisions((_a, b) => got.push(b.id));
    expect(got).toEqual([1, 1]);
  });
});

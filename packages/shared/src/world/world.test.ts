import { describe, expect, it } from "vitest";
import { Vector2 } from "../math/vector2";
import {
  Checkpoint,
  CheckpointState,
  Entity,
  EntityType,
  Movable,
  NO_ID,
  PhysicsSimulator,
  RacePortal,
  World,
} from "./index";

describe("Entity", () => {
  it("has the Dart defaults", () => {
    const e = new Entity();
    expect(e.type).toBe(EntityType.UNKNOWN);
    expect(e.id).toBe(NO_ID);
    expect(e.radius).toBe(1);
    expect(e.orientation).toBe(0);
    expect(e.position).toEqual(Vector2.zero());
    expect(e.updateRank).toBe(0);
  });

  it("subclasses set their entity type", () => {
    expect(new Movable().type).toBe(EntityType.SHIP);
    expect(new Checkpoint().type).toBe(EntityType.CHECKPOINT);
    expect(new RacePortal().type).toBe(EntityType.LAUNCH_PLATFORM);
  });

  it("wraps orientation on assignment", () => {
    const e = new Entity();
    e.orientation = Math.PI + 1;
    expect(e.orientation).toBeCloseTo(1 - Math.PI, 15);
  });

  it("keeps enum values identical to the Dart enum indices (wire format)", () => {
    expect([
      EntityType.UNKNOWN,
      EntityType.ASTEROID,
      EntityType.SHIP,
      EntityType.CHECKPOINT,
      EntityType.LAUNCH_PLATFORM,
      EntityType.ARROWS,
      EntityType.FINISH,
    ]).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect([CheckpointState.CLEARED, CheckpointState.CURRENT, CheckpointState.FUTURE]).toEqual([0, 1, 2]);
  });

  it("clone() deep-copies vectors and keeps the subclass", () => {
    const m = new Movable({ position: new Vector2(1, 2), displayName: "Fritz" });
    m.id = 7;
    m.velocity = new Vector2(3, 4);
    m.canMove = true;
    m.updateRank = 5;

    const c = m.clone();
    expect(c).toBeInstanceOf(Movable);
    expect(c).toMatchObject({ id: 7, displayName: "Fritz", canMove: true, updateRank: 0 });
    expect(c.velocity).toEqual(new Vector2(3, 4));
    c.position.x = 99;
    c.velocity.x = 99;
    expect(m.position.x).toBe(1);
    expect(m.velocity.x).toBe(3);
  });

  it("Checkpoint and RacePortal copy their own state", () => {
    const cp = new Checkpoint();
    cp.state = CheckpointState.CURRENT;
    expect(cp.clone().state).toBe(CheckpointState.CURRENT);

    const portal = new RacePortal();
    portal.positions = [new Entity()];
    expect(portal.clone().positions).toBe(portal.positions); // shallow, as in Dart
  });
});

describe("World", () => {
  it("assigns sequential ids starting at 0", () => {
    const world = new World();
    const a = new Entity();
    const b = new Entity();
    world.addEntities([a, b]);
    expect([a.id, b.id]).toEqual([0, 1]);
    expect(world.entities.get(1)).toBe(b);
  });

  it("removes entities and never reuses ids", () => {
    const world = new World();
    const a = new Entity();
    world.addEntity(a);
    world.removeEntity(a);
    expect(world.entities.size).toBe(0);
    const b = new Entity();
    world.addEntity(b);
    expect(b.id).toBe(1);
  });
});

describe("PhysicsSimulator", () => {
  // Expected values are worked out by hand from the Dart PhysicsSimulator (explicit Euler:
  // v += a·dt, then p += v·dt). Dart's vector_math used float32 storage, so we compare with
  // a tolerance rather than bit-exactly.
  it("integrates velocity before position (explicit Euler, Dart order)", () => {
    const sim = new PhysicsSimulator();
    const ship = new Movable();
    ship.canMove = true;
    ship.acceleration = new Vector2(0, 400);
    sim.addMovable(ship);

    sim.simulateTranslation(0.5);
    expect(ship.velocity).toEqual(new Vector2(0, 200));
    expect(ship.position).toEqual(new Vector2(0, 100));

    sim.simulateTranslation(0.5);
    expect(ship.velocity).toEqual(new Vector2(0, 400));
    expect(ship.position).toEqual(new Vector2(0, 300));
    expect(ship.updateRank).toBe(2);
  });

  it("matches a 1 s run at the 15 ms server tick within float32 tolerance", () => {
    const sim = new PhysicsSimulator();
    const ship = new Movable({ position: new Vector2(10, -20) });
    ship.canMove = true;
    ship.velocity = new Vector2(5, 0);
    ship.acceleration = new Vector2(-2, 3);
    sim.addMovable(ship);

    const dt = 0.015;
    const steps = 66;
    for (let i = 0; i < steps; i++) sim.simulateTranslation(dt);

    // Closed form for explicit Euler: v_n = v0 + n·a·dt ; p_n = p0 + n·v0·dt + a·dt²·n(n+1)/2
    const tri = (steps * (steps + 1)) / 2;
    expect(ship.velocity.x).toBeCloseTo(5 + steps * -2 * dt, 5);
    expect(ship.velocity.y).toBeCloseTo(steps * 3 * dt, 5);
    expect(ship.position.x).toBeCloseTo(10 + steps * 5 * dt + -2 * dt * dt * tri, 4);
    expect(ship.position.y).toBeCloseTo(-20 + 3 * dt * dt * tri, 4);
  });

  it("rotates by rotationSpeed·dt and wraps", () => {
    const sim = new PhysicsSimulator();
    const ship = new Movable();
    ship.canMove = true;
    ship.orientation = 3;
    ship.rotationSpeed = 2;
    sim.addMovable(ship);
    sim.simulateRotation(0.25);
    expect(ship.orientation).toBeCloseTo(3.5 - 2 * Math.PI, 12);
  });

  it("skips movables that cannot move", () => {
    const sim = new PhysicsSimulator();
    const ship = new Movable();
    ship.velocity = new Vector2(1, 1);
    ship.rotationSpeed = 1;
    sim.addMovable(ship);
    sim.simulateRotation(1);
    sim.simulateTranslation(1);
    expect(ship.position).toEqual(Vector2.zero());
    expect(ship.orientation).toBe(0);
    expect(ship.updateRank).toBe(0);
  });

  it("replaces velocity/position vectors instead of mutating them (Dart `+=` semantics)", () => {
    const sim = new PhysicsSimulator();
    const ship = new Movable();
    ship.canMove = true;
    ship.velocity = new Vector2(1, 0);
    const oldVelocity = ship.velocity;
    const oldPosition = ship.position;
    sim.addMovable(ship);
    sim.simulateTranslation(1);
    expect(oldVelocity).toEqual(new Vector2(1, 0));
    expect(oldPosition).toEqual(Vector2.zero());
    expect(ship.position).toEqual(new Vector2(1, 0));
  });

  it("add/remove/reset manage the movable list", () => {
    const sim = new PhysicsSimulator();
    const a = new Movable();
    const b = new Movable();
    sim.addMovable(a);
    sim.addMovable(b);
    sim.removeMovable(a);
    sim.removeMovable(a); // no-op
    expect(sim.count).toBe(1);
    sim.reset();
    expect(sim.count).toBe(0);
  });
});

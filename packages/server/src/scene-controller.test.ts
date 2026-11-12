import type { Checkpoint } from "@ar/shared";
import { CheckpointState, EntityType, World } from "@ar/shared";
import { describe, expect, it } from "vitest";
import { GameServer } from "./game-server";
import { RaceController } from "./race-controller";
import { seededRandom } from "./random";
import { generateAsteroidBelt, SceneController } from "./scene-controller";

function countByType(world: World): Map<EntityType, number> {
  const counts = new Map<EntityType, number>();
  for (const e of world.entities.values()) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
  return counts;
}

describe("SceneController", () => {
  it("scene 2 + race 2 produce the demo world layout", () => {
    const server = new GameServer({ random: seededRandom(42) }).prepareDemoConfiguration();
    const counts = countByType(server.world);
    // 4 blocks of 1000×1000 at 500 asteroids per 4000² → trunc(31.25) = 31 each
    expect(counts.get(EntityType.ASTEROID)).toBe(124);
    expect(counts.get(EntityType.CHECKPOINT)).toBe(7);
    expect(counts.get(EntityType.LAUNCH_PLATFORM)).toBe(1);
    expect(counts.get(EntityType.FINISH)).toBe(1);
    expect(counts.get(EntityType.ARROWS)).toBe(10);
    expect(server.world.passiveCollisionEntities).toHaveLength(124);
  });

  it("is reproducible for a given seed", () => {
    const a = new GameServer({ random: seededRandom(7) }).prepareDemoConfiguration();
    const b = new GameServer({ random: seededRandom(7) }).prepareDemoConfiguration();
    const positions = (s: GameServer) =>
      s.world.passiveCollisionEntities.map((e) => [e.position.x, e.position.y, e.radius]);
    expect(positions(a)).toEqual(positions(b));
  });

  it("keeps the race corridors and the spawn free of asteroids", () => {
    const server = new GameServer({ random: seededRandom(3) }).prepareDemoConfiguration();
    for (const rock of server.world.passiveCollisionEntities) {
      // corridor y ∈ [-100, 100] and the spawn disc around the origin
      expect(Math.abs(rock.position.y) - rock.radius).toBeGreaterThanOrEqual(100 - 1e-9);
      expect(rock.position.length - rock.radius).toBeGreaterThan(100);
    }
  });

  it("only the first checkpoint starts CURRENT and the start/finish share checkpoint positions", () => {
    const world = new World();
    const race = new RaceController(new GameServer());
    SceneController.createRace2(world, race);
    expect(race.checkpoints.map((c: Checkpoint) => c.state)).toEqual([
      CheckpointState.CURRENT,
      ...Array<CheckpointState>(6).fill(CheckpointState.FUTURE),
    ]);
    expect(race.checkpoints[0]!.position).toEqual(race.start!.position);
    expect(race.checkpoints.at(-1)!.position).toEqual(race.finish!.position);
    expect(race.start!.positions).toHaveLength(4);
  });

  it("asteroids stay inside their belt rectangle", () => {
    const rocks = generateAsteroidBelt(seededRandom(5), 100, 200, 300, 400, { count: 200 });
    for (const r of rocks) {
      expect(r.position.x - r.radius).toBeGreaterThanOrEqual(100);
      expect(r.position.x + r.radius).toBeLessThanOrEqual(400);
      expect(r.position.y - r.radius).toBeGreaterThanOrEqual(200);
      expect(r.position.y + r.radius).toBeLessThanOrEqual(600);
    }
  });

  it("the random race has start, 8 checkpoints and finish", () => {
    const world = new World();
    const race = new RaceController(new GameServer());
    SceneController.createRandomRace(world, race, seededRandom(9));
    expect(race.checkpoints).toHaveLength(10);
    expect(race.finish).toBeDefined();
  });
});

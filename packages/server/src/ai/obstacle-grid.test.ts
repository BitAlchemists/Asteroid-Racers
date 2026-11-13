import { Entity, EntityType, Vector2 } from "@ar/shared";
import { describe, expect, it } from "vitest";
import { GameServer } from "../game-server";
import { LocalServerConnection } from "../local-connection";
import { seededRandom } from "../random";
import { AIGameClient } from "./ai-game-client";
import { ObstacleGrid } from "./obstacle-grid";

describe("ObstacleGrid", () => {
  it("finds every obstacle a brute-force search finds near a point, sorted by id", () => {
    const random = seededRandom(4);
    const rocks = Array.from(
      { length: 400 },
      () =>
        new Entity({
          type: EntityType.ASTEROID,
          position: new Vector2(random() * 6000 - 3000, random() * 6000 - 3000),
          radius: 5 + random() * 120,
        }),
    );
    const grid = new ObstacleGrid(rocks);
    for (let i = 0; i < 200; i++) {
      const x = random() * 6000 - 3000;
      const y = random() * 6000 - 3000;
      const r = random() * 700;
      const near = grid.near(x, y, r);
      const expected = rocks.filter((o) => o.position.distanceTo(new Vector2(x, y)) <= r + o.radius);
      for (const o of expected) expect(near).toContain(o);
      expect(near.map((o) => o.id)).toEqual([...near.map((o) => o.id)].sort((a, b) => a - b));
    }
    expect(new ObstacleGrid([]).near(0, 0, 100)).toEqual([]);
  });

  it("returns exactly what the original map-and-set grid returned (dense, sparse, duplicates)", () => {
    // The grid before S1, kept as the reference: cells in a map, results deduplicated by a Set.
    const reference = (obstacles: Entity[], x: number, y: number, r: number, s = 250) => {
      const key = (cx: number, cy: number) => (cx + 0x100000) * 0x200000 + (cy + 0x100000);
      const cells = new Map<number, Entity[]>();
      for (const o of obstacles)
        for (
          let cx = Math.floor((o.position.x - o.radius) / s);
          cx <= Math.floor((o.position.x + o.radius) / s);
          cx++
        )
          for (
            let cy = Math.floor((o.position.y - o.radius) / s);
            cy <= Math.floor((o.position.y + o.radius) / s);
            cy++
          )
            cells.set(key(cx, cy), [...(cells.get(key(cx, cy)) ?? []), o]);
      const found = new Set<Entity>();
      for (let cx = Math.floor((x - r) / s); cx <= Math.floor((x + r) / s); cx++)
        for (let cy = Math.floor((y - r) / s); cy <= Math.floor((y + r) / s); cy++)
          for (const o of cells.get(key(cx, cy)) ?? []) found.add(o);
      return [...found].sort((a, b) => a.id - b.id);
    };
    const random = seededRandom(9);
    for (const spread of [3000, 2_000_000]) {
      const rocks = Array.from({ length: 150 }, (_, i) => {
        const rock = new Entity({
          type: EntityType.ASTEROID,
          position: new Vector2(random() * 2 * spread - spread, random() * 2 * spread - spread),
          radius: 5 + random() * 300,
        });
        rock.id = i % 120; // some equal ids: their order must follow the scan, as before
        return rock;
      });
      const input = [...rocks, rocks[3]!, rocks[7]!]; // the same rock twice
      const grid = new ObstacleGrid(input);
      for (let i = 0; i < 300; i++) {
        const x = random() * 2 * spread - spread;
        const y = random() * 2 * spread - spread;
        const r = random() * (spread > 10_000 ? 2000 : 900);
        const near = grid.near(x, y, r);
        const expected = reference(input, x, y, r);
        expect(near.length).toBe(expected.length);
        near.forEach((o, j) => expect(o).toBe(expected[j]));
      }
    }
  });

  it("the bot keeps the asteroids the server tells it about and indexes them", async () => {
    const server = new GameServer({ random: seededRandom(1) }).prepareDemoConfiguration();
    const bot = new AIGameClient(new LocalServerConnection(server, { delivery: "sync" }));
    await bot.connect();
    const rocks = server.world.passiveCollisionEntities;
    expect(bot.obstacles.size).toBe(rocks.length);
    const rock = rocks[0]!;
    expect(bot.obstacles.near(rock.position.x, rock.position.y, 1).map((o) => o.id)).toContain(rock.id);
    server.removeObstacle(rock);
    expect(bot.obstacles.size).toBe(rocks.length - 1); // the bot dropped it (the world list keeps it)
    expect(bot.obstacles.near(rock.position.x, rock.position.y, 1).map((o) => o.id)).not.toContain(rock.id);
    bot.disconnect();
  });
});

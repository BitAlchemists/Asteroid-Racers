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

import { describe, expect, it } from "vitest";
import { GameServer } from "./game-server";
import { seededRandom } from "./random";
import { trackByName, TRACKS } from "./tracks";

const load = (name: string, seed = 1) =>
  new GameServer({ random: seededRandom(seed) }).loadTrack(trackByName(name));

describe("tracks", () => {
  it.each(Object.keys(TRACKS))("%s builds a race with a portal, checkpoints and a finish", (name) => {
    const server = load(name);
    const race = server.raceController!;
    expect(race.start).toBeDefined();
    expect(race.finish).toBeDefined();
    expect(race.checkpoints.length).toBeGreaterThanOrEqual(3); // portal checkpoint, ≥1 checkpoint, finish
    expect(server.world.passiveCollisionEntities.length).toBeGreaterThan(0);
  });

  it("the demo track is exactly the demo configuration", () => {
    const a = new GameServer({ random: seededRandom(5) }).prepareDemoConfiguration();
    const b = load("demo", 5);
    const positions = (s: GameServer) =>
      [...s.world.entities.values()].map((e) => [e.type, e.position.x, e.position.y]);
    expect(positions(b)).toEqual(positions(a));
  });

  it("random: the seed decides the track, and asteroids keep clear of every checkpoint", () => {
    const checkpoints = (s: GameServer) =>
      s.raceController!.checkpoints.map((c) => [c.position.x, c.position.y]);
    expect(checkpoints(load("random", 3))).toEqual(checkpoints(load("random", 3)));
    expect(checkpoints(load("random", 3))).not.toEqual(checkpoints(load("random", 4)));

    const server = load("random", 3);
    for (const rock of server.world.passiveCollisionEntities)
      for (const c of server.raceController!.checkpoints)
        expect(c.position.distanceTo(rock.position)).toBeGreaterThan(c.radius + rock.radius);
  });

  it("rejects unknown names", () => {
    expect(() => trackByName("moon")).toThrow(/unknown track/);
  });
});

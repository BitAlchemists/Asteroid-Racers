import { describe, expect, it } from "vitest";
import { DEFAULT_EXAM, examFlights } from "./ai/exam";
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

  it("the track files are registered after the code tracks, the generated tracks last", () => {
    expect(Object.keys(TRACKS)).toEqual([
      "demo",
      "short",
      "random",
      "slalom",
      "gauntlet",
      "canyon",
      "generated:easy",
      "generated:medium",
      "generated:hard",
    ]);
  });

  it.each(["slalom", "gauntlet", "canyon"])("%s is the same for every seed (no belts)", (name) => {
    const layout = (s: GameServer) =>
      [...s.world.entities.values()].map((e) => [e.type, e.position.x, e.position.y, e.radius]);
    expect(layout(load(name, 1))).toEqual(layout(load(name, 2)));
  });

  it("the race exam flies only demo, short and random (new tracks stay out of the yardstick)", () => {
    expect(new Set(examFlights(DEFAULT_EXAM).map((f) => f.track))).toEqual(
      new Set(["demo", "short", "random"]),
    );
  });

  it("rejects unknown names", () => {
    expect(() => trackByName("moon")).toThrow(/unknown track/);
  });
});

import { Vector2 } from "@ar/shared";
import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import { arenaByName, ARENAS, type Arena, type ArenaParams, type Scenario } from "./arenas";
import { MemoryModelStore } from "./model-store";
import { createTrainingServer, DEFAULT_LAYOUT, registerAITrainingService } from "./index";
import { MajorTom } from "./network";
import type { EpisodeRecord } from "./scoring";
import { TRACKS } from "../tracks";
import {
  chainArena,
  corridorArena,
  distanceToPolyline,
  distanceToSegment,
  fieldArena,
  headingToOrientation,
  raceLegsArena,
  START_CLEARANCE,
  stopArena,
  TARGET_CLEARANCE,
  TIER_ARENAS,
  turnAndGoArena,
} from "./tier-arenas";

const generate = (arena: Arena, seed: number, params: ArenaParams = {}) =>
  arena.generate(seededRandom(seed), { frames: 600, ...params });

/** JSON of a scenario (Vector2 serialises as {x, y}), for byte-for-byte comparisons. */
const json = (scenario: Scenario) => JSON.stringify(scenario);

/** Turn between two legs in degrees (0..180). */
function turnDegrees(a: Vector2, b: Vector2, c: Vector2): number {
  const u = b.minus(a);
  const v = c.minus(b);
  const cos = u.dot(v) / (u.length * v.length);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

/** Flies one scenario with a fixed random model through the training director. */
async function flyOnce(scenario: Scenario, crashMode: "end" | "respawn" = "end"): Promise<EpisodeRecord[]> {
  return (await flyWithPaths(scenario, crashMode)).records;
}

async function flyWithPaths(
  scenario: Scenario,
  crashMode: "end" | "respawn" = "end",
): Promise<{ records: EpisodeRecord[]; paths: number[][] }> {
  const server = createTrainingServer(1);
  const director = registerAITrainingService(server, {
    store: new MemoryModelStore(),
    maxGenerations: 0,
    collisions: "obstacles",
    crashMode,
  });
  await server.start();
  let flown: { records: EpisodeRecord[][]; paths: number[][][] } | undefined;
  void director
    .flyWithPaths([MajorTom.random(DEFAULT_LAYOUT, seededRandom(5))], [scenario])
    .then((r) => (flown = r));
  for (let guard = 0; !flown && guard < 100_000; guard++) {
    server.tick();
    if (guard % 20 === 0) await new Promise<void>((r) => setTimeout(r, 0));
  }
  expect(flown).toBeDefined();
  expect(server.world.entities.size).toBe(0);
  return { records: flown!.records[0]!, paths: flown!.paths[0]! };
}

/** Every obstacle keeps clear of every start and target of the scenario. */
function expectClear(scenario: Scenario, start = START_CLEARANCE, target = TARGET_CLEARANCE): void {
  for (const e of scenario.episodes)
    for (const o of scenario.obstacles) {
      expect(o.position.distanceTo(e.start.position)).toBeGreaterThanOrEqual(start + o.radius - 1e-6);
      for (const t of e.targets)
        expect(o.position.distanceTo(t.position)).toBeGreaterThanOrEqual(t.radius + target + o.radius - 1e-6);
    }
}

/** Does the segment a–b pass through an obstacle? */
const blocked = (scenario: Scenario, a: Vector2, b: Vector2) =>
  scenario.obstacles.some((o) => distanceToSegment(o.position, a, b) < o.radius);

describe("tiered arenas: common", () => {
  it("are registered by name with a tier and a description, after the existing arenas", () => {
    expect(Object.keys(ARENAS).slice(0, 3)).toEqual(["legacy", "point-to-point", "rock-in-line"]);
    for (const arena of TIER_ARENAS) {
      expect(arenaByName(arena.name)).toBe(arena);
      expect(arena.tier).toBeGreaterThanOrEqual(1);
      expect(arena.description.length).toBeGreaterThan(10);
      expect(arena.fixed).toBeUndefined();
    }
  });

  it.each(TIER_ARENAS.map((a) => [a.name, a] as const))(
    "%s is deterministic per seed and changes with it",
    (_, arena) => {
      expect(json(generate(arena, 7))).toBe(json(generate(arena, 7)));
      expect(json(generate(arena, 7))).not.toBe(json(generate(arena, 8)));
    },
  );

  it("headingToOrientation points the ship's thrust along the heading", () => {
    for (const angle of [0, 1, 2.5, -2]) {
      const thrust = new Vector2(0, 1).rotated(headingToOrientation(angle));
      expect(thrust.x).toBeCloseTo(Math.cos(angle));
      expect(thrust.y).toBeCloseTo(Math.sin(angle));
    }
  });
});

describe("chain arena", () => {
  it("makes episodes of 3–5 targets with legs and turns in range, time per target", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const scenario = generate(chainArena, seed, { frames: 500 });
      expect(scenario.obstacles).toEqual([]);
      expect(scenario.episodes).toHaveLength(6);
      for (const e of scenario.episodes) {
        expect(e.targets.length).toBeGreaterThanOrEqual(3);
        expect(e.targets.length).toBeLessThanOrEqual(5);
        expect(e.timeLimitFrames).toBe(500 * e.targets.length);
        expect(e.start.position).toEqual(Vector2.zero());
        const points = [e.start.position, ...e.targets.map((t) => t.position)];
        for (let i = 1; i < points.length; i++) {
          const leg = points[i]!.distanceTo(points[i - 1]!);
          expect(leg).toBeGreaterThanOrEqual(300 - 1e-9);
          expect(leg).toBeLessThanOrEqual(900 + 1e-9);
          if (i >= 2)
            expect(turnDegrees(points[i - 2]!, points[i - 1]!, points[i]!)).toBeLessThanOrEqual(120 + 1e-6);
        }
        expect(e.targets.every((t) => t.radius === 50 && t.maxSpeed === undefined)).toBe(true);
      }
    }
  });

  it("uses every count in the targets range, and takes fixed counts and exact turns", () => {
    const counts = new Set<number>();
    for (let seed = 1; seed <= 30; seed++)
      for (const e of generate(chainArena, seed).episodes) counts.add(e.targets.length);
    expect([...counts].sort()).toEqual([3, 4, 5]);

    const fixed = generate(chainArena, 3, {
      targets: [4, 4],
      turn: [90, 90],
      distance: [500, 500],
      episodes: 2,
    });
    for (const e of fixed.episodes) {
      expect(e.targets).toHaveLength(4);
      const p = [e.start.position, ...e.targets.map((t) => t.position)];
      for (let i = 2; i < p.length; i++) expect(turnDegrees(p[i - 2]!, p[i - 1]!, p[i]!)).toBeCloseTo(90);
    }
  });

  it("rejects bad params", () => {
    for (const params of [
      { targets: [0, 3] },
      { targets: [3.5, 4] },
      { targets: [5, 3] },
      { targets: 4 },
      { distance: [900, 300] },
      { turn: "wide" },
      { radius: 0 },
      { episodes: 0 },
    ])
      expect(() => generate(chainArena, 1, params), JSON.stringify(params)).toThrow(/arena param/);
  });

  it("is flown target after target: records count every target of the chain", async () => {
    const scenario = generate(chainArena, 2, { episodes: 2, frames: 60 });
    const records = await flyOnce(scenario);
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.targets)).toEqual(scenario.episodes.map((e) => e.targets.length));
  });
});

describe("stop arena", () => {
  it("gives every target a speed limit; distances and counts follow the params", () => {
    const scenario = generate(stopArena, 4, { episodes: 5, distance: [400, 500], maxSpeed: 80, radius: 70 });
    expect(scenario.obstacles).toEqual([]);
    expect(scenario.episodes).toHaveLength(5);
    for (const e of scenario.episodes) {
      expect(e.targets).toHaveLength(1);
      const t = e.targets[0]!;
      expect(t.maxSpeed).toBe(80);
      expect(t.radius).toBe(70);
      expect(t.position.length).toBeGreaterThanOrEqual(400 - 1e-9);
      expect(t.position.length).toBeLessThanOrEqual(500 + 1e-9);
    }
    for (const params of [{ maxSpeed: 0 }, { maxSpeed: "slow" }, { distance: [1] }])
      expect(() => generate(stopArena, 1, params)).toThrow(/arena param/);
  });

  it("counts a target only when the ship is slow enough inside it", async () => {
    const episode = (speed: number) => ({
      start: { position: Vector2.zero(), orientation: 0, velocity: new Vector2(speed, 0) },
      targets: [{ position: Vector2.zero(), radius: 40, maxSpeed: 100 }],
      timeLimitFrames: 30,
    });
    const records = await flyOnce({ obstacles: [], episodes: [episode(0), episode(600)] });
    expect(records.map((r) => r.reached)).toEqual([1, 0]);
  });
});

describe("turn-and-go arena", () => {
  it("starts nose first, moving away from the target within the spread, at a speed in range", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const scenario = generate(turnAndGoArena, seed, { speed: [250, 350], spread: 30 });
      expect(scenario.obstacles).toEqual([]);
      for (const e of scenario.episodes) {
        const v = e.start.velocity!;
        expect(v.length).toBeGreaterThanOrEqual(250 - 1e-9);
        expect(v.length).toBeLessThanOrEqual(350 + 1e-9);
        const toTarget = e.targets[0]!.position.normalized();
        // within 30° of straight away
        expect(v.normalized().dot(toTarget)).toBeLessThanOrEqual(Math.cos((150 * Math.PI) / 180) + 1e-9);
        const nose = new Vector2(0, 1).rotated(e.start.orientation);
        expect(nose.dot(v.normalized())).toBeCloseTo(1);
      }
    }
    for (const params of [{ speed: [-10, 100] }, { spread: -1 }, { speed: [300, 200] }])
      expect(() => generate(turnAndGoArena, 1, params)).toThrow(/arena param/);
  });

  it("the start velocity is applied: the ship first moves away", async () => {
    const scenario = generate(turnAndGoArena, 3, {
      episodes: 1,
      frames: 20,
      speed: [400, 400],
      distance: [1000, 1000],
    });
    const { paths } = await flyWithPaths(scenario);
    const target = scenario.episodes[0]!.targets[0]!.position;
    const [x0, y0, x1, y1] = paths[0]!;
    expect(new Vector2(x1!, y1!).distanceTo(target)).toBeGreaterThan(
      new Vector2(x0!, y0!).distanceTo(target),
    );
  });
});

describe("corridor arena", () => {
  it("walls keep clear of starts, targets and the corridor; the direct line runs into a wall", () => {
    let blockedLines = 0;
    let episodes = 0;
    for (let seed = 1; seed <= 15; seed++) {
      const scenario = generate(corridorArena, seed);
      expect(scenario.obstacles.length).toBeGreaterThan(100);
      expectClear(scenario);
      for (const e of scenario.episodes) {
        episodes++;
        if (blocked(scenario, e.start.position, e.targets[0]!.position)) blockedLines++;
        // the nose points down the corridor: a short hop forward is free
        const nose = new Vector2(0, 1).rotated(e.start.orientation);
        expect(blocked(scenario, e.start.position, e.start.position.plus(nose.times(300)))).toBe(false);
      }
    }
    expect(blockedLines / episodes).toBeGreaterThan(0.8);
  });

  it("puts each corridor in its own cell, rocks beside the corridor only", () => {
    const scenario = generate(corridorArena, 5, { episodes: 4, segments: [2, 2], width: 300 });
    const starts = scenario.episodes.map((e) => e.start.position);
    for (let i = 0; i < starts.length; i++)
      for (let j = i + 1; j < starts.length; j++)
        expect(starts[i]!.distanceTo(starts[j]!)).toBeGreaterThan(5000);
    for (const o of scenario.obstacles) {
      const nearest = Math.min(
        ...scenario.episodes.map((e) =>
          distanceToPolyline(o.position, [e.start.position, e.targets[0]!.position]),
        ),
      );
      expect(nearest).toBeLessThan(3000);
    }
  });

  it("rejects bad params", () => {
    for (const params of [
      { width: 100 },
      { segments: [0, 2] },
      { length: [0, 100] },
      { rockRadius: [1, 2] },
      { bend: [90] },
    ])
      expect(() => generate(corridorArena, 1, params), JSON.stringify(params)).toThrow(/arena param/);
  });
});

describe("field arena", () => {
  it("is a chain through rocks that keep clear of starts and targets, and of each other", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const scenario = generate(fieldArena, seed);
      expectClear(scenario);
      for (const e of scenario.episodes) {
        expect(e.targets.length).toBeGreaterThanOrEqual(3);
        expect(e.targets.length).toBeLessThanOrEqual(5);
        expect(e.timeLimitFrames).toBe(600 * e.targets.length);
      }
      const rocks = scenario.obstacles;
      for (let i = 0; i < rocks.length; i++)
        for (let j = i + 1; j < rocks.length; j++)
          expect(rocks[i]!.position.distanceTo(rocks[j]!.position)).toBeGreaterThanOrEqual(
            rocks[i]!.radius + rocks[j]!.radius - 1e-6,
          );
    }
  });

  it("density scales the rocks; a lane keeps the legs free", () => {
    expect(generate(fieldArena, 2, { density: 0 }).obstacles).toEqual([]);
    const light = generate(fieldArena, 2, { density: 4 }).obstacles.length;
    const dense = generate(fieldArena, 2, { density: 12 }).obstacles.length;
    expect(dense).toBeGreaterThan(2 * light);
    const laned = generate(fieldArena, 2, { lane: 200 });
    for (const e of laned.episodes) {
      const path = [e.start.position, ...e.targets.map((t) => t.position)];
      for (let i = 1; i < path.length; i++) expect(blocked(laned, path[i - 1]!, path[i]!)).toBe(false);
    }
  });

  it("rejects bad params", () => {
    for (const params of [{ density: -1 }, { targets: [2, 1] }, { lane: -5 }, { rockRadius: [0, 10] }])
      expect(() => generate(fieldArena, 1, params), JSON.stringify(params)).toThrow(/arena param/);
  });
});

describe("race-legs arena", () => {
  it("flies consecutive checkpoints of a random race among its asteroids, respawning at the last one", () => {
    const scenario = generate(raceLegsArena, 6);
    expect(scenario.obstacles.length).toBeGreaterThan(100);
    expect(scenario.episodes).toHaveLength(6);
    for (const e of scenario.episodes) {
      expect(e.respawn).toBe("last-target");
      expect(e.targets).toHaveLength(3);
      expect(e.timeLimitFrames).toBe(1800);
      expect(e.targets.every((t) => t.radius === 100 && typeof t.orientation === "number")).toBe(true);
      // legs of the random race are 500–1000 units long
      const points = [e.start.position, ...e.targets.map((t) => t.position)];
      for (let i = 1; i < points.length; i++) {
        const leg = points[i]!.distanceTo(points[i - 1]!);
        expect(leg).toBeGreaterThanOrEqual(500 - 1e-6);
        expect(leg).toBeLessThanOrEqual(1000 + 1e-6);
      }
    }
    // the random track keeps 150 units around its checkpoints (radius 100)
    expectClear(scenario, 250, 150);
  });

  it("takes named tracks and clamps legs to the track", () => {
    const short = generate(raceLegsArena, 1, { tracks: ["short"], legs: 5, episodes: 3 });
    for (const e of short.episodes) expect(e.targets).toHaveLength(2); // portal → checkpoint → finish
    const picked = new Set<number>();
    for (let seed = 1; seed <= 12; seed++)
      picked.add(
        generate(raceLegsArena, seed, { tracks: ["short", "slalom"], episodes: 1 }).obstacles.length,
      );
    expect(picked.size).toBeGreaterThan(1);
    expect(Object.keys(TRACKS)).toContain("slalom");
    for (const params of [
      { tracks: [] },
      { tracks: ["nowhere"] },
      { tracks: "random" },
      { legs: 1.5 },
      { legs: 0 },
    ])
      expect(() => generate(raceLegsArena, 1, params), JSON.stringify(params)).toThrow(
        /arena param|unknown track/,
      );
  });

  it("respawn last-target puts a crashed ship back on the last target reached, at rest", async () => {
    // Moving fast along x: through target 1 at once, then into a rock. Target 2 is far away.
    const scenario: Scenario = {
      obstacles: [{ position: new Vector2(100, 0), radius: 50 }],
      episodes: [
        {
          start: { position: new Vector2(-150, 0), orientation: 0, velocity: new Vector2(800, 0) },
          targets: [
            { position: new Vector2(-100, 0), radius: 40, orientation: 1 },
            { position: new Vector2(0, 3000), radius: 40 },
          ],
          timeLimitFrames: 120,
          respawn: "last-target",
        },
      ],
    };
    const { records, paths } = await flyWithPaths(scenario, "respawn");
    expect(records[0]!.reached).toBe(1);
    expect(records[0]!.crashes).toBeGreaterThanOrEqual(1);
    const path = paths[0]!;
    // Path points are 10 frames apart; at rest after the respawn the ship moves < 5 units in 10 frames.
    let back = false;
    for (let k = 2; k < path.length; k += 2) if (Math.hypot(path[k]! + 100, path[k + 1]!) < 6) back = true;
    expect(back).toBe(true);
  });
});

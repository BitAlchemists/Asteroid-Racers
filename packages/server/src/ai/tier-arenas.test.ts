import { Vector2 } from "@ar/shared";
import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import { arenaByName, ARENAS, type Arena, type ArenaParams, type Scenario } from "./arenas";
import { MemoryModelStore } from "./model-store";
import { createTrainingServer, DEFAULT_LAYOUT, registerAITrainingService } from "./index";
import { MajorTom } from "./network";
import type { EpisodeRecord } from "./scoring";
import { chainArena, headingToOrientation, TIER_ARENAS } from "./tier-arenas";

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
  const server = createTrainingServer(1);
  const director = registerAITrainingService(server, {
    store: new MemoryModelStore(),
    maxGenerations: 0,
    collisions: "obstacles",
    crashMode,
  });
  await server.start();
  let records: EpisodeRecord[][] | undefined;
  void director
    .fly([MajorTom.random(DEFAULT_LAYOUT, seededRandom(5))], [scenario])
    .then((r) => (records = r));
  for (let guard = 0; !records && guard < 100_000; guard++) {
    server.tick();
    if (guard % 20 === 0) await new Promise<void>((r) => setTimeout(r, 0));
  }
  expect(records).toBeDefined();
  expect(server.world.entities.size).toBe(0);
  return records![0]!;
}

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

import { Vector2 } from "@ar/shared";
import { describe, expect, it } from "vitest";
import type { GameServer } from "../game-server";
import { seededRandom } from "../random";
import { arenaByName, deriveSeed, legacyArena, pointToPointArena, type Scenario } from "./arenas";
import { MemoryBrainStore } from "./brain-store";
import type { GenerationReport, TrainingDirector } from "./directors";
import {
  createTrainingServer,
  DEFAULT_LAYOUT,
  registerAITrainingService,
  type TrainingServiceOptions,
} from "./index";
import { MajorTom } from "./network";
import { LEGACY_SCORING, parseScoring, scoreEpisodes, successRate, type EpisodeRecord } from "./scoring";

async function drive(server: GameServer, director: TrainingDirector): Promise<void> {
  await server.start();
  let done = false;
  void director.done.then(() => (done = true));
  for (let guard = 0; !done && guard < 200_000; guard++) {
    server.tick();
    if (guard % 20 === 0) await new Promise<void>((r) => setTimeout(r, 0));
  }
  expect(done).toBe(true);
}

/** Runs `fly` for one scenario with a fixed brain and returns its records. */
async function flyOnce(
  scenario: Scenario,
  options: Partial<TrainingServiceOptions> = {},
  network = MajorTom.random(DEFAULT_LAYOUT, seededRandom(5)),
): Promise<EpisodeRecord[]> {
  const server = createTrainingServer(1);
  const director = registerAITrainingService(server, {
    store: new MemoryBrainStore(),
    maxGenerations: 0,
    ...options,
  });
  await server.start();
  let records: EpisodeRecord[][] | undefined;
  void director.fly([network], [scenario]).then((r) => (records = r));
  for (let guard = 0; !records && guard < 50_000; guard++) {
    server.tick();
    if (guard % 20 === 0) await new Promise<void>((r) => setTimeout(r, 0));
  }
  expect(records).toBeDefined();
  expect(server.clients.size).toBe(0); // the bot left
  expect(server.world.entities.size).toBe(0); // obstacles and targets were removed
  return records![0]!;
}

const episode = (target: Vector2, radius: number, timeLimitFrames: number) => ({
  start: { position: Vector2.zero(), orientation: 0 },
  targets: [{ position: target, radius }],
  timeLimitFrames,
});

describe("arenas", () => {
  it("legacy: 16 one-target episodes from the origin, out to 1000 units", () => {
    const scenario = legacyArena.generate(seededRandom(1), { frames: 600 });
    expect(scenario.episodes).toHaveLength(16);
    expect(scenario.obstacles).toHaveLength(0);
    expect(scenario.episodes.every((e) => e.targets.length === 1 && e.timeLimitFrames === 600)).toBe(true);
    const distances = scenario.episodes.map((e) => Math.round(e.targets[0]!.position.length));
    expect(distances).toEqual([
      0, 200, 200, 200, 400, 400, 400, 600, 600, 600, 800, 800, 800, 1000, 1000, 1000,
    ]);
    expect(legacyArena.fixed).toBe(true);
  });

  it("point-to-point: params shape the scenario; asteroids keep clear of starts and targets", () => {
    const scenario = pointToPointArena.generate(seededRandom(3), {
      episodes: 5,
      distance: [500, 600],
      radius: 40,
      frames: 100,
      asteroids: 30,
    });
    expect(scenario.episodes).toHaveLength(5);
    for (const e of scenario.episodes) {
      const d = e.targets[0]!.position.length;
      expect(d).toBeGreaterThanOrEqual(500);
      expect(d).toBeLessThanOrEqual(600);
      expect(e.timeLimitFrames).toBe(100);
    }
    expect(scenario.obstacles).toHaveLength(30);
    for (const rock of scenario.obstacles) {
      expect(rock.position.length).toBeGreaterThan(150 + rock.radius - 1e-9);
      for (const e of scenario.episodes)
        expect(rock.position.distanceTo(e.targets[0]!.position)).toBeGreaterThan(
          40 + 60 + rock.radius - 1e-9,
        );
    }
  });

  it("the same seed makes the same scenario; bad params and names are rejected", () => {
    const a = pointToPointArena.generate(seededRandom(9), { asteroids: 5 });
    const b = pointToPointArena.generate(seededRandom(9), { asteroids: 5 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(() => pointToPointArena.generate(seededRandom(1), { distance: [5, 1] })).toThrow(/distance/);
    expect(() => pointToPointArena.generate(seededRandom(1), { episodes: 0 })).toThrow(/episodes/);
    expect(() => arenaByName("nope")).toThrow(/unknown arena/);
  });

  it("deriveSeed spreads nearby inputs", () => {
    const seeds = new Set<number>();
    for (let g = 0; g < 100; g++) for (let a = 0; a < 3; a++) seeds.add(deriveSeed(2026, 1, a, g));
    expect(seeds.size).toBe(300);
    expect(deriveSeed(1, 2, 3)).toBe(deriveSeed(1, 2, 3));
  });
});

describe("scoring", () => {
  const records: EpisodeRecord[] = [
    { targets: 1, reached: 1, frames: 100, crashes: 0, distance: 50 },
    { targets: 2, reached: 0, frames: 200, crashes: 1, distance: 300 },
  ];

  it("is a weighted sum of distance, missed targets, seconds and crashes", () => {
    expect(scoreEpisodes(records, LEGACY_SCORING, 0.015)).toBe(350);
    expect(scoreEpisodes(records, { distance: 0, success: 1000, time: 0, crashes: 0 }, 0.015)).toBe(2000);
    expect(scoreEpisodes(records, { distance: 0, success: 0, time: 10, crashes: 0 }, 0.015)).toBeCloseTo(45);
    expect(scoreEpisodes(records, { distance: 0, success: 0, time: 0, crashes: 7 }, 0.015)).toBe(7);
    expect(successRate(records)).toBeCloseTo(1 / 3);
  });

  it("parses config weights: missing terms are 0, unknown or negative ones are errors", () => {
    expect(parseScoring(undefined)).toEqual(LEGACY_SCORING);
    expect(parseScoring({ success: 500 })).toEqual({ distance: 0, success: 500, time: 0, crashes: 0 });
    expect(() => parseScoring({ speed: 1 })).toThrow(/unknown/);
    expect(() => parseScoring({ crashes: -1 })).toThrow(/≥ 0/);
  });
});

describe("ArenaScript (via TrainingDirector.fly)", () => {
  it("counts a target as reached inside its radius, and times out otherwise", async () => {
    const [reached, missed] = await flyOnce({
      obstacles: [],
      episodes: [episode(new Vector2(0, 10), 50, 100), episode(new Vector2(5000, 0), 10, 20)],
    });
    expect(reached).toMatchObject({ targets: 1, reached: 1, frames: 1, crashes: 0 });
    expect(missed).toMatchObject({ targets: 1, reached: 0, frames: 21, crashes: 0 });
    expect(missed!.distance).toBeGreaterThan(4900 * 21 * 0.015);
  });

  it("crash mode `end` charges the rest of the time limit; `respawn` restarts the episode", async () => {
    // A rock right on the start: the ship crashes on its first frame.
    const scenario: Scenario = {
      obstacles: [{ position: new Vector2(0, 0), radius: 30 }],
      episodes: [episode(new Vector2(0, 1000), 20, 50)],
    };
    const [ended] = await flyOnce(scenario, { collisions: "obstacles", crashMode: "end" });
    expect(ended).toMatchObject({ reached: 0, crashes: 1, frames: 51 });
    expect(ended!.distance).toBeGreaterThan(900 * 51 * 0.015);

    const [respawned] = await flyOnce(scenario, { collisions: "obstacles", crashMode: "respawn" });
    expect(respawned!.crashes).toBeGreaterThan(1); // crashed again after every respawn
    expect(respawned!.frames).toBe(51);

    const [ghost] = await flyOnce(scenario, { collisions: "none" });
    expect(ghost!.crashes).toBe(0);
  });
});

describe("TrainingDirector with arenas", () => {
  async function run(options: Partial<TrainingServiceOptions>, seed = 1) {
    const server = createTrainingServer(seed);
    const reports: GenerationReport[] = [];
    const director = registerAITrainingService(server, {
      store: new MemoryBrainStore(),
      sampleSize: 4,
      maxGenerations: 2,
      random: seededRandom(seed + 1),
      scenarioSeed: seed,
      onGeneration: (r) => reports.push(r),
      ...options,
    });
    await drive(server, director);
    return {
      director,
      reports: reports.map(({ winner, ...rest }) => ({ ...rest, winner: winner.toJson() })),
    };
  }

  const p2p = {
    arenas: [{ name: "point-to-point", params: { episodes: 3, frames: 40, asteroids: 10 } }],
    collisions: "obstacles" as const,
    heldOut: 2,
  };

  it("point-to-point changes every generation; legacy stays the same", async () => {
    const { director } = await run({ ...p2p, maxGenerations: 0 });
    expect(JSON.stringify(director.scenariosFor(1))).not.toBe(JSON.stringify(director.scenariosFor(2)));
    const legacy = await run({ maxGenerations: 0 });
    expect(JSON.stringify(legacy.director.scenariosFor(1))).toBe(
      JSON.stringify(legacy.director.scenariosFor(7)),
    );
  });

  it("reports success and held-out metrics, and the same seeds give the same run", async () => {
    const first = await run(p2p);
    expect(first.reports.map((r) => r.generation)).toEqual([1, 2]);
    for (const r of first.reports) {
      expect(r.success).toBeGreaterThanOrEqual(0);
      expect(r.success).toBeLessThanOrEqual(1);
      expect(r.heldOutScore).toEqual(expect.any(Number));
      expect(r.heldOutSuccess).toEqual(expect.any(Number));
    }
    const second = await run(p2p);
    expect(second.reports.map(({ gameSeconds: _, ...r }) => r)).toEqual(
      first.reports.map(({ gameSeconds: _, ...r }) => r),
    );
  });

  it("firstGeneration picks up the scenario sequence where a previous run stopped", async () => {
    const straight = await run({ ...p2p, heldOut: 0, maxGenerations: 3 });
    const resumed = await run({ ...p2p, heldOut: 0, maxGenerations: 1, firstGeneration: 3 });
    expect(JSON.stringify(resumed.director.scenariosFor(3))).toBe(
      JSON.stringify(straight.director.scenariosFor(3)),
    );
    expect(resumed.reports[0]!.generation).toBe(3);
  });
});

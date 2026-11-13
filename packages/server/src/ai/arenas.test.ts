import { Vector2 } from "@ar/shared";
import { describe, expect, it } from "vitest";
import type { GameServer } from "../game-server";
import { seededRandom } from "../random";
import {
  applyLevel,
  arenaByName,
  deriveSeed,
  isTieredLevel,
  legacyArena,
  mixEasyEpisodes,
  parseCurriculum,
  PLATEAU_START,
  pointToPointArena,
  resolveArenas,
  stepPlateau,
  type Scenario,
} from "./arenas";
import { MemoryModelStore } from "./model-store";
import type { GenerationReport, TrainingDirector } from "./directors";
import {
  createTrainingServer,
  DEFAULT_LAYOUT,
  registerAITrainingService,
  type TrainingServiceOptions,
} from "./index";
import { MajorTom } from "./network";
import {
  LEGACY_SCORING,
  meanTurn,
  parseScoring,
  scoreEpisodes,
  successRate,
  type EpisodeRecord,
} from "./scoring";

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

/** Runs `fly` for one scenario with a fixed model and returns its records. */
async function flyOnce(
  scenario: Scenario,
  options: Partial<TrainingServiceOptions> = {},
  network = MajorTom.random(DEFAULT_LAYOUT, seededRandom(5)),
): Promise<EpisodeRecord[]> {
  const server = createTrainingServer(1);
  const director = registerAITrainingService(server, {
    store: new MemoryModelStore(),
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
    {
      targets: 1,
      reached: 1,
      frames: 100,
      crashes: 0,
      distance: 50,
      progress: 400,
      rotation: 6,
      flownFrames: 100,
    },
    {
      targets: 2,
      reached: 0,
      frames: 200,
      crashes: 1,
      distance: 300,
      progress: -20,
      rotation: 9,
      flownFrames: 100,
    },
  ];

  it("scoring.rotation charges turning per radian; absent leaves the score unchanged", () => {
    const base = { distance: 0, success: 0, time: 0, crashes: 0 };
    expect(scoreEpisodes(records, base, 0.015)).toBe(0);
    expect(scoreEpisodes(records, { ...base, rotation: 10 }, 0.015)).toBe(150);
    expect(parseScoring({ rotation: 20 })).toMatchObject({ rotation: 20 });
    expect(parseScoring({ distance: 1 })).not.toHaveProperty("rotation");
    expect(() => parseScoring({ rotation: -1 })).toThrow(/≥ 0/);
  });

  it("meanTurn: mean |turn output| over the frames flown (1 = always turning at full rate)", () => {
    // 15 rad over 200 flown frames of 15 ms = 3 s, at max 5 rad/s → 15 / 15 = 1.
    expect(meanTurn(records, 0.015, 5)).toBeCloseTo(1, 12);
    expect(meanTurn([], 0.015, 5)).toBe(0);
  });

  it("is a weighted sum of distance, missed targets, seconds and crashes", () => {
    expect(scoreEpisodes(records, LEGACY_SCORING, 0.015)).toBe(350);
    expect(scoreEpisodes(records, { distance: 0, success: 1000, time: 0, crashes: 0 }, 0.015)).toBe(2000);
    expect(scoreEpisodes(records, { distance: 0, success: 0, time: 10, crashes: 0 }, 0.015)).toBeCloseTo(45);
    expect(scoreEpisodes(records, { distance: 0, success: 0, time: 0, crashes: 7 }, 0.015)).toBe(7);
    expect(successRate(records)).toBeCloseTo(1 / 3);
  });

  it("time is time to target: a reached target stops the clock, a missed one is charged the full limit", async () => {
    // Episode 1: the ship starts inside the target (reached on the first frame); episode 2: a target
    // 50,000 units away cannot be reached in 100 frames.
    const records = await flyOnce({
      obstacles: [],
      episodes: [episode(new Vector2(0, 0), 50, 100), episode(new Vector2(0, 50_000), 50, 100)],
    });
    expect(records.map((r) => [r.reached, r.frames])).toEqual([
      [1, 1],
      [0, 101],
    ]);
    const tick = 0.015;
    const timeOnly = { distance: 0, success: 0, time: 1, crashes: 0 };
    expect(scoreEpisodes(records, timeOnly, tick)).toBeCloseTo((1 + 101) * tick, 9);
  });

  it("progress is a reward: subtracted per unit flown towards the target; absent or 0 changes nothing", () => {
    const base = { distance: 1, success: 0, time: 0, crashes: 0 };
    expect(scoreEpisodes(records, { ...base, progress: 2 }, 0.015)).toBe(350 - 2 * 380);
    expect(scoreEpisodes(records, { ...base, progress: 0 }, 0.015)).toBe(350);
    expect(parseScoring({ distance: 1 })).toEqual(base); // no progress key unless set
    expect(parseScoring({ distance: 1, progress: 3 })).toEqual({ ...base, progress: 3 });
    expect(() => parseScoring({ progress: -1 })).toThrow(/progress/);
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

  it("crashLimit ends a `respawn` episode at its N-th crash, charged like `end`", async () => {
    // A rock right on the start: the ship crashes on its first frame and after every respawn.
    const scenario: Scenario = {
      obstacles: [{ position: new Vector2(0, 0), radius: 30 }],
      episodes: [episode(new Vector2(0, 1000), 20, 50), episode(new Vector2(1000, 0), 20, 50)],
    };
    const crash = { collisions: "obstacles" as const };
    const ended = await flyOnce(scenario, { ...crash, crashMode: "end" });
    const unlimited = await flyOnce(scenario, { ...crash, crashMode: "respawn" });
    expect(unlimited[0]!.crashes).toBeGreaterThan(3);

    // At the first crash: exactly the `end` record (the same charge for the rest of the episode).
    expect(await flyOnce(scenario, { ...crash, crashMode: "respawn", crashLimit: 1 })).toEqual(ended);

    // At the third: three crashes, the whole time limit charged, and the next episode still flown.
    const capped = await flyOnce(scenario, { ...crash, crashMode: "respawn", crashLimit: 3 });
    expect(capped).toHaveLength(2);
    for (const record of capped) {
      expect(record).toMatchObject({ reached: 0, crashes: 3, frames: 51 });
      expect(record.distance).toBeGreaterThan(900 * 51 * 0.015);
    }

    // With `end` every crash already ends the episode: the limit changes nothing.
    expect(await flyOnce(scenario, { ...crash, crashMode: "end", crashLimit: 3 })).toEqual(ended);
  });
});

describe("TrainingDirector with arenas", () => {
  async function run(options: Partial<TrainingServiceOptions>, seed = 1) {
    const server = createTrainingServer(seed);
    const reports: GenerationReport[] = [];
    const director = registerAITrainingService(server, {
      store: new MemoryModelStore(),
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

describe("rock-in-line arena", () => {
  it("puts a rock across the direct line of every episode, clear of the start and the targets", () => {
    const scenario = arenaByName("rock-in-line").generate(seededRandom(5), {
      episodes: 6,
      rocks: 1,
      offset: 20,
    });
    expect(scenario.episodes).toHaveLength(6);
    for (const episode of scenario.episodes) {
      const target = episode.targets[0]!.position;
      const dir = target.normalized();
      // Some rock blocks the ship-wide corridor (ship radius 20) to this target.
      const blocking = scenario.obstacles.some((o) => {
        const t = o.position.x * dir.x + o.position.y * dir.y;
        const lateral = Math.abs(o.position.x * dir.y - o.position.y * dir.x);
        return t > 0 && t < target.length && lateral < o.radius + 20;
      });
      expect(blocking).toBe(true);
    }
    for (const o of scenario.obstacles) {
      expect(o.position.length).toBeGreaterThan(120 + o.radius - 1e-9);
      for (const e of scenario.episodes)
        expect(o.position.distanceTo(e.targets[0]!.position)).toBeGreaterThan(50 + 60 + o.radius - 1e-9);
    }
  });

  it("is deterministic per seed and takes extra scattered asteroids", () => {
    const a = arenaByName("rock-in-line").generate(seededRandom(9), { asteroids: 10 });
    const b = arenaByName("rock-in-line").generate(seededRandom(9), { asteroids: 10 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.obstacles.length).toBeGreaterThanOrEqual(8 + 10 - 2); // nearly every rock placed
  });
});

describe("curriculum v2", () => {
  it("tiered levels replace the arena list; param levels still override", () => {
    const base = [{ name: "point-to-point", params: { episodes: 2 } }];
    const c = parseCurriculum(
      {
        levels: [
          { arenas: [{ name: "stop", params: { episodes: 3 } }] },
          { "point-to-point": { asteroids: 5 } },
        ],
      },
      base,
    );
    expect(isTieredLevel(c.levels[0]!)).toBe(true);
    expect(applyLevel(base, c.levels[0]!)).toEqual([{ name: "stop", params: { episodes: 3 } }]);
    expect(applyLevel(base, c.levels[1]!)).toEqual([
      { name: "point-to-point", params: { episodes: 2, asteroids: 5 } },
    ]);
    expect(() => parseCurriculum({ levels: [{ arenas: "stop" }, {}] }, base)).toThrow(/levels\[0\]\.arenas/);
  });

  it("keepEasy wraps around an earlier tiered level with fewer arenas", () => {
    const levels = [
      resolveArenas([{ name: "stop", params: { episodes: 4 } }], 600),
      resolveArenas(
        [
          { name: "point-to-point", params: { episodes: 4 } },
          { name: "chain", params: { episodes: 4 } },
        ],
        600,
      ),
    ];
    const { runs, hard } = mixEasyEpisodes(levels, 1, 0.5, 1, 1);
    expect(hard).toBe(2);
    expect(runs.map((r) => [r.arena.name, r.params.episodes])).toEqual([
      ["point-to-point", 2],
      ["chain", 2],
      ["stop", 2],
      ["stop", 2],
    ]);
  });

  it("the plateau rule moves up after `patience` generations without improvement, above the floor", () => {
    const rule = { floor: 0.5, patience: 2, alpha: 1, minGain: 0.05 };
    let state = { ...PLATEAU_START };
    const ups: boolean[] = [];
    for (const s of [0.4, 0.6, 0.62, 0.61, 0.6]) {
      const step = stepPlateau(state, s, rule);
      state = step.state;
      ups.push(step.up);
    }
    // 0.4 and 0.6 improve; 0.62 and 0.61 do not by more than 0.05 → up on the 2nd stalled generation.
    expect(ups).toEqual([false, false, false, true, true]);
    // Below the floor nothing moves up, however long it stalls.
    let low = { ...PLATEAU_START };
    for (let i = 0; i < 5; i++) low = stepPlateau(low, 0.2, rule).state;
    expect(stepPlateau(low, 0.2, rule).up).toBe(false);
    expect(
      parseCurriculum({ plateau: {} }, [{ name: "rock-in-line" }, { name: "point-to-point" }]).plateau,
    ).toEqual({
      floor: 0.5,
      patience: 10,
      alpha: 0.2,
      minGain: 0.02,
    });
  });
});

describe("curriculum", () => {
  const arenas = [
    { name: "rock-in-line", params: { episodes: 16, rocks: 2 } },
    { name: "point-to-point", params: { episodes: 8, asteroids: 80 } },
  ];

  it("defaults to five levels from a clear line of sight to the v2 task, success 0.8, streak 3", () => {
    const c = parseCurriculum({}, arenas);
    expect(c.success).toBe(0.8);
    expect(c.streak).toBe(3);
    expect(c.levels).toHaveLength(5);
    expect(applyLevel(arenas, c.levels[0]!)).toEqual([
      { name: "rock-in-line", params: { episodes: 16, rocks: 0 } },
      { name: "point-to-point", params: { episodes: 8, asteroids: 0 } },
    ]);
    expect(applyLevel(arenas, c.levels[4]!)).toEqual(arenas);
  });

  it("level overrides apply only to the arenas they name", () => {
    expect(applyLevel(arenas, { "rock-in-line": { rocks: 1 } })[1]).toEqual(arenas[1]);
  });
});

import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import { resolveArenas, trainingScenarios, type ArenaConfig } from "./arenas";
import type { CrashMode } from "./arena-script";
import { DEFAULT_EXAM, ExamReplay, examFlight } from "./exam";
import { bundledModels, createTrainingServer, DEFAULT_MODEL_NAME, registerAITrainingService } from "./index";
import { MemoryModelStore } from "./model-store";
import { MajorTom, type NetworkJson } from "./network";
import { ArenaReplay } from "./replay";
import { scoreEpisodes, type ScoringWeights } from "./scoring";
import type { ArenaTrace } from "./trace";
import { LEGACY_SPEC } from "./model-spec";
import { parseSensors, type SensorSpec } from "./sensors";
import type { CollisionMode } from "../contracts";

interface Setup {
  arenas: ArenaConfig[];
  frames: number;
  collisions: CollisionMode;
  crashMode: CrashMode;
  crashLimit?: number;
  scoring: ScoringWeights;
  sensors?: SensorSpec[];
}

/** Trains a few generations in-process and returns each generation's winner and best score. */
async function train(setup: Setup, seed: number, generations: number) {
  const server = createTrainingServer(seed);
  const winners: { g: number; model: NetworkJson; best: number; trace: ArenaTrace[] }[] = [];
  const director = registerAITrainingService(server, {
    store: new MemoryModelStore(),
    sampleSize: 8,
    maxGenerations: generations,
    random: seededRandom(seed + 1),
    scenarioSeed: seed,
    framesPerTarget: setup.frames,
    arenas: setup.arenas,
    collisions: setup.collisions,
    crashMode: setup.crashMode,
    ...(setup.crashLimit === undefined ? {} : { crashLimit: setup.crashLimit }),
    scoring: setup.scoring,
    ...(setup.sensors
      ? {
          model: {
            spec: { ...LEGACY_SPEC, inputs: [...LEGACY_SPEC.inputs], sensors: setup.sensors },
            hidden: [8],
          },
        }
      : {}),
    onGeneration: (r) =>
      winners.push({ g: r.generation, model: r.winner.toJson(), best: r.bestScore, trace: r.trace }),
  });
  await server.start();
  let done = false;
  void director.done.then(() => (done = true));
  for (let guard = 0; !done && guard < 300_000; guard++) {
    server.tick();
    if (guard % 20 === 0) await new Promise<void>((r) => setTimeout(r, 0));
  }
  expect(done).toBe(true);
  return winners;
}

async function replayFlight(setup: Setup, seed: number, g: number, model: NetworkJson) {
  const { sensors: _sensors, ...options } = setup;
  const replay = await ArenaReplay.create({ model: MajorTom.fromJson(model), seed, g, ...options });
  while (!replay.done) replay.step(50);
  const score = scoreEpisodes(replay.records, setup.scoring, replay.server.tickSeconds);
  const paths = replay.script.paths;
  replay.dispose();
  return { score, paths };
}

describe("progress record", () => {
  it("telescopes to start distance − end distance when nothing interrupts the episode", async () => {
    const setup: Setup = {
      arenas: [{ name: "point-to-point", params: { episodes: 3, distance: [600, 900] } }],
      frames: 120,
      collisions: "none",
      crashMode: "end",
      scoring: { distance: 1, success: 0, time: 0, crashes: 0, progress: 1 },
    };
    const model = MajorTom.random([4, 6, 2], seededRandom(3));
    const replay = await ArenaReplay.create({ model, seed: 5, g: 1, ...setup });
    while (!replay.done) replay.step(50);
    const scenario = trainingScenarios(resolveArenas(setup.arenas, setup.frames), 5, 1)[0]!;
    replay.records.forEach((record, e) => {
      expect(record.reached).toBe(0); // a 120-frame random flight does not reach a target 600+ away
      const target = scenario.episodes[e]!.targets[0]!.position;
      const start = scenario.episodes[e]!.start.position;
      const path = replay.script.paths[e]!;
      const end = { x: path[path.length - 2]!, y: path[path.length - 1]! };
      const expected =
        Math.hypot(target.x - start.x, target.y - start.y) - Math.hypot(target.x - end.x, target.y - end.y);
      // Within one tick of motion: the record starts after the first physics step.
      expect(Math.abs(record.progress - expected)).toBeLessThan(5);
    });
    replay.dispose();
  });
});

describe("ArenaReplay", () => {
  it.each<[string, Setup]>([
    [
      "point-to-point with asteroids, crashes end the episode",
      {
        arenas: [{ name: "point-to-point", params: { episodes: 3, asteroids: 12 } }],
        frames: 120,
        collisions: "obstacles",
        crashMode: "end",
        scoring: { distance: 1, success: 1000, time: 0, crashes: 500 },
      },
    ],
    [
      "point-to-point, crashes respawn",
      {
        arenas: [{ name: "point-to-point", params: { episodes: 2, asteroids: 20 } }],
        frames: 100,
        collisions: "obstacles",
        crashMode: "respawn",
        scoring: { distance: 1, success: 500, time: 1, crashes: 100 },
      },
    ],
    [
      "point-to-point with dense asteroids, crashes respawn, crashLimit 2",
      {
        arenas: [{ name: "point-to-point", params: { episodes: 4, asteroids: 120 } }],
        frames: 200,
        collisions: "obstacles",
        crashMode: "respawn",
        crashLimit: 2,
        scoring: { distance: 1, success: 1000, time: 0, crashes: 0 },
      },
    ],
    [
      "point-to-point with asteroids, a model with whiskers, sectors, nearest and lineCheck",
      {
        arenas: [{ name: "point-to-point", params: { episodes: 2, asteroids: 25 } }],
        frames: 100,
        collisions: "obstacles",
        crashMode: "respawn",
        scoring: { distance: 1, success: 1000, time: 0, crashes: 500 },
        sensors: parseSensors({ whiskers: {}, sectors: {}, nearest: {}, lineCheck: {} }),
      },
    ],
    [
      "rock-in-line with respawns and a progress reward",
      {
        arenas: [{ name: "rock-in-line", params: { episodes: 3 } }],
        frames: 200,
        collisions: "obstacles",
        crashMode: "respawn",
        scoring: { distance: 1, success: 1000, time: 0, crashes: 500, progress: 4 },
      },
    ],
    [
      "the legacy course",
      {
        arenas: [{ name: "legacy" }],
        frames: 40,
        collisions: "none",
        crashMode: "end",
        scoring: { distance: 1, success: 0, time: 0, crashes: 0 },
      },
    ],
  ])(
    "replaying a generation's winner reproduces its recorded best score exactly: %s",
    async (_name, setup) => {
      const winners = await train(setup, 5, 3);
      for (const w of winners) {
        const replayed = await replayFlight(setup, 5, w.g, w.model);
        expect(replayed.score).toBe(w.best);
        // The trace in the report is the winner's flight: the replay draws the same paths.
        const episodes = w.trace.flatMap((a) => a.episodes);
        expect(episodes.map((e) => e.path)).toEqual(replayed.paths);
        expect(episodes.every((e) => e.path.length >= 4)).toBe(true);
        if (setup.crashLimit !== undefined)
          expect(episodes.every((e) => e.crashes <= setup.crashLimit!)).toBe(true);
      }
      if (setup.crashLimit !== undefined) {
        // The cap did fire, and the replay needs the option: without it the winners score differently.
        const { crashLimit: _limit, ...unlimited } = setup;
        const scores = await Promise.all(winners.map((w) => replayFlight(unlimited, 5, w.g, w.model)));
        expect(scores.some((s, i) => s.score !== winners[i]!.best)).toBe(true);
      }
    },
    120_000,
  );

  it("steps frame by frame with a status for the HUD", async () => {
    const replay = await ArenaReplay.create({
      model: bundledModels().load(DEFAULT_MODEL_NAME)![0]!,
      arenas: [{ name: "point-to-point", params: { episodes: 2 } }],
      frames: 60,
      collisions: "none",
      crashMode: "end",
      seed: 1,
      g: 1,
    });
    expect(replay.status()).toMatchObject({ kind: "episode", index: 0, count: 2, total: 1, done: false });
    expect(replay.target).toBeDefined();
    const start = replay.ship!.position.clone();
    replay.step(10);
    expect(replay.frame).toBe(10);
    expect(replay.ship!.position.distanceTo(start)).toBeGreaterThan(0);
    replay.skipToEpisode(1);
    expect(replay.status().index).toBe(1);
    while (!replay.done) replay.step(100);
    expect(replay.status().done).toBe(true);
    expect(replay.records).toHaveLength(2);
    replay.dispose();
  });
});

describe("ExamReplay", () => {
  it("stepped in uneven chunks, it ends with exactly the exam's flight result", async () => {
    const model = bundledModels().load(DEFAULT_MODEL_NAME)![0]!;
    const expected = await examFlight(model, "random", 77, 40, DEFAULT_EXAM.weights);
    const replay = await ExamReplay.create(model, "random", 77, 40);
    expect(replay.status()).toMatchObject({ kind: "flight", reached: 0, total: 9 });
    while (!replay.done) replay.step(7);
    expect(replay.result(DEFAULT_EXAM.weights)).toEqual(expected);
    expect(replay.status().reached).toBe(expected.checkpoints);
    replay.dispose();
  });
});

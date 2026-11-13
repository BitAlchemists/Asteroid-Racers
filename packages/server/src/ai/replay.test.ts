import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import type { ArenaConfig } from "./arenas";
import type { CrashMode } from "./arena-script";
import { DEFAULT_EXAM, ExamReplay, examFlight } from "./exam";
import { bundledModels, createTrainingServer, DEFAULT_MODEL_NAME, registerAITrainingService } from "./index";
import { MemoryModelStore } from "./model-store";
import { MajorTom, type NetworkJson } from "./network";
import { ArenaReplay } from "./replay";
import { scoreEpisodes, type ScoringWeights } from "./scoring";
import type { CollisionMode } from "../contracts";

interface Setup {
  arenas: ArenaConfig[];
  frames: number;
  collisions: CollisionMode;
  crashMode: CrashMode;
  scoring: ScoringWeights;
}

/** Trains a few generations in-process and returns each generation's winner and best score. */
async function train(setup: Setup, seed: number, generations: number) {
  const server = createTrainingServer(seed);
  const winners: { g: number; model: NetworkJson; best: number }[] = [];
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
    scoring: setup.scoring,
    onGeneration: (r) => winners.push({ g: r.generation, model: r.winner.toJson(), best: r.bestScore }),
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

async function replayScore(setup: Setup, seed: number, g: number, model: NetworkJson): Promise<number> {
  const replay = await ArenaReplay.create({ model: MajorTom.fromJson(model), seed, g, ...setup });
  while (!replay.done) replay.step(50);
  const score = scoreEpisodes(replay.records, setup.scoring, replay.server.tickSeconds);
  replay.dispose();
  return score;
}

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
      for (const w of winners) expect(await replayScore(setup, 5, w.g, w.model)).toBe(w.best);
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

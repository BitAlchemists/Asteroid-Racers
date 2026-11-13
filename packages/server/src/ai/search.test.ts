import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import {
  createTrainingServer,
  DEFAULT_MODEL_NAME,
  registerAITrainingService,
  type TrainingServiceOptions,
} from "./index";
import { MemoryModelStore } from "./model-store";
import { MajorTom } from "./network";

const layout = [3, 4, 2];
const filled = (value: number) => {
  const n = new MajorTom(layout);
  for (const layer of n.weights) layer.fill(value);
  return n;
};

describe("crossover", () => {
  it("uniform takes each weight from either parent, about half from each, deterministically", () => {
    const child = filled(1).crossover(filled(2), "uniform", seededRandom(1));
    const all = child.weights.flatMap((l) => [...l]);
    expect(new Set(all)).toEqual(new Set([1, 2]));
    const share = all.filter((w) => w === 2).length / all.length;
    expect(share).toBeGreaterThan(0.25);
    expect(share).toBeLessThan(0.75);
    const again = filled(1).crossover(filled(2), "uniform", seededRandom(1));
    expect(again.toJson()).toEqual(child.toJson());
  });

  it("layer takes whole layers from one parent or the other", () => {
    for (let seed = 1; seed < 10; seed++) {
      const child = filled(1).crossover(filled(2), "layer", seededRandom(seed));
      for (const layer of child.weights) expect(new Set(layer).size).toBe(1);
    }
  });

  it("needs the same layout", () => {
    expect(() => filled(1).crossover(new MajorTom([3, 5, 2]), "uniform", seededRandom(1))).toThrow(/layout/);
  });
});

/** Trains a few generations and returns the stored parents after each. */
async function train(options: Partial<TrainingServiceOptions>, generations: number) {
  const store = new MemoryModelStore();
  const server = createTrainingServer(2);
  const parents: { json: unknown[] }[] = [];
  const director = registerAITrainingService(server, {
    store,
    sampleSize: 9,
    framesPerTarget: 20,
    maxGenerations: generations,
    random: seededRandom(3),
    parents: 3,
    mutation: { kind: "gaussian", sigma: 0.2 },
    ...options,
    onGeneration: (r) => parents.push({ json: r.parents.map((p) => p.toJson()) }),
  });
  await server.start();
  let done = false;
  void director.done.then(() => (done = true));
  for (let guard = 0; !done && guard < 200_000; guard++) {
    server.tick();
    if (guard % 20 === 0) await new Promise<void>((r) => setTimeout(r, 0));
  }
  expect(done).toBe(true);
  expect(store.load(DEFAULT_MODEL_NAME)).toHaveLength(3);
  return parents;
}

describe("crossover in training", () => {
  it("is deterministic, changes the run, and rate 0 is the same as none", async () => {
    const crossed = await train({ crossover: { kind: "uniform", rate: 1 } }, 3);
    expect(await train({ crossover: { kind: "uniform", rate: 1 } }, 3)).toEqual(crossed);
    const none = await train({}, 3);
    expect(crossed).not.toEqual(none);
    expect(await train({ crossover: { kind: "layer", rate: 0 } }, 3)).toEqual(none);
  }, 60_000);
});

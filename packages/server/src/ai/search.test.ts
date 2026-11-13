import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import {
  createTrainingServer,
  DEFAULT_MODEL_NAME,
  registerAITrainingService,
  type TrainingServiceOptions,
} from "./index";
import { MemoryModelStore } from "./model-store";
import {
  MajorTom,
  mutateScheduled,
  scheduledSigma,
  SELF_ADAPT_BOUNDS,
  type GaussianMutation,
} from "./network";

const layout = [4, 4, 2];
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
    expect(() => filled(1).crossover(new MajorTom([4, 5, 2]), "uniform", seededRandom(1))).toThrow(/layout/);
  });
});

/** Trains a few generations and returns the stored parents after each. */
async function train(options: Partial<TrainingServiceOptions>, generations: number) {
  const store = new MemoryModelStore();
  const server = createTrainingServer(2);
  const parents: { json: unknown[]; sigma: (number | undefined)[] }[] = [];
  const director = registerAITrainingService(server, {
    store,
    sampleSize: 9,
    framesPerTarget: 20,
    maxGenerations: generations,
    random: seededRandom(3),
    parents: 3,
    mutation: { kind: "gaussian", sigma: 0.2 },
    ...options,
    onGeneration: (r) =>
      parents.push({ json: r.parents.map((p) => p.toJson()), sigma: r.parents.map((p) => p.sigma) }),
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

describe("mutation schedules", () => {
  const gaussian: GaussianMutation = { kind: "gaussian", sigma: 0.2 };

  it("anneal: σ falls from sigma to `to` over `over` generations, linear or geometric", () => {
    const linear = { ...gaussian, anneal: { to: 0.02, over: 10 } };
    expect(scheduledSigma(linear, 1)).toBeCloseTo(0.2, 12);
    expect(scheduledSigma(linear, 6)).toBeCloseTo(0.11, 12);
    expect(scheduledSigma(linear, 11)).toBeCloseTo(0.02, 12);
    expect(scheduledSigma(linear, 500)).toBeCloseTo(0.02, 12);
    const geometric = { ...gaussian, anneal: { to: 0.02, over: 10, shape: "geometric" as const } };
    expect(scheduledSigma(geometric, 6)).toBeCloseTo(0.2 * Math.sqrt(0.1), 12);
    expect(scheduledSigma(geometric, 11)).toBeCloseTo(0.02, 12);
    expect(scheduledSigma(gaussian, 50)).toBe(0.2);
  });

  it("selfAdapt: the child's σ moves log-normally from its parent's, within bounds, and is stored", () => {
    const m = { ...gaussian, selfAdapt: true };
    const n = new MajorTom(layout);
    expect(n.toJson()).not.toHaveProperty("sigma"); // plain models serialize as before
    mutateScheduled(n, m, 1, 2, seededRandom(1));
    expect(n.sigma).toBeGreaterThan(0.1);
    expect(n.sigma).toBeLessThan(0.4);
    expect(n.sigma).not.toBe(0.2);
    expect(MajorTom.fromJson(JSON.parse(JSON.stringify(n.toJson()))).sigma).toBe(n.sigma);
    expect(n.clone().sigma).toBe(n.sigma);
    const tiny = new MajorTom(layout);
    tiny.sigma = SELF_ADAPT_BOUNDS[0];
    for (let i = 0; i < 50; i++) mutateScheduled(tiny, m, 1, 2, seededRandom(i));
    expect(tiny.sigma).toBeGreaterThanOrEqual(SELF_ADAPT_BOUNDS[0]);
  });

  it("in training: deterministic, self-adaptive models carry σ, a flat anneal equals fixed σ", async () => {
    const adaptive = await train({ mutation: { ...gaussian, selfAdapt: true } }, 3);
    expect(await train({ mutation: { ...gaussian, selfAdapt: true } }, 3)).toEqual(adaptive);
    expect(adaptive.flatMap((g) => g.sigma).every((s) => typeof s === "number")).toBe(true);
    const fixed = await train({}, 3);
    expect(fixed.flatMap((g) => g.sigma).every((s) => s === undefined)).toBe(true);
    expect(await train({ mutation: { ...gaussian, anneal: { to: 0.2, over: 5 } } }, 3)).toEqual(fixed);
    expect(await train({ mutation: { ...gaussian, anneal: { to: 0.01, over: 2 } } }, 3)).not.toEqual(fixed);
  }, 60_000);
});

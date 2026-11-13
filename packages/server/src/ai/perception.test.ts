import { Movable, Vector2 } from "@ar/shared";
import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import type { AIGameClient } from "./ai-game-client";
import { DEFAULT_EXAM, ExamReplay, examPerception, parseExamConfig, plainExam, runExam } from "./exam";
import { LEGACY_SPEC, layoutFor } from "./model-spec";
import { MajorTom } from "./network";
import { ArenaReplay } from "./replay";
import { TargetVehicleController, type Perception } from "./target-vehicle-controller";

const model = () => MajorTom.random(layoutFor(LEGACY_SPEC, [5]), seededRandom(2), "Laggy");

/** A controller on a fake client whose ship sits at (0, y); returns a stepper and the controller. */
function rig(perception?: Perception) {
  const ship = new Movable({ position: Vector2.zero(), radius: 20 });
  const sent: number[] = [];
  const client = {
    ship,
    obstacles: undefined,
    move: (m: { rotationSpeed: number }) => sent.push(m.rotationSpeed),
  } as unknown as AIGameClient;
  const controller = new TargetVehicleController(client, model(), perception);
  controller.target = new Movable({ position: new Vector2(0, 1000) });
  /** Puts the ship at y and steps; returns what the network saw. */
  const step = (y: number) => {
    ship.position = new Vector2(0, y);
    controller.step(0.015);
    return [...controller.lastActivation()!.values];
  };
  return { step, controller, sent };
}

/** targetDistance (input 1 of the legacy spec) for a ship at y. */
const distanceAt = (y: number) => (1000 - y) / 1000;

describe("input delay and noise", () => {
  it("0 changes nothing: the network sees exactly its inputs", () => {
    const plain = rig();
    const zero = rig({ inputDelay: 0, inputNoise: 0, noiseSeed: 5 });
    for (const y of [0, 100, 250, 400]) expect(zero.step(y)).toEqual(plain.step(y));
    expect(zero.sent).toEqual(plain.sent);
  });

  it("delay k: the network sees the inputs of k steps ago (the first ones until then); an episode start resets it", () => {
    const { step, controller } = rig({ inputDelay: 3 });
    const ys = [0, 10, 20, 30, 40, 50, 60];
    const seen = ys.map((y) => step(y)[1]!);
    expect(seen).toEqual([0, 0, 0, 0, 10, 20, 30].map((y) => expect.closeTo(distanceAt(y), 12)));
    controller.resetHistory();
    expect(step(500)[1]).toBeCloseTo(distanceAt(500), 12);
    expect(step(510)[1]).toBeCloseTo(distanceAt(500), 12);
  });

  it("noise: Gaussian with the given σ, the same for the same seed, different for another", () => {
    const run = (noiseSeed: number) => {
      const { step } = rig({ inputNoise: 0.1, noiseSeed });
      return Array.from({ length: 2000 }, () => step(0)[1]! - distanceAt(0));
    };
    const a = run(1);
    expect(run(1)).toEqual(a);
    expect(run(2)).not.toEqual(a);
    const mean = a.reduce((s, x) => s + x, 0) / a.length;
    const sd = Math.sqrt(a.reduce((s, x) => s + (x - mean) ** 2, 0) / a.length);
    expect(Math.abs(mean)).toBeLessThan(0.01);
    expect(sd).toBeGreaterThan(0.09);
    expect(sd).toBeLessThan(0.11);
  });

  it("rejects a bad delay or noise", () => {
    expect(() => rig({ inputDelay: 1.5 })).toThrow(/inputDelay/);
    expect(() => rig({ inputNoise: -1 })).toThrow(/inputNoise/);
  });

  it("a training replay with delay and noise is deterministic", async () => {
    const flight = async () => {
      const replay = await ArenaReplay.create({
        model: model(),
        arenas: [{ name: "point-to-point", params: { episodes: 2, asteroids: 10 } }],
        frames: 80,
        collisions: "obstacles",
        crashMode: "end",
        seed: 3,
        g: 2,
        inputDelay: 4,
        inputNoise: 0.05,
      });
      while (!replay.done) replay.step(50);
      const out = { records: replay.records, x: replay.ship!.position.x };
      replay.dispose();
      return out;
    };
    expect(await flight()).toEqual(await flight());
  });
});

describe("robustness exam", () => {
  it("parses inputDelay and inputNoise, absent from configs without them", () => {
    expect(parseExamConfig({})).not.toHaveProperty("inputDelay");
    const robust = parseExamConfig({ inputDelay: 4, inputNoise: 0.05 });
    expect(examPerception(robust)).toEqual({ inputDelay: 4, inputNoise: 0.05 });
    expect(plainExam(robust)).toEqual(parseExamConfig({}));
    expect(examPerception(parseExamConfig({ inputDelay: 0, inputNoise: 0 }))).toBeUndefined();
    expect(() => parseExamConfig({ inputDelay: -1 })).toThrow(/exam.inputDelay/);
    expect(() => parseExamConfig({ inputNoise: "x" })).toThrow(/exam.inputNoise/);
  });

  it("flies the same races with delay and noise, deterministically, and its replay matches", async () => {
    const base = { ...DEFAULT_EXAM, tracks: ["demo"], randomTracks: 1, timeLimitSeconds: 8 };
    const robust = { ...base, inputDelay: 4, inputNoise: 0.1 };
    const plain = await runExam(model(), base);
    const a = await runExam(model(), robust);
    expect((await runExam(model(), robust)).flights).toEqual(a.flights);
    expect(a.flights.map((f) => f.seed)).toEqual(plain.flights.map((f) => f.seed));
    expect(a.traces.map((t) => t.path)).not.toEqual(plain.traces.map((t) => t.path));
    const flight = a.flights[0]!;
    const replay = await ExamReplay.create(model(), "demo", flight.seed, 8, examPerception(robust));
    while (!replay.done) replay.step(100);
    expect(replay.result(base.weights)).toEqual(flight);
    replay.dispose();
  });
});

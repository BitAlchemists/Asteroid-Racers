import { Movable, Vector2 } from "@ar/shared";
import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import { INPUTS, LEGACY_SPEC, parseBrainConfig, validateSpec } from "./brain-spec";
import { MemoryBrainStore } from "./brain-store";
import { bundledBrains, createTrainingServer, DEFAULT_BRAIN_NAME, registerAITrainingService } from "./index";
import { MajorTom, type NetworkJson } from "./network";
import { targetInputs } from "./target-vehicle-controller";

describe("brain spec", () => {
  it("the legacy inputs from the registry equal targetInputs", () => {
    const random = seededRandom(2);
    for (let i = 0; i < 50; i++) {
      const ship = new Movable({
        position: new Vector2(random() * 400, random() * 400),
        orientation: random() * 6,
      });
      ship.velocity = new Vector2(random() * 200 - 100, random() * 200 - 100);
      const target = new Vector2(random() * 2000 - 1000, random() * 2000 - 1000);
      expect(LEGACY_SPEC.inputs.map((name) => INPUTS[name]!({ ship, target }))).toEqual(
        targetInputs(ship, target),
      );
    }
  });

  it("is saved with a brain; brains without one (Dart, bundled) load with the legacy spec", () => {
    const net = MajorTom.random([2, 3, 2], seededRandom(1), "Two", {
      inputs: ["targetAngle", "speed"],
      outputs: "thrustTurn",
    });
    const json = net.toJson();
    expect(json.spec).toEqual({ inputs: ["targetAngle", "speed"], outputs: "thrustTurn" });
    expect(MajorTom.fromJson(json).spec).toEqual(json.spec);

    const { spec: _, ...old } = json;
    expect(MajorTom.fromJson({ ...old, input_neurons_count: 2 } as NetworkJson).spec).toEqual(LEGACY_SPEC);
    expect(bundledBrains().load(DEFAULT_BRAIN_NAME)![0]!.spec).toEqual(LEGACY_SPEC);
  });

  it("rejects specs that do not fit the network or name unknown inputs", () => {
    expect(() => validateSpec(LEGACY_SPEC, [3, 2])).toThrow(/4 inputs/);
    expect(() => validateSpec({ inputs: ["nope"], outputs: "thrustTurn" }, [1, 2])).toThrow(
      /unknown brain inputs nope/,
    );
    expect(() => validateSpec({ inputs: ["speed"], outputs: "fly" }, [1, 2])).toThrow(
      /unknown brain outputs/,
    );
    const json = MajorTom.random([4, 2], seededRandom(1)).toJson();
    expect(() => MajorTom.fromJson({ ...json, spec: { inputs: ["speed"], outputs: "thrustTurn" } })).toThrow(
      /1 inputs/,
    );
  });

  it("parses the brain config with the original brain as default", () => {
    expect(parseBrainConfig(undefined)).toEqual({ spec: LEGACY_SPEC, hidden: [10, 8, 6, 4] });
    expect(parseBrainConfig({ inputs: ["targetAngle", "targetDistance"], hidden: [6] })).toEqual({
      spec: { inputs: ["targetAngle", "targetDistance"], outputs: "thrustTurn" },
      hidden: [6],
    });
    expect(() => parseBrainConfig({ inputs: [] })).toThrow(/non-empty/);
    expect(() => parseBrainConfig({ hidden: [0] })).toThrow(/hidden/);
    expect(() => parseBrainConfig({ layers: [3] })).toThrow(/unknown brain keys layers/);
    expect(() => parseBrainConfig({ inputs: ["whiskers"] })).toThrow(/unknown brain inputs/);
  });
});

describe("training with a brain spec", () => {
  async function train(store: MemoryBrainStore) {
    const server = createTrainingServer(1);
    const director = registerAITrainingService(server, {
      store,
      sampleSize: 3,
      framesPerTarget: 20,
      maxGenerations: 1,
      random: seededRandom(2),
      brain: { spec: { inputs: ["targetAngle", "targetDistance"], outputs: "thrustTurn" }, hidden: [3] },
    });
    await server.start();
    let done = false;
    let failure: unknown;
    director.done.then(
      () => (done = true),
      (error: unknown) => (failure = error),
    );
    for (let guard = 0; !done && !failure && guard < 100_000; guard++) {
      server.tick();
      if (guard % 20 === 0) await new Promise<void>((r) => setTimeout(r, 0));
    }
    if (failure) throw failure;
  }

  it("evolves brains with the configured inputs and layout", async () => {
    const store = new MemoryBrainStore();
    await train(store);
    const winner = store.load(DEFAULT_BRAIN_NAME)![0]!;
    expect(winner.layout).toEqual([2, 3, 2]);
    expect(winner.spec.inputs).toEqual(["targetAngle", "targetDistance"]);
  });

  it("refuses to continue from a stored brain with a different spec", async () => {
    const store = bundledBrains(); // legacy spec
    await expect(train(store)).rejects.toThrow(/stored brain .* has inputs/);
  });
});

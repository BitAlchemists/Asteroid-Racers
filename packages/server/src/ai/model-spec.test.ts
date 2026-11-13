import { Movable, Vector2 } from "@ar/shared";
import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import { INPUTS, LEGACY_SPEC, parseModelConfig, validateSpec } from "./model-spec";
import { MemoryModelStore } from "./model-store";
import { bundledModels, createTrainingServer, DEFAULT_MODEL_NAME, registerAITrainingService } from "./index";
import { MajorTom, type NetworkJson } from "./network";
import { targetInputs } from "./target-vehicle-controller";

describe("model spec", () => {
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

  it("is saved with a model; models without one (Dart, bundled) load with the legacy spec", () => {
    const net = MajorTom.random([2, 3, 2], seededRandom(1), "Two", {
      inputs: ["targetAngle", "speed"],
      outputs: "thrustTurn",
    });
    const json = net.toJson();
    expect(json.spec).toEqual({ inputs: ["targetAngle", "speed"], outputs: "thrustTurn" });
    expect(MajorTom.fromJson(json).spec).toEqual(json.spec);

    const { spec: _, ...old } = json;
    expect(MajorTom.fromJson({ ...old, input_neurons_count: 2 } as NetworkJson).spec).toEqual(LEGACY_SPEC);
    expect(bundledModels().load(DEFAULT_MODEL_NAME)![0]!.spec).toEqual(LEGACY_SPEC);
  });

  it("rejects specs that do not fit the network or name unknown inputs", () => {
    expect(() => validateSpec(LEGACY_SPEC, [3, 2])).toThrow(/4 inputs/);
    expect(() => validateSpec({ inputs: ["nope"], outputs: "thrustTurn" }, [1, 2])).toThrow(
      /unknown model inputs nope/,
    );
    expect(() => validateSpec({ inputs: ["speed"], outputs: "fly" }, [1, 2])).toThrow(
      /unknown model outputs/,
    );
    const json = MajorTom.random([4, 2], seededRandom(1)).toJson();
    expect(() => MajorTom.fromJson({ ...json, spec: { inputs: ["speed"], outputs: "thrustTurn" } })).toThrow(
      /1 inputs/,
    );
  });

  it("parses the model config with the original model as default", () => {
    expect(parseModelConfig(undefined)).toEqual({ spec: LEGACY_SPEC, hidden: [10, 8, 6, 4] });
    expect(parseModelConfig({ inputs: ["targetAngle", "targetDistance"], hidden: [6] })).toEqual({
      spec: { inputs: ["targetAngle", "targetDistance"], outputs: "thrustTurn" },
      hidden: [6],
    });
    expect(() => parseModelConfig({ inputs: [] })).toThrow(/non-empty/);
    expect(() => parseModelConfig({ hidden: [0] })).toThrow(/hidden/);
    expect(() => parseModelConfig({ layers: [3] })).toThrow(/unknown model keys layers/);
    expect(() => parseModelConfig({ inputs: ["whiskers"] })).toThrow(/unknown model inputs/);
  });
});

describe("training with a model spec", () => {
  async function train(store: MemoryModelStore) {
    const server = createTrainingServer(1);
    const director = registerAITrainingService(server, {
      store,
      sampleSize: 3,
      framesPerTarget: 20,
      maxGenerations: 1,
      random: seededRandom(2),
      model: { spec: { inputs: ["targetAngle", "targetDistance"], outputs: "thrustTurn" }, hidden: [3] },
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

  it("evolves models with the configured inputs and layout", async () => {
    const store = new MemoryModelStore();
    await train(store);
    const winner = store.load(DEFAULT_MODEL_NAME)![0]!;
    expect(winner.layout).toEqual([2, 3, 2]);
    expect(winner.spec.inputs).toEqual(["targetAngle", "targetDistance"]);
  });

  it("refuses to continue from a stored model with a different spec", async () => {
    const store = bundledModels(); // legacy spec
    await expect(train(store)).rejects.toThrow(/stored model .* has inputs/);
  });
});

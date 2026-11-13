import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import { inputCount, inputNames, LEGACY_SPEC, layoutFor } from "./model-spec";
import { MajorTom } from "./network";
import { ArenaReplay } from "./replay";
import { parseSensors } from "./sensors";

const spec = {
  ...LEGACY_SPEC,
  inputs: [...LEGACY_SPEC.inputs],
  sensors: parseSensors({ lineCheck: {}, whiskers: {}, sectors: {}, nearest: { flag: 1 } }),
};

const replayOf = (model: MajorTom) =>
  ArenaReplay.create({
    model,
    arenas: [{ name: "point-to-point", params: { episodes: 1, asteroids: 25 } }],
    frames: 100,
    collisions: "obstacles",
    crashMode: "respawn",
    seed: 3,
    g: 1,
  });

describe("replay inputs", () => {
  it("names every input neuron: the spec's inputs, then each sensor's", () => {
    const names = inputNames(spec);
    expect(names).toHaveLength(inputCount(spec));
    // Sensors in the spec's order (parseSensors sorts them: whiskers, sectors, nearest, lineCheck).
    expect(spec.sensors.map((s) => s.type)).toEqual(["whiskers", "sectors", "nearest", "lineCheck"]);
    expect(names.slice(0, 5)).toEqual([...LEGACY_SPEC.inputs, "whiskers[0]"]);
    expect(names).toContain("whiskers[6]");
    expect(names).toContain("sectors[7]");
    expect(names).toContain("nearest[0].present");
    expect(names.slice(-2)).toEqual(["lineCheck.near", "lineCheck.offset"]);
    const unflagged = { ...spec, sensors: parseSensors({ nearest: { k: 2 } }) };
    expect(inputNames(unflagged).slice(4)).toEqual([
      "nearest[0].angle",
      "nearest[0].dist",
      "nearest[0].radius",
      "nearest[1].angle",
      "nearest[1].dist",
      "nearest[1].radius",
    ]);
  });

  it("shows what the network saw and answered, without changing the flight", async () => {
    const model = () => MajorTom.random(layoutFor(spec, [8]), seededRandom(1), "Seer", spec);
    const watched = await replayOf(model());
    const plain = await replayOf(model());
    expect(watched.inputs()).toBeUndefined();
    for (let i = 0; i < 60 && !watched.done; i++) {
      watched.step();
      plain.step();
      const seen = watched.inputs()!;
      expect(seen.names).toHaveLength(seen.values.length);
      expect(seen.outputs).toHaveLength(2);
      // The values are what the network was given: activating again gives the same outputs.
      expect([...model().activate(seen.values)]).toEqual(Array.from(seen.outputs));
      expect(watched.ship!.position.x).toBe(plain.ship!.position.x);
      expect(watched.ship!.position.y).toBe(plain.ship!.position.y);
    }
    watched.dispose();
    plain.dispose();
  });
});

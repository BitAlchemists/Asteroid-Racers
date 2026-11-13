import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import { LEGACY_SPEC, layoutFor } from "./model-spec";
import { MajorTom } from "./network";
import { ArenaReplay } from "./replay";
import { parseSensors } from "./sensors";

async function arenaReplay(model: MajorTom): Promise<ArenaReplay> {
  return ArenaReplay.create({
    model,
    arenas: [{ name: "point-to-point", params: { episodes: 1, asteroids: 25 } }],
    frames: 100,
    collisions: "obstacles",
    crashMode: "respawn",
    seed: 3,
    g: 1,
  });
}

describe("replay sensors", () => {
  it("a model with sensors shows what they see while it flies", async () => {
    const spec = {
      ...LEGACY_SPEC,
      inputs: [...LEGACY_SPEC.inputs],
      sensors: parseSensors({ whiskers: {}, sectors: {}, nearest: {}, lineCheck: {} }),
    };
    const model = MajorTom.random(layoutFor(spec, [8]), seededRandom(1), "Seer", spec);
    const replay = await arenaReplay(model);
    let lit = false;
    let rock = false;
    for (let i = 0; i < 100 && !replay.done; i++) {
      replay.step();
      const primitives = replay.sensors();
      expect(primitives.length).toBeGreaterThan(0);
      for (const p of primitives) {
        if (p.kind === "segment") {
          expect([p.x1, p.y1, p.x2, p.y2].every(Number.isFinite)).toBe(true);
          lit ||= p.lit;
        } else {
          expect(p.r).toBeGreaterThan(0);
          rock = true;
        }
      }
    }
    // With 25 asteroids around, some sensor picks a rock or finds an obstacle.
    expect(lit || rock).toBe(true);
    replay.dispose();
  });

  it("a model without sensors shows nothing", async () => {
    const replay = await arenaReplay(MajorTom.random([4, 8, 2], seededRandom(1)));
    replay.step(10);
    expect(replay.sensors()).toEqual([]);
    replay.dispose();
  });
});

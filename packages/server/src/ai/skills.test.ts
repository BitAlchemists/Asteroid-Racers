import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import { LEGACY_SPEC, layoutFor } from "./model-spec";
import { MajorTom } from "./network";
import { parseSkillsConfig, runSkills, SKILL_ARENAS, skillFlights, skillMetrics } from "./skills";

const setup = { seed: 1, frames: 60, collisions: "obstacles", crashMode: "respawn" } as const;

describe("skills exam", () => {
  it("parses its config with defaults and rejects mistakes", () => {
    expect(parseSkillsConfig({})).toEqual({ episodes: 8 });
    expect(parseSkillsConfig({ episodes: 3 })).toEqual({ episodes: 3 });
    expect(() => parseSkillsConfig({ episodes: 0 })).toThrow(/episodes/);
    expect(() => parseSkillsConfig({ foo: 1 })).toThrow(/unknown/);
    expect(() => parseSkillsConfig([])).toThrow(/object/);
  });

  it("every model meets the same scenarios: seeds depend only on the exam seed", () => {
    const a = skillFlights({ episodes: 2 }, 1);
    expect(a.map((f) => f.seed)).toEqual(skillFlights({ episodes: 2 }, 1).map((f) => f.seed));
    expect(new Set(a.map((f) => f.seed)).size).toBe(SKILL_ARENAS.length);
    expect(a.every((f) => f.arena.params?.episodes === 2)).toBe(true);
    expect(skillFlights({ episodes: 2 }, 2)[0]!.seed).not.toBe(a[0]!.seed);
  });

  it("flies every skill deterministically and reports share reached and crashes per episode", async () => {
    const model = MajorTom.random(layoutFor(LEGACY_SPEC, [6]), seededRandom(4), "Probe", { ...LEGACY_SPEC });
    const first = await runSkills(model, { episodes: 1 }, setup);
    const again = await runSkills(model, { episodes: 1 }, setup);
    expect(again).toEqual(first);
    expect(first.map((r) => r.key)).toEqual(SKILL_ARENAS.map((s) => s.key));
    for (const r of first) {
      expect(r.episodes).toBe(1);
      expect(r.success).toBeCloseTo(r.targets === 0 ? 0 : r.reached / r.targets, 12);
      expect(r.crashesPerEpisode).toBe(r.crashes);
    }
    const metrics = skillMetrics(first);
    expect(Object.keys(metrics)).toHaveLength(2 * SKILL_ARENAS.length);
    expect(metrics.skillChain).toBe(first[2]!.success);
  }, 60_000);
});

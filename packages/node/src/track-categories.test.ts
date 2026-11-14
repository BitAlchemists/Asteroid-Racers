import { TRACKS } from "@ar/server";
import { describe, expect, it } from "vitest";
import {
  EXCLUDED_TRACKS,
  RACE_ROTATION,
  RACE_TRACKS,
  SKILL_TRACKS,
  trackBlurb,
  trackCategory,
} from "./track-categories";

describe("track categories", () => {
  it("puts every registered track in exactly one group, or excludes it explicitly", () => {
    const grouped = [...RACE_TRACKS, ...SKILL_TRACKS].map((t) => t.name);
    for (const name of Object.keys(TRACKS)) {
      const places = grouped.filter((g) => g === name).length + (name in EXCLUDED_TRACKS ? 1 : 0);
      expect(places, `track ${name}`).toBe(1);
    }
  });

  it("lists only registered tracks", () => {
    for (const name of [...RACE_TRACKS, ...SKILL_TRACKS]
      .map((t) => t.name)
      .concat(Object.keys(EXCLUDED_TRACKS)))
      expect(TRACKS[name], name).toBeDefined();
  });

  it("has the agreed groups", () => {
    expect(RACE_TRACKS.map((t) => t.name)).toEqual([
      "demo",
      "canyon",
      "gauntlet",
      "circuit",
      "random",
      "generated:easy",
      "generated:medium",
      "generated:hard",
    ]);
    expect(SKILL_TRACKS.map((t) => t.name)).toEqual([
      "short",
      "slalom",
      "hairpins",
      "straight-to-turn",
      "chicane",
      "dense-belt",
      "gate-row",
      "pit-stop",
    ]);
    expect(RACE_ROTATION).toEqual(RACE_TRACKS.map((t) => t.name));
    expect(trackCategory("canyon")).toBe("race");
    expect(trackCategory("slalom")).toBe("skill");
    expect(trackCategory("moon")).toBeUndefined();
  });

  it("gives every track a one-line blurb", () => {
    for (const { name, blurb } of [...RACE_TRACKS, ...SKILL_TRACKS]) {
      expect(blurb.length, name).toBeGreaterThan(10);
      expect(blurb.length, name).toBeLessThanOrEqual(80);
      expect(blurb).not.toMatch(/\n/);
      expect(trackBlurb(name)).toBe(blurb);
    }
  });
});

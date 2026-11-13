import { applyLevel, DEFAULT_CURRICULUM_LEVELS, parseArenas } from "@ar/server";
import { describe, expect, it } from "vitest";
import { curriculumLevel, levelLabel } from "./level";

const arenas = [
  { name: "rock-in-line", params: {} },
  { name: "point-to-point", params: { frames: 600 } },
];

describe("curriculumLevel", () => {
  it("matches the snapshot's arenas against the config's levels", () => {
    const config = { arenas, curriculum: {} };
    const flown = JSON.parse(JSON.stringify(applyLevel(parseArenas(arenas), DEFAULT_CURRICULUM_LEVELS[2]!)));
    const level = curriculumLevel(config, flown);
    expect(level).toEqual({ index: 2, count: DEFAULT_CURRICULUM_LEVELS.length });
    expect(levelLabel(level!)).toBe(`level 3/${DEFAULT_CURRICULUM_LEVELS.length}`);
  });

  it("uses custom levels and falls back to the level metric", () => {
    const config = {
      arenas,
      curriculum: { levels: [{ "rock-in-line": { rocks: 0 } }, { "rock-in-line": { rocks: 3 } }] },
    };
    const flown = applyLevel(parseArenas(arenas), { "rock-in-line": { rocks: 3 } });
    expect(curriculumLevel(config, flown)).toEqual({ index: 1, count: 2 });
    expect(curriculumLevel(config, undefined, { level: 0 })).toEqual({ index: 0, count: 2 });
    expect(curriculumLevel(config, undefined, { level: 7 })).toBeUndefined();
  });

  it("recognises tiered levels (arena lists) in snapshots", () => {
    const tier2 = [{ name: "chain", params: { episodes: 4 } }];
    const config = {
      arenas,
      curriculum: { levels: [{ arenas: [{ name: "stop", params: { episodes: 4 } }] }, { arenas: tier2 }] },
    };
    // The worker writes applyLevel(...) of the flown level into the snapshot: the tier's arena list.
    const flown = JSON.parse(JSON.stringify(applyLevel(parseArenas(arenas), { arenas: parseArenas(tier2) })));
    expect(curriculumLevel(config, flown)).toEqual({ index: 1, count: 2 });
  });

  it("is undefined without a curriculum (old runs and snapshots)", () => {
    expect(curriculumLevel({ arenas }, undefined, { level: 1 })).toBeUndefined();
    expect(curriculumLevel(undefined, undefined)).toBeUndefined();
    expect(curriculumLevel({ arenas, curriculum: "bad" }, undefined)).toBeUndefined();
  });
});

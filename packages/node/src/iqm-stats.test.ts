import { describe, expect, it } from "vitest";
import { comparePaired, directionOf, iqm, mean, sd, seedsNeeded } from "./iqm-stats";

describe("iqm statistics", () => {
  it("IQM drops the outer quarters (floor(n/4) at each end), so outlier seeds do not dominate", () => {
    expect(iqm([1, 2, 3, 4])).toBe(2.5);
    expect(iqm([1, 2, 3, 4, 5, 6, 7, 8, 9, 1000])).toBe(5.5); // keeps 3..8
    expect(iqm([5])).toBe(5);
    expect(mean([1, 2, 3])).toBe(2);
    expect(sd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
  });

  it("a clear paired improvement gets a CI that excludes 0; noise alone does not", () => {
    const base = [100, 120, 90, 150, 110, 130, 95, 105, 140, 115];
    const better = base.map((v, i) => v - 30 + (i % 3)); // every seed about 30 lower
    const c = comparePaired(base, better, "lower");
    expect(c.iqmEffect).toBeLessThan(-25);
    expect(c.iqmCi[1]).toBeLessThan(0);
    expect(c.meanCi[1]).toBeLessThan(0);
    expect(c.winFraction).toBe(1);
    const noise = base.map((v, i) => v + (i % 2 === 0 ? 20 : -20));
    const n = comparePaired(base, noise, "lower");
    expect(n.meanCi[0]).toBeLessThan(0);
    expect(n.meanCi[1]).toBeGreaterThan(0);
    expect(n.winFraction).toBe(0.5);
  });

  it("is deterministic for a given seed and respects the direction", () => {
    const base = [1, 2, 3, 4, 5];
    const arm = [2, 3, 3, 5, 7];
    expect(comparePaired(base, arm, "higher")).toEqual(comparePaired(base, arm, "higher"));
    expect(comparePaired(base, arm, "higher").winFraction).toBe(0.8);
    expect(comparePaired(base, arm, "lower").winFraction).toBe(0);
    expect(() => comparePaired([1], [1, 2], "lower")).toThrow(/equal/);
  });

  it("power: seeds needed grow with the spread of differences, and metric directions are known", () => {
    expect(seedsNeeded(10, 10)).toBe(8); // (2.8 · 1)² ≈ 7.85
    expect(seedsNeeded(20, 10)).toBe(32);
    expect(directionOf("exam")).toBe("lower");
    expect(directionOf("examCrashes")).toBe("lower");
    expect(directionOf("examCheckpoints")).toBe("higher");
    expect(directionOf("heldOutSuccess")).toBe("higher");
  });
});

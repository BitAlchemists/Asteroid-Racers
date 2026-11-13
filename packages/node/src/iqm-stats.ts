/**
 * Robust statistics for comparing training runs over seeds (Agarwal et al. 2021, "rliable"):
 * the interquartile mean (IQM), paired bootstrap confidence intervals and a simple power estimate.
 * Everything is deterministic: the bootstrap draws come from a seeded generator.
 */
import { seededRandom } from "@ar/server";

/** Mean of the middle 50 %: drops floor(n/4) values at each end (like scipy's trim_mean(x, 0.25)). */
export function iqm(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const cut = Math.floor(sorted.length / 4);
  const middle = sorted.slice(cut, sorted.length - cut);
  return middle.reduce((s, v) => s + v, 0) / middle.length;
}

export function mean(values: readonly number[]): number {
  return values.length === 0 ? NaN : values.reduce((s, v) => s + v, 0) / values.length;
}

/** Sample standard deviation (n − 1). */
export function sd(values: readonly number[]): number {
  if (values.length < 2) return NaN;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1));
}

function percentile(sorted: readonly number[], p: number): number {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo);
}

export interface PairedComparison {
  n: number;
  iqmBase: number;
  iqmArm: number;
  /** IQM(arm) − IQM(base). */
  iqmEffect: number;
  /** 95 % percentile bootstrap CI of the IQM effect (seeds resampled together, so pairs stay paired). */
  iqmCi: [number, number];
  /** Mean of the per-seed differences arm − base. */
  meanEffect: number;
  meanCi: [number, number];
  /** Share of seeds where the arm is better (in `direction`). */
  winFraction: number;
  /** Sample sd of the per-seed differences. */
  sdDiff: number;
  /** Smallest mean effect these n seeds detect at α = 0.05 (two-sided) with 80 % power. */
  detectable: number;
}

/**
 * Compares `arm` with `base`, paired by index (same seed). `direction` says which way is better:
 * "lower" (exam score, crashes) or "higher" (checkpoints, success).
 */
export function comparePaired(
  base: readonly number[],
  arm: readonly number[],
  direction: "lower" | "higher",
  { resamples = 10_000, seed = 1 }: { resamples?: number; seed?: number } = {},
): PairedComparison {
  if (base.length !== arm.length || base.length === 0)
    throw new Error(`paired comparison needs equal, non-empty lists (got ${base.length} and ${arm.length})`);
  const n = base.length;
  const diffs = arm.map((a, i) => a - base[i]!);
  const random = seededRandom(seed);
  const iqmEffects: number[] = [];
  const meanEffects: number[] = [];
  const b = new Array<number>(n);
  const a = new Array<number>(n);
  for (let r = 0; r < resamples; r++) {
    for (let k = 0; k < n; k++) {
      const i = Math.floor(random() * n);
      b[k] = base[i]!;
      a[k] = arm[i]!;
    }
    iqmEffects.push(iqm(a) - iqm(b));
    meanEffects.push(mean(a) - mean(b));
  }
  iqmEffects.sort((x, y) => x - y);
  meanEffects.sort((x, y) => x - y);
  const better = diffs.filter((d) => (direction === "lower" ? d < 0 : d > 0)).length;
  const sdDiff = sd(diffs);
  return {
    n,
    iqmBase: iqm(base),
    iqmArm: iqm(arm),
    iqmEffect: iqm(arm) - iqm(base),
    iqmCi: [percentile(iqmEffects, 0.025), percentile(iqmEffects, 0.975)],
    meanEffect: mean(diffs),
    meanCi: [percentile(meanEffects, 0.025), percentile(meanEffects, 0.975)],
    winFraction: better / n,
    sdDiff,
    detectable: (Z_ALPHA + Z_POWER) * (sdDiff / Math.sqrt(n)),
  };
}

const Z_ALPHA = 1.959964; // two-sided α = 0.05
const Z_POWER = 0.841621; // power 0.8

/** Seeds needed to detect a mean paired effect of `effect` given the sd of per-seed differences. */
export function seedsNeeded(sdDiff: number, effect: number): number {
  if (!(effect > 0) || !Number.isFinite(sdDiff)) return NaN;
  return Math.ceil((((Z_ALPHA + Z_POWER) * sdDiff) / effect) ** 2);
}

/** Which way is better for a metric, by name. */
export function directionOf(metric: string): "lower" | "higher" {
  return /exam$|Crashes$|^score$|^mean$|^worst$|^heldOut$/.test(metric) ? "lower" : "higher";
}

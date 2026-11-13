import type { Random } from "../random";

/** Arena params as they appear in a training config. */
export type ArenaParams = Record<string, unknown>;

/** Reads a number param, with a default and a range check. */
export function numberParam(params: ArenaParams, key: string, fallback: number, min = -Infinity): number {
  const value = params[key] ?? fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min)
    throw new Error(`arena param ${key} must be a number ≥ ${min}, got ${JSON.stringify(value)}`);
  return value;
}

/** Reads a `[min, max]` param (min ≤ max). */
export function rangeParam(params: ArenaParams, key: string, fallback: [number, number]): [number, number] {
  const value = params[key] ?? fallback;
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !value.every((v) => typeof v === "number" && Number.isFinite(v)) ||
    (value[0] as number) > (value[1] as number)
  )
    throw new Error(`arena param ${key} must be [min, max], got ${JSON.stringify(value)}`);
  return value as [number, number];
}

/** Reads a `[min, max]` param of integers, both at least `least`. */
export function intRangeParam(
  params: ArenaParams,
  key: string,
  fallback: [number, number],
  least: number,
): [number, number] {
  const value = rangeParam(params, key, fallback);
  if (!value.every((v) => Number.isInteger(v) && v >= least))
    throw new Error(
      `arena param ${key} must be [min, max] of integers ≥ ${least}, got ${JSON.stringify(value)}`,
    );
  return value;
}

/** A uniform number in `[min, max)`. */
export const between = (random: Random, [min, max]: [number, number]) => min + random() * (max - min);

/** A uniform integer in `[min, max]`. */
export const intBetween = (random: Random, [min, max]: [number, number]) =>
  min + Math.min(max - min, Math.floor(random() * (max - min + 1)));

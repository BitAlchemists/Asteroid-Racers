const TWO_PI = 2 * Math.PI;

/**
 * Wraps an angle into [-π, π]. Values already inside the range (including exactly ±π) are returned
 * unchanged, matching the Dart `Entity.orientation` setter for the common single-wrap case; unlike
 * the Dart setter, angles more than one turn out of range are wrapped fully. Non-finite values are
 * returned as-is.
 */
export function wrapAngle(value: number): number {
  if (!Number.isFinite(value) || (value <= Math.PI && value >= -Math.PI)) {
    return value;
  }
  return value - TWO_PI * Math.floor((value + Math.PI) / TWO_PI);
}

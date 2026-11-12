/** Returns a float in [0, 1). `Math.random` satisfies it; tests pass a seeded generator. */
export type Random = () => number;

/** A seeded generator whose whole state is one uint32, so it can be checkpointed and restored. */
export interface SeededRandom extends Random {
  state: number;
}

/** Small, fast seeded PRNG (mulberry32) for reproducible worlds, tests and resumable training. */
export function seededRandom(seed: number): SeededRandom {
  let state = seed >>> 0;
  const next = (() => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }) as SeededRandom;
  Object.defineProperty(next, "state", {
    get: () => state,
    set: (value: number) => {
      state = value >>> 0;
    },
    enumerable: true,
  });
  return next;
}

export function randomInt(random: Random, maxExclusive: number): number {
  return Math.floor(random() * maxExclusive);
}

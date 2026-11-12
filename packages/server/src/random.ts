/** Returns a float in [0, 1). `Math.random` satisfies it; tests pass a seeded generator. */
export type Random = () => number;

/** Small, fast seeded PRNG (mulberry32) for reproducible worlds and tests. */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(random: Random, maxExclusive: number): number {
  return Math.floor(random() * maxExclusive);
}

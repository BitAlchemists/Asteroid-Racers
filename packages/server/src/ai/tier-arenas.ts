import { Vector2 } from "@ar/shared";
import type { Random } from "../random";
import { between, intBetween, intRangeParam, numberParam, rangeParam } from "./arena-params";
import type { Arena, EpisodeSpec, TargetSpec } from "./arenas";

// The tiered training arenas of M5 (see doc/plans/M5-content.md, step 4). Each asks for one skill;
// all are opt-in by name and deterministic per seed (they use only `random`).

const DEG = Math.PI / 180;

/** The ship orientation that points its nose (thrust) along the direction angle `angle`. */
export const headingToOrientation = (angle: number) => angle - Math.PI / 2;

/**
 * A chain of `count` points from `from`: the first leg goes in a random direction, each further leg
 * turns by an angle in `turn` (degrees, random side) from the previous one; leg lengths in `legs`.
 */
export function chainPoints(
  random: Random,
  from: Vector2,
  count: number,
  legs: [number, number],
  turn: [number, number],
): Vector2[] {
  const points: Vector2[] = [];
  let angle = random() * Math.PI * 2;
  let at = from;
  for (let i = 0; i < count; i++) {
    if (i > 0) {
      const side = random() < 0.5 ? -1 : 1;
      angle += side * between(random, turn) * DEG;
    }
    at = at.plus(new Vector2(Math.cos(angle), Math.sin(angle)).scale(between(random, legs)));
    points.push(at);
  }
  return points;
}

/**
 * Chain: every episode is a row of 3–5 targets, like the legs of a race. The ship starts at the
 * origin with a random heading; each leg turns from the previous one, so a good racer plans its exit
 * from one target towards the next. No obstacles.
 * Params: `episodes`, `targets` [min, max] per episode, `distance` [min, max] per leg, `turn`
 * [min, max] degrees between legs, `radius`, `frames` per target (time limit = frames × targets).
 */
export const chainArena: Arena = {
  name: "chain",
  description: "Rows of 3–5 targets per episode, each leg turning from the last (planning the next turn)",
  tier: 1,
  generate(random, params) {
    const episodes = numberParam(params, "episodes", 6, 1);
    const targets = intRangeParam(params, "targets", [3, 5], 1);
    const distance = rangeParam(params, "distance", [300, 900]);
    const turn = rangeParam(params, "turn", [0, 120]);
    const radius = numberParam(params, "radius", 50, 1);
    const frames = numberParam(params, "frames", 600, 1);

    const specs: EpisodeSpec[] = [];
    for (let i = 0; i < episodes; i++) {
      const orientation = random() * Math.PI * 2;
      const count = intBetween(random, targets);
      const points = chainPoints(random, Vector2.zero(), count, distance, turn);
      specs.push({
        start: { position: Vector2.zero(), orientation },
        targets: points.map((position): TargetSpec => ({ position, radius })),
        timeLimitFrames: frames * count,
      });
    }
    return { obstacles: [], episodes: specs };
  },
};

/** The tiered arenas, in tier order. */
export const TIER_ARENAS: readonly Arena[] = [chainArena];

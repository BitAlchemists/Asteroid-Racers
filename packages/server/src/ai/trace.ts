import type { Scenario } from "./arenas";
import type { EpisodeRecord } from "./scoring";

/** A path point is kept every this many frames (plus the last position of each episode or flight). */
export const PATH_EVERY = 10;

/** Positions are rounded to this many decimals in traces (keeps snapshot files small). */
const round = (v: number) => Math.round(v * 10) / 10;

/** Appends a position to a flat [x0, y0, x1, y1, …] path. */
export function addPathPoint(path: number[], x: number, y: number): void {
  path.push(round(x), round(y));
}

/** One episode as drawn in a thumbnail: where it started, its targets, the ship's path, the outcome. */
export interface EpisodeTrace {
  start: [number, number];
  /** [x, y, radius] per target. */
  targets: [number, number, number][];
  /** Flat [x0, y0, x1, y1, …], a point every {@link PATH_EVERY} frames. */
  path: number[];
  reached: number;
  crashes: number;
}

export interface ArenaTrace {
  arena: string;
  /** [x, y, radius] per obstacle. */
  obstacles: [number, number, number][];
  episodes: EpisodeTrace[];
}

/** Builds the traces of one model's flights through `scenarios` (records and paths in episode order). */
export function buildTraces(
  arenaNames: readonly string[],
  scenarios: readonly Scenario[],
  records: readonly EpisodeRecord[],
  paths: readonly number[][],
): ArenaTrace[] {
  let e = 0;
  return scenarios.map((scenario, a) => ({
    arena: arenaNames[a] ?? `arena ${a}`,
    obstacles: scenario.obstacles.map((o) => [round(o.position.x), round(o.position.y), round(o.radius)]),
    episodes: scenario.episodes.map((spec) => {
      const record = records[e];
      const path = paths[e] ?? [];
      e++;
      return {
        start: [round(spec.start.position.x), round(spec.start.position.y)],
        targets: spec.targets.map((t) => [round(t.position.x), round(t.position.y), round(t.radius)]),
        path,
        reached: record?.reached ?? 0,
        crashes: record?.crashes ?? 0,
      };
    }),
  }));
}

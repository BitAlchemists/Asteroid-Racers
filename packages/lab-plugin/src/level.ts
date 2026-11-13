import { applyLevel, parseArenas, parseCurriculum } from "@ar/server";

/** A curriculum level for display: `index` 0-based, of `count` levels. */
export interface CurriculumLevel {
  index: number;
  count: number;
}

/**
 * The curriculum level a training generation flew, or undefined without a curriculum. Matches the
 * snapshot's `arenas` (written with the `curriculum` switch) against the arenas of each of the
 * config's levels; without arenas, falls back to the gen event's `level` metric. Old snapshots and
 * runs without the switch give undefined.
 */
export function curriculumLevel(
  config: Record<string, unknown> | null | undefined,
  snapshotArenas: unknown,
  metrics?: Record<string, unknown> | null,
): CurriculumLevel | undefined {
  if (!config || config.curriculum === undefined) return undefined;
  let levels: ReturnType<typeof parseCurriculum>["levels"];
  let arenas: ReturnType<typeof parseArenas>;
  try {
    arenas = parseArenas(config.arenas);
    levels = parseCurriculum(config.curriculum, arenas).levels;
  } catch {
    return undefined;
  }
  const count = levels.length;
  if (snapshotArenas !== undefined) {
    const flown = JSON.stringify(snapshotArenas);
    const index = levels.findIndex((level) => JSON.stringify(applyLevel(arenas, level)) === flown);
    if (index >= 0) return { index, count };
  }
  const metric = metrics?.level;
  return typeof metric === "number" && Number.isInteger(metric) && metric >= 0 && metric < count
    ? { index: metric, count }
    : undefined;
}

/** "level 2/5" (1-based for people). */
export const levelLabel = (level: CurriculumLevel): string => `level ${level.index + 1}/${level.count}`;

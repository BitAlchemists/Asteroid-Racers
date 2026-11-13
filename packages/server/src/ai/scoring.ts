/** What happened in one episode of one candidate. */
export interface EpisodeRecord {
  /** Targets in the episode. */
  targets: number;
  /** Targets reached. */
  reached: number;
  /** Frames flown (up to the time limit + 1). */
  frames: number;
  crashes: number;
  /**
   * ∫ (distance to the current target + |rotation speed|) dt, in unit-seconds: the original score.
   * After an episode-ending crash, the rest of the time limit is charged at the crash distance.
   */
  distance: number;
}

/** Weights of the score terms. The score is a weighted sum; lower is better. */
export interface ScoringWeights {
  /** Per unit-second of {@link EpisodeRecord.distance}. */
  distance: number;
  /** Per target missed. */
  success: number;
  /** Per second flown. */
  time: number;
  /** Per crash. */
  crashes: number;
}

/** The original evaluator (QuadraticSumOfDistanceToTargets): distance only. */
export const LEGACY_SCORING: Readonly<ScoringWeights> = { distance: 1, success: 0, time: 0, crashes: 0 };

export function parseScoring(raw: unknown): ScoringWeights {
  if (raw === undefined) return { ...LEGACY_SCORING };
  if (typeof raw !== "object" || raw === null) throw new Error("scoring must be an object of weights");
  const weights = { ...LEGACY_SCORING, distance: 0 };
  for (const [key, value] of Object.entries(raw)) {
    if (!(key in weights)) throw new Error(`unknown scoring term ${JSON.stringify(key)}`);
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
      throw new Error(`scoring.${key} must be a number ≥ 0`);
    weights[key as keyof ScoringWeights] = value;
  }
  return weights;
}

export function scoreEpisodes(
  records: readonly EpisodeRecord[],
  weights: ScoringWeights,
  tickSeconds: number,
): number {
  let score = 0;
  for (const r of records) {
    score +=
      weights.distance * r.distance +
      weights.success * (r.targets - r.reached) +
      weights.time * r.frames * tickSeconds +
      weights.crashes * r.crashes;
  }
  return score;
}

/** Share of all targets that were reached (0..1). */
export function successRate(records: readonly EpisodeRecord[]): number {
  let targets = 0;
  let reached = 0;
  for (const r of records) {
    targets += r.targets;
    reached += r.reached;
  }
  return targets === 0 ? 0 : reached / targets;
}

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
  /**
   * Distance flown towards the current target, in units: the sum over frames of the reduction in
   * distance to it (negative when flying away). Potential-based (Φ = −distance), so per target it
   * telescopes to start distance − end distance. Respawns and target switches do not count.
   */
  progress: number;
  /**
   * Turning done, in radians: ∫ |rotation speed| dt over the frames flown (not over the time charged
   * after an episode-ending crash). Full-rate spinning (5 rad/s) for a 9 s episode is 45 rad.
   */
  rotation: number;
  /** Frames actually flown (frames minus the time charged after an episode-ending crash). */
  flownFrames: number;
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
  /**
   * Reward per unit of {@link EpisodeRecord.progress} (subtracted from the score). Absent = 0, and
   * absent from configs that do not set it, so older results stay byte-identical.
   */
  progress?: number;
  /**
   * Cost per radian of {@link EpisodeRecord.rotation}: discourages constant spinning. Absent = 0, and
   * absent from configs that do not set it, so older results stay byte-identical.
   */
  rotation?: number;
}

/** The original evaluator (QuadraticSumOfDistanceToTargets): distance only. */
export const LEGACY_SCORING: Readonly<ScoringWeights> = { distance: 1, success: 0, time: 0, crashes: 0 };

export function parseScoring(raw: unknown): ScoringWeights {
  if (raw === undefined) return { ...LEGACY_SCORING };
  if (typeof raw !== "object" || raw === null) throw new Error("scoring must be an object of weights");
  const weights: ScoringWeights = { ...LEGACY_SCORING, distance: 0 };
  for (const [key, value] of Object.entries(raw)) {
    if (!(key in weights) && key !== "progress" && key !== "rotation")
      throw new Error(`unknown scoring term ${JSON.stringify(key)}`);
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
    if (weights.progress) score -= weights.progress * r.progress;
    if (weights.rotation) score += weights.rotation * r.rotation;
  }
  return score;
}

/**
 * How much of the time the ship turns at full rate, 0..1: the mean |turn output| over the frames
 * flown, i.e. rotation ÷ (maxRotationSpeed × seconds). A "spin and pulse" controller reads about 1.
 */
export function meanTurn(
  records: readonly EpisodeRecord[],
  tickSeconds: number,
  maxRotationSpeed: number,
): number {
  let rotation = 0;
  let frames = 0;
  for (const r of records) {
    rotation += r.rotation;
    frames += r.flownFrames;
  }
  return frames > 0 ? rotation / (maxRotationSpeed * frames * tickSeconds) : 0;
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

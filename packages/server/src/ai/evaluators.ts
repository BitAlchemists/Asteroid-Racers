import type { Entity } from "@ar/shared";
import type { RaceTargetTrainingScript } from "./scripts";

/** Scores one training flight; called every frame. Lower final scores are better. */
export interface Evaluator {
  evaluate(script: RaceTargetTrainingScript, dt: number): void;
  readonly finalScore: number;
}

/** Average over targets of the closest the ship ever got to each. */
export class LeastDistanceToTargetsEvaluator implements Evaluator {
  private readonly closest = new Map<Entity, number>();

  evaluate(script: RaceTargetTrainingScript, _dt: number): void {
    const target = script.currentTarget;
    const ship = script.client?.ship;
    if (!target || !ship) return;
    const distance = ship.position.distanceTo(target.position);
    this.closest.set(target, Math.min(distance, this.closest.get(target) ?? Infinity));
  }

  get finalScore(): number {
    if (this.closest.size === 0) return Infinity;
    let sum = 0;
    for (const d of this.closest.values()) sum += d;
    return sum / this.closest.size;
  }
}

/** ∫ distance-to-target dt. */
export class SumOfDistanceToTargetsEvaluator implements Evaluator {
  finalScore = 0;

  evaluate(script: RaceTargetTrainingScript, dt: number): void {
    const target = script.currentTarget;
    const ship = script.client?.ship;
    if (target && ship) this.finalScore += ship.position.distanceTo(target.position) * dt;
  }
}

/**
 * ∫ (distance-to-target + |rotation speed|) dt — the Dart default ("Quadratic" in name only).
 * Penalising spin discourages the lazy "pirouette towards the target" strategy.
 */
export class QuadraticSumOfDistanceToTargetsEvaluator implements Evaluator {
  finalScore = 0;

  evaluate(script: RaceTargetTrainingScript, dt: number): void {
    const target = script.currentTarget;
    const ship = script.client?.ship;
    if (!target || !ship) return;
    this.finalScore += (ship.position.distanceTo(target.position) + Math.abs(ship.rotationSpeed)) * dt;
  }
}

/** Total time spent (reaching targets fast is all that counts). */
export class TimeToTargetEvaluator implements Evaluator {
  finalScore = 0;

  evaluate(_script: RaceTargetTrainingScript, dt: number): void {
    this.finalScore += dt;
  }
}

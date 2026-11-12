import type { Movable } from "./movable";

/**
 * Explicit-Euler integrator. Rotation and translation are separate passes because the server applies
 * player input between them.
 */
export class PhysicsSimulator {
  private readonly movables: Movable[] = [];

  addMovable(movable: Movable): void {
    this.movables.push(movable);
  }

  removeMovable(movable: Movable): void {
    const index = this.movables.indexOf(movable);
    if (index !== -1) this.movables.splice(index, 1);
  }

  reset(): void {
    this.movables.length = 0;
  }

  get count(): number {
    return this.movables.length;
  }

  simulateRotation(dt: number): void {
    for (const movable of this.movables) {
      if (!movable.canMove) continue;
      movable.orientation += movable.rotationSpeed * dt;
    }
  }

  simulateTranslation(dt: number): void {
    for (const movable of this.movables) {
      if (!movable.canMove) continue;
      // Dart reassigned new vectors (`velocity += acceleration * dt`); keep that so nobody holding the
      // previous vector instance sees it change underneath them.
      movable.velocity = movable.velocity.plus(movable.acceleration.times(dt));
      movable.position = movable.position.plus(movable.velocity.times(dt));
      movable.updateRank += 1;
    }
  }
}

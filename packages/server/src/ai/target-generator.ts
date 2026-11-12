import { Checkpoint, CheckpointState, Vector2 } from "@ar/shared";
import type { IGameServer } from "../contracts";
import type { Random } from "../random";

/** Positions evenly spaced on a ring around `center`, each distance jittered by ±range. */
function ring(count: number, distance: number, range: number, center: Vector2, random: Random): Vector2[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const d = distance + (random() * 2 - 1) * range;
    return center.plus(new Vector2(Math.cos(angle) * d, Math.sin(angle) * d));
  });
}

function spawnTargets(
  server: IGameServer,
  positions: Vector2[],
  radius: number,
  random: Random,
): Checkpoint[] {
  return positions.map((position) => {
    const checkpoint = new Checkpoint({ position, radius, orientation: random() * Math.PI * 2 });
    checkpoint.state = CheckpointState.FUTURE;
    server.spawnEntity(checkpoint);
    return checkpoint;
  });
}

/** Training/demo target layouts, spawned into the server's world as checkpoints. */
export const TargetGenerator = {
  /** `count` targets on a ring (radius 800 ± 200 by default). */
  circle(
    server: IGameServer,
    random: Random,
    { center = Vector2.zero(), count = 20, distance = 800, range = 200, radius = 30 } = {},
  ): Checkpoint[] {
    return spawnTargets(server, ring(count, distance, range, center, random), radius, random);
  },

  /**
   * The training course ("flux compensator"): the center, then three targets on each of the rings at
   * 200, 400, 600, 800 and 1000 units — 16 targets of radius 30.
   */
  fluxCompensator(server: IGameServer, random: Random, center = Vector2.zero()): Checkpoint[] {
    const positions = [
      ...ring(1, 0, 0, center, random),
      ...[200, 400, 600, 800, 1000].flatMap((d) => ring(3, d, 0, center, random)),
    ];
    return spawnTargets(server, positions, 30, random);
  },

  /** Eight targets of radius 60 on a ring of 800 units. */
  demoRaceTrack(server: IGameServer, random: Random, center = Vector2.zero()): Checkpoint[] {
    return spawnTargets(server, ring(8, 800, 0, center, random), 60, random);
  },

  teardown(server: IGameServer, targets: Checkpoint[]): void {
    for (const target of targets) server.despawnEntity(target);
    targets.length = 0;
  },
};

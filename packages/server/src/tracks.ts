import type { Entity, World } from "@ar/shared";
import type { RaceController } from "./race-controller";
import type { Random } from "./random";
import { generateAsteroidBelt, SceneController } from "./scene-controller";

/** Asteroids of the `random` track keep this much room around the start and every checkpoint. */
const RANDOM_TRACK_CLEARANCE = 150;

/**
 * A race track: a world (asteroids, arrows) plus a race (portal, checkpoints, finish). `build` must
 * use only `random`, so a track is fully determined by its seed.
 */
export interface Track {
  readonly name: string;
  readonly description: string;
  build(world: World, race: RaceController, random: Random): void;
}

export const TRACKS: Readonly<Record<string, Track>> = {
  demo: {
    name: "demo",
    description: "Scene 2: the corridor race through four asteroid blocks that the game runs",
    build(world, race, random) {
      SceneController.createScene2(world, random);
      SceneController.createRace2(world, race);
    },
  },
  short: {
    name: "short",
    description: "Scene 1: start, one checkpoint and the finish, 600 units, asteroids to the sides",
    build(world, race, random) {
      SceneController.createScene1(world, random);
      SceneController.createRace1(world, race);
    },
  },
  random: {
    name: "random",
    description: "A random race (8 checkpoints, legs of 500–1000 units) in a light asteroid field",
    build(world, race, random) {
      SceneController.createRandomRace(world, race, random);
      const keepClear: Entity[] = [...race.checkpoints];
      if (race.finish) keepClear.push(race.finish);
      const rocks = generateAsteroidBelt(random, -4000, -4000, 8000, 8000, { densityFactor: 0.4 }).filter(
        (rock) =>
          !keepClear.some(
            (c) => c.position.distanceTo(rock.position) < c.radius + rock.radius + RANDOM_TRACK_CLEARANCE,
          ),
      );
      world.addEntities(rocks);
      world.passiveCollisionEntities.push(...rocks);
    },
  },
};

export function trackByName(name: string): Track {
  const track = TRACKS[name];
  if (!track)
    throw new Error(`unknown track ${JSON.stringify(name)}; known: ${Object.keys(TRACKS).join(", ")}`);
  return track;
}

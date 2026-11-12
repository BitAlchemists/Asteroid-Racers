import { Entity, EntityType, Vector2, type World } from "@ar/shared";
import type { RaceController } from "./race-controller";
import type { Random } from "./random";

/** Layout constants of scene 2 / race 2 (the demo configuration). */
const X_OFFSET = 250;
const BLOCK_LENGTH = 1000;
const CORRIDOR_WIDTH = 200;

/** 500 asteroids per 4000×4000 units. */
const DEFAULT_ASTEROID_DENSITY = 500 / (4000 * 4000);
const MIN_ASTEROID_RADIUS = 6;
const MAX_ASTEROID_RADIUS = 60;

/** World layouts. Ported from the Dart `SceneController`; scene/race 2 is what the server runs. */
export const SceneController = {
  /** Four asteroid blocks around a cross-shaped corridor system. */
  createScene2(world: World, random: Random): void {
    const asteroids = [
      ...generateAsteroidBelt(
        random,
        X_OFFSET,
        -BLOCK_LENGTH - CORRIDOR_WIDTH / 2,
        BLOCK_LENGTH,
        BLOCK_LENGTH,
      ),
      ...generateAsteroidBelt(random, X_OFFSET, CORRIDOR_WIDTH / 2, BLOCK_LENGTH, BLOCK_LENGTH),
      ...generateAsteroidBelt(
        random,
        X_OFFSET + BLOCK_LENGTH + CORRIDOR_WIDTH,
        -BLOCK_LENGTH - CORRIDOR_WIDTH / 2,
        BLOCK_LENGTH,
        BLOCK_LENGTH,
      ),
      ...generateAsteroidBelt(
        random,
        X_OFFSET + BLOCK_LENGTH + CORRIDOR_WIDTH,
        CORRIDOR_WIDTH / 2,
        BLOCK_LENGTH,
        BLOCK_LENGTH,
      ),
    ];
    addPassive(world, asteroids);
  },

  /** The race through the corridors of scene 2. */
  createRace2(world: World, race: RaceController): void {
    const arrow = (x: number, y: number, orientation: number) =>
      world.addEntity(createArrow(x, y, orientation));
    const right = X_OFFSET + BLOCK_LENGTH + CORRIDOR_WIDTH + BLOCK_LENGTH + CORRIDOR_WIDTH * 0.5;
    const center = X_OFFSET + BLOCK_LENGTH + CORRIDOR_WIDTH * 0.5;
    const left = X_OFFSET - CORRIDOR_WIDTH * 0.5;
    const down = BLOCK_LENGTH + CORRIDOR_WIDTH;

    // left
    race.addStart(left, 0, Math.PI * 1.5);
    arrow(X_OFFSET + CORRIDOR_WIDTH * 0.5, 0, Math.PI * 1.5);

    // center
    arrow(X_OFFSET + BLOCK_LENGTH - CORRIDOR_WIDTH * 1.5, 0, Math.PI * 1.5);
    arrow(X_OFFSET + BLOCK_LENGTH + CORRIDOR_WIDTH * 2.5, 0, Math.PI * 1.5);

    // right
    race.addCheckpoint(right, 0, 0);
    arrow(right, 0, 0);

    // down right
    race.addCheckpoint(right, down, Math.PI * 0.5);
    arrow(right, down, Math.PI * 0.5);

    // down
    race.addCheckpoint(center, down, Math.PI);
    arrow(center, down, Math.PI);

    // center
    arrow(center, CORRIDOR_WIDTH * 1.5, Math.PI);
    arrow(center, -CORRIDOR_WIDTH * 1.5, Math.PI);

    // top
    race.addCheckpoint(center, -down, Math.PI * 0.5);
    arrow(center, -down, Math.PI * 0.5);

    // top left
    race.addCheckpoint(left, -down, 0);
    arrow(left, -down, 0);

    race.addFinish(left, CORRIDOR_WIDTH, Math.PI);
    addRaceEntities(world, race);
  },

  createScene1(world: World, random: Random): void {
    const asteroids = [
      ...generateAsteroidBelt(random, -2000, 250, 4000, 4000),
      ...generateAsteroidBelt(random, -300, -100, 200, -1000, { count: 20 }),
      ...generateAsteroidBelt(random, 100, -100, 200, -1000, { count: 20 }),
      ...generateAsteroidBelt(random, -150, -1300, 300, -300, { count: 20 }),
    ];
    addPassive(world, asteroids);

    const arrow = (x: number, y: number, orientation: number) =>
      world.addEntity(createArrow(x, y, orientation));
    arrow(0, -400, Math.PI);
    arrow(0, -200, Math.PI);
    arrow(100, -1200, Math.PI * 1.25);
    arrow(-100, -1200, Math.PI * 0.75);
    arrow(150, -1700, Math.PI * 0.5);
    arrow(-150, -1700, Math.PI * 1.5);
  },

  createRace1(world: World, race: RaceController): void {
    race.addStart(0, -200, Math.PI);
    race.addCheckpoint(0, -600, Math.PI);
    race.addFinish(0, -800, Math.PI);
    addRaceEntities(world, race);
  },

  createSmallDensityField(world: World, random: Random): void {
    const size = 8000;
    addPassive(world, generateAsteroidBelt(random, -size / 2, -size / 2, size, size, { densityFactor: 0.4 }));
  },

  /** Start, 8 random checkpoints with guiding arrows, finish. */
  createRandomRace(world: World, race: RaceController, random: Random): void {
    const minDistance = 500;
    const maxDistance = 1000;
    const randomAngle = () => (random() * 2 - 1) * Math.PI * 0.5;

    let angle = randomAngle();
    let current: Entity = race.addStart(0, 0, angle);

    const nextLeg = () => {
      const direction = new Vector2(Math.cos(angle), Math.sin(angle));
      const arrowPos = current.position.plus(direction.scaled(200));
      world.addEntity(createArrow(arrowPos.x, arrowPos.y, angle));
      const distance = random() * (maxDistance - minDistance) + minDistance;
      const next = current.position.plus(direction.scaled(distance));
      angle += randomAngle();
      return next;
    };

    for (let i = 0; i < 8; i++) {
      const next = nextLeg();
      current = race.addCheckpoint(next.x, next.y, angle);
    }
    const finish = nextLeg();
    race.addFinish(finish.x, finish.y, angle);
    addRaceEntities(world, race);
  },
};

export function createArrow(x: number, y: number, orientation: number): Entity {
  return new Entity({ type: EntityType.ARROWS, position: new Vector2(x, y), orientation, radius: 100 });
}

/**
 * Uniformly scatters asteroids with random radii inside a rectangle so they don't poke out of it.
 * Width/height should be positive (negative values, used by scene 1, produce sloppy borders, as in Dart).
 */
export function generateAsteroidBelt(
  random: Random,
  x: number,
  y: number,
  width: number,
  height: number,
  { count, densityFactor = 1 }: { count?: number; densityFactor?: number } = {},
): Entity[] {
  const n = count ?? Math.trunc(width * height * DEFAULT_ASTEROID_DENSITY * densityFactor);
  const asteroids: Entity[] = [];
  for (let i = 0; i < n; i++) {
    const radius = random() * (MAX_ASTEROID_RADIUS - MIN_ASTEROID_RADIUS) + MIN_ASTEROID_RADIUS;
    const position = new Vector2(
      x + radius + random() * (width - 2 * radius),
      y + radius + random() * (height - 2 * radius),
    );
    asteroids.push(new Entity({ type: EntityType.ASTEROID, position, radius }));
  }
  return asteroids;
}

function addPassive(world: World, entities: Entity[]): void {
  world.addEntities(entities);
  world.passiveCollisionEntities.push(...entities);
}

function addRaceEntities(world: World, race: RaceController): void {
  world.addEntities(race.checkpoints);
  if (race.start) world.addEntity(race.start);
  if (race.finish) world.addEntity(race.finish);
}

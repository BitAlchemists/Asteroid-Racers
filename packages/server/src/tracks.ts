import type { Entity, World } from "@ar/shared";
import type { RaceController } from "./race-controller";
import type { Random } from "./random";
import { generateAsteroidBelt, SceneController } from "./scene-controller";
import { parseTrackFile, trackFromFile } from "./track-file";
import { generatedTrack, parseGeneratedTrackName, TRACK_BAND_NAMES } from "./track-generator";
import canyon from "./tracks/canyon.json";
import chicane from "./tracks/chicane.json";
import denseBelt from "./tracks/dense-belt.json";
import circuit from "./tracks/circuit.json";
import gateRow from "./tracks/gate-row.json";
import gauntlet from "./tracks/gauntlet.json";
import hairpins from "./tracks/hairpins.json";
import pitStop from "./tracks/pit-stop.json";
import slalom from "./tracks/slalom.json";
import straightToTurn from "./tracks/straight-to-turn.json";

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

/** The tracks built in code. The race exam flies these; they must not change (M4 compares runs on it). */
const CODE_TRACKS: Readonly<Record<string, Track>> = {
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

/**
 * Track files (`tracks/*.json`, format `asteroid-racers/track/v1`), bundled so the browser has them.
 * They are for the game and the watch page; the exam and training use only the tracks they name.
 */
const TRACK_FILES: Readonly<Record<string, unknown>> = {
  slalom,
  gauntlet,
  canyon,
  // M7 (S3): one challenge each.
  hairpins,
  "straight-to-turn": straightToTurn,
  "dense-belt": denseBelt,
  chicane,
  "gate-row": gateRow,
  circuit,
  "pit-stop": pitStop,
};

/** Builds the file tracks; throws if a file is invalid or its name doesn't match its file name. */
export function fileTracks(files: Readonly<Record<string, unknown>> = TRACK_FILES): Record<string, Track> {
  const tracks: Record<string, Track> = {};
  for (const [name, raw] of Object.entries(files)) {
    const file = parseTrackFile(raw, `tracks/${name}.json`);
    if (file.name !== name)
      throw new Error(`tracks/${name}.json: name ${JSON.stringify(file.name)} must match the file name`);
    if (name in CODE_TRACKS) throw new Error(`tracks/${name}.json: ${name} is already a code track`);
    tracks[name] = trackFromFile(file);
  }
  return tracks;
}

/**
 * Generated tracks (M7, track-generator.ts), one per difficulty band: `generated:easy`,
 * `generated:medium`, `generated:hard`; the world's seed decides the track. A fixed one is
 * `generated:<band>:<seed>` (resolved by {@link trackByName}, not listed).
 */
const GENERATED_TRACKS: Readonly<Record<string, Track>> = Object.fromEntries(
  TRACK_BAND_NAMES.map((band) => [`generated:${band}`, generatedTrack(band)]),
);

/**
 * Every track: the code tracks first, then the file tracks, then the generated ones (the order the
 * game's picker shows).
 */
export const TRACKS: Readonly<Record<string, Track>> = {
  ...CODE_TRACKS,
  ...fileTracks(),
  ...GENERATED_TRACKS,
};

export function trackByName(name: string): Track {
  const track = TRACKS[name] ?? parseGeneratedTrackName(name);
  if (!track)
    throw new Error(`unknown track ${JSON.stringify(name)}; known: ${Object.keys(TRACKS).join(", ")}`);
  return track;
}

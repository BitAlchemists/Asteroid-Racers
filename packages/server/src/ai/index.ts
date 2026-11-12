import { Vector2 } from "@ar/shared";
import { GameServer } from "../game-server";
import { seededRandom, type Random } from "../random";
import { MemoryBrainStore, type BrainStore } from "./brain-store";
import defaultBrain from "./brains/default-brain.json";
import { DemoDirector, TrainingDirector, type GenerationReport } from "./directors";
import { QuadraticSumOfDistanceToTargetsEvaluator } from "./evaluators";
import { mutateRelative, type MajorTom, type NetworkJson } from "./network";
import { RaceTargetScript, RespawnTargetTrainingScript } from "./scripts";
import { TargetGenerator } from "./target-generator";

export * from "./ai-game-client";
export * from "./brain-store";
export * from "./directors";
export * from "./evaluators";
export * from "./network";
export * from "./scripts";
export * from "./target-generator";
export * from "./target-vehicle-controller";

/** Name the Dart trainer used for its default brain (kept so old `db/` folders still match). */
export const DEFAULT_BRAIN_NAME = "QuadraticSumOfDistanceToTargets_4_10_8_6_4_2";
/** inputs: target angle, target distance, velocity angle, speed → outputs: thrust, turn rate */
export const DEFAULT_LAYOUT = [4, 10, 8, 6, 4, 2] as const;

// Training configuration (Dart defaults).
export const AI_TRAINING_SAMPLE_SIZE = 100;
/** 9 s per target at the 15 ms tick. */
export const AI_TRAINING_FRAMES = Math.trunc(9000 / 15);
export const MUTATION_RATE = 0.1;
export const MUTATION_STRENGTH = 1;

/** The brain that ships with the game, so racing bots work without training first. */
export function bundledBrains(): MemoryBrainStore {
  return new MemoryBrainStore({ [DEFAULT_BRAIN_NAME]: [defaultBrain as NetworkJson] });
}

/** Racing bots in a live server (what the Dart tcp_server registered). */
export function registerAIRacingService(
  server: GameServer,
  store: BrainStore = bundledBrains(),
  { networkName = DEFAULT_BRAIN_NAME, bots = 1, delaySeconds = 5 } = {},
): DemoDirector {
  const director = new DemoDirector(networkName, store);
  for (let i = 0; i < bots; i++) {
    const name = bots === 1 ? "Major Tom" : `Major Tom ${i + 1}`;
    director.scriptFactories.push((network) => new RaceTargetScript(network, delaySeconds, name));
  }
  server.registerService(director);
  return director;
}

/** Demo of the training course and a ring track placed into a live world (Dart registerAIDemoService). */
export function registerAIDemoService(
  server: GameServer,
  store: BrainStore = bundledBrains(),
  networkName = DEFAULT_BRAIN_NAME,
): DemoDirector {
  const director = new DemoDirector(networkName, store);
  const center = new Vector2(-300, -600);
  const course = TargetGenerator.fluxCompensator(server, server.random, center);
  director.scriptFactories.push(
    (network) =>
      new RespawnTargetTrainingScript(network, course, new QuadraticSumOfDistanceToTargetsEvaluator(), {
        spawn: center,
        maxFramesPerTarget: AI_TRAINING_FRAMES,
      }),
  );
  server.registerService(director);
  return director;
}

/**
 * A headless server for training: empty world, no entity broadcast throttling noise (bots get their
 * own ship every tick instead), seeded for reproducible courses.
 */
export function createTrainingServer(seed = 1): GameServer {
  return new GameServer({ random: seededRandom(seed), entityUpdatesPerTick: 0, sendOwnShipEveryTick: true });
}

export interface TrainingServiceOptions {
  store: BrainStore;
  networkName?: string;
  layout?: readonly number[];
  sampleSize?: number;
  framesPerTarget?: number;
  maxGenerations?: number;
  random?: Random;
  onGeneration?: (report: GenerationReport) => void;
}

/** Evolves brains on the training course around the origin (Dart registerAITrainingService). */
export function registerAITrainingService(
  server: GameServer,
  options: TrainingServiceOptions,
): TrainingDirector {
  const random = options.random ?? server.random;
  const course = TargetGenerator.fluxCompensator(server, random);
  const framesPerTarget = options.framesPerTarget ?? AI_TRAINING_FRAMES;
  const director = new TrainingDirector({
    store: options.store,
    networkName: options.networkName ?? DEFAULT_BRAIN_NAME,
    layout: options.layout ?? DEFAULT_LAYOUT,
    sampleSize: options.sampleSize ?? AI_TRAINING_SAMPLE_SIZE,
    random,
    ...(options.maxGenerations === undefined ? {} : { maxGenerations: options.maxGenerations }),
    ...(options.onGeneration === undefined ? {} : { onGeneration: options.onGeneration }),
    mutate: (network: MajorTom, rnd: Random) =>
      network.mutate(MUTATION_RATE, MUTATION_STRENGTH, mutateRelative, rnd),
    scriptFactory: (network) =>
      new RespawnTargetTrainingScript(network, course, new QuadraticSumOfDistanceToTargetsEvaluator(), {
        spawn: Vector2.zero(),
        maxFramesPerTarget: framesPerTarget,
      }),
  });
  server.registerService(director);
  return director;
}

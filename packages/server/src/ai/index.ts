import { Vector2 } from "@ar/shared";
import type { CollisionMode } from "../contracts";
import { GameServer } from "../game-server";
import { seededRandom, type Random } from "../random";
import type { CrashMode } from "./arena-script";
import { legacyArena, resolveArenas, type ArenaConfig } from "./arenas";
import { MemoryModelStore, type ModelStore } from "./model-store";
import { DEFAULT_HIDDEN, layoutFor, LEGACY_SPEC, type ModelSpec } from "./model-spec";
import defaultModel from "./models/default-model.json";
import { DemoDirector, TrainingDirector, type GenerationReport } from "./directors";
import { QuadraticSumOfDistanceToTargetsEvaluator } from "./evaluators";
import { mutateRelative, type MajorTom, type NetworkJson } from "./network";
import type { ScoringWeights } from "./scoring";
import { RaceTargetScript, RespawnTargetTrainingScript } from "./scripts";
import { TargetGenerator } from "./target-generator";

export * from "./ai-game-client";
export * from "./arena-script";
export * from "./arenas";
export * from "./scoring";
export * from "./trace";
export * from "./model-store";
export * from "./model-spec";
export * from "./directors";
export * from "./exam";
export * from "./replay";
export * from "./evaluators";
export * from "./network";
export * from "./obstacle-grid";
export * from "./scripts";
export * from "./target-generator";
export * from "./target-vehicle-controller";

/** Name the Dart trainer used for its default model (kept so old `db/` folders still match). */
export const DEFAULT_MODEL_NAME = "QuadraticSumOfDistanceToTargets_4_10_8_6_4_2";
/** inputs: target angle, target distance, velocity angle, speed → outputs: thrust, turn rate */
export const DEFAULT_LAYOUT = [4, 10, 8, 6, 4, 2] as const;

// Training configuration (Dart defaults).
export const AI_TRAINING_SAMPLE_SIZE = 100;
/** 9 s per target at the 15 ms tick. */
export const AI_TRAINING_FRAMES = Math.trunc(9000 / 15);
export const MUTATION_RATE = 0.1;
export const MUTATION_STRENGTH = 1;

/** The model that ships with the game, so racing bots work without training first. */
export function bundledModels(): MemoryModelStore {
  return new MemoryModelStore({ [DEFAULT_MODEL_NAME]: [defaultModel as NetworkJson] });
}

/** Racing bots in a live server (what the Dart tcp_server registered). */
export function registerAIRacingService(
  server: GameServer,
  store: ModelStore = bundledModels(),
  { networkName = DEFAULT_MODEL_NAME, bots = 1, delaySeconds = 5 } = {},
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
  store: ModelStore = bundledModels(),
  networkName = DEFAULT_MODEL_NAME,
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
  store: ModelStore;
  networkName?: string;
  /** Inputs, hidden layers and outputs of new models (default: the original 4-10-8-6-4-2 model). */
  model?: { spec?: ModelSpec; hidden?: readonly number[] };
  sampleSize?: number;
  /** Default `frames` param for every arena (frames per target in `legacy`, per episode elsewhere). */
  framesPerTarget?: number;
  /** Chance that a single weight mutates (default 0.1). */
  mutationRate?: number;
  /** Relative size of a weight mutation (default 1 = up to ±100 %). */
  mutationStrength?: number;
  maxGenerations?: number;
  /** Number of the first generation (default 1; a resumed run passes g + 1). */
  firstGeneration?: number;
  /** Drives mutation and the first random models. Pass a seeded one for reproducible training. */
  random?: Random;
  /** Default: the original course only. */
  arenas?: readonly ArenaConfig[];
  /** Seed the scenarios are derived from (default 1). */
  scenarioSeed?: number;
  /** Held-out scenarios per arena (default 0). */
  heldOut?: number;
  /** Default: the original evaluator (distance only). */
  scoring?: ScoringWeights;
  /** Default `none` (ghosts). */
  collisions?: CollisionMode;
  /** Default `end`. */
  crashMode?: CrashMode;
  onGeneration?: (report: GenerationReport) => void;
}

/** Evolves models on the given arenas (by default the original course, like Dart registerAITrainingService). */
export function registerAITrainingService(
  server: GameServer,
  options: TrainingServiceOptions,
): TrainingDirector {
  const random = options.random ?? server.random;
  const frames = options.framesPerTarget ?? AI_TRAINING_FRAMES;
  const mutationRate = options.mutationRate ?? MUTATION_RATE;
  const mutationStrength = options.mutationStrength ?? MUTATION_STRENGTH;
  const spec = options.model?.spec ?? LEGACY_SPEC;
  const arenas = resolveArenas(options.arenas ?? [{ name: legacyArena.name }], frames);
  const director = new TrainingDirector({
    store: options.store,
    networkName: options.networkName ?? DEFAULT_MODEL_NAME,
    layout: layoutFor(spec, options.model?.hidden ?? DEFAULT_HIDDEN),
    spec,
    sampleSize: options.sampleSize ?? AI_TRAINING_SAMPLE_SIZE,
    random,
    arenas,
    scenarioSeed: options.scenarioSeed ?? 1,
    ...(options.heldOut === undefined ? {} : { heldOut: options.heldOut }),
    ...(options.scoring === undefined ? {} : { scoring: options.scoring }),
    ...(options.collisions === undefined ? {} : { collisions: options.collisions }),
    ...(options.crashMode === undefined ? {} : { crashMode: options.crashMode }),
    ...(options.firstGeneration === undefined ? {} : { firstGeneration: options.firstGeneration }),
    ...(options.maxGenerations === undefined ? {} : { maxGenerations: options.maxGenerations }),
    ...(options.onGeneration === undefined ? {} : { onGeneration: options.onGeneration }),
    mutate: (network: MajorTom, rnd: Random) =>
      network.mutate(mutationRate, mutationStrength, mutateRelative, rnd),
  });
  server.registerService(director);
  return director;
}

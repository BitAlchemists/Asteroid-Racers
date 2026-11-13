/**
 * evo-lab worker (protocol v1) for the `train` method: runs the neuro-evolution trainer for one run
 * and reports through RUN_DIR/events.jsonl. See lab.config.json and evo-lab's docs/protocol.md.
 *
 *   node --import tsx packages/node/src/lab-train.ts --config config.json --seed N --out RUN_DIR
 *        --root ROOT [--resume] [--every K] [--to G]
 *
 * Generations are 1-based; a fresh run has completed generation 0; `--to G` includes G.
 * Exact resume: the checkpoint holds the winner and both random generators, so resuming from g and
 * running to G gives a result.json byte-identical to an uninterrupted run to G.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setImmediate as yieldToEventLoop } from "node:timers/promises";
import { parseArgs } from "node:util";
import { Level, setLogLevel } from "@ar/shared";
import {
  atomicWrite,
  atomicWriteSync,
  dependencyVersions as dependencyVersions_,
  eventLog,
  PROTOCOL,
} from "./lab-common";
import {
  AI_TRAINING_FRAMES,
  AI_TRAINING_SAMPLE_SIZE,
  DEFAULT_MODEL_NAME,
  ENCODINGS,
  GameServer,
  lookaheadInputs,
  ManualGameLoop,
  MemoryModelStore,
  MUTATION_RATE,
  MUTATION_STRENGTH,
  MajorTom,
  registerAITrainingService,
  seededRandom,
  parseArenas,
  parseCurriculum,
  applyLevel,
  type CurriculumConfig,
  parseModelConfig,
  parseSensors,
  parseExamConfig,
  examPerception,
  plainExam,
  runExam,
  type ExamConfig,
  parseScoring,
  type ArenaConfig,
  type CollisionMode,
  type CrashMode,
  type GenerationReport,
  type NetworkJson,
  type ScoringWeights,
} from "@ar/server";

const CHECKPOINT = "ckpt.json";
const CHECKPOINT_FORMAT = "asteroid-racers/train-ckpt/v2";
/** What `stateHash` on gen events is computed from (evo-lab's baseline gate compares it per generation). */
const STATE_HASH_REPR = "asteroid-racers/state-v1";
/** Format of the per-generation winner files in RUN_DIR/gens/ (read by the exam method). */
export const SNAPSHOT_FORMAT = "asteroid-racers/model-snapshot/v1";
/** Generations to run when the run has no `--to`. */
const DEFAULT_GENERATIONS = 200;

export interface TrainConfig {
  sample: number;
  /** Default `frames` param of every arena (per target in `legacy`, per episode elsewhere). */
  frames: number;
  mutationRate: number;
  mutationStrength: number;
  /** Used only when the runner gives no --to. */
  generations: number;
  /** Inputs, hidden layers and outputs of new models. */
  model: { inputs: string[]; hidden: number[]; outputs: string };
  /** Every candidate flies every arena, in order. */
  arenas: ArenaConfig[];
  scoring: ScoringWeights;
  collisions: CollisionMode;
  crashMode: CrashMode;
  /** Held-out scenarios per arena, flown by each winner only. */
  heldOut: number;
  /** Save the winner as RUN_DIR/gens/gNNNN.json every this many generations (and always the last). 0 = only the last. */
  snapshotEvery: number;
  /**
   * Switch: obstacle sensors appended to the model's inputs (`{ whiskers: { count, spread, range },
   * sectors, nearest, lineCheck }`, with defaults filled in). Absent = none.
   */
  sensors?: Record<string, Record<string, number>>;
  /** Switch: hidden layer sizes overriding `model.hidden`. Absent = the model's own. */
  hidden?: number[];
  /** Switch: a named input set (`v2`: smooth angles, ship-frame velocity) replacing `model.inputs`. */
  encoding?: string;
  /**
   * Switch: lookahead inputs for the next 1 or 2 legs after the current target (`next2*`, `next3*`:
   * present, sin, cos, soft length), appended to the model's inputs. Absent = none.
   */
  lookahead?: number;
  /**
   * Switch: every bot sees its inputs this many controller steps late (a ring buffer; 4 ≈ 66 ms at
   * the 15 ms tick), reset at each episode start. Absent or 0 = none.
   */
  inputDelay?: number;
  /**
   * Switch: Gaussian noise (this standard deviation) on every input the network sees, from its own
   * stream per (seed, round, generation, scenario), the same for every candidate. Absent or 0 = none.
   */
  inputNoise?: number;
  /** Switch: Gaussian mutation (add N(0, sigma²) with probability `rate`, default `mutationRate`). */
  mutation?: { kind: "gaussian"; sigma: number; rate?: number };
  /** Switch: models kept per generation, best first ((μ + λ) selection). Absent = 1. */
  parents?: number;
  /**
   * Switch (needs `parents` ≥ 2): with probability `rate` a child is its parent crossed with
   * another parent (`uniform`: per weight, `layer`: per whole layer), then mutated. Absent = none.
   */
  crossover?: { kind: "uniform" | "layer"; rate: number };
  /** Switch: range of the random starting weights. Absent = 1. */
  initRange?: number;
  /**
   * Switch: with `crashMode: "respawn"`, an episode ends at its N-th crash and the rest is charged
   * like an `end` crash (at the crash distance). With `end` it changes nothing. Absent = no limit.
   */
  crashLimit?: number;
  /**
   * Switch: a staged curriculum over `arenas` (`{ levels, success, streak }`, defaults filled in):
   * a clear line of sight first, more rocks as the winner gets good. Absent = always `arenas`.
   */
  curriculum?: CurriculumConfig;
  /**
   * Switch: the best `top` candidates plus the previous parents fly about `episodes` extra fresh
   * scenarios; the winner and the kept parents follow the sum of both rounds. Absent = off.
   */
  reevaluate?: { top: number; episodes: number };
  /**
   * Switch: every `every` generations (and at the last), the winner flies the race exam; its
   * metrics go on that generation's `gen` event. The rest is an exam config (defaults filled in).
   */
  exam?: ExamConfig & { every: number };
}

interface Checkpoint {
  format: typeof CHECKPOINT_FORMAT;
  g: number;
  seed: number;
  config: TrainConfig;
  winner: NetworkJson | null;
  /** All kept models, best first; only with the `parents` switch (else the winner alone). */
  parents?: NetworkJson[];
  /** Where the curriculum stands for the next generation; only with the `curriculum` switch. */
  curriculum?: { level: number; streak: number };
  bestScore: number | null;
  rng: { mutation: number; server: number };
}

const { values } = parseArgs({
  strict: false, // ignore unknown arguments: the protocol may grow
  options: {
    config: { type: "string" },
    seed: { type: "string" },
    out: { type: "string" },
    root: { type: "string" },
    resume: { type: "boolean" },
    every: { type: "string" },
    to: { type: "string" },
  },
});

const runDir = resolve(String(values.out ?? process.env.LAB_RUN_DIR ?? "."));
/** Project root: --root, LAB_ROOT, or three levels up from this file. Inputs are resolved against it. */
const projectRoot = resolve(
  String(values.root ?? process.env.LAB_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "../../..")),
);

const emit = eventLog(runDir);
const dependencyVersions = () => dependencyVersions_(projectRoot, { trainer: CHECKPOINT_FORMAT });

function intArg(value: unknown, name: string, min: number): number | undefined {
  if (value === undefined || value === true) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min)
    throw new Error(`--${name} must be an integer ≥ ${min}, got ${String(value)}`);
  return n;
}

function oneOf<T extends string>(value: unknown, name: string, allowed: readonly T[], fallback: T): T {
  if (value === undefined) return fallback;
  if (!allowed.includes(value as T))
    throw new Error(`config.${name} must be one of ${allowed.join(", ")}, got ${JSON.stringify(value)}`);
  return value as T;
}

function parseTrainingExam(raw: unknown): ExamConfig & { every: number } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    throw new Error("config.exam must be an object ({ every, ...exam config })");
  const { every = 10, ...exam } = raw as Record<string, unknown>;
  if (!Number.isInteger(every) || (every as number) < 1)
    throw new Error("config.exam.every must be an integer ≥ 1");
  return { every: every as number, ...parseExamConfig(exam) };
}

function parseMutation(raw: unknown): { kind: "gaussian"; sigma: number; rate?: number } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    throw new Error('config.mutation must be an object ({ kind: "gaussian", sigma, rate? })');
  const { kind, sigma = 0.2, rate, ...rest } = raw as Record<string, unknown>;
  if (Object.keys(rest).length > 0)
    throw new Error(`unknown config.mutation keys ${Object.keys(rest).join(", ")}`);
  if (kind !== "gaussian") throw new Error('config.mutation.kind must be "gaussian"');
  if (typeof sigma !== "number" || !(sigma > 0))
    throw new Error("config.mutation.sigma must be a number > 0");
  if (rate !== undefined && (typeof rate !== "number" || !(rate > 0 && rate <= 1)))
    throw new Error("config.mutation.rate must be in (0, 1]");
  return { kind, sigma, ...(rate === undefined ? {} : { rate }) };
}

function parseCrossover(raw: unknown): { kind: "uniform" | "layer"; rate: number } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    throw new Error('config.crossover must be an object ({ kind: "uniform" | "layer", rate? })');
  const { kind, rate = 0.5, ...rest } = raw as Record<string, unknown>;
  if (Object.keys(rest).length > 0)
    throw new Error(`unknown config.crossover keys ${Object.keys(rest).join(", ")}`);
  if (kind !== "uniform" && kind !== "layer")
    throw new Error('config.crossover.kind must be "uniform" or "layer"');
  if (typeof rate !== "number" || !(rate >= 0 && rate <= 1))
    throw new Error("config.crossover.rate must be in [0, 1]");
  return { kind, rate };
}

function parseReevaluate(raw: unknown): { top: number; episodes: number } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    throw new Error("config.reevaluate must be an object ({ top?, episodes? })");
  const { top = 5, episodes = 24, ...rest } = raw as Record<string, unknown>;
  if (Object.keys(rest).length > 0)
    throw new Error(`unknown config.reevaluate keys ${Object.keys(rest).join(", ")}`);
  if (!Number.isInteger(top) || (top as number) < 1)
    throw new Error("config.reevaluate.top must be an integer ≥ 1");
  if (!Number.isInteger(episodes) || (episodes as number) < 1)
    throw new Error("config.reevaluate.episodes must be an integer ≥ 1");
  return { top: top as number, episodes: episodes as number };
}

function readConfig(): TrainConfig {
  const file = values.config === undefined ? undefined : resolve(runDir, String(values.config));
  const raw =
    file && existsSync(file)
      ? (JSON.parse(readFileSync(file, "utf8")) as Partial<Record<keyof TrainConfig, unknown>>)
      : {};
  // `brain` is the key's old name (runs before the rename); `model` wins if both are given.
  const model = parseModelConfig(raw.model ?? (raw as { brain?: unknown }).brain);
  const config: TrainConfig = {
    sample: (raw.sample as number | undefined) ?? AI_TRAINING_SAMPLE_SIZE,
    frames: (raw.frames as number | undefined) ?? AI_TRAINING_FRAMES,
    mutationRate: (raw.mutationRate as number | undefined) ?? MUTATION_RATE,
    mutationStrength: (raw.mutationStrength as number | undefined) ?? MUTATION_STRENGTH,
    generations: (raw.generations as number | undefined) ?? DEFAULT_GENERATIONS,
    model: { inputs: model.spec.inputs, hidden: model.hidden, outputs: model.spec.outputs },
    arenas: parseArenas(raw.arenas),
    scoring: parseScoring(raw.scoring),
    collisions: oneOf(raw.collisions, "collisions", ["none", "obstacles", "all"] as const, "none"),
    crashMode: oneOf(raw.crashMode, "crashMode", ["end", "respawn"] as const, "end"),
    heldOut: (raw.heldOut as number | undefined) ?? 0,
    snapshotEvery: (raw.snapshotEvery as number | undefined) ?? 1,
    // Switches: present only when set, so a config without them is exactly the baseline's.
    ...(raw.sensors === undefined
      ? {}
      : {
          sensors: Object.fromEntries(
            parseSensors(raw.sensors).map(({ type, ...params }) => [type, params as Record<string, number>]),
          ),
        }),
    ...(raw.hidden === undefined ? {} : { hidden: raw.hidden as number[] }),
    ...(raw.exam === undefined ? {} : { exam: parseTrainingExam(raw.exam) }),
    ...(raw.encoding === undefined ? {} : { encoding: raw.encoding as string }),
    ...(raw.lookahead === undefined ? {} : { lookahead: raw.lookahead as number }),
    ...(raw.inputDelay === undefined ? {} : { inputDelay: raw.inputDelay as number }),
    ...(raw.inputNoise === undefined ? {} : { inputNoise: raw.inputNoise as number }),
    ...(raw.mutation === undefined ? {} : { mutation: parseMutation(raw.mutation) }),
    ...(raw.parents === undefined ? {} : { parents: raw.parents as number }),
    ...(raw.crossover === undefined ? {} : { crossover: parseCrossover(raw.crossover) }),
    ...(raw.initRange === undefined ? {} : { initRange: raw.initRange as number }),
    ...(raw.crashLimit === undefined ? {} : { crashLimit: raw.crashLimit as number }),
    ...(raw.reevaluate === undefined ? {} : { reevaluate: parseReevaluate(raw.reevaluate) }),
    ...(raw.curriculum === undefined
      ? {}
      : { curriculum: parseCurriculum(raw.curriculum, parseArenas(raw.arenas)) }),
  };
  if (config.encoding !== undefined) {
    if (typeof config.encoding !== "string" || !(config.encoding in ENCODINGS))
      throw new Error(`config.encoding must be one of ${Object.keys(ENCODINGS).join(", ")}`);
    const given = (raw.model as { inputs?: unknown } | undefined)?.inputs;
    if (given !== undefined) throw new Error("config.encoding and config.model.inputs cannot both be set");
  }
  if (config.lookahead !== undefined) lookaheadInputs(config.lookahead); // throws when out of range
  if (config.inputDelay !== undefined && (!Number.isInteger(config.inputDelay) || config.inputDelay < 0))
    throw new Error("config.inputDelay must be an integer ≥ 0");
  if (config.inputNoise !== undefined && (typeof config.inputNoise !== "number" || !(config.inputNoise >= 0)))
    throw new Error("config.inputNoise must be a number ≥ 0");
  if (
    config.parents !== undefined &&
    (!Number.isInteger(config.parents) ||
      config.parents < 1 ||
      config.parents >= config.sample ||
      (config.sample - config.parents) % config.parents !== 0)
  )
    throw new Error("config.parents must be an integer ≥ 1 that divides sample − parents");
  if (config.crossover !== undefined && (config.parents ?? 1) < 2)
    throw new Error("config.crossover needs config.parents ≥ 2");
  if (config.initRange !== undefined && (typeof config.initRange !== "number" || !(config.initRange > 0)))
    throw new Error("config.initRange must be a number > 0");
  if (config.crashLimit !== undefined && (!Number.isInteger(config.crashLimit) || config.crashLimit < 1))
    throw new Error("config.crashLimit must be an integer ≥ 1");
  if (
    config.hidden !== undefined &&
    (!Array.isArray(config.hidden) || !config.hidden.every((n) => Number.isInteger(n) && n >= 1))
  )
    throw new Error("config.hidden must be a list of layer sizes ≥ 1");
  if (!Number.isInteger(config.heldOut) || config.heldOut < 0)
    throw new Error("config.heldOut must be an integer ≥ 0");
  if (!Number.isInteger(config.snapshotEvery) || config.snapshotEvery < 0)
    throw new Error("config.snapshotEvery must be an integer ≥ 0");
  if (!Number.isInteger(config.sample) || config.sample < 2)
    throw new Error("config.sample must be an integer ≥ 2");
  if (!Number.isInteger(config.frames) || config.frames < 1)
    throw new Error("config.frames must be an integer ≥ 1");
  if (!(config.mutationRate >= 0 && config.mutationRate <= 1))
    throw new Error("config.mutationRate must be in [0, 1]");
  if (!(config.mutationStrength >= 0)) throw new Error("config.mutationStrength must be ≥ 0");
  return config;
}

async function main(): Promise<void> {
  setLogLevel("", Level.WARNING);

  const config = readConfig();
  const seed = intArg(values.seed, "seed", 0) ?? 1;
  const to = intArg(values.to, "to", 1) ?? config.generations;
  const every = intArg(values.every, "every", 1) ?? 1;
  const resuming = values.resume === true && existsSync(join(runDir, CHECKPOINT));

  let saved: Checkpoint | undefined;
  if (resuming) {
    saved = JSON.parse(readFileSync(join(runDir, CHECKPOINT), "utf8")) as Checkpoint;
    if (saved.format !== CHECKPOINT_FORMAT)
      throw new Error(`unknown checkpoint format ${String(saved.format)}`);
    if (saved.seed !== seed) throw new Error(`checkpoint was written for seed ${saved.seed}, not ${seed}`);
  }

  emit("hello", {
    protocol: PROTOCOL,
    method: "train",
    run: process.env.LAB_RUN_ID ?? null,
    attempt: Number(process.env.LAB_ATTEMPT ?? 1),
    config,
    seed,
    resume: resuming,
    to,
    pid: process.pid,
    imports: [],
    versions: dependencyVersions(),
  });

  // Same construction order as a fresh run, so the course is identical; then restore the generators.
  const serverRandom = seededRandom(seed);
  const mutationRandom = seededRandom(seed + 1);
  const server = new GameServer({
    random: serverRandom,
    entityUpdatesPerTick: 0,
    sendOwnShipEveryTick: true,
  });
  const store = new MemoryModelStore();
  if (saved?.parents)
    store.save(
      DEFAULT_MODEL_NAME,
      saved.parents.map((p) => MajorTom.fromJson(p)),
    );
  else if (saved?.winner) store.save(DEFAULT_MODEL_NAME, [MajorTom.fromJson(saved.winner)]);

  const startG = saved?.g ?? 0;
  let g = startG;
  let bestScore = saved?.bestScore ?? null;
  let winner: MajorTom | undefined = saved?.winner ? MajorTom.fromJson(saved.winner) : undefined;
  /** Kept models after the last generation (only tracked with the `parents` switch). */
  let parents: NetworkJson[] | undefined = saved?.parents;
  /** Curriculum level and streak for the next generation (only with the `curriculum` switch). */
  let curriculum: { level: number; streak: number } | undefined = config.curriculum
    ? (saved?.curriculum ?? { level: 0, streak: 0 })
    : undefined;
  let genStartWall = performance.now();
  let genStartCpu = process.cpuUsage();
  let genStartFrame = 0;
  const pending: Promise<void>[] = [];
  /** Exams, gen events and checkpoint writes happen in generation order, after the generation. */
  let chain: Promise<void> = Promise.resolve();

  /** The checkpoint content, taken at once: both generators are where the next generation starts. */
  const checkpointNow = (): Checkpoint => ({
    format: CHECKPOINT_FORMAT,
    g,
    seed,
    config,
    winner: winner ? winner.toJson() : null,
    ...(parents === undefined ? {} : { parents }),
    ...(curriculum === undefined ? {} : { curriculum }),
    bestScore,
    rng: { mutation: mutationRandom.state, server: serverRandom.state },
  });
  const writeCheckpoint = async (ckpt: Checkpoint): Promise<void> => {
    await atomicWrite(join(runDir, CHECKPOINT), JSON.stringify(ckpt));
    emit("checkpoint", { g: ckpt.g });
  };

  const onGeneration = (report: GenerationReport): void => {
    g = report.generation;
    winner = report.winner;
    bestScore = report.bestScore;
    if (config.parents !== undefined) parents = report.parents.map((p) => p.toJson());
    const flownLevel = report.curriculum?.level;
    if (report.curriculum)
      curriculum = { level: report.curriculum.nextLevel, streak: report.curriculum.streak };
    const cpu = process.cpuUsage(genStartCpu);
    const wall = (performance.now() - genStartWall) / 1000;
    const cpuSec = (cpu.user + cpu.system) / 1e6;
    // Game ticks of this generation (candidates and held-out; the exam runs its own server).
    const ticks = server.frameCount - genStartFrame;
    let snapshot: string | undefined;
    if (g === to || (config.snapshotEvery > 0 && g % config.snapshotEvery === 0)) {
      snapshot = `gens/g${String(g).padStart(4, "0")}.json`;
      mkdirSync(join(runDir, "gens"), { recursive: true });
      atomicWriteSync(
        join(runDir, snapshot),
        JSON.stringify({
          format: SNAPSHOT_FORMAT,
          g,
          score: report.bestScore,
          model: report.winner.toJson(),
          trace: report.trace,
          // With a curriculum, the arenas this generation flew, so a replay builds the same scenarios.
          ...(config.curriculum && flownLevel !== undefined
            ? {
                arenas:
                  report.trainingArenas ?? applyLevel(config.arenas, config.curriculum.levels[flownLevel]!),
              }
            : {}),
        }),
      );
    }
    const metrics: Record<string, number | undefined> = {
      score: report.bestScore,
      mean: report.meanScore,
      worst: report.worstScore,
      success: report.success,
      ...(report.heldOutScore === undefined
        ? {}
        : { heldOut: report.heldOutScore, heldOutSuccess: report.heldOutSuccess }),
      ...(flownLevel === undefined ? {} : { level: flownLevel }),
      ...(report.reevaluation === undefined
        ? {}
        : { reevalScore: report.reevaluation.score, reevalSuccess: report.reevaluation.success }),
      // Speed (timing data: never in result.json or stateHash).
      ticks,
      tps: wall > 0 ? Math.round(ticks / wall) : undefined,
    };
    // The full training state after this generation: the winner (exact doubles in JSON), its score and
    // both generators. Equal hashes per generation = the same run (evo-lab's baseline gate).
    const stateHash = createHash("sha256")
      .update(
        JSON.stringify({
          winner: report.winner.toJson(),
          ...(parents === undefined ? {} : { parents }),
          ...(curriculum === undefined ? {} : { curriculum }),
          bestScore: report.bestScore,
          rng: { mutation: mutationRandom.state, server: serverRandom.state },
        }),
      )
      .digest("hex");
    const genEvent = {
      g,
      stateHash,
      stateHashRepr: STATE_HASH_REPR,
      metrics,
      phases: { simulate: { wall, cpu: cpuSec } } as Record<string, { wall: number; cpu: number }>,
      cpuSec,
      rssMiB: Math.round(process.memoryUsage().rss / 2 ** 20),
      ...(snapshot === undefined ? {} : { snapshot }),
    };
    const ckpt = g % every === 0 || g === to ? checkpointNow() : undefined;
    const exam = config.exam;
    const examModel = exam && (g % exam.every === 0 || g === to) ? report.winner.clone() : undefined;
    chain = chain.then(async () => {
      if (exam && examModel) {
        const startWall = performance.now();
        const startCpu = process.cpuUsage();
        const robust = examPerception(exam);
        const result = await runExam(examModel, robust ? plainExam(exam) : exam);
        metrics.exam = result.score;
        metrics.examCheckpoints = result.checkpoints;
        metrics.examFinished = result.finished;
        metrics.examCrashes = result.crashes;
        if (robust) {
          // The same races with the exam's input delay and noise.
          const perturbed = await runExam(examModel, exam);
          metrics.examRobust = perturbed.score;
          metrics.examRobustCheckpoints = perturbed.checkpoints;
          metrics.examRobustFinished = perturbed.finished;
          metrics.examRobustCrashes = perturbed.crashes;
        }
        const examCpu = process.cpuUsage(startCpu);
        genEvent.phases.exam = {
          wall: (performance.now() - startWall) / 1000,
          cpu: (examCpu.user + examCpu.system) / 1e6,
        };
      }
      emit("gen", genEvent);
      if (ckpt) await writeCheckpoint(ckpt);
    });
    pending.push(chain);
    genStartWall = performance.now();
    genStartCpu = process.cpuUsage();
    genStartFrame = server.frameCount;
  };

  if (startG < to) {
    const director = registerAITrainingService(server, {
      store,
      sampleSize: config.sample,
      framesPerTarget: config.frames,
      model: {
        spec: {
          inputs: [
            ...(config.encoding ? ENCODINGS[config.encoding]! : config.model.inputs),
            ...(config.lookahead === undefined ? [] : lookaheadInputs(config.lookahead)),
          ],
          outputs: config.model.outputs,
          ...(config.sensors ? { sensors: parseSensors(config.sensors) } : {}),
        },
        hidden: config.hidden ?? config.model.hidden,
      },
      arenas: config.arenas,
      scoring: config.scoring,
      collisions: config.collisions,
      crashMode: config.crashMode,
      heldOut: config.heldOut,
      scenarioSeed: seed,
      mutationRate: config.mutationRate,
      mutationStrength: config.mutationStrength,
      ...(config.mutation ? { mutation: config.mutation } : {}),
      ...(config.parents === undefined ? {} : { parents: config.parents }),
      ...(config.crossover === undefined ? {} : { crossover: config.crossover }),
      ...(config.curriculum && curriculum
        ? { curriculum: { ...config.curriculum, level: curriculum.level, streakCount: curriculum.streak } }
        : {}),
      ...(config.initRange === undefined ? {} : { initRange: config.initRange }),
      ...(config.crashLimit === undefined ? {} : { crashLimit: config.crashLimit }),
      ...(config.reevaluate === undefined ? {} : { reevaluate: config.reevaluate }),
      ...(config.inputDelay === undefined && config.inputNoise === undefined
        ? {}
        : {
            perception: {
              ...(config.inputDelay === undefined ? {} : { inputDelay: config.inputDelay }),
              ...(config.inputNoise === undefined ? {} : { inputNoise: config.inputNoise }),
            },
          }),
      random: mutationRandom,
      firstGeneration: startG + 1,
      maxGenerations: to - startG,
      onGeneration,
    });
    if (saved) {
      mutationRandom.state = saved.rng.mutation;
      serverRandom.state = saved.rng.server;
    }

    const loop = new ManualGameLoop();
    await server.start(loop);
    let finished = false;
    void director.done.then(() => (finished = true));
    while (!finished) {
      loop.advance(50);
      await yieldToEventLoop(); // lets bots connect and scripts settle between batches
      while (pending.length > 0) await pending.shift();
    }
    director.stop();
  }
  while (pending.length > 0) await pending.shift();
  if (!winner) throw new Error("no winner: the run completed no generation");

  // Deterministic result: no times, pids or paths.
  const result = {
    method: "train",
    seed,
    generations: g,
    config,
    bestScore,
    modelGeneration: winner.generation,
    winner: winner.toJson(),
  };
  await atomicWrite(join(runDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
  // The trainer's own format too, so `npm run bot -- --model RUN_DIR/luke.txt` works.
  await atomicWrite(join(runDir, "luke.txt"), JSON.stringify([winner.toJson()]));
  emit("done", { g, result: "result.json", metrics: { score: bestScore } });
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    const err = error instanceof Error ? error : new Error(String(error));
    try {
      emit("error", { message: err.message, trace: err.stack ?? null });
    } catch {
      // the run directory is unusable; the exit code still reports the failure
    }
    console.error(err);
    process.exit(1);
  },
);

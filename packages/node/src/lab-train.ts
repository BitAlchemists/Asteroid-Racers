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
import { appendFileSync, existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setImmediate as yieldToEventLoop } from "node:timers/promises";
import { parseArgs } from "node:util";
import { Level, setLogLevel } from "@ar/shared";
import {
  AI_TRAINING_FRAMES,
  AI_TRAINING_SAMPLE_SIZE,
  DEFAULT_MODEL_NAME,
  GameServer,
  ManualGameLoop,
  MemoryModelStore,
  MUTATION_RATE,
  MUTATION_STRENGTH,
  MajorTom,
  registerAITrainingService,
  seededRandom,
  arenaByName,
  parseModelConfig,
  parseScoring,
  type ArenaConfig,
  type CollisionMode,
  type CrashMode,
  type GenerationReport,
  type NetworkJson,
  type ScoringWeights,
} from "@ar/server";

const PROTOCOL = 1;
const CHECKPOINT = "ckpt.json";
const CHECKPOINT_FORMAT = "asteroid-racers/train-ckpt/v2";
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
}

interface Checkpoint {
  format: typeof CHECKPOINT_FORMAT;
  g: number;
  seed: number;
  config: TrainConfig;
  winner: NetworkJson | null;
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
const eventsFile = join(runDir, "events.jsonl");
/** Project root: --root, LAB_ROOT, or three levels up from this file. Inputs are resolved against it. */
const projectRoot = resolve(
  String(values.root ?? process.env.LAB_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "../../..")),
);

/** Versions that could change results without changing our bound sources; stored per run by evo-lab. */
function dependencyVersions(): Record<string, string | null> {
  const versionOf = (pkg: string): string | null => {
    try {
      const json = JSON.parse(
        readFileSync(join(projectRoot, "node_modules", pkg, "package.json"), "utf8"),
      ) as {
        version?: string;
      };
      return json.version ?? null;
    } catch {
      return null;
    }
  };
  return {
    node: process.version,
    tsx: versionOf("tsx"),
    "@bufbuild/protobuf": versionOf("@bufbuild/protobuf"),
    trainer: CHECKPOINT_FORMAT,
  };
}

function emit(type: string, fields: Record<string, unknown> = {}): void {
  appendFileSync(eventsFile, `${JSON.stringify({ type, t: Date.now() / 1000, ...fields })}\n`);
}

/** temp + rename, retried briefly because a reader may hold the target open on Windows. */
async function atomicWrite(file: string, text: string): Promise<void> {
  const temp = `${file}.tmp`;
  writeFileSync(temp, text);
  for (let attempt = 0; ; attempt++) {
    try {
      renameSync(temp, file);
      return;
    } catch (error) {
      if (attempt >= 20) throw error;
      await new Promise((r) => setTimeout(r, 50));
    }
  }
}

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

function parseArenas(value: unknown): ArenaConfig[] {
  if (value === undefined) return [{ name: "legacy", params: {} }];
  if (!Array.isArray(value) || value.length === 0)
    throw new Error("config.arenas must be a non-empty list of { name, params }");
  return value.map((entry: unknown, i) => {
    const { name, params = {} } = (entry ?? {}) as { name?: unknown; params?: unknown };
    if (typeof name !== "string") throw new Error(`config.arenas[${i}].name must be a string`);
    if (typeof params !== "object" || params === null || Array.isArray(params))
      throw new Error(`config.arenas[${i}].params must be an object`);
    arenaByName(name); // unknown names fail here, before the run starts
    return { name, params: params as Record<string, unknown> };
  });
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
  };
  if (!Number.isInteger(config.heldOut) || config.heldOut < 0)
    throw new Error("config.heldOut must be an integer ≥ 0");
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
  // Terminate a line torn by a kill during the previous attempt, so the next event parses.
  if (existsSync(eventsFile) && statSync(eventsFile).size > 0) {
    const text = readFileSync(eventsFile, "utf8");
    if (!text.endsWith("\n")) appendFileSync(eventsFile, "\n");
  }
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
  if (saved?.winner) store.save(DEFAULT_MODEL_NAME, [MajorTom.fromJson(saved.winner)]);

  const startG = saved?.g ?? 0;
  let g = startG;
  let bestScore = saved?.bestScore ?? null;
  let winner: MajorTom | undefined = saved?.winner ? MajorTom.fromJson(saved.winner) : undefined;
  let genStartWall = performance.now();
  let genStartCpu = process.cpuUsage();
  const pending: Promise<void>[] = [];

  const writeCheckpoint = async (): Promise<void> => {
    const ckpt: Checkpoint = {
      format: CHECKPOINT_FORMAT,
      g,
      seed,
      config,
      winner: winner ? winner.toJson() : null,
      bestScore,
      rng: { mutation: mutationRandom.state, server: serverRandom.state },
    };
    await atomicWrite(join(runDir, CHECKPOINT), JSON.stringify(ckpt));
    emit("checkpoint", { g });
  };

  const onGeneration = (report: GenerationReport): void => {
    g = report.generation;
    winner = report.winner;
    bestScore = report.bestScore;
    const cpu = process.cpuUsage(genStartCpu);
    const wall = (performance.now() - genStartWall) / 1000;
    const cpuSec = (cpu.user + cpu.system) / 1e6;
    emit("gen", {
      g,
      metrics: {
        score: report.bestScore,
        mean: report.meanScore,
        worst: report.worstScore,
        success: report.success,
        ...(report.heldOutScore === undefined
          ? {}
          : { heldOut: report.heldOutScore, heldOutSuccess: report.heldOutSuccess }),
      },
      phases: { simulate: { wall, cpu: cpuSec } },
      cpuSec,
      rssMiB: Math.round(process.memoryUsage().rss / 2 ** 20),
    });
    // Called between generations: both generators are exactly where the next generation starts.
    if (g % every === 0 || g === to) pending.push(writeCheckpoint());
    genStartWall = performance.now();
    genStartCpu = process.cpuUsage();
  };

  if (startG < to) {
    const director = registerAITrainingService(server, {
      store,
      sampleSize: config.sample,
      framesPerTarget: config.frames,
      model: {
        spec: { inputs: config.model.inputs, outputs: config.model.outputs },
        hidden: config.model.hidden,
      },
      arenas: config.arenas,
      scoring: config.scoring,
      collisions: config.collisions,
      crashMode: config.crashMode,
      heldOut: config.heldOut,
      scenarioSeed: seed,
      mutationRate: config.mutationRate,
      mutationStrength: config.mutationStrength,
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

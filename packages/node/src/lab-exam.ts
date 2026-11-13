/**
 * evo-lab worker (protocol v1, evaluation-only runs / contract A9) for the `exam` method: flies models
 * through the race exam and reports one `gen` event per examined generation of the input run.
 *
 *   node scripts/lab-exam.mjs --config config.json --out RUN_DIR --root ROOT
 *        [--input-run SOURCE_RUN_DIR --input-gens all|last|10,20,30]
 *
 * The models come from the input run's snapshots (SOURCE/gens/gNNNN.json, written by `train`), or
 * from its result.json for runs from before snapshots. Without an input run the config's `model`
 * names what to examine ("bundled", the model that ships with the game). The exam is deterministic,
 * so it is not resumable: a rerun produces the same result.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Level, setLogLevel } from "@ar/shared";
import {
  bundledModels,
  DEFAULT_MODEL_NAME,
  MajorTom,
  parseExamConfig,
  runExam,
  runSkills,
  skillMetrics,
  type ExamConfig,
  type NetworkJson,
} from "@ar/server";
import { atomicWrite, atomicWriteSync, dependencyVersions, eventLog, PROTOCOL } from "./lab-common";

const EXAM_FORMAT = "asteroid-racers/exam/v1";
/** Per examined generation: the flights with their paths, for the evo-lab renderer plugin. */
const EXAM_SNAPSHOT_FORMAT = "asteroid-racers/exam-snapshot/v1";

export interface ExamRunConfig extends ExamConfig {
  /** What to examine when the run has no input run: "bundled". */
  model: string | null;
}

const { values } = parseArgs({
  strict: false, // ignore unknown arguments: the protocol may grow
  options: {
    config: { type: "string" },
    out: { type: "string" },
    root: { type: "string" },
    seed: { type: "string" },
    "input-run": { type: "string" },
    "input-gens": { type: "string" },
  },
});

const runDir = resolve(String(values.out ?? process.env.LAB_RUN_DIR ?? "."));
const projectRoot = resolve(
  String(values.root ?? process.env.LAB_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "../../..")),
);
const emit = eventLog(runDir);

function readConfig(): ExamRunConfig {
  const file = values.config === undefined ? undefined : resolve(runDir, String(values.config));
  const raw =
    file && existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>) : {};
  const { model = null, ...exam } = raw;
  if (model !== null && model !== "bundled")
    throw new Error(`config.model must be "bundled" or null, got ${JSON.stringify(model)}`);
  return { ...parseExamConfig(exam), model };
}

/** A model to examine and the generation it is reported under. */
interface Candidate {
  g: number;
  model: MajorTom;
}

/** The source run's models: its snapshots, plus the final winner from result.json if not among them. */
function sourceModels(sourceDir: string): Map<number, () => MajorTom> {
  const models = new Map<number, () => MajorTom>();
  const gensDir = join(sourceDir, "gens");
  if (existsSync(gensDir)) {
    for (const name of readdirSync(gensDir)) {
      const match = /^g(\d+)\.json$/.exec(name);
      if (!match) continue;
      models.set(Number(match[1]), () => {
        const snapshot = JSON.parse(readFileSync(join(gensDir, name), "utf8")) as { model: NetworkJson };
        return MajorTom.fromJson(snapshot.model);
      });
    }
  }
  const resultFile = join(sourceDir, "result.json");
  if (existsSync(resultFile)) {
    const result = JSON.parse(readFileSync(resultFile, "utf8")) as {
      generations?: number;
      winner?: NetworkJson;
    };
    if (typeof result.generations === "number" && result.winner && !models.has(result.generations)) {
      const winner = result.winner;
      models.set(result.generations, () => MajorTom.fromJson(winner));
    }
  }
  return models;
}

function selectGens(available: number[], spec: string): number[] {
  if (available.length === 0)
    throw new Error("the input run has no models (no gens/ snapshots, no result.json winner)");
  if (spec === "all") return available;
  if (spec === "last") return [available.at(-1)!];
  const wanted = spec.split(",").map((part) => Number(part.trim()));
  if (!wanted.every((g) => Number.isInteger(g) && g >= 0)) throw new Error(`bad --input-gens ${spec}`);
  const missing = wanted.filter((g) => !available.includes(g));
  if (missing.length > 0)
    throw new Error(
      `the input run has no model for generation ${missing.join(", ")}; it has ${available.join(", ")}`,
    );
  return [...new Set(wanted)].sort((a, b) => a - b);
}

function candidates(config: ExamRunConfig): { source: string; list: Candidate[] } {
  const inputRun = values["input-run"];
  if (typeof inputRun === "string") {
    const models = sourceModels(inputRun);
    const gens = selectGens(
      [...models.keys()].sort((a, b) => a - b),
      String(values["input-gens"] ?? "last"),
    );
    // The source run's id (its directory name), never the absolute path: results hold no paths.
    return { source: basename(resolve(inputRun)), list: gens.map((g) => ({ g, model: models.get(g)!() })) };
  }
  if (config.model === "bundled") {
    const model = bundledModels().load(DEFAULT_MODEL_NAME)![0]!;
    return { source: "bundled", list: [{ g: 1, model }] };
  }
  throw new Error('nothing to examine: enqueue with an inputRun, or set config.model to "bundled"');
}

async function main(): Promise<void> {
  setLogLevel("", Level.WARNING);
  const config = readConfig();
  emit("hello", {
    protocol: PROTOCOL,
    method: "exam",
    run: process.env.LAB_RUN_ID ?? null,
    attempt: Number(process.env.LAB_ATTEMPT ?? 1),
    config,
    seed: null,
    resume: false,
    pid: process.pid,
    imports: [],
    versions: dependencyVersions(projectRoot, { exam: EXAM_FORMAT }),
  });

  const { source, list } = candidates(config);
  const examined = [];
  for (const { g, model } of list) {
    const startWall = performance.now();
    const startCpu = process.cpuUsage();
    const { traces, ...exam } = await runExam(model, config);
    // Skills exam (optional): the M4 default physics (obstacles collide, crashes respawn, 600 frames).
    const skills = config.skills
      ? await runSkills(model, config.skills, {
          seed: config.seed,
          frames: 600,
          collisions: "obstacles",
          crashMode: "respawn",
        })
      : undefined;
    const cpu = process.cpuUsage(startCpu);
    const cpuSec = (cpu.user + cpu.system) / 1e6;
    const snapshot = `gens/g${String(g).padStart(4, "0")}.json`;
    mkdirSync(join(runDir, "gens"), { recursive: true });
    atomicWriteSync(
      join(runDir, snapshot),
      JSON.stringify({
        format: EXAM_SNAPSHOT_FORMAT,
        sourceRun: source,
        g,
        score: exam.score,
        flights: traces,
      }),
    );
    emit("gen", {
      g,
      snapshot,
      metrics: {
        exam: exam.score,
        examCheckpoints: exam.checkpoints,
        examFinished: exam.finished,
        examCrashes: exam.crashes,
        ...(skills ? skillMetrics(skills) : {}),
      },
      phases: { exam: { wall: (performance.now() - startWall) / 1000, cpu: cpuSec } },
      cpuSec,
      rssMiB: Math.round(process.memoryUsage().rss / 2 ** 20),
    });
    examined.push({
      g,
      model: model.name,
      modelGeneration: model.generation,
      ...exam,
      ...(skills ? { skills } : {}),
    });
  }

  // Deterministic result: no times, pids or paths.
  const last = examined.at(-1)!;
  const result = { method: "exam", format: EXAM_FORMAT, source, exam: config, examined };
  await atomicWrite(join(runDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
  emit("done", { g: last.g, result: "result.json", metrics: { exam: last.score } });
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

import { writeFileSync } from "node:fs";
import { setImmediate as yieldToEventLoop } from "node:timers/promises";
import { parseArgs } from "node:util";
import { Level, setLogLevel } from "@ar/shared";
import {
  AI_TRAINING_FRAMES,
  AI_TRAINING_SAMPLE_SIZE,
  createTrainingServer,
  DEFAULT_MODEL_NAME,
  ManualGameLoop,
  registerAITrainingService,
  seededRandom,
} from "@ar/server";
import { FileModelStore } from "./file-model-store";

const HELP = `Evolve racing bots headless, as fast as the CPU allows (port of bin/train_bots.dart).

Usage: npm run train -- [options]

  --name <name>         model name (default ${DEFAULT_MODEL_NAME})
  --db <dir>            model directory (default db) — continues from <db>/<name>/luke.txt if present
  --generations <n>     stop after n generations (default: run until Ctrl+C)
  --sample <n>          models per generation (default ${AI_TRAINING_SAMPLE_SIZE})
  --frames <n>          frames per target (default ${AI_TRAINING_FRAMES} = 9 s)
  --seed <n>            seed for the course and mutations (default: random)
  --export <file>       after each generation, also write the winner as a single JSON network
  -h, --help`;

const { values } = parseArgs({
  options: {
    name: { type: "string", default: DEFAULT_MODEL_NAME },
    db: { type: "string", default: "db" },
    generations: { type: "string" },
    sample: { type: "string", default: String(AI_TRAINING_SAMPLE_SIZE) },
    frames: { type: "string", default: String(AI_TRAINING_FRAMES) },
    seed: { type: "string" },
    export: { type: "string" },
    help: { type: "boolean", short: "h" },
  },
});

if (values.help) {
  console.log(HELP);
  process.exit(0);
}

function positiveInt(value: string | undefined, flag: string): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    console.error(`--${flag} must be a positive integer, got "${value}"`);
    process.exit(2);
  }
  return n;
}

setLogLevel("", Level.WARNING);
setLogLevel("services.ai.TrainingDirector", Level.WARNING);

const seed = positiveInt(values.seed, "seed") ?? Math.floor(Math.random() * 2 ** 31);
const store = new FileModelStore(values.db);
const log = store.createLog(values.name);
const server = createTrainingServer(seed);
const loop = new ManualGameLoop();
const startedAt = performance.now();
let lastReport = startedAt;

const maxGenerations = positiveInt(values.generations, "generations");
const director = registerAITrainingService(server, {
  store,
  networkName: values.name,
  sampleSize: positiveInt(values.sample, "sample")!,
  framesPerTarget: positiveInt(values.frames, "frames")!,
  random: seededRandom(seed + 1),
  ...(maxGenerations === undefined ? {} : { maxGenerations }),
  onGeneration: (report) => {
    const now = performance.now();
    const line =
      `${new Date().toISOString()} gen ${report.generation} (model gen ${report.modelGeneration}) ` +
      `best ${report.bestScore.toFixed(0)} mean ${report.meanScore.toFixed(0)} worst ${report.worstScore.toFixed(0)} ` +
      `| ${report.gameSeconds.toFixed(0)} s game time in ${((now - lastReport) / 1000).toFixed(1)} s`;
    lastReport = now;
    console.log(line);
    log(line);
    if (values.export) writeFileSync(values.export, `${JSON.stringify(report.winner.toJson())}\n`);
  },
});

console.log(
  `Training "${values.name}" in ${store.root} — seed ${seed}, ${values.sample} models per generation` +
    (maxGenerations ? `, ${maxGenerations} generations` : ", Ctrl+C to stop"),
);

let interrupted = false;
process.once("SIGINT", () => {
  interrupted = true;
  console.log("\nstopping after the current batch (the last finished generation is saved)");
});

await server.start(loop);
let finished = false;
void director.done.then(() => (finished = true));

// Step the server in batches; yielding between batches lets bots connect and scripts settle.
const TICKS_PER_BATCH = 50;
while (!finished && !interrupted) {
  loop.advance(TICKS_PER_BATCH);
  await yieldToEventLoop();
}
director.stop();
console.log(`done in ${((performance.now() - startedAt) / 1000).toFixed(1)} s`);

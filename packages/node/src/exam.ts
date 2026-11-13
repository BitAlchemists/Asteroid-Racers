/**
 * Race exam from the command line: flies a model through the exam tracks and prints a table.
 * The same exam the evo-lab `exam` method runs.
 */
import { parseArgs } from "node:util";
import { Level, setLogLevel } from "@ar/shared";
import { DEFAULT_EXAM, parseExamConfig, runExam } from "@ar/server";
import { loadModelFile } from "./model-file";

const HELP = `Fly a model through the race exam and print the results.

Usage: npm run exam -- [options]

  --model <file|bundled>  a network JSON, luke.txt, evo-lab snapshot or result.json (default: bundled)
  --track <name>          exam only this track (repeatable; default ${DEFAULT_EXAM.tracks.join(", ")})
  --random <n>            random tracks (default ${DEFAULT_EXAM.randomTracks}; 0 with --track for just that track)
  --time <seconds>        game-time limit per flight (default ${DEFAULT_EXAM.timeLimitSeconds})
  --seed <n>              exam seed: asteroids and random tracks (default ${DEFAULT_EXAM.seed})
  --json                  print the full result as JSON
  -h, --help`;

const { values } = parseArgs({
  options: {
    model: { type: "string" },
    track: { type: "string", multiple: true },
    random: { type: "string" },
    time: { type: "string" },
    seed: { type: "string" },
    json: { type: "boolean" },
    help: { type: "boolean", short: "h" },
  },
});
if (values.help) {
  console.log(HELP);
  process.exit(0);
}
setLogLevel("", Level.WARNING);

const num = (value: string | undefined) => (value === undefined ? undefined : Number(value));
const config = parseExamConfig({
  ...(values.track ? { tracks: values.track } : {}),
  ...(values.random !== undefined ? { randomTracks: num(values.random) } : {}),
  ...(values.time !== undefined ? { timeLimitSeconds: num(values.time) } : {}),
  ...(values.seed !== undefined ? { seed: num(values.seed) } : {}),
});
const model = loadModelFile(values.model);
const result = await runExam(model, config);

if (values.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(
    `Exam of "${model.name}" (generation ${model.generation}), ${config.timeLimitSeconds} s per flight\n`,
  );
  console.table(
    result.flights.map((f) => ({
      track: f.track,
      checkpoints: `${f.checkpoints}/${f.totalCheckpoints}`,
      finished: f.finished ? "yes" : "no",
      seconds: Number(f.seconds.toFixed(2)),
      crashes: f.crashes,
      "distance left": Math.round(f.distanceLeft),
      score: Math.round(f.score),
    })),
  );
  console.log(
    `\nExam score ${Math.round(result.score)} · checkpoints ${(result.checkpoints * 100).toFixed(0)} % · ` +
      `finished ${(result.finished * 100).toFixed(0)} % · crashes ${result.crashes}`,
  );
}

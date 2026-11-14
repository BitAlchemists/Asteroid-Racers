/**
 * Exam v3 from the command line (M7 S4): flies stored models through exam v3 and prints the primary
 * score `exam3`, the profile (per category, goal type, skill and track) and the crashes.
 *
 *   npm run exam3 -- --run train-310..train-319 --gen 150 [--jobs 8] [--json out.json]
 *   npm run exam3 -- --model lab/runs/train-327/luke.txt
 *   npm run exam3 -- --scripted
 *
 * Several models fly in parallel child processes with --jobs. The exam is deterministic: the same
 * model always gets the same result.
 */
import { fork } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Level, setLogLevel } from "@ar/shared";
import {
  EXAM3,
  EXAM3_CATEGORIES,
  modelFromJson,
  runExam3,
  scriptedModel,
  SKILL_ARENAS,
  type Exam3Definition,
  type Exam3Result,
  type MajorTom,
} from "@ar/server";
import { loadModelFile } from "./model-file";
import { expandRuns } from "./skills-profile";

const HELP = `Fly models through exam v3 (${EXAM3.version}) and print the score and its profile.

Usage: npm run exam3 -- [options]

  --run <ids>       runs, e.g. train-310..train-319 or a,b (their gens/gNNNN.json snapshots)
  --gen <g>         the generation of the snapshots (with --run)
  --lab <dir>       the runs directory (default lab/runs of the project)
  --model <file>    a model file (network JSON, luke.txt, snapshot, result.json, or "bundled"); repeatable
  --scripted        the scripted steering controller (a reference)
  --jobs <n>        models flown in parallel processes (default 1)
  --json <file>     write the full results (every flight and skill) as JSON
  --tracks          print every race of every model
  --def <file>      calibration only: JSON overriding parts of the exam definition (not exam ${EXAM3.version})
  -h, --help`;

interface Job {
  label: string;
  /** "scripted", a model file, or run:gen. */
  source: { kind: "scripted" } | { kind: "file"; file: string } | { kind: "run"; dir: string; gen: number };
}

function loadJob(job: Job): MajorTom {
  if (job.source.kind === "scripted") return scriptedModel();
  if (job.source.kind === "file") return loadModelFile(job.source.file);
  const file = join(job.source.dir, "gens", `g${String(job.source.gen).padStart(4, "0")}.json`);
  if (!existsSync(file)) throw new Error(`${job.label}: no snapshot ${file}`);
  return modelFromJson(JSON.parse(readFileSync(file, "utf8")) as unknown, file);
}

export interface Exam3Row {
  label: string;
  seconds: number;
  result: Exam3Result;
}

async function runJob(job: Job, def: Exam3Definition): Promise<Exam3Row> {
  const model = loadJob(job);
  const start = performance.now();
  const result = await runExam3(model, def);
  return { label: job.label, seconds: (performance.now() - start) / 1000, result };
}

/** Runs the jobs in `jobs` child processes (each a copy of this script in --child mode). */
async function runParallel(jobs: Job[], parallel: number, defFile: string | undefined): Promise<Exam3Row[]> {
  const rows = new Array<Exam3Row>(jobs.length);
  let next = 0;
  const self = fileURLToPath(import.meta.url);
  const worker = async (): Promise<void> => {
    while (next < jobs.length) {
      const index = next++;
      const job = jobs[index]!;
      rows[index] = await new Promise<Exam3Row>((resolveRow, reject) => {
        const child = fork(self, ["--child", JSON.stringify(job), ...(defFile ? ["--def", defFile] : [])], {
          execArgv: process.execArgv,
          stdio: ["ignore", "ignore", "inherit", "ipc"],
        });
        child.once("message", (row) => resolveRow(row as Exam3Row));
        child.once("exit", (code) => {
          if (code !== 0) reject(new Error(`${job.label}: exam process exited with ${code}`));
        });
      });
      process.stderr.write(`  ${job.label}: exam3 ${rows[index].result.score.toFixed(1)}\n`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, jobs.length) }, worker));
  return rows;
}

const pct = (v: number) => (Number.isNaN(v) ? "   -" : v.toFixed(1).padStart(5));

function printRows(rows: Exam3Row[], showTracks: boolean): void {
  const header = ["model".padEnd(18), "exam3".padStart(6), ...EXAM3_CATEGORIES.map((c) => c.padStart(9))];
  header.push("stop".padStart(6), "gates".padStart(6), "laps".padStart(6));
  header.push("finished".padStart(9), "crashes/race".padStart(13), "time/par".padStart(9), "s".padStart(6));
  console.log(header.join(" "));
  for (const { label, seconds, result: r } of rows)
    console.log(
      [
        label.padEnd(18),
        pct(r.score).padStart(6),
        ...EXAM3_CATEGORIES.map((c) => pct(r.categories[c]).padStart(9)),
        pct(r.goals.stop).padStart(6),
        pct(r.goals.gates).padStart(6),
        pct(r.goals.laps).padStart(6),
        `${Math.round(r.finished * 100)}%`.padStart(9),
        r.crashes.toFixed(2).padStart(13),
        (Number.isNaN(r.timeVsPar) ? "-" : r.timeVsPar.toFixed(2)).padStart(9),
        seconds.toFixed(1).padStart(6),
      ].join(" "),
    );
  console.log("\nskills: targets reached (crashes per episode)");
  console.log(["model".padEnd(18), ...SKILL_ARENAS.map((s) => s.key.padStart(12))].join(" "));
  for (const { label, result } of rows)
    console.log(
      [
        label.padEnd(18),
        ...result.skills.map((s) =>
          `${Math.round(s.success * 100)}% (${s.crashesPerEpisode.toFixed(1)})`.padStart(12),
        ),
      ].join(" "),
    );
  if (!showTracks) return;
  for (const { label, result } of rows) {
    console.log(`\n${label}: race value, checkpoints, time (par), crashes`);
    for (const f of result.flights)
      console.log(
        `  ${f.id.padEnd(40)} ${(f.value * 100).toFixed(0).padStart(4)}  ${`${f.checkpoints}/${f.totalCheckpoints}`.padStart(6)}  ` +
          `${f.finished ? `${f.seconds.toFixed(1)} s` : "-"} (${f.exam3Par})  ${f.crashes}`,
      );
  }
}

function readDef(file: string | undefined): Exam3Definition {
  if (!file) return EXAM3;
  const override = JSON.parse(readFileSync(file, "utf8")) as Partial<Exam3Definition>;
  return { ...EXAM3, ...override, version: `${EXAM3.version}-calibration` };
}

async function main(): Promise<void> {
  setLogLevel("", Level.WARNING);
  const { values } = parseArgs({
    options: {
      run: { type: "string" },
      gen: { type: "string" },
      lab: { type: "string" },
      model: { type: "string", multiple: true },
      scripted: { type: "boolean" },
      jobs: { type: "string" },
      json: { type: "string" },
      tracks: { type: "boolean" },
      def: { type: "string" },
      child: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  const def = readDef(values.def);
  if (values.child) {
    const row = await runJob(JSON.parse(values.child) as Job, def);
    process.send!(row, () => process.exit(0));
    return;
  }
  if (values.help) {
    console.log(HELP);
    return;
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const labRuns = resolve(values.lab ?? join(root, "lab", "runs"));
  const jobs: Job[] = [];
  if (values.scripted) jobs.push({ label: "scripted", source: { kind: "scripted" } });
  for (const file of values.model ?? [])
    jobs.push({
      label: file === "bundled" ? "bundled" : file,
      source: { kind: "file", file: resolve(file) },
    });
  if (values.run) {
    if (!values.gen) throw new Error("--run needs --gen");
    const gen = Number(values.gen);
    for (const run of expandRuns(values.run))
      jobs.push({ label: `${run}@g${gen}`, source: { kind: "run", dir: join(labRuns, run), gen } });
  }
  if (jobs.length === 0)
    throw new Error("nothing to examine (--run/--gen, --model or --scripted); see --help");
  const parallel = Math.max(1, Number(values.jobs ?? 1));
  const rows =
    parallel === 1 || jobs.length === 1
      ? await jobs.reduce<Promise<Exam3Row[]>>(
          async (acc, job) => [...(await acc), await runJob(job, def)],
          Promise.resolve([]),
        )
      : await runParallel(jobs, parallel, values.def);
  console.log(
    `exam v3 (${def.version}): ${rows[0]!.result.flights.length} races + ${rows[0]!.result.skills.length} skills; ` +
      `scores 0-100, higher is better; crashes are per race\n`,
  );
  printRows(rows, values.tracks ?? false);
  if (values.json) {
    writeFileSync(values.json, JSON.stringify({ version: def.version, rows }, null, 1));
    console.log(`\nwrote ${values.json}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });

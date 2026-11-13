/**
 * Skill profile of stored models: flies a run's snapshot model through the skills exam (fixed
 * scenarios of every training arena, see packages/server/src/ai/skills.ts) with the run's physics
 * settings, without retraining. Several runs give one row each plus the mean.
 *
 *   npm run skills -- --run train-310..train-319 --gen 150 [--episodes 8] [--lab <dir of runs>]
 *   npm run skills -- --run train-327 --gen 300
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Level, setLogLevel } from "@ar/shared";
import {
  DEFAULT_EXAM,
  DEFAULT_SKILLS,
  MajorTom,
  runSkills,
  SKILL_ARENAS,
  type CollisionMode,
  type CrashMode,
  type NetworkJson,
  type SkillResult,
} from "@ar/server";

/** "train-310..train-319" → the ten ids; "a,b" → both; "a" → itself. */
export function expandRuns(spec: string): string[] {
  return spec.split(",").flatMap((part) => {
    const m = /^(.*?)(\d+)\.\.(?:\1)?(\d+)$/.exec(part.trim());
    if (!m) return [part.trim()];
    const [, prefix, from, to] = m;
    const out: string[] = [];
    for (let i = Number(from); i <= Number(to); i++) out.push(`${prefix}${i}`);
    return out;
  });
}

async function profile(labRuns: string, run: string, gen: number, episodes: number): Promise<SkillResult[]> {
  const dir = join(labRuns, run);
  const config = JSON.parse(readFileSync(join(dir, "config.json"), "utf8")) as Record<string, unknown>;
  const file = join(dir, "gens", `g${String(gen).padStart(4, "0")}.json`);
  if (!existsSync(file)) throw new Error(`${run} has no snapshot for g${gen}`);
  const model = MajorTom.fromJson((JSON.parse(readFileSync(file, "utf8")) as { model: NetworkJson }).model);
  const exam = (config.exam ?? {}) as { seed?: number };
  return runSkills(
    model,
    { episodes },
    {
      seed: exam.seed ?? DEFAULT_EXAM.seed,
      frames: (config.frames as number | undefined) ?? 600,
      collisions: (config.collisions as CollisionMode | undefined) ?? "none",
      crashMode: (config.crashMode as CrashMode | undefined) ?? "end",
      ...(typeof config.crashLimit === "number" ? { crashLimit: config.crashLimit } : {}),
    },
  );
}

async function main(): Promise<void> {
  setLogLevel("", Level.WARNING);
  const { values } = parseArgs({
    options: {
      run: { type: "string" },
      gen: { type: "string" },
      episodes: { type: "string" },
      lab: { type: "string" },
    },
  });
  if (!values.run || !values.gen) throw new Error("usage: npm run skills -- --run <id|a..b> --gen <g>");
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const labRuns = resolve(values.lab ?? join(root, "lab", "runs"));
  const gen = Number(values.gen);
  const episodes = values.episodes ? Number(values.episodes) : DEFAULT_SKILLS.episodes;
  const rows: { run: string; results: SkillResult[] }[] = [];
  const start = performance.now();
  for (const run of expandRuns(values.run))
    rows.push({ run, results: await profile(labRuns, run, gen, episodes) });
  const seconds = (performance.now() - start) / 1000 / rows.length;

  const keys = SKILL_ARENAS.map((s) => s.key);
  const pct = (v: number) => `${Math.round(v * 100)}%`.padStart(5);
  console.log(`skills exam, g${gen}, ${episodes} episodes per skill: targets reached (crashes per episode)`);
  console.log(["run".padEnd(10), ...keys.map((k) => k.padStart(13))].join(" "));
  for (const { run, results } of rows)
    console.log(
      [
        run.padEnd(10),
        ...results.map((r) => `${pct(r.success)} (${r.crashesPerEpisode.toFixed(1)})`.padStart(13)),
      ].join(" "),
    );
  if (rows.length > 1) {
    const mean = keys.map((_, i) => {
      const s = rows.reduce((n, r) => n + r.results[i]!.success, 0) / rows.length;
      const c = rows.reduce((n, r) => n + r.results[i]!.crashesPerEpisode, 0) / rows.length;
      return `${pct(s)} (${c.toFixed(1)})`.padStart(13);
    });
    console.log(["mean".padEnd(10), ...mean].join(" "));
  }
  console.log(`${seconds.toFixed(2)} s per model`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });

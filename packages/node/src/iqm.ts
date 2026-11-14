/**
 * Robust comparison of training runs over seeds: IQM per arm, paired bootstrap 95 % CIs of the
 * effect, win fraction and a power estimate. Reads the runs' gen events from lab/runs.
 *
 *   npm run iqm -- <experiment-id> [--metric exam] [--gen 150] [--effect 10000]
 *   npm run iqm -- --base train-1,train-2,... --arm train-11,train-12,... [--metric ...] [--gen ...]
 *   npm run iqm -- --from exam3.json --base ... --arm ... --metric exam3 --gen 150
 *   npm run iqm -- --from exam3.json --base ... --arm ... --metric exam3 --gens 125..150:5
 *
 * With --gens (M8's averaged decision rule, list mode only), each run's value is the mean of the
 * metric over those generations (every run must have the same ones), before the IQM and bootstrap.
 *
 * With --from, the values come from a JSON file written by `npm run exam3 -- --json` (re-scored
 * stored models, labelled `<run>@g<gen>`) instead of the runs' gen events.
 *
 * In experiment mode, every run labelled `exp:<id>/<arm>` counts (check runs excluded); a
 * continuation run belongs to the arm of the run it continues. Per arm and seed, the newest run
 * that has the generation is used. Lists given with --base/--arm are paired in order.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { exam3Metrics, type Exam3Result } from "@ar/server";
import { expandRuns } from "./skills-profile";
import {
  comparePaired,
  directionOf,
  iqm,
  parseGens,
  seedsNeeded,
  windowMeans,
  type PairedComparison,
} from "./iqm-stats";

interface Manifest {
  id: string;
  label?: string;
  seed: number;
  parentRun?: string | null;
  createdAt?: string;
}

export interface RunData {
  id: string;
  seed: number;
  /** The arm, from the label of the run (or of the run it continues). */
  arm: string | undefined;
  createdAt: string;
  /** metric → value per generation that has it. */
  metrics: Map<number, Record<string, number>>;
}

export function readRun(runsDir: string, id: string): RunData | undefined {
  const dir = join(runsDir, id);
  if (!existsSync(join(dir, "manifest.json"))) return undefined;
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as Manifest;
  const metrics = new Map<number, Record<string, number>>();
  const events = join(dir, "events.jsonl");
  if (existsSync(events))
    for (const line of readFileSync(events, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line) as { type: string; g?: number; metrics?: Record<string, number> };
        if (e.type === "gen" && e.g !== undefined && e.metrics) metrics.set(e.g, e.metrics);
      } catch {
        // torn line from a kill
      }
    }
  return { id, seed: manifest.seed, arm: manifest.label, createdAt: manifest.createdAt ?? "", metrics };
}

/** Arms of an experiment: arm name → seed → value of `metric` at `gen`. */
export function experimentArms(
  runsDir: string,
  experiment: string,
  metric: string,
  gen: number,
): Map<string, Map<number, { value: number; run: string }>> {
  const manifests = new Map<string, Manifest>();
  for (const id of readdirSync(runsDir)) {
    const file = join(runsDir, id, "manifest.json");
    if (existsSync(file)) manifests.set(id, JSON.parse(readFileSync(file, "utf8")) as Manifest);
  }
  const prefix = `exp:${experiment}/`;
  const armOf = (m: Manifest): string | undefined => {
    for (let cur: Manifest | undefined = m, hops = 0; cur && hops < 20; hops++) {
      if (cur.label?.startsWith(prefix)) {
        const arm = cur.label.slice(prefix.length).replace(/-continued$/, "");
        return arm === "check" ? undefined : arm;
      }
      cur = cur.parentRun ? manifests.get(cur.parentRun) : undefined;
    }
    return undefined;
  };
  const arms = new Map<string, Map<number, { value: number; run: string; at: string }>>();
  for (const m of manifests.values()) {
    const arm = armOf(m);
    if (!arm) continue;
    const run = readRun(runsDir, m.id);
    const value = run?.metrics.get(gen)?.[metric];
    if (value === undefined) continue;
    const bySeed = arms.get(arm) ?? new Map();
    const prev = bySeed.get(m.seed);
    if (!prev || (m.createdAt ?? "") > prev.at)
      bySeed.set(m.seed, { value, run: m.id, at: m.createdAt ?? "" });
    arms.set(arm, bySeed);
  }
  return arms;
}

/** Metrics per model label from an `npm run exam3 -- --json` file. */
function exam3Values(file: string): Map<string, Record<string, number>> {
  const data = JSON.parse(readFileSync(file, "utf8")) as { rows: { label: string; result: Exam3Result }[] };
  return new Map(data.rows.map((r) => [r.label, exam3Metrics(r.result)]));
}

function fmt(v: number): string {
  if (!Number.isFinite(v)) return "–";
  const a = Math.abs(v);
  return a >= 1000 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(3);
}

function line(name: string, c: PairedComparison, effect: number | undefined): string {
  const needed = effect === undefined ? "" : `  seeds for ${fmt(effect)}: ${seedsNeeded(c.sdDiff, effect)}`;
  return (
    `${name.padEnd(28)} IQM ${fmt(c.iqmArm).padStart(9)}  effect ${fmt(c.iqmEffect).padStart(9)} ` +
    `[${fmt(c.iqmCi[0])}, ${fmt(c.iqmCi[1])}]  mean diff ${fmt(c.meanEffect)} [${fmt(c.meanCi[0])}, ${fmt(c.meanCi[1])}]  ` +
    `better ${Math.round(c.winFraction * c.n)}/${c.n}  detectable ${fmt(c.detectable)}${needed}`
  );
}

function main(): void {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      metric: { type: "string", default: "exam" },
      gen: { type: "string", default: "150" },
      gens: { type: "string" },
      base: { type: "string" },
      arm: { type: "string" },
      baseline: { type: "string", default: "baseline" },
      effect: { type: "string" },
      resamples: { type: "string", default: "10000" },
      root: { type: "string" },
      from: { type: "string" },
    },
  });
  const root = resolve(values.root ?? join(dirname(fileURLToPath(import.meta.url)), "../../.."));
  const runsDir = join(root, "lab", "runs");
  const metric = values.metric!;
  const gen = Number(values.gen);
  const direction = directionOf(metric);
  const effect = values.effect === undefined ? undefined : Number(values.effect);
  const opts = { resamples: Number(values.resamples), seed: 1 };
  const window = values.gens === undefined ? undefined : parseGens(values.gens);
  console.log(
    `${metric} ${window ? `averaged per run over g${values.gens}` : `at g${gen}`} (${direction} is better); ` +
      `95 % CIs from ${opts.resamples} paired bootstrap resamples`,
  );

  if (values.base && values.arm) {
    const rescored = values.from === undefined ? undefined : exam3Values(values.from);
    const runCache = new Map<string, RunData | undefined>();
    const valueOf = (id: string, g: number): number | undefined => {
      if (rescored) return rescored.get(`${id}@g${g}`)?.[metric];
      if (!runCache.has(id)) runCache.set(id, readRun(runsDir, id));
      return runCache.get(id)?.metrics.get(g)?.[metric];
    };
    let windowGens: number[] = [];
    const get = (ids: string) => {
      const runs = expandRuns(ids).map((id) => id.trim());
      if (window) {
        const w = windowMeans(runs, window, valueOf);
        if (windowGens.length > 0 && w.gens.join() !== windowGens.join())
          throw new Error(
            `base and arm have different generations: g${windowGens.join(",")} vs g${w.gens.join(",")}`,
          );
        windowGens = w.gens;
        return w.means;
      }
      return runs.map((id) => {
        const v = valueOf(id, gen);
        if (v === undefined) throw new Error(`run ${id} has no ${metric} at g${gen}`);
        return v;
      });
    };
    const base = get(values.base);
    const arm = get(values.arm);
    if (window) console.log(`generations averaged: g${windowGens.join(", g")}`);
    console.log(`${"base".padEnd(28)} IQM ${fmt(iqm(base)).padStart(9)}  (n ${base.length})`);
    console.log(line("arm", comparePaired(base, arm, direction, opts), effect));
    return;
  }
  const experiment = positionals[0];
  if (!experiment) throw new Error("give an experiment id, or --base and --arm run lists");
  if (window) throw new Error("--gens works with --base and --arm run lists only");
  const arms = experimentArms(runsDir, experiment, metric, gen);
  const base = arms.get(values.baseline!);
  if (!base) throw new Error(`no ${values.baseline} runs with ${metric} at g${gen} in ${experiment}`);
  console.log(
    `${values.baseline!.padEnd(28)} IQM ${fmt(iqm([...base.values()].map((v) => v.value))).padStart(9)}  (n ${base.size})`,
  );
  for (const [name, bySeed] of [...arms].sort(([a], [b]) => a.localeCompare(b))) {
    if (name === values.baseline) continue;
    const seeds = [...bySeed.keys()].filter((s) => base.has(s)).sort((a, b) => a - b);
    if (seeds.length < 2) {
      console.log(`${name.padEnd(28)} only ${seeds.length} paired seed(s) at g${gen}`);
      continue;
    }
    const c = comparePaired(
      seeds.map((s) => base.get(s)!.value),
      seeds.map((s) => bySeed.get(s)!.value),
      direction,
      opts,
    );
    console.log(line(name, c, effect));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

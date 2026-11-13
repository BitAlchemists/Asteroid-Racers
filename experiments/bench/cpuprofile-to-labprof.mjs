// Converts a V8 `.cpuprofile` (node --cpu-prof) into Evo Lab's labprof cProfile export, so
// `node <evo-lab>/bin/profile.js hotspots before.json after.json` can compare two Node profiles.
//
//   node experiments/bench/cpuprofile-to-labprof.mjs in.cpuprofile out.json [--gens 3] [--top 25]
//
// tottime = sampled self time, cumtime = sampled time with the function anywhere on the stack
// (counted once per sample, so recursion is not double-counted), ncalls = samples (V8 does not
// count calls). Also prints the top functions by self time with their share of all samples.
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { gens: { type: "string" }, top: { type: "string" } },
});
const [input, output] = positionals;
if (!input || !output) throw new Error("usage: cpuprofile-to-labprof.mjs in.cpuprofile out.json [--gens N]");

const profile = JSON.parse(readFileSync(input, "utf8"));
const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);

const keyOf = (n) => {
  const f = n.callFrame;
  const file = f.url ? f.url.replace(/^file:\/\/\/?/, "") : "~";
  return { key: `${file}|${f.functionName || "(anonymous)"}|${f.lineNumber + 1}`, file, func: f.functionName || "(anonymous)", line: f.lineNumber + 1 };
};

const funcs = new Map();
const entry = (n) => {
  const k = keyOf(n);
  let e = funcs.get(k.key);
  if (!e) funcs.set(k.key, (e = { file: k.file, line: k.line, func: k.func, tottime: 0, cumtime: 0, ncalls: 0 }));
  return e;
};

let total = 0;
const { samples, timeDeltas } = profile;
for (let i = 0; i < samples.length; i++) {
  const dt = (timeDeltas[i + 1] ?? timeDeltas[i] ?? 0) / 1e6; // seconds until the next sample
  total += dt;
  let id = samples[i];
  const leaf = entry(nodes.get(id));
  leaf.tottime += dt;
  leaf.ncalls += 1;
  const seen = new Set();
  while (id !== undefined) {
    const e = entry(nodes.get(id));
    if (!seen.has(e)) {
      seen.add(e);
      e.cumtime += dt;
    }
    id = parent.get(id);
  }
}

const gens = values.gens ? Number(values.gens) : null;
const doc = {
  kind: "labprof-cprofile",
  total,
  meta: gens ? { profiledGens: Array.from({ length: gens }, (_, i) => i + 1), source: input } : { source: input },
  functions: [...funcs.values()],
};
writeFileSync(output, JSON.stringify(doc));

const top = Number(values.top ?? 25);
const base = (f) => String(f).split(/[\\/]/).pop();
console.log(`total sampled ${total.toFixed(2)} s`);
for (const f of [...funcs.values()].sort((a, b) => b.tottime - a.tottime).slice(0, top))
  console.log(
    `${((100 * f.tottime) / total).toFixed(1).padStart(5)}%  self ${f.tottime.toFixed(2).padStart(6)} s  cum ${((100 * f.cumtime) / total).toFixed(1).padStart(5)}%  ${f.func}  ${base(f.file)}:${f.line}`,
  );

/**
 * Experiment plans for evo-lab (its docs/experiments.md). `draft` writes a plan skeleton to
 * experiments/<id>.md with the standard baseline config; edit it, then register it with evo-lab:
 *
 *   npm run experiment -- draft sensors-compare --design one-at-a-time
 *   node <evo-lab>/bin/lab.js exp new experiments/sensors-compare.md
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** M4's standard baseline: blind models on rock-in-line + point-to-point with asteroids, exam every 10. */
export const STANDARD_BASELINE = {
  generations: 150,
  arenas: [
    { name: "rock-in-line", params: { episodes: 8 } },
    { name: "point-to-point", params: { episodes: 4, asteroids: 20 } },
  ],
  collisions: "obstacles",
  crashMode: "respawn",
  scoring: { distance: 1, success: 1000, time: 0, crashes: 500 },
  heldOut: 2,
  exam: { every: 10, randomTracks: 15 },
};

const DESIGNS = ["one-at-a-time", "leave-one-out", "factorial", "measurement"] as const;

function draft(id: string, design: (typeof DESIGNS)[number]): string {
  const measurement = design === "measurement";
  const header = {
    id,
    question: "TODO: one sentence",
    ...(measurement ? {} : { hypothesis: "TODO: one sentence" }),
    method: "train",
    baseline: { config: STANDARD_BASELINE, ...(measurement ? {} : { runs: ["TODO: stored baseline runs"] }) },
    ...(measurement ? {} : { switches: [{ key: "sensors", on: { whiskers: {} }, note: "TODO" }] }),
    design,
    seeds: [1, 2, 3, 4, 5],
    screen: measurement ? { gen: 50 } : { gen: 50, metric: "exam", k: 2, noise: "paired-se", keep: "better" },
    final: { gen: 150 },
    ...(measurement
      ? { metrics: ["exam", "examCrashes", "examCheckpoints", "score", "success"] }
      : {
          decision: { metric: "exam", gen: 150, k: 2, noise: "paired-se", minWinFraction: 0.8 },
          gate: { gen: 5 },
        }),
  };
  return `# Experiment: ${id}

TODO: what this experiment is for, in two or three sentences.

\`\`\`json experiment
${JSON.stringify(header, null, 2)}
\`\`\`

## Hypothesis

TODO

## Baseline

The standard M4 baseline (\`STANDARD_BASELINE\` in \`packages/node/src/experiment.ts\`): blind models on
\`rock-in-line\` + point-to-point with 20 asteroids, crashes respawn, race exam every 10 generations
(15 random tracks), 150 generations, seeds 1 to 5.

## Runs

TODO: arms × seeds, screen and final generations.

## Decision rule

TODO
`;
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { design: { type: "string", default: "one-at-a-time" }, force: { type: "boolean" } },
});
const [command, id] = positionals;
if (command !== "draft" || !id || !/^[a-z0-9-]+$/.test(id)) {
  console.log(
    "usage: npm run experiment -- draft <id> [--design one-at-a-time|leave-one-out|factorial|measurement]",
  );
  process.exit(command === undefined ? 0 : 1);
}
const design = values.design as (typeof DESIGNS)[number];
if (!DESIGNS.includes(design)) throw new Error(`--design must be one of ${DESIGNS.join(", ")}`);
const file = join(ROOT, "experiments", `${id}.md`);
if (existsSync(file) && !values.force) throw new Error(`${file} exists (use --force to overwrite)`);
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, draft(id, design));
console.log(`wrote ${file}`);

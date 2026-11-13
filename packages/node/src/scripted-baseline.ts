/**
 * Diagnostic: flies the hand-written steering controller and a trained model through exactly the same
 * evaluation (training scenarios of a run's config, its held-out scenarios, the race exam) and prints
 * scores under the run's scoring and under alternatives. Answers "is the learner stuck, or does our
 * score not reward better flying?".
 *
 *   npm run scripted -- --run train-327 --gen 300 [--gens 291-300] [--level last] [--races 100]
 *        [--lab R:/code/simulations/asteroid-racers/lab/runs]
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Level, setLogLevel } from "@ar/shared";
import {
  applyLevel,
  DEFAULT_EXAM,
  GameServer,
  heldOutScenarios,
  MajorTom,
  MemoryModelStore,
  parseArenas,
  parseCurriculum,
  parseScoring,
  registerAITrainingService,
  resolveArenas,
  runExam,
  scoreEpisodes,
  scriptedModel,
  seededRandom,
  type ArenaConfig,
  type EpisodeRecord,
  type ScoringWeights,
} from "@ar/server";

const TICK = 0.015;

/** Counts frames with |turn output| > 0.9 (full-rate spinning) while a phase runs. */
function spinCounter(model: MajorTom) {
  const activate = model.activate.bind(model);
  const counter = { frames: 0, spinning: 0 };
  model.activate = (inputs: ArrayLike<number>) => {
    const out = activate(inputs);
    counter.frames++;
    if (Math.abs(out[1]!) > 0.9) counter.spinning++;
    return out;
  };
  return {
    take() {
      const share = counter.frames === 0 ? 0 : counter.spinning / counter.frames;
      counter.frames = 0;
      counter.spinning = 0;
      return share;
    },
  };
}

export interface SetSummary {
  episodes: number;
  reached: number;
  targets: number;
  finished: number;
  crashes: number;
  meanTime: number | null;
  scores: Record<string, number>;
  spin: number;
}

export function summarize(
  records: EpisodeRecord[],
  scorings: Record<string, ScoringWeights>,
  spin: number,
): SetSummary {
  const done = records.filter((r) => r.reached === r.targets);
  return {
    episodes: records.length,
    reached: records.reduce((n, r) => n + r.reached, 0),
    targets: records.reduce((n, r) => n + r.targets, 0),
    finished: done.length / Math.max(1, records.length),
    crashes: records.reduce((n, r) => n + r.crashes, 0),
    meanTime: done.length ? done.reduce((s, r) => s + r.frames * TICK, 0) / done.length : null,
    scores: Object.fromEntries(
      Object.entries(scorings).map(([k, w]) => [
        k,
        scoreEpisodes(records, w, TICK) / Math.max(1, records.length),
      ]),
    ),
    spin,
  };
}

/**
 * Episodes (same scenario, same index) that both controllers finished without a crash: isolates what
 * flying speed alone is worth under a scoring.
 */
export function cleanComparison(a: EpisodeRecord[], b: EpisodeRecord[], w: ScoringWeights) {
  const pairs = a
    .map((ra, i) => [ra, b[i]!] as const)
    .filter(
      ([ra, rb]) =>
        rb && ra.reached === ra.targets && rb.reached === rb.targets && ra.crashes === 0 && rb.crashes === 0,
    );
  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  return {
    n: pairs.length,
    timeA: mean(pairs.map(([r]) => r.frames * TICK)),
    timeB: mean(pairs.map(([, r]) => r.frames * TICK)),
    scoreA: mean(pairs.map(([r]) => scoreEpisodes([r], w, TICK))),
    scoreB: mean(pairs.map(([, r]) => scoreEpisodes([r], w, TICK))),
  };
}

async function main(): Promise<void> {
  setLogLevel("", Level.SEVERE);
  const { values } = parseArgs({
    options: {
      run: { type: "string", default: "train-327" },
      gen: { type: "string", default: "300" },
      gens: { type: "string" },
      level: { type: "string", default: "last" },
      races: { type: "string", default: "100" },
      lab: { type: "string" },
    },
  });
  const lab = resolve(values.lab ?? join(dirname(fileURLToPath(import.meta.url)), "../../../lab/runs"));
  const runDir = join(lab, values.run!);
  const config = JSON.parse(readFileSync(join(runDir, "config.json"), "utf8")) as Record<string, unknown>;
  const seed = (JSON.parse(readFileSync(join(runDir, "manifest.json"), "utf8")) as { seed: number }).seed;
  const g = Number(values.gen);
  const snapshot = JSON.parse(
    readFileSync(join(runDir, "gens", `g${String(g).padStart(4, "0")}.json`), "utf8"),
  );
  const [from, to] = (values.gens ?? `${g - 9}-${g}`).split("-").map(Number) as [number, number];

  let arenas: ArenaConfig[] = parseArenas(config.arenas);
  if (config.curriculum !== undefined) {
    const c = parseCurriculum(config.curriculum, arenas);
    const level = values.level === "last" ? c.levels.length - 1 : Number(values.level);
    arenas = applyLevel(arenas, c.levels[level]!);
  }
  const frames = typeof config.frames === "number" ? config.frames : 600;
  const ours = parseScoring(config.scoring);
  const scorings: Record<string, ScoringWeights> = {
    ours,
    "time 300": { ...ours, time: 300 },
    "progress 3": { ...ours, progress: 3 },
  };

  const learned = MajorTom.fromJson(snapshot.model);
  learned.name = `${values.run} g${g}`;
  const scripted = scriptedModel();
  const models = [scripted, learned];
  const spins = models.map(spinCounter);

  // Training and held-out flights through the training director, exactly as in a run.
  const server = new GameServer({
    random: seededRandom(seed),
    entityUpdatesPerTick: 0,
    sendOwnShipEveryTick: true,
  });
  const director = registerAITrainingService(server, {
    store: new MemoryModelStore(),
    framesPerTarget: frames,
    arenas,
    scoring: ours,
    collisions: (config.collisions as "obstacles") ?? "none",
    crashMode: (config.crashMode as "respawn") ?? "end",
    scenarioSeed: seed,
    maxGenerations: 0,
    model: { spec: learned.spec, hidden: [1] },
  });
  await server.start();
  const fly = async (scenarios: Parameters<typeof director.fly>[1]) => {
    let done = false;
    const result = director.fly(models, scenarios).then((r) => ((done = true), r));
    for (let i = 0; !done; i++) {
      server.tick();
      if (i % 50 === 0) await new Promise<void>((r) => setImmediate(r));
    }
    return result;
  };

  const sets: Record<string, SetSummary[]> = {};
  const train: EpisodeRecord[][] = models.map(() => []);
  for (let gen = from; gen <= to; gen++) {
    const records = await fly(director.scenariosFor(gen));
    records.forEach((r, i) => train[i]!.push(...r));
  }
  sets[`training g${from}-${to}`] = models.map((_, i) => summarize(train[i]!, scorings, spins[i]!.take()));
  const heldOut = heldOutScenarios(resolveArenas(arenas, frames), seed, 6);
  const held = await fly(heldOut);
  sets["held-out (6 per arena)"] = models.map((_, i) => summarize(held[i]!, scorings, spins[i]!.take()));
  director.stop();
  server.stop();
  const clean = cleanComparison(train[0]!, train[1]!, ours);

  const exam = { ...DEFAULT_EXAM, randomTracks: Number(values.races) };
  const examRows: string[] = [];
  for (const [i, model] of models.entries()) {
    const r = await runExam(model, exam);
    const done = r.flights.filter((f) => f.finished);
    examRows.push(
      `${model.name.padEnd(16)} score ${r.score.toFixed(0).padStart(9)}  checkpoints ${(100 * r.checkpoints).toFixed(1)} %` +
        `  finished ${(100 * r.finished).toFixed(1)} %  crashes ${r.crashes}` +
        `  mean finish ${done.length ? (done.reduce((s, f) => s + f.seconds, 0) / done.length).toFixed(1) : "–"} s` +
        `  spin ${(100 * spins[i]!.take()).toFixed(0)} %`,
    );
  }

  for (const [name, rows] of Object.entries(sets)) {
    console.log(`\n${name}  (score per episode; lower is better)`);
    rows.forEach((s, i) => {
      console.log(
        `${models[i]!.name.padEnd(16)} ` +
          Object.entries(s.scores)
            .map(([k, v]) => `${k} ${v.toFixed(0).padStart(7)}`)
            .join("  ") +
          `  targets ${s.reached}/${s.targets}  finished ${(100 * s.finished).toFixed(1)} %  crashes ${s.crashes}` +
          `  mean time ${s.meanTime === null ? "–" : s.meanTime.toFixed(2)} s  spin ${(100 * s.spin).toFixed(0)} %`,
      );
    });
  }
  console.log(
    `\nlike for like: ${clean.n} training episodes both reached without a crash` +
      ` — mean time ${clean.timeA.toFixed(2)} s vs ${clean.timeB.toFixed(2)} s,` +
      ` mean score ${clean.scoreA.toFixed(0)} vs ${clean.scoreB.toFixed(0)} (${models[0]!.name} vs ${models[1]!.name})`,
  );
  console.log(`\nexam (${exam.tracks.length + exam.randomTracks} races, exam scoring)`);
  for (const row of examRows) console.log(row);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(
    () => process.exit(0),
    (e: unknown) => {
      console.error(e);
      process.exit(1);
    },
  );
}

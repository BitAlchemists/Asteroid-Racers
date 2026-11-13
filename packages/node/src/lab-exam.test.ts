import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundledModels, DEFAULT_LAYOUT, DEFAULT_MODEL_NAME, MajorTom, seededRandom } from "@ar/server";
import { afterAll, describe, expect, it } from "vitest";

/** The exam worker, run exactly as the evo-lab runner calls it (separate process, cwd = run dir). */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const ENTRY = join(ROOT, "scripts", "lab-exam.mjs");
const FAST = { tracks: ["short"], randomTracks: 1, timeLimitSeconds: 10 };
const dirs: string[] = [];

afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

function newRun(config: object): string {
  const dir = tempDir("ar-lab-exam-");
  writeFileSync(join(dir, "config.json"), JSON.stringify(config));
  return dir;
}

/** A finished training run: snapshots at 2 and 4, the final winner (generation 5) only in result.json. */
function sourceRun(): string {
  const dir = tempDir("train-");
  mkdirSync(join(dir, "gens"));
  const model = (seed: number) => MajorTom.random(DEFAULT_LAYOUT, seededRandom(seed)).toJson();
  for (const g of [2, 4])
    writeFileSync(
      join(dir, "gens", `g000${g}.json`),
      JSON.stringify({ format: "asteroid-racers/model-snapshot/v1", g, score: 1, model: model(g) }),
    );
  const winner = bundledModels().load(DEFAULT_MODEL_NAME)![0]!.toJson();
  writeFileSync(join(dir, "result.json"), JSON.stringify({ method: "train", generations: 5, winner }));
  return dir;
}

function run(dir: string, args: string[]): Promise<number> {
  const child = spawn(
    process.execPath,
    [ENTRY, "--config", "config.json", "--out", dir, "--root", ROOT, ...args],
    {
      cwd: dir,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
  return new Promise((resolveExit) =>
    child.on("exit", (code) => {
      if (code !== 0 && !stderr.includes("Error")) console.error(stderr);
      resolveExit(code ?? -1);
    }),
  );
}

interface LabEvent {
  type: string;
  g?: number;
  [key: string]: unknown;
}

const events = (dir: string): LabEvent[] =>
  existsSync(join(dir, "events.jsonl"))
    ? readFileSync(join(dir, "events.jsonl"), "utf8")
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as LabEvent)
    : [];
const result = (dir: string) => readFileSync(join(dir, "result.json"), "utf8");

describe("evo-lab exam worker", () => {
  it("examines the bundled model: hello, one gen with the exam metrics, done", async () => {
    const dir = newRun({ ...FAST, model: "bundled" });
    expect(await run(dir, [])).toBe(0);
    const ev = events(dir);
    expect(ev.map((e) => e.type)).toEqual(["hello", "gen", "done"]);
    expect(ev[1]).toMatchObject({
      g: 1,
      metrics: {
        exam: expect.any(Number),
        examCheckpoints: expect.any(Number),
        examFinished: expect.any(Number),
        examCrashes: expect.any(Number),
      },
    });
    const res = JSON.parse(result(dir)) as { source: string; examined: { flights: unknown[] }[] };
    expect(res.source).toBe("bundled");
    expect(res.examined[0]!.flights).toHaveLength(2);
    expect(result(dir)).not.toMatch(/ar-lab-exam|\d{4}-\d\d-\d\dT/); // no paths, no timestamps
  }, 60_000);

  it("examines an input run's generations: all, last, or a list (g = the source generation)", async () => {
    const source = sourceRun();
    const gensOf = async (spec: string) => {
      const dir = newRun(FAST);
      expect(await run(dir, ["--input-run", source, "--input-gens", spec])).toBe(0);
      return events(dir)
        .filter((e) => e.type === "gen")
        .map((e) => e.g);
    };
    expect(await gensOf("all")).toEqual([2, 4, 5]);
    expect(await gensOf("last")).toEqual([5]);
    expect(await gensOf("4,2")).toEqual([2, 4]);

    const dir = newRun(FAST);
    expect(await run(dir, ["--input-run", source, "--input-gens", "3"])).not.toBe(0);
    expect(String(events(dir).at(-1)!.message)).toMatch(/no model for generation 3/);
  }, 120_000);

  it("is deterministic, and names the source run by its id, not its path", async () => {
    const source = sourceRun();
    const a = newRun(FAST);
    const b = newRun(FAST);
    expect(await run(a, ["--input-run", source, "--input-gens", "all"])).toBe(0);
    expect(await run(b, ["--input-run", source, "--input-gens", "all"])).toBe(0);
    expect(result(b)).toBe(result(a));
    const res = JSON.parse(result(a)) as { source: string };
    expect(res.source).toMatch(/^train-/);
    expect(result(a)).not.toContain(tmpdir().replace(/\\/g, "\\\\"));
  }, 120_000);

  it("fails with an error event when there is nothing to examine or the config is bad", async () => {
    for (const [config, message] of [
      [FAST, /nothing to examine/],
      [{ ...FAST, model: "luke" }, /config.model/],
      [{ model: "bundled", tracks: ["moon"] }, /unknown track/],
    ] as const) {
      const dir = newRun(config);
      expect(await run(dir, [])).not.toBe(0);
      expect(String(events(dir).at(-1)!.message)).toMatch(message);
    }
  }, 60_000);
});

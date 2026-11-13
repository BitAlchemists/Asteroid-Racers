import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

/** The evo-lab worker, exercised exactly as the runner calls it (separate process, cwd = run dir). */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const ENTRY = join(ROOT, "scripts", "lab-train.mjs");
const CONFIG = { sample: 8, frames: 60 };
const dirs: string[] = [];

afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

function newRun(config: object = CONFIG): string {
  const dir = mkdtempSync(join(tmpdir(), "ar-lab-run-"));
  dirs.push(dir);
  writeFileSync(join(dir, "config.json"), JSON.stringify(config));
  return dir;
}

function start(dir: string, args: string[]) {
  const child = spawn(
    process.execPath,
    [ENTRY, "--config", "config.json", "--seed", "7", "--out", dir, "--root", ROOT, ...args],
    { cwd: dir, stdio: ["ignore", "pipe", "pipe"] },
  );
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
  const exited = new Promise<number>((resolveExit) => child.on("exit", (code) => resolveExit(code ?? -1)));
  return { child, exited, stderr: () => stderr };
}

async function run(dir: string, args: string[]): Promise<number> {
  const worker = start(dir, args);
  const code = await worker.exited;
  if (code !== 0) console.error(worker.stderr());
  return code;
}

interface LabEvent {
  type: string;
  t: number;
  g?: number;
  [key: string]: unknown;
}

function events(dir: string): LabEvent[] {
  const file = join(dir, "events.jsonl");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as LabEvent];
      } catch {
        return []; // torn line from a kill
      }
    });
}

const result = (dir: string) => readFileSync(join(dir, "result.json"), "utf8");

describe("evo-lab worker (protocol v1)", () => {
  it("emits hello, gen/checkpoint per generation and done, and exits 0", async () => {
    const dir = newRun();
    expect(await run(dir, ["--to", "3", "--unknown-future-flag", "x"])).toBe(0);
    const ev = events(dir);
    expect(ev.map((e) => e.type)).toEqual([
      "hello",
      "gen",
      "checkpoint",
      "gen",
      "checkpoint",
      "gen",
      "checkpoint",
      "done",
    ]);
    expect(ev.every((e) => typeof e.t === "number")).toBe(true);
    expect(ev.filter((e) => e.type === "gen").map((e) => e.g)).toEqual([1, 2, 3]);
    const gen = ev[1]!;
    expect(gen.metrics).toMatchObject({
      score: expect.any(Number),
      mean: expect.any(Number),
      worst: expect.any(Number),
      success: expect.any(Number),
    });
    expect(gen.metrics).not.toHaveProperty("heldOut");
    expect(ev[0]).toMatchObject({ protocol: 1, method: "train", seed: 7, to: 3, resume: false });
    expect(ev[0]!.versions).toMatchObject({
      node: process.version,
      tsx: expect.stringMatching(/^\d+\.\d+\.\d+/),
      "@bufbuild/protobuf": expect.stringMatching(/^\d+\.\d+\.\d+/),
    });
    expect(ev.at(-1)).toMatchObject({ g: 3, result: "result.json" });

    const res = JSON.parse(result(dir)) as Record<string, unknown>;
    expect(res).toMatchObject({ method: "train", seed: 7, generations: 3 });
    expect(result(dir)).not.toMatch(/ar-lab-run|\d{4}-\d\d-\d\dT/); // no paths, no timestamps
    expect(existsSync(join(dir, "luke.txt"))).toBe(true);
  }, 60_000);

  it("--every K checkpoints every K generations and always at the end", async () => {
    const dir = newRun();
    expect(await run(dir, ["--to", "5", "--every", "2"])).toBe(0);
    expect(
      events(dir)
        .filter((e) => e.type === "checkpoint")
        .map((e) => e.g),
    ).toEqual([2, 4, 5]);
  }, 60_000);

  it("exact resume: stop at 2 and continue to 5 = uninterrupted run to 5, byte for byte", async () => {
    const straight = newRun();
    expect(await run(straight, ["--to", "5"])).toBe(0);

    const resumed = newRun();
    expect(await run(resumed, ["--to", "2"])).toBe(0);
    expect(await run(resumed, ["--resume", "--to", "5"])).toBe(0);

    expect(result(resumed)).toBe(result(straight));
    const hellos = events(resumed).filter((e) => e.type === "hello");
    expect(hellos.map((e) => e.resume)).toEqual([false, true]);
  }, 120_000);

  it.each([
    ["legacy", { sample: 12, frames: 150 }],
    [
      "point-to-point with asteroids",
      {
        sample: 12,
        frames: 150,
        arenas: [{ name: "point-to-point", params: { episodes: 3, asteroids: 10 } }],
        collisions: "obstacles",
        heldOut: 1,
      },
    ],
  ])(
    "exact resume after being killed mid-run (pause = tree kill): %s",
    async (_name, config) => {
      const straight = newRun(config);
      expect(await run(straight, ["--to", "8"])).toBe(0);

      const killed = newRun(config);
      const worker = start(killed, ["--to", "8"]);
      const deadline = Date.now() + 30_000;
      while (!events(killed).some((e) => e.type === "checkpoint" && (e.g ?? 0) >= 2)) {
        if (Date.now() > deadline) throw new Error("no checkpoint");
        await new Promise((r) => setTimeout(r, 10));
      }
      worker.child.kill("SIGKILL");
      await worker.exited;
      expect(events(killed).some((e) => e.type === "done")).toBe(false);

      expect(await run(killed, ["--resume", "--to", "8"])).toBe(0);
      expect(result(killed)).toBe(result(straight));
    },
    120_000,
  );

  it("exact resume with point-to-point arenas, obstacles and held-out scenarios", async () => {
    const config = {
      sample: 6,
      frames: 60,
      arenas: [{ name: "point-to-point", params: { episodes: 2, asteroids: 8 } }],
      collisions: "obstacles",
      scoring: { distance: 1, success: 500, crashes: 100 },
      heldOut: 1,
      brain: { inputs: ["targetAngle", "targetDistance", "speed"], hidden: [5] },
    };
    const straight = newRun(config);
    expect(await run(straight, ["--to", "4"])).toBe(0);
    const gens = events(straight).filter((e) => e.type === "gen");
    expect(gens[0]!.metrics).toMatchObject({
      heldOut: expect.any(Number),
      heldOutSuccess: expect.any(Number),
    });

    const resumed = newRun(config);
    expect(await run(resumed, ["--to", "2"])).toBe(0);
    expect(await run(resumed, ["--resume", "--to", "4"])).toBe(0);
    expect(result(resumed)).toBe(result(straight));
    const res = JSON.parse(result(straight)) as { winner: { spec: unknown; input_neurons_count: number } };
    expect(res.winner.spec).toEqual({
      inputs: ["targetAngle", "targetDistance", "speed"],
      outputs: "thrustTurn",
    });
    expect(res.winner.input_neurons_count).toBe(3);
  }, 120_000);

  it("rejects unknown arenas and bad config values before running", async () => {
    for (const [config, message] of [
      [{ arenas: [{ name: "moon" }] }, /unknown arena/],
      [{ collisions: "some" }, /collisions/],
      [{ scoring: { speed: 1 } }, /unknown scoring term/],
      [{ brain: { inputs: ["sonar"] } }, /unknown brain inputs/],
    ] as const) {
      const dir = newRun(config);
      expect(await run(dir, ["--to", "1"])).not.toBe(0);
      expect(String(events(dir).at(-1)!.message)).toMatch(message);
    }
  }, 60_000);

  it("reports bad input with an error event and a non-zero exit", async () => {
    const dir = newRun({ sample: 1 });
    expect(await run(dir, ["--to", "2"])).not.toBe(0);
    const last = events(dir).at(-1)!;
    expect(last.type).toBe("error");
    expect(String(last.message)).toMatch(/sample/);
  }, 60_000);
});

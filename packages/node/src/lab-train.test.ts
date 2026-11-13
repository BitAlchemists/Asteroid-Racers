import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EntityType } from "@ar/shared";
import { ArenaReplay, MajorTom, parseArenas, type NetworkJson } from "@ar/server";
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
      ticks: expect.any(Number),
      tps: expect.any(Number),
    });
    expect((gen.metrics as { ticks: number }).ticks).toBeGreaterThan(0);
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
    expect(result(dir)).not.toMatch(/"ticks"|"tps"/); // speed stays out of the result
    expect(existsSync(join(dir, "luke.txt"))).toBe(true);
  }, 60_000);

  it("saves the winner as gens/gNNNN.json every snapshotEvery generations and names it on the gen event", async () => {
    const dir = newRun({ ...CONFIG, snapshotEvery: 2 });
    expect(await run(dir, ["--to", "5"])).toBe(0);
    const gens = events(dir).filter((e) => e.type === "gen");
    expect(gens.map((e) => e.snapshot ?? null)).toEqual([
      null,
      "gens/g0002.json",
      null,
      "gens/g0004.json",
      "gens/g0005.json",
    ]);
    const last = JSON.parse(readFileSync(join(dir, "gens", "g0005.json"), "utf8")) as Record<string, unknown>;
    const res = JSON.parse(result(dir)) as Record<string, unknown>;
    expect(last).toMatchObject({ format: "asteroid-racers/model-snapshot/v1", g: 5, score: res.bestScore });
    expect(last.model).toEqual(res.winner);
    // A trace of the winner's episodes, for thumbnails: one arena (legacy), 16 episodes with paths.
    const trace = last.trace as { arena: string; episodes: { path: number[]; targets: unknown[] }[] }[];
    expect(trace.map((a) => a.arena)).toEqual(["legacy"]);
    expect(trace[0]!.episodes).toHaveLength(16);
    expect(trace[0]!.episodes.every((e) => e.path.length >= 4 && e.targets.length === 1)).toBe(true);

    // Snapshots don't change the result.
    const plain = newRun({ ...CONFIG, snapshotEvery: 0 });
    expect(await run(plain, ["--to", "5"])).toBe(0);
    const { config: _a, ...withSnapshots } = res;
    const { config: _b, ...without } = JSON.parse(result(plain)) as Record<string, unknown>;
    expect(without).toEqual(withSnapshots);
    expect(
      events(plain)
        .filter((e) => e.snapshot)
        .map((e) => e.g),
    ).toEqual([5]);
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
    // The per-generation state hash (evo-lab's baseline gate) is the same sequence either way.
    const hashes = (dir: string) =>
      events(dir)
        .filter((e) => e.type === "gen")
        .map((e) => [e.g, e.stateHash, e.stateHashRepr]);
    expect(hashes(resumed)).toEqual(hashes(straight));
    expect(new Set(hashes(straight).map((h) => h[1])).size).toBe(5);
    expect(hashes(straight)[0]![2]).toBe("asteroid-racers/state-v1");
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
      model: { inputs: ["targetAngle", "targetDistance", "speed"], hidden: [5] },
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

  it("sensors and hidden are switches: the winner carries them, and exact resume holds", async () => {
    const config = {
      sample: 6,
      frames: 60,
      arenas: [{ name: "point-to-point", params: { episodes: 2, asteroids: 15 } }],
      collisions: "obstacles",
      sensors: { whiskers: { count: 5 }, lineCheck: {} },
      hidden: [6],
    };
    const straight = newRun(config);
    expect(await run(straight, ["--to", "4"])).toBe(0);
    const resumed = newRun(config);
    expect(await run(resumed, ["--to", "2"])).toBe(0);
    expect(await run(resumed, ["--resume", "--to", "4"])).toBe(0);
    expect(result(resumed)).toBe(result(straight));
    const res = JSON.parse(result(straight)) as {
      config: Record<string, unknown>;
      winner: { input_neurons_count: number; layers: unknown[][]; spec: { sensors: { type: string }[] } };
    };
    expect(res.config.sensors).toEqual({
      whiskers: { count: 5, spread: 180, range: 600 },
      lineCheck: { range: 1000 },
    });
    expect(res.winner.spec.sensors.map((s) => s.type)).toEqual(["whiskers", "lineCheck"]);
    expect(res.winner.input_neurons_count).toBe(4 + 5 + 2);
    expect(res.winner.layers[0]).toHaveLength(6);
  }, 120_000);

  it("setup switches (encoding, mutation, parents, initRange, time-mode sensors): exact resume holds", async () => {
    const config = {
      sample: 8,
      frames: 60,
      arenas: [{ name: "rock-in-line", params: { episodes: 2 } }],
      collisions: "obstacles",
      crashMode: "respawn",
      encoding: "v2",
      mutation: { kind: "gaussian", sigma: 0.3 },
      parents: 2,
      initRange: 2,
      sensors: { lineCheck: { horizon: 2 }, nearest: { k: 1, flag: 1 } },
      hidden: [5],
    };
    const straight = newRun(config);
    expect(await run(straight, ["--to", "4"])).toBe(0);
    const resumed = newRun(config);
    expect(await run(resumed, ["--to", "2"])).toBe(0);
    const ckpt = JSON.parse(readFileSync(join(resumed, "ckpt.json"), "utf8")) as { parents: unknown[] };
    expect(ckpt.parents).toHaveLength(2);
    expect(await run(resumed, ["--resume", "--to", "4"])).toBe(0);
    expect(result(resumed)).toBe(result(straight));
    const res = JSON.parse(result(straight)) as {
      config: Record<string, unknown>;
      winner: { input_neurons_count: number; spec: { inputs: string[]; sensors: unknown[] } };
    };
    expect(res.config).toMatchObject({
      encoding: "v2",
      mutation: { kind: "gaussian", sigma: 0.3 },
      parents: 2,
    });
    expect(res.winner.spec.inputs).toEqual([
      "targetSin",
      "targetCos",
      "targetDistanceSoft",
      "forwardSpeed",
      "sideSpeed",
    ]);
    expect(res.winner.spec.sensors).toEqual([
      { type: "nearest", k: 1, range: 800, flag: 1 },
      { type: "lineCheck", range: 2500, horizon: 2 },
    ]);
    expect(res.winner.input_neurons_count).toBe(5 + 4 + 2);
    // The stateHash of every generation covers the kept parents too: equal runs, equal hashes.
    const hashes = (dir: string) =>
      events(dir)
        .filter((e) => e.type === "gen")
        .map((e) => e.stateHash);
    expect(hashes(resumed)).toEqual(hashes(straight));
  }, 120_000);

  it("crashLimit switch: deterministic, exact resume after a kill, and it changes the run", async () => {
    const config = {
      // Dense rocks and strong random weights: the winners crash several times per episode.
      sample: 8,
      frames: 400,
      initRange: 3,
      arenas: [{ name: "point-to-point", params: { episodes: 3, asteroids: 150 } }],
      collisions: "obstacles",
      crashMode: "respawn",
      crashLimit: 2,
      scoring: { distance: 1, success: 1000, crashes: 0 },
      heldOut: 1,
    };
    const straight = newRun(config);
    expect(await run(straight, ["--to", "6"])).toBe(0);
    const again = newRun(config);
    expect(await run(again, ["--to", "6"])).toBe(0);
    expect(result(again)).toBe(result(straight));
    expect((JSON.parse(result(straight)) as { config: unknown }).config).toMatchObject({ crashLimit: 2 });
    // No episode of any winner goes past the limit, and some end at it.
    const crashes = events(straight)
      .filter((e) => e.type === "gen")
      .flatMap((gen) => {
        const file = join(straight, String(gen.snapshot));
        const snap = JSON.parse(readFileSync(file, "utf8")) as {
          trace: { episodes: { crashes: number }[] }[];
        };
        return snap.trace.flatMap((a) => a.episodes.map((e) => e.crashes));
      });
    expect(Math.max(...crashes)).toBe(2);

    const killed = newRun(config);
    const worker = start(killed, ["--to", "6"]);
    const deadline = Date.now() + 60_000;
    while (!events(killed).some((e) => e.type === "checkpoint" && (e.g ?? 0) >= 2)) {
      if (Date.now() > deadline) throw new Error("no checkpoint");
      await new Promise((r) => setTimeout(r, 10));
    }
    worker.child.kill("SIGKILL");
    await worker.exited;
    expect(events(killed).some((e) => e.type === "done")).toBe(false);
    expect(await run(killed, ["--resume", "--to", "6"])).toBe(0);
    expect(result(killed)).toBe(result(straight));

    // The switch does something: without it the same seed runs differently.
    const { crashLimit: _limit, ...unlimited } = config;
    const off = newRun(unlimited);
    expect(await run(off, ["--to", "6"])).toBe(0);
    const hashes = (dir: string) =>
      events(dir)
        .filter((e) => e.type === "gen")
        .map((e) => e.stateHash);
    expect(hashes(off)).not.toEqual(hashes(straight));
  }, 180_000);

  it("curriculum switch: levels go up with success, exact resume holds, snapshots replay the right level", async () => {
    // Targets 10–20 units from the start (inside the 50-unit target radius): every episode succeeds,
    // so with streak 1 the run climbs one level per generation.
    const config = {
      sample: 6,
      frames: 60,
      arenas: [
        { name: "point-to-point", params: { episodes: 2, distance: [10, 20] } },
        { name: "rock-in-line", params: { episodes: 1 } },
      ],
      collisions: "obstacles",
      heldOut: 1,
      // 2 of 3 targets are reached for sure (rock-in-line may fail), so success ≥ 0.6 every generation.
      curriculum: {
        levels: [
          { "rock-in-line": { rocks: 0 } },
          { "rock-in-line": { rocks: 1 } },
          { "rock-in-line": { rocks: 2 } },
        ],
        success: 0.6,
        streak: 1,
      },
    };
    const straight = newRun(config);
    expect(await run(straight, ["--to", "4"])).toBe(0);
    const levels = events(straight)
      .filter((e) => e.type === "gen")
      .map((e) => (e.metrics as { level: number }).level);
    expect(levels).toEqual([0, 1, 2, 2]);
    const snap = (g: number) =>
      JSON.parse(readFileSync(join(straight, "gens", `g000${g}.json`), "utf8")) as {
        arenas: { name: string; params: Record<string, unknown> }[];
        trace: { obstacles: unknown[] }[];
        model: NetworkJson;
      };
    expect(snap(1).arenas[1]!.params.rocks).toBe(0);
    expect(snap(2).arenas[1]!.params.rocks).toBe(1);
    expect(snap(1).trace[1]!.obstacles).toHaveLength(0);
    expect(snap(3).trace[1]!.obstacles).toHaveLength(2);
    // A replay built from the snapshot's arenas places exactly the obstacles training flew.
    const replay = await ArenaReplay.create({
      model: MajorTom.fromJson(snap(2).model),
      arenas: parseArenas(snap(2).arenas),
      frames: 60,
      collisions: "obstacles",
      crashMode: "end",
      seed: 7,
      g: 2,
      arenaIndex: 1,
    });
    const rocks = [...replay.server.world.entities.values()].filter((e) => e.type === EntityType.ASTEROID);
    const round = (v: number) => Math.round(v * 10) / 10; // traces store 0.1 units
    expect(rocks.map((r) => [round(r.position.x), round(r.position.y), round(r.radius)])).toEqual(
      snap(2).trace[1]!.obstacles,
    );
    expect(rocks).toHaveLength(1);
    replay.dispose();

    const resumed = newRun(config);
    expect(await run(resumed, ["--to", "2"])).toBe(0);
    const ckpt = JSON.parse(readFileSync(join(resumed, "ckpt.json"), "utf8")) as { curriculum: unknown };
    expect(ckpt.curriculum).toEqual({ level: 2, streak: 0 });
    expect(await run(resumed, ["--resume", "--to", "4"])).toBe(0);
    expect(result(resumed)).toBe(result(straight));
    const hashes = (dir: string) =>
      events(dir)
        .filter((e) => e.type === "gen")
        .map((e) => e.stateHash);
    expect(hashes(resumed)).toEqual(hashes(straight));
    const res = JSON.parse(result(straight)) as {
      config: { curriculum: { success: number; streak: number } };
    };
    expect(res.config.curriculum).toMatchObject({ success: 0.6, streak: 1 });
  }, 120_000);

  /** Runs `config` to 4 in one go and as 2 + resume to 4; both must give the same result and hashes. */
  async function exactResume(config: object): Promise<string> {
    const straight = newRun(config);
    expect(await run(straight, ["--to", "4"])).toBe(0);
    const resumed = newRun(config);
    expect(await run(resumed, ["--to", "2"])).toBe(0);
    expect(await run(resumed, ["--resume", "--to", "4"])).toBe(0);
    expect(result(resumed)).toBe(result(straight));
    const hashes = (dir: string) =>
      events(dir)
        .filter((e) => e.type === "gen")
        .map((e) => e.stateHash);
    expect(hashes(resumed)).toEqual(hashes(straight));
    return straight;
  }

  /** Kill-and-resume: a run killed after its checkpoint at g ≥ 2 and resumed to `to` = a straight run. */
  async function killResume(config: object, to = 6): Promise<string> {
    const straight = newRun(config);
    expect(await run(straight, ["--to", String(to)])).toBe(0);
    const killed = newRun(config);
    const worker = start(killed, ["--to", String(to)]);
    const deadline = Date.now() + 60_000;
    while (!events(killed).some((e) => e.type === "checkpoint" && (e.g ?? 0) >= 2)) {
      if (Date.now() > deadline) throw new Error("no checkpoint");
      await new Promise((r) => setTimeout(r, 10));
    }
    worker.child.kill("SIGKILL");
    await worker.exited;
    expect(await run(killed, ["--resume", "--to", String(to)])).toBe(0);
    expect(result(killed)).toBe(result(straight));
    const hashes = (dir: string) =>
      events(dir)
        .filter((e) => e.type === "gen")
        .map((e) => [e.g, e.stateHash]);
    // A killed run may repeat generations after its checkpoint; the last hash per generation counts.
    expect(Object.fromEntries(hashes(killed))).toEqual(Object.fromEntries(hashes(straight)));
    return straight;
  }

  /** Replays a training snapshot's arena `index` and returns (reached, crashes) per episode, and the trace's. */
  async function replayEpisodes(
    dir: string,
    g: number,
    index: number,
    config: {
      frames: number;
      collisions: string;
      crashMode?: string;
      arenas: unknown;
      inputDelay?: number;
      inputNoise?: number;
    },
  ) {
    const snap = JSON.parse(
      readFileSync(join(dir, "gens", `g${String(g).padStart(4, "0")}.json`), "utf8"),
    ) as {
      arenas?: unknown;
      model: NetworkJson;
      trace: { episodes: { reached: number; crashes: number }[] }[];
    };
    const replay = await ArenaReplay.create({
      model: MajorTom.fromJson(snap.model),
      arenas: parseArenas(snap.arenas ?? config.arenas),
      frames: config.frames,
      collisions: config.collisions as "obstacles",
      crashMode: (config.crashMode ?? "end") as "end",
      seed: 7,
      g,
      arenaIndex: index,
      ...(config.inputDelay === undefined ? {} : { inputDelay: config.inputDelay }),
      ...(config.inputNoise === undefined ? {} : { inputNoise: config.inputNoise }),
    });
    while (!replay.done) replay.step(200);
    const replayed = replay.records.map((r) => [r.reached, r.crashes]);
    replay.dispose();
    return { replayed, traced: snap.trace[index]!.episodes.map((e) => [e.reached, e.crashes]) };
  }

  it("reevaluate switch: re-scored finalists pick the winner, exact resume, metrics on gen events", async () => {
    const config = {
      sample: 8,
      frames: 60,
      arenas: [{ name: "point-to-point", params: { episodes: 2, asteroids: 10 } }],
      collisions: "obstacles",
      parents: 2,
      reevaluate: { top: 2, episodes: 3 },
    };
    const dir = await exactResume(config);
    const gens = events(dir).filter((e) => e.type === "gen");
    for (const e of gens) {
      const m = e.metrics as { reevalScore?: number; reevalSuccess?: number };
      expect(typeof m.reevalScore).toBe("number");
      expect(m.reevalSuccess).toBeGreaterThanOrEqual(0);
    }
    const res = JSON.parse(result(dir)) as { config: Record<string, unknown> };
    expect(res.config.reevaluate).toEqual({ top: 2, episodes: 3 });
    // It changes selection: the same run without the switch takes a different path.
    const { reevaluate: _off, ...plain } = config;
    const without = newRun(plain);
    expect(await run(without, ["--to", "4"])).toBe(0);
    const hashes = (d: string) =>
      events(d)
        .filter((e) => e.type === "gen")
        .map((e) => e.stateHash);
    expect(hashes(without)).not.toEqual(hashes(dir));
  }, 180_000);

  it("curriculum keepEasy: earlier-level episodes are mixed in after a level-up, replay and resume stay exact", async () => {
    const config = {
      sample: 6,
      frames: 60,
      arenas: [
        { name: "point-to-point", params: { episodes: 2, distance: [10, 20] } },
        { name: "rock-in-line", params: { episodes: 4 } },
      ],
      collisions: "obstacles",
      // The point-to-point episode on the current level is always reached (1 of 3 judged episodes).
      curriculum: {
        levels: [
          { "rock-in-line": { rocks: 0 } },
          { "rock-in-line": { rocks: 1 } },
          { "rock-in-line": { rocks: 2 } },
        ],
        success: 0.3,
        streak: 1,
        keepEasy: 0.5,
      },
    };
    const dir = await exactResume(config);
    const levels = events(dir)
      .filter((e) => e.type === "gen")
      .map((e) => (e.metrics as { level: number }).level);
    expect(levels).toEqual([0, 1, 2, 2]);
    const snap = (g: number) =>
      JSON.parse(readFileSync(join(dir, "gens", `g000${g}.json`), "utf8")) as {
        arenas: { name: string; params: { episodes: number; rocks?: number } }[];
        trace: { episodes: unknown[] }[];
      };
    // Level 0 mixes nothing (the plain level arenas); level 2 has 1 + 2 regular and 1 + 2 easy episodes.
    expect(snap(1).arenas).toHaveLength(2);
    const g3 = snap(3).arenas;
    expect(g3.map((a) => [a.name, a.params.episodes])).toEqual([
      ["point-to-point", 1],
      ["rock-in-line", 2],
      ["point-to-point", 1],
      ["rock-in-line", 2],
    ]);
    expect(g3[1]!.params.rocks).toBe(2);
    expect([0, 1]).toContain(g3[3]!.params.rocks);
    expect(snap(3).trace).toHaveLength(4);
    // A replay of the mixed-in easy rock-in-line run matches what training recorded.
    const { replayed, traced } = await replayEpisodes(dir, 3, 3, config);
    expect(replayed).toEqual(traced);
    const res = JSON.parse(result(dir)) as { config: { curriculum: { keepEasy: number } } };
    expect(res.config.curriculum.keepEasy).toBe(0.5);
  }, 180_000);

  it("standard Gaussian mutation (all weights, sigma 0.03) and a linear policy: deterministic, exact resume, replay", async () => {
    const arenas = [{ name: "point-to-point", params: { episodes: 2, asteroids: 5 } }];
    const gaussian = {
      sample: 6,
      frames: 60,
      arenas,
      collisions: "obstacles",
      mutation: { kind: "gaussian", sigma: 0.03, rate: 1 },
    };
    await exactResume(gaussian);
    const linear = { sample: 6, frames: 60, arenas, collisions: "obstacles", hidden: [] };
    const dir = await exactResume(linear);
    const res = JSON.parse(result(dir)) as { winner: { input_neurons_count: number; layers: number[][][] } };
    expect(res.winner.layers).toHaveLength(1); // inputs → outputs, no hidden layer
    expect(res.winner.layers[0]).toHaveLength(2);
    const { replayed, traced } = await replayEpisodes(dir, 4, 0, linear);
    expect(replayed).toEqual(traced);
  }, 180_000);

  it("lookahead switch: next-leg inputs appended to the spec, exact resume, replay, the exam's bot flies it", async () => {
    const config = {
      sample: 6,
      frames: 60,
      // M5's chain arena: 3–5 targets per episode, so the lookahead inputs see real legs.
      arenas: [{ name: "chain", params: { episodes: 2 } }],
      collisions: "obstacles",
      encoding: "v2",
      lookahead: 2,
      exam: { every: 4, tracks: ["demo"], randomTracks: 0, timeLimitSeconds: 5 },
    };
    const dir = await exactResume(config);
    const res = JSON.parse(result(dir)) as {
      config: Record<string, unknown>;
      winner: { input_neurons_count: number; spec: { inputs: string[] } };
    };
    expect(res.config.lookahead).toBe(2);
    expect(res.winner.spec.inputs.slice(5)).toEqual([
      "next2Present",
      "next2Sin",
      "next2Cos",
      "next2DistanceSoft",
      "next3Present",
      "next3Sin",
      "next3Cos",
      "next3DistanceSoft",
    ]);
    expect(res.winner.input_neurons_count).toBe(13);
    const examined = events(dir).filter((e) => e.type === "gen" && e.g === 4)[0]!.metrics as Record<
      string,
      unknown
    >;
    expect(examined.examCheckpoints).toEqual(expect.any(Number));
    const { replayed, traced } = await replayEpisodes(dir, 4, 0, config);
    expect(replayed).toEqual(traced);
  }, 180_000);

  it("inputDelay / inputNoise switches and the robustness exam: deterministic, kill-and-resume, replay, 0 = absent", async () => {
    const base = {
      sample: 6,
      frames: 60,
      arenas: [{ name: "point-to-point", params: { episodes: 2, asteroids: 5 } }],
      collisions: "obstacles",
    };
    const exam = { every: 3, tracks: ["short"], randomTracks: 1, timeLimitSeconds: 5 };
    const config = {
      ...base,
      inputDelay: 4,
      inputNoise: 0.05,
      exam: { ...exam, inputDelay: 4, inputNoise: 0.1 },
    };
    const dir = await killResume(config);
    const { replayed, traced } = await replayEpisodes(dir, 6, 0, config);
    expect(replayed).toEqual(traced);
    const metricsAt = (d: string, g: number) =>
      events(d).filter((e) => e.type === "gen" && e.g === g)[0]!.metrics as Record<string, number>;
    expect(metricsAt(dir, 3)).toMatchObject({
      exam: expect.any(Number),
      examRobust: expect.any(Number),
      examRobustCheckpoints: expect.any(Number),
      examRobustFinished: expect.any(Number),
      examRobustCrashes: expect.any(Number),
    });
    // The plain exam is the exam without delay and noise: the same as in a run without them.
    const plainExamRun = newRun({ ...config, exam });
    expect(await run(plainExamRun, ["--to", "3"])).toBe(0);
    expect(metricsAt(plainExamRun, 3).exam).toBe(metricsAt(dir, 3).exam);
    expect(metricsAt(plainExamRun, 3)).not.toHaveProperty("examRobust");
    // Training with delay and noise changes the run; 0 is the same as absent, byte for byte.
    const plain = newRun(base);
    expect(await run(plain, ["--to", "3"])).toBe(0);
    const zero = newRun({ ...base, inputDelay: 0, inputNoise: 0 });
    expect(await run(zero, ["--to", "3"])).toBe(0);
    const strip = (d: string) => {
      const { config: _c, ...rest } = JSON.parse(result(d)) as Record<string, unknown>;
      return rest;
    };
    expect(strip(zero)).toEqual(strip(plain));
    const short = newRun(config);
    expect(await run(short, ["--to", "3"])).toBe(0);
    expect(strip(short)).not.toEqual(strip(plain));
  }, 240_000);

  it("crossover switch: deterministic, kill-and-resume, replay; rate 0 = absent", async () => {
    const base = {
      sample: 8,
      frames: 60,
      arenas: [{ name: "point-to-point", params: { episodes: 2, asteroids: 5 } }],
      collisions: "obstacles",
      mutation: { kind: "gaussian", sigma: 0.2 },
      parents: 2,
    };
    for (const kind of ["uniform", "layer"]) {
      const config = { ...base, crossover: { kind, rate: 0.5 } };
      const dir = await killResume(config);
      expect(JSON.parse(result(dir)).config.crossover).toEqual({ kind, rate: 0.5 });
      const { replayed, traced } = await replayEpisodes(dir, 6, 0, config);
      expect(replayed).toEqual(traced);
    }
    const strip = (d: string) => {
      const { config: _c, ...rest } = JSON.parse(result(d)) as Record<string, unknown>;
      return rest;
    };
    const plain = newRun(base);
    expect(await run(plain, ["--to", "3"])).toBe(0);
    const zero = newRun({ ...base, crossover: { kind: "uniform", rate: 0 } });
    expect(await run(zero, ["--to", "3"])).toBe(0);
    expect(strip(zero)).toEqual(strip(plain));
    const crossed = newRun({ ...base, crossover: { kind: "uniform", rate: 1 } });
    expect(await run(crossed, ["--to", "3"])).toBe(0);
    expect(strip(crossed)).not.toEqual(strip(plain));
  }, 240_000);

  it("exam switch: race metrics on every N-th generation, results and resume unchanged", async () => {
    const exam = { every: 2, tracks: ["short"], randomTracks: 1, timeLimitSeconds: 10 };
    const withExam = newRun({ ...CONFIG, exam });
    expect(await run(withExam, ["--to", "5"])).toBe(0);
    const ev = events(withExam);
    const gens = ev.filter((e) => e.type === "gen");
    const examined = gens
      .filter((e) => (e.metrics as Record<string, unknown>).exam !== undefined)
      .map((e) => e.g);
    expect(examined).toEqual([2, 4, 5]);
    expect(gens[1]!.metrics).toMatchObject({
      exam: expect.any(Number),
      examCheckpoints: expect.any(Number),
      examFinished: expect.any(Number),
      examCrashes: expect.any(Number),
    });
    // Every gen event comes before its checkpoint, in generation order.
    const order = ev.filter((e) => e.type === "gen" || e.type === "checkpoint").map((e) => `${e.type}${e.g}`);
    expect(order).toEqual([
      "gen1",
      "checkpoint1",
      "gen2",
      "checkpoint2",
      "gen3",
      "checkpoint3",
      "gen4",
      "checkpoint4",
      "gen5",
      "checkpoint5",
    ]);

    const plain = newRun(CONFIG);
    expect(await run(plain, ["--to", "5"])).toBe(0);
    const strip = (dir: string) => {
      const { config: _c, ...rest } = JSON.parse(result(dir)) as Record<string, unknown>;
      return rest;
    };
    expect(strip(withExam)).toEqual(strip(plain));

    const resumed = newRun({ ...CONFIG, exam });
    expect(await run(resumed, ["--to", "3"])).toBe(0);
    expect(await run(resumed, ["--resume", "--to", "5"])).toBe(0);
    expect(result(resumed)).toBe(result(withExam));
    const examOf = (dir: string, g: number) =>
      (
        events(dir)
          .filter((e) => e.type === "gen" && e.g === g)
          .at(-1)!.metrics as Record<string, unknown>
      ).exam;
    expect(examOf(resumed, 4)).toBe(examOf(withExam, 4));
  }, 180_000);

  it("rejects unknown arenas and bad config values before running", async () => {
    for (const [config, message] of [
      [{ arenas: [{ name: "moon" }] }, /unknown arena/],
      [{ collisions: "some" }, /collisions/],
      [{ scoring: { speed: 1 } }, /unknown scoring term/],
      [{ model: { inputs: ["sonar"] } }, /unknown model inputs/],
      [{ sensors: { sonar: {} } }, /unknown sensor/],
      [{ hidden: [0] }, /hidden/],
      [{ exam: { every: 0 } }, /exam.every/],
      [{ exam: { tracks: ["moon"] } }, /unknown track/],
      [{ brain: { inputs: ["sonar"] } }, /unknown model inputs/], // old key name still read
      [{ encoding: "v9" }, /config.encoding/],
      [{ encoding: "v2", model: { inputs: ["speed"] } }, /cannot both be set/],
      [{ mutation: { kind: "cauchy" } }, /mutation.kind/],
      [{ mutation: { kind: "gaussian", sigma: 0 } }, /sigma/],
      [{ sample: 10, parents: 3 }, /parents/],
      [{ initRange: -1 }, /initRange/],
      [{ crashLimit: 0 }, /crashLimit/],
      [{ crashLimit: 1.5 }, /crashLimit/],
      [{ curriculum: { levels: [{}] } }, /at least 2 levels/],
      [{ curriculum: { levels: [{}, { moon: {} }] } }, /not in config.arenas/],
      [{ curriculum: { success: 2 } }, /curriculum.success/],
      [{ curriculum: { pace: 1 } }, /unknown config.curriculum keys/],
      [{ curriculum: { keepEasy: 1 } }, /keepEasy/],
      [{ reevaluate: { top: 0 } }, /reevaluate.top/],
      [{ reevaluate: { episodes: 2.5 } }, /reevaluate.episodes/],
      [{ reevaluate: { rounds: 2 } }, /unknown config.reevaluate keys/],
      [{ sensors: { nearest: { horizon: 1 } } }, /unknown parameter/],
      [{ lookahead: 3 }, /lookahead/],
      [{ lookahead: 0 }, /lookahead/],
      [{ inputDelay: -1 }, /config.inputDelay/],
      [{ inputDelay: 2.5 }, /config.inputDelay/],
      [{ inputNoise: -0.1 }, /config.inputNoise/],
      [{ exam: { inputDelay: 1.5 } }, /exam.inputDelay/],
      [{ crossover: { kind: "uniform" } }, /needs config.parents/],
      [{ sample: 10, parents: 2, crossover: { kind: "blend" } }, /crossover.kind/],
      [{ sample: 10, parents: 2, crossover: { kind: "layer", rate: 2 } }, /crossover.rate/],
      [{ sample: 10, parents: 2, crossover: { kind: "layer", mix: 1 } }, /unknown config.crossover keys/],
    ] as const) {
      const dir = newRun(config);
      expect(await run(dir, ["--to", "1"])).not.toBe(0);
      expect(String(events(dir).at(-1)!.message)).toMatch(message);
    }
  }, 60_000);

  it.each(["legacy", "p2p"])(
    "with no new switches, reproduces the stored %s baseline result byte for byte",
    async (name) => {
      const fixtures = join(ROOT, "packages", "node", "src", "fixtures");
      const config = JSON.parse(
        readFileSync(join(fixtures, `baseline-${name}.config.json`), "utf8"),
      ) as object;
      const dir = newRun(config);
      const child = spawn(
        process.execPath,
        [ENTRY, "--config", "config.json", "--seed", "3", "--out", dir, "--root", ROOT, "--to", "4"],
        { cwd: dir, stdio: "ignore" },
      );
      expect(await new Promise((r) => child.on("exit", r))).toBe(0);
      expect(result(dir)).toBe(readFileSync(join(fixtures, `baseline-${name}.result.json`), "utf8"));
    },
    60_000,
  );

  it("reports bad input with an error event and a non-zero exit", async () => {
    const dir = newRun({ sample: 1 });
    expect(await run(dir, ["--to", "2"])).not.toBe(0);
    const last = events(dir).at(-1)!;
    expect(last.type).toBe("error");
    expect(String(last.message)).toMatch(/sample/);
  }, 60_000);
});

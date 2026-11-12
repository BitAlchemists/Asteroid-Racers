import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MajorTom, seededRandom } from "@ar/server";
import { afterEach, describe, expect, it } from "vitest";
import { FileBrainStore } from "./file-brain-store";

let root: string;
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("FileBrainStore", () => {
  it("reads a luke.txt written by the Dart trainer (no bias field → bias off)", () => {
    root = mkdtempSync(join(tmpdir(), "ar-brains-"));
    mkdirSync(join(root, "Old"));
    const dart = [
      { generation: 42, name: "Winner from last round", input_neurons_count: 1, layers: [[[0.3, -0.7]]] },
    ];
    writeFileSync(join(root, "Old", "luke.txt"), JSON.stringify(dart));

    const [brain] = new FileBrainStore(root).load("Old")!;
    expect(brain).toMatchObject({ generation: 42, biasOutput: 0 });
    expect(brain!.activate([1])[0]).toBeCloseTo(Math.tanh(-0.7), 12);
  });

  it("saves atomically in the same layout and loads it back", () => {
    root = mkdtempSync(join(tmpdir(), "ar-brains-"));
    const store = new FileBrainStore(root);
    expect(store.load("New")).toBeUndefined();
    const net = MajorTom.random([4, 3, 2], seededRandom(1), "Luke");
    store.save("New", [net]);

    const file = join(root, "New", "luke.txt");
    expect(existsSync(`${file}.tmp`)).toBe(false);
    const raw = JSON.parse(readFileSync(file, "utf8")) as unknown[];
    expect(raw).toHaveLength(1);
    expect(Array.from(store.load("New")![0]!.activate([1, 2, 3, 4]))).toEqual(
      Array.from(net.activate([1, 2, 3, 4])),
    );
  });

  it("appends training reports to a per-run log", () => {
    root = mkdtempSync(join(tmpdir(), "ar-brains-"));
    const log = new FileBrainStore(root).createLog("Run");
    log("gen 1");
    log("gen 2");
    expect(existsSync(join(root, "Run", "log"))).toBe(true);
  });
});

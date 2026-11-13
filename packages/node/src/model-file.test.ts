import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_LAYOUT, MajorTom, seededRandom } from "@ar/server";
import { afterAll, describe, expect, it } from "vitest";
import { loadModelFile } from "./model-file";

const dir = mkdtempSync(join(tmpdir(), "ar-model-file-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("loadModelFile", () => {
  const model = MajorTom.random(DEFAULT_LAYOUT, seededRandom(1), "Saved");
  const write = (name: string, json: unknown) => {
    const file = join(dir, name);
    writeFileSync(file, JSON.stringify(json));
    return file;
  };

  it.each([
    ["a network JSON", model.toJson()],
    ["a luke.txt list", [model.toJson()]],
    ["an evo-lab snapshot", { format: "asteroid-racers/model-snapshot/v1", g: 3, model: model.toJson() }],
    ["a training result.json", { method: "train", winner: model.toJson() }],
  ])("reads %s", (name, json) => {
    expect(loadModelFile(write(`${name}.json`, json)).toJson()).toEqual(model.toJson());
  });

  it("gives the bundled model without a file, and rejects files without a model", () => {
    expect(loadModelFile(undefined).name).toMatch(/Interim model/);
    expect(loadModelFile("bundled").name).toMatch(/Interim model/);
    expect(() => loadModelFile(write("other.json", { hello: 1 }))).toThrow(/holds no model/);
  });
});

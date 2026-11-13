import { readFileSync } from "node:fs";
import { bundledModels, DEFAULT_MODEL_NAME, modelFromJson, type MajorTom } from "@ar/server";

/**
 * Loads a model from `file`: a network JSON, a trainer luke.txt, an evo-lab snapshot or a training
 * result.json (see {@link modelFromJson}). No file or "bundled" gives the model that ships with the game.
 */
export function loadModelFile(file: string | undefined): MajorTom {
  if (!file || file === "bundled") return bundledModels().load(DEFAULT_MODEL_NAME)![0]!;
  return modelFromJson(JSON.parse(readFileSync(file, "utf8")) as unknown, file);
}

import { readFileSync } from "node:fs";
import { bundledModels, DEFAULT_MODEL_NAME, MajorTom, type NetworkJson } from "@ar/server";

/**
 * Loads a model from `file`: a network JSON, a trainer luke.txt (a list, the first is used), an
 * evo-lab snapshot (`{ model }`) or a training result.json (`{ winner }`). No file or "bundled" gives
 * the model that ships with the game.
 */
export function loadModelFile(file: string | undefined): MajorTom {
  if (!file || file === "bundled") return bundledModels().load(DEFAULT_MODEL_NAME)![0]!;
  const json = JSON.parse(readFileSync(file, "utf8")) as unknown;
  const candidate = Array.isArray(json)
    ? json[0]
    : typeof json === "object" && json !== null && "model" in json
      ? json.model
      : typeof json === "object" && json !== null && "winner" in json
        ? json.winner
        : json;
  if (typeof candidate !== "object" || candidate === null || !("layers" in candidate))
    throw new Error(`${file} holds no model (expected a network, a luke.txt, a snapshot or a result.json)`);
  return MajorTom.fromJson(candidate as NetworkJson);
}

import { bundledModels, DEFAULT_MODEL_NAME } from "../ai/index";
import { MemoryModelStore } from "../ai/model-store";
import { MajorTom, type NetworkJson } from "../ai/network";
import manifest from "./manifest.json";
import train327 from "./models/train-327-g300.json";
import train502 from "./models/train-502-g150.json";
import train504 from "./models/train-504-g150.json";

/**
 * Showcase models (D1): the models the showcase page presents and players can race against. They
 * live here, apart from the game's own model (`ai/models/`), which only the user replaces, by hand.
 * The manifest records where each one comes from (run, generation, setup, exam numbers).
 */
export interface ShowcaseModelInfo {
  id: string;
  label: string;
  role: string;
  /** The model file next to the manifest; null for the game's bundled model. */
  file: string | null;
  setup: string;
  run?: string;
  generation?: number;
  experiment?: string;
  /** The training run's exam v2 at that generation. */
  exam?: { checkpoints: number; finished: number; crashes: number; score: number };
  /** `npm run skills` (share of targets reached per skill). */
  skills?: Record<string, number>;
}

/** The id of the game's bundled model: the default opponent. */
export const DEFAULT_OPPONENT = "default";

/** The id of the latest accepted model (the showcase page opens with it). */
export const ACCEPTED_MODEL = "train-502-g150";

export const SHOWCASE_MODELS: readonly ShowcaseModelInfo[] = Object.freeze(
  manifest.models as ShowcaseModelInfo[],
);

const FILES: Readonly<Record<string, NetworkJson>> = {
  "models/train-327-g300.json": train327 as NetworkJson,
  "models/train-502-g150.json": train502 as NetworkJson,
  "models/train-504-g150.json": train504 as NetworkJson,
};

export function showcaseModelInfo(id: string): ShowcaseModelInfo | undefined {
  return SHOWCASE_MODELS.find((m) => m.id === id);
}

/** A fresh copy of showcase model `id` (its spec included), or undefined for an unknown id. */
export function loadShowcaseModel(id: string): MajorTom | undefined {
  const info = showcaseModelInfo(id);
  if (!info) return undefined;
  if (info.file === null) {
    const model = bundledModels().load(DEFAULT_MODEL_NAME)![0]!;
    model.name = info.label;
    return model;
  }
  const json = FILES[info.file];
  if (!json) throw new Error(`showcase model file ${info.file} is not bundled`);
  const model = MajorTom.fromJson(json);
  model.name = info.label;
  return model;
}

/** Every showcase model under its id (for bots: `store.load(id)`). */
export function showcaseStore(): MemoryModelStore {
  const store = new MemoryModelStore();
  for (const info of SHOWCASE_MODELS) store.save(info.id, [loadShowcaseModel(info.id)!]);
  return store;
}

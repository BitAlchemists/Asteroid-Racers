/**
 * The version of the game's AI: the bundled model in `models/default-model.json` (see
 * doc/model-release.md). The racing bots carry the short label in their name, so players can tell
 * which model is live. A test checks that the bundled model's name is the full label.
 */
export interface ModelVersion {
  /** Release number: AI v1 was the interim Dart-era model. Never reused. */
  version: number;
  /** The training run and generation the model comes from. */
  run: string;
  generation: number;
  /** `AI v<N>`, shown in the bots' name. */
  short: string;
  /** `AI v<N> (<run> g<generation>)`: the bundled model's name. */
  label: string;
}

function modelVersion(version: number, run: string, generation: number): ModelVersion {
  const short = `AI v${version}`;
  return Object.freeze({ version, run, generation, short, label: `${short} (${run} g${generation})` });
}

/** The bundled model's version. */
export const DEFAULT_MODEL_VERSION: ModelVersion = modelVersion(2, "train-595", 147);

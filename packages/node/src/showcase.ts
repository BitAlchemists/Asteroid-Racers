/**
 * The showcase's results table (D1), headless: every showcase model through every challenge
 * (tracks, skill arenas, exam v2), the same flights the showcase page shows.
 *
 *   npm run showcase [-- --model train-502-g150] [--challenge track:demo] [--json]
 */
import { parseArgs } from "node:util";
import { Level, setLogLevel } from "@ar/shared";
import {
  formatResult,
  loadShowcaseModel,
  runChallenge,
  SHOWCASE_MODELS,
  showcaseChallenges,
  type ChallengeResult,
} from "@ar/server";

async function main(): Promise<void> {
  setLogLevel("", Level.WARNING);
  const { values } = parseArgs({
    options: {
      model: { type: "string", multiple: true },
      challenge: { type: "string", multiple: true },
      json: { type: "boolean", default: false },
    },
  });
  const models = SHOWCASE_MODELS.filter((m) => !values.model || values.model.includes(m.id));
  const challenges = showcaseChallenges().filter((c) => !values.challenge || values.challenge.includes(c.id));
  const out: Record<string, Record<string, ChallengeResult>> = {};
  for (const info of models) {
    const model = loadShowcaseModel(info.id)!;
    out[info.id] = {};
    if (!values.json) console.log(`\n${info.label} (${info.id})`);
    for (const challenge of challenges) {
      const started = performance.now();
      const result = await runChallenge(model, challenge);
      out[info.id]![challenge.id] = result;
      if (!values.json)
        console.log(
          `  ${challenge.id.padEnd(16)} ${formatResult(result, challenge.kind)}  [${((performance.now() - started) / 1000).toFixed(1)} s]`,
        );
    }
  }
  if (values.json) console.log(JSON.stringify(out, null, 2));
}

await main();

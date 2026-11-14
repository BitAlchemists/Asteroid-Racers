import { Level, setLogLevel } from "@ar/shared";
import {
  loadShowcaseModel,
  runChallenge,
  SHOWCASE_MODELS,
  showcaseChallenges,
  type ChallengeResult,
} from "@ar/server";

// The showcase's headless results (D1), off the page's thread: every challenge for every model,
// starting with the one asked for. The same simulation as the replay viewer, without drawing.

export interface WorkerRequest {
  first: string;
}

export type WorkerMessage =
  | { type: "result"; model: string; result: ChallengeResult }
  | { type: "progress"; model: string; challenge: string; done: number; of: number }
  | { type: "done" }
  | { type: "error"; message: string };

setLogLevel("", Level.WARNING);
const post = (message: WorkerMessage) => self.postMessage(message);

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  try {
    const ids = SHOWCASE_MODELS.map((m) => m.id);
    const order = [event.data.first, ...ids.filter((id) => id !== event.data.first)];
    for (const id of order) {
      const model = loadShowcaseModel(id);
      if (!model) continue;
      for (const challenge of showcaseChallenges()) {
        const result = await runChallenge(model, challenge, (done) => {
          if (challenge.segments > 1 && done % 10 === 0)
            post({ type: "progress", model: id, challenge: challenge.id, done, of: challenge.segments });
        });
        post({ type: "result", model: id, result });
      }
    }
    post({ type: "done" });
  } catch (error) {
    post({ type: "error", message: String(error instanceof Error ? error.message : error) });
  }
};

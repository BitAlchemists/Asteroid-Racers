// evo-lab entry for the `exam` method (see lab.config.json). Registers tsx relative to this file —
// not the working directory, which is the run directory — and runs the TypeScript worker.
import { register } from "tsx/esm/api";

register();
await import("../packages/node/src/lab-exam.ts");

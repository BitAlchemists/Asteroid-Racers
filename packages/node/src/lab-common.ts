/** Helpers shared by the evo-lab workers (lab-train, lab-exam); see evo-lab's docs/protocol.md. */
import { appendFileSync, existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const PROTOCOL = 1;

/** Appends protocol events to RUN_DIR/events.jsonl. */
export function eventLog(runDir: string): (type: string, fields?: Record<string, unknown>) => void {
  const file = join(runDir, "events.jsonl");
  // Terminate a line torn by a kill during the previous attempt, so the next event parses.
  if (existsSync(file) && statSync(file).size > 0 && !readFileSync(file, "utf8").endsWith("\n"))
    appendFileSync(file, "\n");
  return (type, fields = {}) =>
    appendFileSync(file, `${JSON.stringify({ type, t: Date.now() / 1000, ...fields })}\n`);
}

/** temp + rename, retried briefly because a reader may hold the target open on Windows. */
export async function atomicWrite(file: string, text: string): Promise<void> {
  const temp = `${file}.tmp`;
  writeFileSync(temp, text);
  for (let attempt = 0; ; attempt++) {
    try {
      renameSync(temp, file);
      return;
    } catch (error) {
      if (attempt >= 20) throw error;
      await new Promise((r) => setTimeout(r, 50));
    }
  }
}

/** Same as atomicWrite, synchronously (for files an event names, which must exist before the event). */
export function atomicWriteSync(file: string, text: string): void {
  const temp = `${file}.tmp`;
  writeFileSync(temp, text);
  for (let attempt = 0; ; attempt++) {
    try {
      renameSync(temp, file);
      return;
    } catch (error) {
      if (attempt >= 1000) throw error;
    }
  }
}

/** Versions that could change results without changing our bound sources; stored per run by evo-lab. */
export function dependencyVersions(
  projectRoot: string,
  extra: Record<string, string>,
): Record<string, string | null> {
  const versionOf = (pkg: string): string | null => {
    try {
      const json = JSON.parse(
        readFileSync(join(projectRoot, "node_modules", pkg, "package.json"), "utf8"),
      ) as {
        version?: string;
      };
      return json.version ?? null;
    } catch {
      return null;
    }
  };
  return {
    node: process.version,
    tsx: versionOf("tsx"),
    "@bufbuild/protobuf": versionOf("@bufbuild/protobuf"),
    ...extra,
  };
}

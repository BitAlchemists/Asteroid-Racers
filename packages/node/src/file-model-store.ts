import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { MajorTom, type ModelStore, type NetworkJson } from "@ar/server";

/**
 * Models on disk in the Dart trainer's layout: `<root>/<name>/luke.txt` holds a JSON array of
 * networks, `<root>/<name>/log/<timestamp>.log` the training report. Old Dart files load unchanged.
 */
export class FileModelStore implements ModelStore {
  readonly root: string;

  constructor(root = "db") {
    this.root = resolve(root);
  }

  path(name: string): string {
    return join(this.root, name, "luke.txt");
  }

  load(name: string): MajorTom[] | undefined {
    const file = this.path(name);
    if (!existsSync(file)) return undefined;
    const json = JSON.parse(readFileSync(file, "utf8")) as NetworkJson[];
    return json.map((network) => MajorTom.fromJson(network));
  }

  save(name: string, networks: readonly MajorTom[]): void {
    const file = this.path(name);
    mkdirSync(join(this.root, name), { recursive: true });
    // Write-then-rename so an interrupted save never leaves a truncated model behind.
    const temp = `${file}.tmp`;
    writeFileSync(temp, JSON.stringify(networks.map((n) => n.toJson())));
    renameSync(temp, file);
  }

  /** Opens a log file for this training run (one per run, like the Dart trainer). */
  createLog(name: string): (line: string) => void {
    const dir = join(this.root, name, "log");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${Date.now()}.log`);
    return (line) => appendFileSync(file, `${line}\n`);
  }
}

import { MajorTom, type NetworkJson } from "./network";

/**
 * Where evolved networks ("models") are kept between generations / runs. The Node trainer uses a file
 * store compatible with the Dart `db/<name>/luke.txt` layout; the browser uses models bundled as JSON.
 */
export interface ModelStore {
  load(name: string): MajorTom[] | undefined;
  save(name: string, networks: readonly MajorTom[]): void;
}

/** Keeps models in memory (tests, and as the browser's store seeded with bundled models). */
export class MemoryModelStore implements ModelStore {
  private readonly models = new Map<string, NetworkJson[]>();

  constructor(initial: Record<string, readonly NetworkJson[]> = {}) {
    for (const [name, networks] of Object.entries(initial)) this.models.set(name, [...networks]);
  }

  load(name: string): MajorTom[] | undefined {
    return this.models.get(name)?.map((json) => MajorTom.fromJson(json));
  }

  save(name: string, networks: readonly MajorTom[]): void {
    this.models.set(
      name,
      networks.map((n) => n.toJson()),
    );
  }
}

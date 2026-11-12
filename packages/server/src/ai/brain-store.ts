import { MajorTom, type NetworkJson } from "./network";

/**
 * Where evolved networks ("brains") are kept between generations / runs. The Node trainer uses a file
 * store compatible with the Dart `db/<name>/luke.txt` layout; the browser uses brains bundled as JSON.
 */
export interface BrainStore {
  load(name: string): MajorTom[] | undefined;
  save(name: string, networks: readonly MajorTom[]): void;
}

/** Keeps brains in memory (tests, and as the browser's store seeded with bundled brains). */
export class MemoryBrainStore implements BrainStore {
  private readonly brains = new Map<string, NetworkJson[]>();

  constructor(initial: Record<string, readonly NetworkJson[]> = {}) {
    for (const [name, networks] of Object.entries(initial)) this.brains.set(name, [...networks]);
  }

  load(name: string): MajorTom[] | undefined {
    return this.brains.get(name)?.map((json) => MajorTom.fromJson(json));
  }

  save(name: string, networks: readonly MajorTom[]): void {
    this.brains.set(
      name,
      networks.map((n) => n.toJson()),
    );
  }
}

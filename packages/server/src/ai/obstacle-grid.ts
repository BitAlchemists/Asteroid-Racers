import type { Entity } from "@ar/shared";

/**
 * Static obstacles bucketed into square cells, so "which rocks are near here?" costs about the same
 * with 20 or 500 of them. Results come sorted by entity id, so sensors that pick "the first" or
 * "the nearest" among equals are deterministic.
 */
export class ObstacleGrid {
  private readonly cells = new Map<number, Entity[]>();
  readonly size: number;

  constructor(
    obstacles: Iterable<Entity>,
    readonly cellSize = 250,
  ) {
    let count = 0;
    for (const o of obstacles) {
      count++;
      const r = o.radius;
      const x0 = Math.floor((o.position.x - r) / cellSize);
      const x1 = Math.floor((o.position.x + r) / cellSize);
      const y0 = Math.floor((o.position.y - r) / cellSize);
      const y1 = Math.floor((o.position.y + r) / cellSize);
      for (let cx = x0; cx <= x1; cx++)
        for (let cy = y0; cy <= y1; cy++) {
          const key = ObstacleGrid.key(cx, cy);
          const list = this.cells.get(key);
          if (list) list.push(o);
          else this.cells.set(key, [o]);
        }
    }
    this.size = count;
  }

  /** Cell coordinates packed into one number (fine for |cx|, |cy| < 2^20). */
  private static key(cx: number, cy: number): number {
    return (cx + 0x100000) * 0x200000 + (cy + 0x100000);
  }

  /** Obstacles whose cells overlap the square around (x, y) with half-size `r`, sorted by id. */
  near(x: number, y: number, r: number): Entity[] {
    if (this.size === 0) return [];
    const s = this.cellSize;
    const found = new Set<Entity>();
    const x0 = Math.floor((x - r) / s);
    const x1 = Math.floor((x + r) / s);
    const y0 = Math.floor((y - r) / s);
    const y1 = Math.floor((y + r) / s);
    for (let cx = x0; cx <= x1; cx++)
      for (let cy = y0; cy <= y1; cy++) {
        const list = this.cells.get(ObstacleGrid.key(cx, cy));
        if (list) for (const o of list) found.add(o);
      }
    return [...found].sort((a, b) => a.id - b.id);
  }
}

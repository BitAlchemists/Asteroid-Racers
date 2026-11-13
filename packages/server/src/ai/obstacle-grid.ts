import type { Entity } from "@ar/shared";

/**
 * Static obstacles bucketed into square cells, so "which rocks are near here?" costs about the same
 * with 20 or 500 of them. Results come sorted by entity id, so sensors that pick "the first" or
 * "the nearest" among equals are deterministic.
 */
export class ObstacleGrid {
  /**
   * Cells over the covered range, x-major: cell i holds slots[start[i] .. start[i + 1]) in insertion
   * order (compressed rows). Very sparse worlds fall back to a map of cell index to slots.
   */
  private start = new Int32Array(1);
  private slots = new Int32Array(0);
  private sparse: Map<number, number[]> | undefined;
  private cx0 = 0;
  private cy0 = 0;
  private cxCount = 0;
  private cyCount = 0;
  /** Distinct obstacles by slot. */
  private readonly obstacles: Entity[] = [];
  /** Per slot: the query that last collected it (deduplication without a Set). */
  private readonly marks: Uint32Array;
  private stamp = 0;
  readonly size: number;

  constructor(
    obstacles: Iterable<Entity>,
    readonly cellSize = 250,
  ) {
    let count = 0;
    const slotOf = new Map<Entity, number>();
    const placed: { slot: number; x0: number; x1: number; y0: number; y1: number }[] = [];
    for (const o of obstacles) {
      count++;
      let slot = slotOf.get(o);
      if (slot === undefined) {
        slot = this.obstacles.length;
        slotOf.set(o, slot);
        this.obstacles.push(o);
      }
      const r = o.radius;
      const bounds = {
        slot,
        x0: Math.floor((o.position.x - r) / cellSize),
        x1: Math.floor((o.position.x + r) / cellSize),
        y0: Math.floor((o.position.y - r) / cellSize),
        y1: Math.floor((o.position.y + r) / cellSize),
      };
      // Non-finite bounds cover no cell (the loops over them never run).
      if (Number.isFinite(bounds.x0 + bounds.x1 + bounds.y0 + bounds.y1)) placed.push(bounds);
    }
    this.size = count;
    this.marks = new Uint32Array(this.obstacles.length);
    if (placed.length === 0) return;
    let cx0 = Infinity,
      cx1 = -Infinity,
      cy0 = Infinity,
      cy1 = -Infinity;
    for (const p of placed) {
      cx0 = Math.min(cx0, p.x0);
      cx1 = Math.max(cx1, p.x1);
      cy0 = Math.min(cy0, p.y0);
      cy1 = Math.max(cy1, p.y1);
    }
    this.cx0 = cx0;
    this.cy0 = cy0;
    this.cxCount = cx1 - cx0 + 1;
    this.cyCount = cy1 - cy0 + 1;
    const cellCount = this.cxCount * this.cyCount;
    const cellOf = (cx: number, cy: number) => (cx - cx0) * this.cyCount + (cy - cy0);
    if (cellCount > MAX_DENSE_CELLS) {
      const sparse = new Map<number, number[]>();
      for (const p of placed)
        for (let cx = p.x0; cx <= p.x1; cx++)
          for (let cy = p.y0; cy <= p.y1; cy++) {
            const i = cellOf(cx, cy);
            const list = sparse.get(i);
            if (list) list.push(p.slot);
            else sparse.set(i, [p.slot]);
          }
      this.sparse = sparse;
      return;
    }
    const start = new Int32Array(cellCount + 1);
    for (const p of placed)
      for (let cx = p.x0; cx <= p.x1; cx++)
        for (let cy = p.y0; cy <= p.y1; cy++) start[cellOf(cx, cy) + 1]!++;
    for (let i = 0; i < cellCount; i++) start[i + 1]! += start[i]!;
    const fill = start.slice(0, cellCount);
    const slots = new Int32Array(start[cellCount]!);
    for (const p of placed)
      for (let cx = p.x0; cx <= p.x1; cx++)
        for (let cy = p.y0; cy <= p.y1; cy++) slots[fill[cellOf(cx, cy)]!++] = p.slot;
    this.start = start;
    this.slots = slots;
  }

  /**
   * Obstacles whose cells overlap the square around (x, y) with half-size `r`, sorted by id (each
   * once; equal ids keep the order in which the cells were scanned).
   */
  near(x: number, y: number, r: number): Entity[] {
    if (this.size === 0) return [];
    if (this.stamp === 0xffffffff) {
      this.marks.fill(0);
      this.stamp = 0;
    }
    const stamp = ++this.stamp;
    const marks = this.marks;
    const s = this.cellSize;
    const found: Entity[] = [];
    // Cells outside the covered range are empty: clamp the scan to it (same cells, same order).
    const x0 = Math.max(Math.floor((x - r) / s) - this.cx0, 0);
    const x1 = Math.min(Math.floor((x + r) / s) - this.cx0, this.cxCount - 1);
    const y0 = Math.max(Math.floor((y - r) / s) - this.cy0, 0);
    const y1 = Math.min(Math.floor((y + r) / s) - this.cy0, this.cyCount - 1);
    const rows = this.cyCount;
    if (this.sparse) {
      for (let cx = x0; cx <= x1; cx++)
        for (let cy = y0; cy <= y1; cy++) {
          const list = this.sparse.get(cx * rows + cy);
          if (list) for (const slot of list) this.collect(slot, stamp, found);
        }
    } else {
      const { start, slots } = this;
      for (let cx = x0; cx <= x1; cx++)
        for (let cy = y0; cy <= y1; cy++) {
          const cell = cx * rows + cy;
          for (let i = start[cell]!, end = start[cell + 1]!; i < end; i++) {
            const slot = slots[i]!;
            if (marks[slot] === stamp) continue;
            marks[slot] = stamp;
            found.push(this.obstacles[slot]!);
          }
        }
    }
    return found.length > 1 ? found.sort(byId) : found;
  }

  /**
   * Like {@link near}, but unsorted and without allocating: fills and returns a buffer the grid
   * reuses (valid until the next call). For callers that pick a minimum and break ties by id
   * themselves, so the order does not matter.
   */
  nearUnsorted(x: number, y: number, r: number): readonly Entity[] {
    const found = this.buffer;
    found.length = 0;
    if (this.size === 0) return found;
    if (this.stamp === 0xffffffff) {
      this.marks.fill(0);
      this.stamp = 0;
    }
    const stamp = ++this.stamp;
    const marks = this.marks;
    const s = this.cellSize;
    const x0 = Math.max(Math.floor((x - r) / s) - this.cx0, 0);
    const x1 = Math.min(Math.floor((x + r) / s) - this.cx0, this.cxCount - 1);
    const y0 = Math.max(Math.floor((y - r) / s) - this.cy0, 0);
    const y1 = Math.min(Math.floor((y + r) / s) - this.cy0, this.cyCount - 1);
    const rows = this.cyCount;
    if (this.sparse) {
      for (let cx = x0; cx <= x1; cx++)
        for (let cy = y0; cy <= y1; cy++) {
          const list = this.sparse.get(cx * rows + cy);
          if (list) for (const slot of list) this.collect(slot, stamp, found);
        }
    } else {
      const { start, slots } = this;
      for (let cx = x0; cx <= x1; cx++)
        for (let cy = y0; cy <= y1; cy++) {
          const cell = cx * rows + cy;
          for (let i = start[cell]!, end = start[cell + 1]!; i < end; i++) {
            const slot = slots[i]!;
            if (marks[slot] === stamp) continue;
            marks[slot] = stamp;
            found.push(this.obstacles[slot]!);
          }
        }
    }
    return found;
  }

  private readonly buffer: Entity[] = [];

  private collect(slot: number, stamp: number, found: Entity[]): void {
    if (this.marks[slot] === stamp) return;
    this.marks[slot] = stamp;
    found.push(this.obstacles[slot]!);
  }
}

const byId = (a: Entity, b: Entity) => a.id - b.id;
/** Above this many cells in the covered range, the grid keeps only the occupied ones (in a map). */
const MAX_DENSE_CELLS = 1 << 20;

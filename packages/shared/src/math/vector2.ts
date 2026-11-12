/**
 * 2D vector, modelled on the subset of `package:vector_math` Vector2 the Dart code used.
 *
 * Naming follows vector_math so ported code reads the same:
 * - `add` / `sub` / `scale` / `negate` / `normalize` mutate in place and return `this`
 *   (`normalize` returns the previous length, like vector_math).
 * - `plus` / `minus` / `times` / `scaled` / `negated` / `normalized` return a new vector;
 *   they replace Dart's operator overloads (`a + b`, `a - b`, `a * s`, `-a`).
 *
 * Note: vector_math stored components as float32; we use float64 (plain JS numbers).
 */
export class Vector2 {
  constructor(
    public x = 0,
    public y = 0,
  ) {}

  static zero(): Vector2 {
    return new Vector2(0, 0);
  }

  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  setValues(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  setFrom(other: Vector2): this {
    this.x = other.x;
    this.y = other.y;
    return this;
  }

  get length(): number {
    return Math.hypot(this.x, this.y);
  }

  get length2(): number {
    return this.x * this.x + this.y * this.y;
  }

  // --- in-place ---------------------------------------------------------------

  add(other: Vector2): this {
    this.x += other.x;
    this.y += other.y;
    return this;
  }

  sub(other: Vector2): this {
    this.x -= other.x;
    this.y -= other.y;
    return this;
  }

  scale(factor: number): this {
    this.x *= factor;
    this.y *= factor;
    return this;
  }

  negate(): this {
    this.x = -this.x;
    this.y = -this.y;
    return this;
  }

  /** Normalizes in place and returns the length before normalization. A zero vector stays zero. */
  normalize(): number {
    const len = this.length;
    if (len !== 0) {
      this.x /= len;
      this.y /= len;
    }
    return len;
  }

  // --- pure -------------------------------------------------------------------

  plus(other: Vector2): Vector2 {
    return new Vector2(this.x + other.x, this.y + other.y);
  }

  minus(other: Vector2): Vector2 {
    return new Vector2(this.x - other.x, this.y - other.y);
  }

  times(factor: number): Vector2 {
    return new Vector2(this.x * factor, this.y * factor);
  }

  scaled(factor: number): Vector2 {
    return this.times(factor);
  }

  negated(): Vector2 {
    return new Vector2(-this.x, -this.y);
  }

  normalized(): Vector2 {
    const v = this.clone();
    v.normalize();
    return v;
  }

  dot(other: Vector2): number {
    return this.x * other.x + this.y * other.y;
  }

  /** z-component of the 3D cross product. */
  cross(other: Vector2): number {
    return this.x * other.y - this.y * other.x;
  }

  distanceTo(other: Vector2): number {
    return Math.hypot(this.x - other.x, this.y - other.y);
  }

  distanceToSquared(other: Vector2): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return dx * dx + dy * dy;
  }

  /** Rotates counter-clockwise by `radians` (in a y-up frame) and returns a new vector. */
  rotated(radians: number): Vector2 {
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    return new Vector2(this.x * c - this.y * s, this.x * s + this.y * c);
  }

  equals(other: Vector2): boolean {
    return this.x === other.x && this.y === other.y;
  }

  toString(): string {
    return `[${this.x},${this.y}]`;
  }
}

import { describe, expect, it } from "vitest";
import { wrapAngle } from "./angle";
import { Vector2 } from "./vector2";

describe("Vector2", () => {
  it("mutating ops change the receiver and return it (vector_math semantics)", () => {
    const v = new Vector2(1, 2);
    expect(v.add(new Vector2(3, 4))).toBe(v);
    expect(v).toEqual(new Vector2(4, 6));
    v.sub(new Vector2(1, 1)).scale(2);
    expect(v).toEqual(new Vector2(6, 10));
    v.negate();
    expect(v).toEqual(new Vector2(-6, -10));
  });

  it("pure ops leave the receiver untouched", () => {
    const v = new Vector2(3, 4);
    expect(v.plus(new Vector2(1, 1))).toEqual(new Vector2(4, 5));
    expect(v.minus(new Vector2(1, 1))).toEqual(new Vector2(2, 3));
    expect(v.times(2)).toEqual(new Vector2(6, 8));
    expect(v.scaled(0.5)).toEqual(new Vector2(1.5, 2));
    expect(v.negated()).toEqual(new Vector2(-3, -4));
    expect(v.normalized()).toEqual(new Vector2(0.6, 0.8));
    expect(v).toEqual(new Vector2(3, 4));
  });

  it("normalize returns the previous length and keeps zero vectors at zero", () => {
    const v = new Vector2(3, 4);
    expect(v.normalize()).toBe(5);
    expect(v.length).toBeCloseTo(1, 15);
    const zero = Vector2.zero();
    expect(zero.normalize()).toBe(0);
    expect(zero).toEqual(Vector2.zero());
  });

  it("measures length, distance, dot and cross", () => {
    const a = new Vector2(3, 4);
    const b = new Vector2(6, 8);
    expect(a.length).toBe(5);
    expect(a.length2).toBe(25);
    expect(a.distanceTo(b)).toBe(5);
    expect(a.distanceToSquared(b)).toBe(25);
    expect(a.dot(b)).toBe(50);
    expect(new Vector2(1, 0).cross(new Vector2(0, 1))).toBe(1);
  });

  it("rotates counter-clockwise", () => {
    const r = new Vector2(1, 0).rotated(Math.PI / 2);
    expect(r.x).toBeCloseTo(0, 15);
    expect(r.y).toBeCloseTo(1, 15);
  });

  it("clone is independent", () => {
    const a = new Vector2(1, 1);
    const b = a.clone();
    b.x = 5;
    expect(a.x).toBe(1);
  });
});

describe("wrapAngle", () => {
  it("leaves angles within [-π, π] unchanged, including the bounds", () => {
    for (const a of [0, 1, -1, Math.PI, -Math.PI, 3.14]) expect(wrapAngle(a)).toBe(a);
  });

  it("wraps a single overflow exactly like the Dart setter (value ∓ 2π)", () => {
    expect(wrapAngle(Math.PI + 0.5)).toBeCloseTo(Math.PI + 0.5 - 2 * Math.PI, 15);
    expect(wrapAngle(-Math.PI - 0.5)).toBeCloseTo(-Math.PI - 0.5 + 2 * Math.PI, 15);
  });

  it("wraps multiple turns fully (the Dart setter only wrapped once)", () => {
    expect(wrapAngle(7 * Math.PI + 0.25)).toBeCloseTo(-Math.PI + 0.25, 12);
    expect(wrapAngle(-10 * Math.PI)).toBeCloseTo(0, 12);
  });

  it("passes non-finite values through", () => {
    expect(wrapAngle(Number.NaN)).toBeNaN();
    expect(wrapAngle(Infinity)).toBe(Infinity);
  });
});

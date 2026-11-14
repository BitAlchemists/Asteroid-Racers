import { Movable, Vector2 } from "@ar/shared";
import { describe, expect, it } from "vitest";
import { phoneZoom } from "../index";
import { PlayerController, SHIP_ACCELERATION, SHIP_ROTATION_SPEED } from "./controllers";
import {
  headingFromStick,
  steer,
  STICK_DEAD_ZONE,
  TouchPilot,
  TouchState,
  wrapAngle,
  zoneAt,
} from "./touch-input";

/** The screen direction (y down) a ship's nose points along at `orientation`. */
function nose(orientation: number): { x: number; y: number } {
  return new Vector2(0, 1).rotated(orientation);
}

function player(orientation = 0): PlayerController {
  return new PlayerController(new Movable({ position: Vector2.zero(), radius: 20, orientation }));
}

describe("touch input mapping", () => {
  it("the stick's direction becomes the heading the nose points along", () => {
    for (const [dx, dy] of [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
      [3, -4],
      [-2, 5],
    ] as const) {
      const n = nose(headingFromStick(dx, dy));
      const len = Math.hypot(dx, dy);
      expect(n.x).toBeCloseTo(dx / len, 12);
      expect(n.y).toBeCloseTo(dy / len, 12);
    }
  });

  it("a thrust along the heading accelerates the ship towards the stick", () => {
    const p = player(headingFromStick(1, 0)); // stick to the right
    p.accelerationFactor = 1;
    p.applyThrust();
    expect(p.entity.acceleration.x).toBeCloseTo(SHIP_ACCELERATION, 9);
    expect(Math.abs(p.entity.acceleration.y)).toBeLessThan(1e-9);
  });

  it("wraps angles into (−π, π]", () => {
    expect(wrapAngle(0)).toBe(0);
    expect(wrapAngle(Math.PI)).toBeCloseTo(Math.PI, 12);
    expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI, 12);
    expect(wrapAngle(3 * Math.PI + 0.5)).toBeCloseTo(-Math.PI + 0.5, 12);
    expect(wrapAngle(-0.25)).toBeCloseTo(-0.25, 12);
  });

  it("steers the short way round, and snaps when the heading is within one frame's turn", () => {
    const dt = 1 / 60;
    expect(steer(0, 1, dt).rotate).toBe(1); // clockwise on screen
    expect(steer(0, -1, dt).rotate).toBe(-1);
    expect(steer(3, -3, dt).rotate).toBe(1); // across ±π: the short way is clockwise
    expect(steer(-3, 3, dt).rotate).toBe(-1);
    const near = steer(1, 1 + 0.5 * SHIP_ROTATION_SPEED * dt, dt);
    expect(near).toEqual({ rotate: 0, snapTo: 1 + 0.5 * SHIP_ROTATION_SPEED * dt });
  });

  it("splits the screen: left half steers, right half thrusts", () => {
    expect(zoneAt(10, 400)).toBe("stick");
    expect(zoneAt(199, 400)).toBe("stick");
    expect(zoneAt(200, 400)).toBe("thrust");
  });

  it("tracks a stick thumb and thrust thumbs independently", () => {
    const s = new TouchState();
    s.down(1, 50, 300, 400);
    expect(s.heading).toBeUndefined(); // not dragged yet
    s.move(1, 50 + STICK_DEAD_ZONE - 1, 300);
    expect(s.heading).toBeUndefined(); // inside the dead zone
    s.move(1, 150, 300);
    expect(s.heading).toBeCloseTo(headingFromStick(1, 0), 12);
    s.down(2, 300, 300, 400);
    s.down(3, 100, 100, 400); // a second thumb on the left while the stick is held thrusts
    expect(s.thrusting).toBe(true);
    s.up(2);
    expect(s.thrusting).toBe(true);
    s.up(3);
    expect(s.thrusting).toBe(false);
    s.up(1);
    expect(s.stick).toBeUndefined();
    expect(s.heading).toBeUndefined();
  });

  it("drives the ship: turns towards the stick, snaps onto it, thrusts while held, releases cleanly", () => {
    const s = new TouchState();
    const pilot = new TouchPilot(s);
    const p = player(0); // nose down the screen
    const dt = 1 / 60;
    s.down(1, 100, 100, 400);
    s.move(1, 200, 100); // stick right: heading −π/2... the ship must turn
    s.down(2, 300, 300, 400);
    pilot.update(p, dt);
    const target = headingFromStick(1, 0);
    expect(Math.sign(p.entity.rotationSpeed)).toBe(Math.sign(wrapAngle(target - 0)));
    expect(p.accelerationFactor).toBe(1);
    // Integrate like the client does until the nose points there.
    for (let i = 0; i < 120 && p.entity.rotationSpeed !== 0; i++) {
      p.entity.orientation += p.entity.rotationSpeed * dt;
      pilot.update(p, dt);
    }
    expect(p.entity.rotationSpeed).toBe(0);
    expect(p.entity.orientation).toBeCloseTo(target, 12);
    s.up(1);
    s.up(2);
    pilot.update(p, dt);
    expect(p.entity.rotationSpeed).toBe(0);
    expect(p.accelerationFactor).toBe(0);
  });

  it("leaves keyboard input alone while no thumb is down", () => {
    const pilot = new TouchPilot(new TouchState());
    const p = player();
    p.rotateLeft();
    p.accelerationFactor = 1;
    pilot.update(p, 1 / 60);
    expect(p.entity.rotationSpeed).toBe(-SHIP_ROTATION_SPEED);
    expect(p.accelerationFactor).toBe(1);
  });

  it("zooms out on small screens only", () => {
    expect(phoneZoom(450, 900)).toBeCloseTo(450 / 700, 12);
    expect(phoneZoom(200, 300)).toBe(0.55);
    expect(phoneZoom(1920, 1080)).toBe(1);
  });
});

import { SHIP_ROTATION_SPEED, type PlayerController } from "./controllers";
import type { GameClient } from "./game-client";

/**
 * Touch controls for phones and tablets (D1). The left half of the screen is a floating stick: put a
 * thumb down anywhere there and drag; the ship turns towards the direction of the drag (at the same
 * turn rate as the arrow keys) and stops turning once its nose points there. Anywhere on the right
 * half thrusts while held. Both work at once with two thumbs.
 */

/** Drags shorter than this (px) do not steer, so a resting thumb does not twitch the ship. */
export const STICK_DEAD_ZONE = 12;
/** Radius of the drawn stick (px); the knob stays inside it. */
export const STICK_RADIUS = 56;

/** `a` wrapped into (−π, π]. */
export function wrapAngle(a: number): number {
  const twoPi = 2 * Math.PI;
  let r = (a + Math.PI) % twoPi;
  if (r <= 0) r += twoPi;
  return r - Math.PI;
}

/**
 * The ship orientation whose nose points along screen direction (dx, dy) (y down). The camera does
 * not rotate, and a ship's nose points along +y at orientation 0, turning clockwise on screen.
 */
export function headingFromStick(dx: number, dy: number): number {
  return Math.atan2(-dx, dy);
}

/**
 * How to turn from `orientation` towards `heading` within one frame of `dt` seconds: left (−1) or
 * right (+1) at the normal turn rate, or, when the heading is closer than one frame's turn, stop and
 * snap to it (no overshoot, no jitter).
 */
export function steer(
  orientation: number,
  heading: number,
  dt: number,
): { rotate: -1 | 0 | 1; snapTo?: number } {
  const diff = wrapAngle(heading - orientation);
  if (Math.abs(diff) <= SHIP_ROTATION_SPEED * Math.max(dt, 1 / 120)) return { rotate: 0, snapTo: heading };
  return { rotate: diff > 0 ? 1 : -1 };
}

/** Which half of the screen a touch starting at `x` belongs to. */
export function zoneAt(x: number, width: number): "stick" | "thrust" {
  return x < width / 2 ? "stick" : "thrust";
}

interface Stick {
  id: number;
  originX: number;
  originY: number;
  x: number;
  y: number;
}

/** Pointer bookkeeping without the DOM: which pointer steers, which ones thrust. */
export class TouchState {
  stick: Stick | undefined;
  private readonly thrusters = new Set<number>();

  down(id: number, x: number, y: number, width: number): void {
    if (zoneAt(x, width) === "stick" && !this.stick) this.stick = { id, originX: x, originY: y, x, y };
    else this.thrusters.add(id);
  }

  move(id: number, x: number, y: number): void {
    if (this.stick?.id === id) {
      this.stick.x = x;
      this.stick.y = y;
    }
  }

  up(id: number): void {
    if (this.stick?.id === id) this.stick = undefined;
    this.thrusters.delete(id);
  }

  clear(): void {
    this.stick = undefined;
    this.thrusters.clear();
  }

  get thrusting(): boolean {
    return this.thrusters.size > 0;
  }

  /** The drag from the stick's origin, or undefined when there is no stick. */
  get drag(): { dx: number; dy: number; length: number } | undefined {
    const s = this.stick;
    if (!s) return undefined;
    const dx = s.x - s.originX;
    const dy = s.y - s.originY;
    return { dx, dy, length: Math.hypot(dx, dy) };
  }

  /** The heading the stick asks for, or undefined (no stick, or inside the dead zone). */
  get heading(): number | undefined {
    const d = this.drag;
    return d && d.length >= STICK_DEAD_ZONE ? headingFromStick(d.dx, d.dy) : undefined;
  }
}

/**
 * Applies the touch state to the local ship for one frame. Only what touch controls is touched:
 * a keyboard on the same device keeps working when no thumb is down.
 */
export class TouchPilot {
  private steering = false;
  private thrusting = false;

  constructor(readonly state: TouchState) {}

  update(player: PlayerController | undefined, dt: number): void {
    if (!player) return;
    const heading = this.state.heading;
    if (heading !== undefined) {
      this.steering = true;
      const { rotate, snapTo } = steer(player.entity.orientation, heading, dt);
      if (rotate > 0) player.rotateRight();
      else if (rotate < 0) player.rotateLeft();
      else {
        player.stopRotation();
        if (snapTo !== undefined) player.entity.orientation = snapTo;
      }
    } else if (this.steering) {
      this.steering = false;
      player.stopRotation();
    }
    if (this.state.thrusting) {
      this.thrusting = true;
      player.accelerationFactor = 1;
    } else if (this.thrusting) {
      this.thrusting = false;
      player.accelerationFactor = 0;
    }
  }
}

/** Whether to show touch controls: a coarse pointer (phone, tablet) or `?touch` in the URL. */
export function wantsTouchControls(win: Window): boolean {
  return (
    new URLSearchParams(win.location.search).has("touch") ||
    (typeof win.matchMedia === "function" && win.matchMedia("(pointer: coarse)").matches)
  );
}

function div(className: string, parent: HTMLElement, text = ""): HTMLDivElement {
  const el = parent.ownerDocument.createElement("div");
  el.className = className;
  el.textContent = text;
  parent.append(el);
  return el;
}

export interface TouchControls {
  /** Call once per frame before the game client's update. */
  update(dt: number): void;
  destroy(): void;
}

/**
 * Mounts the touch layer into `parent` (under the HUD, over the canvas) and marks the page with
 * `touch-controls` (the CSS makes the HUD compact). Pointer events of any kind drive it, so it can
 * be tried with a mouse via `?touch`.
 */
export function bindTouch(parent: HTMLElement, client: GameClient, before?: Element | null): TouchControls {
  const doc = parent.ownerDocument;
  doc.body.classList.add("touch-controls");
  const layer = doc.createElement("div");
  layer.className = "touch-layer";
  parent.insertBefore(layer, before ?? null);
  div("touch-hint touch-hint-stick", layer, "drag to steer");
  const thrustButton = div("touch-thrust", layer, "THRUST");
  const base = div("touch-stick", layer);
  const knob = div("touch-knob", base);
  base.hidden = true;

  const state = new TouchState();
  const pilot = new TouchPilot(state);

  const draw = () => {
    const s = state.stick;
    base.hidden = !s;
    if (s) {
      base.style.left = `${s.originX}px`;
      base.style.top = `${s.originY}px`;
      const d = state.drag!;
      const k = d.length > STICK_RADIUS ? STICK_RADIUS / d.length : 1;
      knob.style.transform = `translate(${d.dx * k}px, ${d.dy * k}px)`;
    }
    thrustButton.classList.toggle("active", state.thrusting);
  };

  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    layer.setPointerCapture?.(e.pointerId);
    state.down(e.pointerId, e.clientX, e.clientY, layer.clientWidth || doc.defaultView!.innerWidth);
    draw();
  };
  const onMove = (e: PointerEvent) => {
    state.move(e.pointerId, e.clientX, e.clientY);
    draw();
  };
  const onUp = (e: PointerEvent) => {
    state.up(e.pointerId);
    draw();
  };
  const onBlur = () => {
    state.clear();
    draw();
  };
  // The page must not scroll, zoom or open a context menu while playing.
  const prevent = (e: Event) => e.preventDefault();

  layer.addEventListener("pointerdown", onDown);
  layer.addEventListener("pointermove", onMove);
  layer.addEventListener("pointerup", onUp);
  layer.addEventListener("pointercancel", onUp);
  layer.addEventListener("contextmenu", prevent);
  layer.addEventListener("touchmove", prevent, { passive: false });
  doc.defaultView?.addEventListener("blur", onBlur);

  return {
    update(dt) {
      pilot.update(client.player, dt);
    },
    destroy() {
      doc.defaultView?.removeEventListener("blur", onBlur);
      layer.remove();
      doc.body.classList.remove("touch-controls");
    },
  };
}

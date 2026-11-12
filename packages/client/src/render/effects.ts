import { Container, Graphics } from "pixi.js";
import type { Animated } from "./scenery";
import { drawExplosion } from "./shapes";

/** Blows up to 3× in 0.3 s, then shrinks back over ~1 s while spinning; removes itself when done. */
export class Explosion extends Container implements Animated {
  private phase: "exploding" | "imploding" | "done" = "exploding";
  private size = 0.1;

  constructor(radius: number) {
    super();
    this.addChild(drawExplosion(new Graphics(), radius));
    this.scale.set(this.size);
  }

  get finished(): boolean {
    return this.phase === "done";
  }

  update(dt: number): void {
    if (this.phase === "exploding") {
      this.size += dt * 10;
      if (this.size >= 3) {
        this.size = 3;
        this.phase = "imploding";
      }
    } else if (this.phase === "imploding") {
      this.size -= dt * 3;
      if (this.size <= 0.1) {
        this.size = 0.1;
        this.phase = "done";
        this.destroy({ children: true });
        return;
      }
    }
    this.rotation += dt;
    this.scale.set(this.size);
  }
}

interface Particle {
  g: Graphics;
  age: number;
  life: number;
  vx: number;
  vy: number;
  startSize: number;
}

/**
 * Engine exhaust, modelled on the Dart stagexl_particle config: up to 20 particles, 0.9 ± 0.4 s life,
 * 100 ± 10 units/s away from the nose, growing from ~10 px to 70 px while fading orange → red.
 */
export class ThrustEmitter extends Container implements Animated {
  private static readonly MAX = 20;
  private static readonly RATE = ThrustEmitter.MAX / 0.9; // particles per second at full throttle
  private readonly particles: Particle[] = [];
  private readonly pool: Graphics[] = [];
  private spawnDebt = 0;

  /** Whether new particles are emitted; existing ones always finish their life. */
  emitting = false;
  /** Emission point (world coordinates) and ship orientation, set every frame by the view. */
  originX = 0;
  originY = 0;
  orientation = 0;

  update(dt: number): void {
    if (this.emitting) {
      this.spawnDebt += dt * ThrustEmitter.RATE;
      while (this.spawnDebt >= 1 && this.particles.length < ThrustEmitter.MAX) {
        this.spawnDebt -= 1;
        this.spawn();
      }
      if (this.particles.length >= ThrustEmitter.MAX) this.spawnDebt = 0;
    } else {
      this.spawnDebt = 0;
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.age += dt;
      if (p.age >= p.life) {
        p.g.visible = false;
        this.pool.push(p.g);
        this.particles.splice(i, 1);
        continue;
      }
      const t = p.age / p.life;
      p.g.x += p.vx * dt;
      p.g.y += p.vy * dt;
      const size = p.startSize + (70 - p.startSize) * t;
      p.g.scale.set(size / 2);
      // orange (1, 0.75, 0) → red (1, 0, 0), alpha 1 → 0
      p.g.tint = (0xff << 16) | (Math.round(0xbf * (1 - t)) << 8);
      p.g.alpha = 1 - t;
    }
  }

  private spawn(): void {
    const g = this.pool.pop() ?? this.addChild(new Graphics().circle(0, 0, 1).fill(0xffffff));
    g.visible = true;
    // Exhaust leaves the tail: opposite the ship's +y nose, ±10°.
    const spread = ((Math.random() * 2 - 1) * 10 * Math.PI) / 180;
    const direction = this.orientation + Math.PI / 2 + Math.PI + spread;
    const speed = 100 + (Math.random() * 2 - 1) * 10;
    const tail = { x: Math.sin(this.orientation) * 5, y: -Math.cos(this.orientation) * 5 };
    g.position.set(this.originX + tail.x, this.originY + tail.y);
    this.particles.push({
      g,
      age: 0,
      life: Math.max(0.1, 0.9 + (Math.random() * 2 - 1) * 0.4),
      vx: Math.cos(direction) * speed,
      vy: Math.sin(direction) * speed,
      startSize: Math.max(1, 10 + (Math.random() * 2 - 1) * 20),
    });
  }
}

/** Fixed simulation step. The Dart server hard-coded 0.015 s (game_loop's default update step). */
export const TICK_SECONDS = 0.015;

/** Drives a fixed-timestep simulation; `onUpdate` receives the step length in seconds. */
export interface GameLoop {
  onUpdate: (dt: number) => void;
  start(): void;
  stop(): void;
  readonly running: boolean;
}

/**
 * Real-time loop: wakes up on a timer, measures elapsed wall time and runs as many fixed steps as
 * fit (accumulator pattern). Works in Node and in the browser.
 */
export class RealtimeGameLoop implements GameLoop {
  onUpdate: (dt: number) => void = () => {};
  // Number in browsers, Timeout object in Node — whatever the host's setTimeout returns.
  private handle: ReturnType<typeof setTimeout> | undefined;
  private last = 0;
  private accumulator = 0;

  constructor(
    readonly step = TICK_SECONDS,
    /** Upper bound of catch-up steps per wake-up, so a stalled host doesn't spiral. */
    readonly maxStepsPerWake = 10,
  ) {}

  get running(): boolean {
    return this.handle !== undefined;
  }

  start(): void {
    if (this.running) return;
    this.last = performance.now();
    this.accumulator = 0;
    this.schedule();
  }

  stop(): void {
    if (this.handle !== undefined) clearTimeout(this.handle);
    this.handle = undefined;
  }

  private schedule(): void {
    this.handle = setTimeout(() => this.wake(), (this.step * 1000) / 2);
  }

  private wake(): void {
    const now = performance.now();
    this.accumulator += (now - this.last) / 1000;
    this.last = now;

    let steps = 0;
    while (this.accumulator >= this.step && steps < this.maxStepsPerWake) {
      this.accumulator -= this.step;
      steps++;
      this.onUpdate(this.step);
      if (!this.running) return; // stopped from inside onUpdate
    }
    if (steps === this.maxStepsPerWake) this.accumulator = 0; // drop the backlog
    this.schedule();
  }
}

/**
 * Loop that only advances when told to. Used by tests and by the headless trainer, which runs the
 * simulation as fast as the CPU allows.
 */
export class ManualGameLoop implements GameLoop {
  onUpdate: (dt: number) => void = () => {};
  private active = false;

  constructor(readonly step = TICK_SECONDS) {}

  get running(): boolean {
    return this.active;
  }

  start(): void {
    this.active = true;
  }

  stop(): void {
    this.active = false;
  }

  /** Runs `count` fixed steps (only while started). */
  advance(count = 1): void {
    for (let i = 0; i < count && this.active; i++) this.onUpdate(this.step);
  }

  /** Runs enough steps to cover `seconds` of game time. */
  advanceSeconds(seconds: number): void {
    this.advance(Math.ceil(seconds / this.step - 1e-9));
  }
}

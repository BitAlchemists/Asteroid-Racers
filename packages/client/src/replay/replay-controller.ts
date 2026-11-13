import type { Replay, ReplaySource } from "@ar/server";

export const SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16] as const;

/** Frames a replay may simulate per animation frame, so 16× on a slow machine stays responsive. */
const MAX_STEPS_PER_UPDATE = 400;

/**
 * Playback logic without any drawing: which segment, playing or paused, speed, seeking. `update(dt)`
 * turns wall time into simulation frames. Testable headless; the viewer calls it every animation frame.
 */
export class ReplayController {
  replay: Replay | undefined;
  segment = 0;
  playing: boolean;
  speed = 1;
  private carry = 0;
  /** Bumped whenever a new replay is opened, so a slow open can't overwrite a newer one. */
  private generation = 0;
  private disposed = false;
  /** Called after the replay changed (opened, seeked, moved to another segment). */
  onChange: (() => void) | undefined;

  constructor(
    readonly source: ReplaySource,
    { autoplay = true, speed = 1 }: { autoplay?: boolean; speed?: number } = {},
  ) {
    this.playing = autoplay;
    this.speed = speed;
  }

  /** Frames since the current segment started. */
  get segmentFrame(): number {
    const replay = this.replay;
    return replay ? Math.round(replay.status().seconds / replay.server.tickSeconds) : 0;
  }

  get segmentLength(): number {
    return this.source.segmentFrames(this.segment);
  }

  /** Opens segment `index` (clamped), optionally fast-forwarded by `frame` frames. */
  async open(index: number, frame = 0): Promise<void> {
    const segment = Math.max(0, Math.min(this.source.segments.length - 1, index));
    const ticket = ++this.generation;
    const replay = await this.source.open(segment);
    if (this.disposed || ticket !== this.generation) {
      replay.dispose();
      return;
    }
    this.replay?.dispose();
    this.replay = replay;
    this.segment = segment;
    this.carry = 0;
    if (frame > 0) replay.step(frame);
    this.onChange?.();
  }

  next(): Promise<void> {
    return this.open(this.segment + 1);
  }

  previous(): Promise<void> {
    return this.open(this.segment - 1);
  }

  restart(): Promise<void> {
    return this.open(this.segment);
  }

  /** Re-simulates the current segment up to `frame` (seeking backwards needs a fresh replay). */
  seek(frame: number): Promise<void> {
    return this.open(this.segment, Math.max(0, Math.round(frame)));
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  faster(): void {
    const i = SPEEDS.indexOf(this.speed as (typeof SPEEDS)[number]);
    this.speed = SPEEDS[Math.min(SPEEDS.length - 1, i + 1)] ?? 1;
  }

  slower(): void {
    const i = SPEEDS.indexOf(this.speed as (typeof SPEEDS)[number]);
    this.speed = SPEEDS[Math.max(0, i - 1)] ?? 1;
  }

  toggle(): void {
    this.playing = !this.playing;
  }

  /** Advances the replay by `dt` seconds of wall time at the current speed. */
  update(dt: number): void {
    const replay = this.replay;
    if (!replay || !this.playing || replay.done) return;
    this.carry += (dt * this.speed) / replay.server.tickSeconds;
    const steps = Math.min(MAX_STEPS_PER_UPDATE, Math.floor(this.carry));
    this.carry -= steps;
    if (steps <= 0) return;
    replay.step(steps);
    const now = this.source.segmentOf?.(replay) ?? this.segment;
    if (now !== this.segment && now < this.source.segments.length) {
      this.segment = now;
      this.onChange?.();
    }
  }

  dispose(): void {
    this.disposed = true;
    this.replay?.dispose();
    this.replay = undefined;
  }
}

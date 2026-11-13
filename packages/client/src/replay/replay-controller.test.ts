import {
  arenaReplaySource,
  bundledModels,
  DEFAULT_MODEL_NAME,
  examReplaySource,
  type Replay,
} from "@ar/server";
import { describe, expect, it } from "vitest";
import { ReplayController } from "./replay-controller";

const model = () => bundledModels().load(DEFAULT_MODEL_NAME)![0]!;
const exam = () =>
  examReplaySource(
    model(),
    [
      { track: "short", seed: 1 },
      { track: "random", seed: 2 },
      { track: "random", seed: 3 },
    ],
    20,
  );
const arena = () =>
  arenaReplaySource({
    model: model(),
    arenas: [{ name: "point-to-point", params: { episodes: 3 } }],
    frames: 40,
    collisions: "none",
    crashMode: "end",
    seed: 1,
    g: 1,
  });

describe("ReplayController", () => {
  it("turns wall time into frames at the chosen speed, and stops when paused", async () => {
    const c = new ReplayController(exam(), { autoplay: true });
    await c.open(1);
    c.update(0.15); // 10 frames of 15 ms at 1×
    expect(c.replay!.frame).toBe(10);
    c.setSpeed(4);
    c.update(0.15);
    expect(c.replay!.frame).toBe(50);
    c.toggle();
    c.update(1);
    expect(c.replay!.frame).toBe(50);
    expect(c.segmentFrame).toBe(50);
    c.dispose();
  });

  it("moves between segments, clamped to the list, and seeks by re-simulating", async () => {
    const c = new ReplayController(exam(), { autoplay: false });
    await c.open(0);
    await c.previous();
    expect(c.segment).toBe(0);
    await c.next();
    await c.next();
    await c.next();
    expect(c.segment).toBe(2);
    await c.seek(300);
    expect(c.segment).toBe(2);
    expect(c.segmentFrame).toBe(300);
    expect(c.segmentLength).toBe(Math.round(20 / 0.015));
    c.faster();
    expect(c.speed).toBe(2);
    c.slower();
    c.slower();
    expect(c.speed).toBe(0.5);
    c.dispose();
  });

  it("follows a training replay from episode to episode", async () => {
    const source = arena();
    expect(source.segments).toEqual([
      "point-to-point · episode 1/3",
      "point-to-point · episode 2/3",
      "point-to-point · episode 3/3",
    ]);
    const c = new ReplayController(source, { autoplay: true, speed: 16 });
    let changes = 0;
    c.onChange = () => changes++;
    await c.open(1);
    expect(c.replay!.status().index).toBe(1);
    for (let i = 0; i < 100 && !c.replay!.done; i++) c.update(0.1);
    expect(c.segment).toBe(2);
    expect(changes).toBe(2); // opened, then moved on to episode 3
    c.dispose();
  });

  it("drops a replay that finished opening after a newer one was asked for, and disposes on dispose", async () => {
    const disposed: number[] = [];
    const base = exam();
    const source = {
      ...base,
      async open(i: number): Promise<Replay> {
        const replay = await base.open(i);
        const dispose = replay.dispose.bind(replay);
        replay.dispose = () => {
          disposed.push(i);
          dispose();
        };
        return replay;
      },
    };
    const c = new ReplayController(source, { autoplay: false });
    await Promise.all([c.open(0), c.open(1)]);
    expect(c.segment).toBe(1);
    expect(disposed).toEqual([0]);
    c.dispose();
    expect(disposed).toEqual([0, 1]);
    expect(c.replay).toBeUndefined();
  });
});

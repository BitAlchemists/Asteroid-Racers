import { EntityType, Vector2, World } from "@ar/shared";
import { describe, expect, it } from "vitest";
import { GameServer } from "../game-server";
import { seededRandom } from "../random";
import { FakeClient } from "../test-support";
import { parseTrackFile, TRACK_FORMAT_V2, trackFromFile } from "../track-file";
import type { IGameServer } from "../contracts";
import { RaceController, type RaceRules } from "../race-controller";
import { generateTrack } from "../track-generator";
import { ArenaScript } from "./arena-script";
import { arenaByName, type Arena, type ArenaParams, type EpisodeSpec, type Scenario } from "./arenas";
import { placeScenario } from "./directors";
import { DEFAULT_LAYOUT } from "./index";
import { MajorTom } from "./network";
import { ArenaReplay, ReplayDirector, startScript } from "./replay";
import { parseScoring, scoreEpisodes, type EpisodeRecord } from "./scoring";
import {
  gatesArena,
  generatedLegsArena,
  goalParams,
  headingToOrientation,
  lapsArena,
  parFramesOf,
  raceLegsArena,
  TIER_ARENAS,
} from "./tier-arenas";

// M7 S5: goal types (gates, stop, laps, par) in the training arenas, and par scoring.

const generate = (arena: Arena, seed: number, params: ArenaParams = {}) =>
  arena.generate(seededRandom(seed), { frames: 600, ...params });

/** FNV-1a (32 bit, hex) of a scenario's JSON: a fingerprint for byte-for-byte comparisons. */
function hash(scenario: Scenario): string {
  const text = JSON.stringify(scenario);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** The scenario without the goal fields, for "same scenario, goals on top" comparisons. */
function withoutGoals(scenario: Scenario): Scenario {
  return {
    obstacles: scenario.obstacles,
    episodes: scenario.episodes.map(({ laps: _l, parFrames: _p, finishMaxSpeed: _f, ...e }) => ({
      ...e,
      targets: e.targets.map(({ gate: _g, ...t }) => t),
    })),
  };
}

describe("goal params off: the race-like arenas are byte-identical", () => {
  it("generated-legs and race-legs hash as before M7 S5", () => {
    // Recorded on main at 501c4b6 (before S5).
    expect(hash(generate(generatedLegsArena, 7))).toBe("c25c7244");
    expect(hash(generate(generatedLegsArena, 3, { bands: ["hard"], legs: 4, episodes: 5 }))).toBe("26b73f56");
    expect(hash(generate(raceLegsArena, 5, { tracks: ["slalom", "gauntlet", "canyon"] }))).toBe("7ea27013");
  });

  it("the new arenas come after all older ones, so older arena lists keep their order", () => {
    expect(TIER_ARENAS.slice(-2)).toEqual([gatesArena, lapsArena]);
    expect(arenaByName("gates")).toBe(gatesArena);
    expect(arenaByName("laps")).toBe(lapsArena);
  });
});

describe("goal params on race-legs and generated-legs", () => {
  it("add goals on top of the same scenario (no extra random draws)", () => {
    for (const [arena, params] of [
      [generatedLegsArena, { bands: ["medium"] }],
      [raceLegsArena, { tracks: ["slalom", "random"] }],
    ] as const) {
      for (let seed = 1; seed <= 4; seed++) {
        const plain = generate(arena, seed, params);
        const goals = generate(arena, seed, { ...params, gates: "all", stop: 80, laps: 2, parSpeed: 300 });
        expect(withoutGoals(goals).obstacles).toEqual(plain.obstacles);
        expect(withoutGoals(goals).episodes.map(({ timeLimitFrames: _, ...e }) => e)).toEqual(
          plain.episodes.map(({ timeLimitFrames: _, ...e }) => e),
        );
        goals.episodes.forEach((e, i) => {
          expect(e.laps).toBe(2);
          expect(e.finishMaxSpeed).toBe(80);
          expect(e.timeLimitFrames).toBe(2 * plain.episodes[i]!.timeLimitFrames);
          expect(e.parFrames).toBe(parFramesOf(e.start.position, e.targets, 2, 300));
        });
      }
    }
  });

  it('gates "track" = the generator\'s gates and chicanes; "all" = every checkpoint but the finish', () => {
    let gated = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const params = { bands: ["hard"], episodes: 12, legs: 10, frames: 100 };
      const own = generate(generatedLegsArena, seed, { ...params, gates: "track" });
      const all = generate(generatedLegsArena, seed, { ...params, gates: "all" });
      // The generator's own gates, at the positions of this scenario's track.
      const random = seededRandom(seed);
      random(); // the band pick
      const world = seededRandom(Math.floor(random() * 2 ** 32));
      const track = generateTrack(Math.floor(world() * 2 ** 32), "hard");
      const gatePoints = new Set(
        track.gates.map((g) => `${track.points[g.point]!.x},${track.points[g.point]!.y}`),
      );
      const finish = track.points.at(-1)!;
      own.episodes.forEach((e, i) => {
        e.targets.forEach((t, k) => {
          const key = `${t.position.x},${t.position.y}`;
          expect(t.gate !== undefined, key).toBe(gatePoints.has(key));
          if (t.gate) {
            gated++;
            expect(t.gate).toEqual({ orientation: t.orientation, width: 2 * t.radius });
          }
          const other = all.episodes[i]!.targets[k]!;
          const isFinish = t.position.x === finish.x && t.position.y === finish.y;
          expect(other.gate === undefined).toBe(isFinish);
          if (t.gate) expect(other.gate).toEqual(t.gate);
        });
      });
    }
    expect(gated).toBeGreaterThan(0);
  });

  it("race-legs takes a file track's own gate widths", () => {
    // gate-row (M7 S3) has gates 240 wide; slalom has none, so "track" leaves it plain.
    const row = generate(raceLegsArena, 1, { tracks: ["gate-row"], gates: "track", episodes: 4, legs: 2 });
    const widths = row.episodes.flatMap((e) => e.targets.map((t) => t.gate?.width));
    expect(widths).toContain(240);
    for (const e of row.episodes)
      for (const t of e.targets) if (t.gate) expect(t.gate.orientation).toBe(t.orientation);
    const slalom = generate(raceLegsArena, 1, { tracks: ["slalom"], gates: "track", episodes: 3 });
    for (const e of slalom.episodes) for (const t of e.targets) expect(t.gate).toBeUndefined();
    // Off, gate-row's legs are plain targets, as before S5.
    const off = generate(raceLegsArena, 1, { tracks: ["gate-row"], episodes: 4, legs: 2 });
    for (const e of off.episodes) for (const t of e.targets) expect(t.gate).toBeUndefined();
  });

  it("rejects bad goal params", () => {
    for (const params of [
      { gates: true },
      { gates: "some" },
      { stop: 0 },
      { stop: "slow" },
      { laps: 0 },
      { laps: 1.5 },
      { parSpeed: 0 },
      { parSpeed: [300] },
    ]) {
      expect(() => generate(generatedLegsArena, 1, params), JSON.stringify(params)).toThrow(/arena param/);
      expect(() => generate(raceLegsArena, 1, params), JSON.stringify(params)).toThrow(/arena param/);
    }
    expect(() => goalParams({ gates: "all" })).toThrow(/arena param gates/);
  });
});

describe("gates arena", () => {
  it("is a chain of directional gates, skewed from the leg by up to `skew` degrees", () => {
    const scenario = generate(gatesArena, 3, { episodes: 20, width: 160, skew: [10, 30], targets: [2, 4] });
    expect(scenario.obstacles).toEqual([]);
    for (const e of scenario.episodes) {
      expect(e.targets.length).toBeGreaterThanOrEqual(2);
      expect(e.targets.length).toBeLessThanOrEqual(4);
      expect(e.timeLimitFrames).toBe(600 * e.targets.length);
      let from = e.start.position;
      for (const t of e.targets) {
        expect(t.gate!.width).toBe(160);
        expect(t.radius).toBe(80);
        const leg = t.position.minus(from);
        from = t.position;
        // The gate's travel direction (−sin, cos) against the leg's.
        const direction = new Vector2(-Math.sin(t.gate!.orientation), Math.cos(t.gate!.orientation));
        const angle = (Math.acos(direction.dot(leg) / leg.length) * 180) / Math.PI;
        expect(angle).toBeGreaterThanOrEqual(10 - 1e-6);
        expect(angle).toBeLessThanOrEqual(30 + 1e-6);
      }
    }
    expect(hash(generate(gatesArena, 3))).toBe(hash(generate(gatesArena, 3)));
  });

  it("takes stop, laps and parSpeed, and rejects bad params", () => {
    const e = generate(gatesArena, 2, { episodes: 1, stop: 50, laps: 2, parSpeed: 200 }).episodes[0]!;
    expect(e).toMatchObject({ laps: 2, finishMaxSpeed: 50, timeLimitFrames: 600 * e.targets.length * 2 });
    expect(e.parFrames).toBeGreaterThan(0);
    for (const params of [{ gates: "all" }, { width: 0 }, { skew: [30, 10] }, { targets: [0, 2] }])
      expect(() => generate(gatesArena, 1, params), JSON.stringify(params)).toThrow(/arena param/);
  });
});

describe("laps arena", () => {
  it("is a closed circuit round a ring, the last target on the start, flown `laps` times", () => {
    const scenario = generate(lapsArena, 5, { episodes: 12, targets: [3, 6], ring: [500, 600], laps: 2 });
    expect(scenario.obstacles).toEqual([]);
    for (const e of scenario.episodes) {
      const n = e.targets.length;
      expect(n).toBeGreaterThanOrEqual(3);
      expect(e.laps).toBe(2);
      expect(e.timeLimitFrames).toBe(600 * n * 2);
      expect(e.targets.at(-1)!.position).toEqual(e.start.position);
      // The ship starts facing its first target.
      const first = e.targets[0]!.position.minus(e.start.position);
      expect(headingToOrientation(Math.atan2(first.y, first.x))).toBeCloseTo(e.start.orientation, 9);
      for (const t of e.targets) expect(t.gate).toBeUndefined();
    }
    const gated = generate(lapsArena, 5, { gates: true, radius: 40 });
    for (const e of gated.episodes)
      for (const t of e.targets) expect(t.gate).toEqual({ orientation: t.orientation, width: 80 });
  });

  it("rejects bad params", () => {
    for (const params of [{ laps: 0 }, { gates: "all" }, { ring: [50, 60] }, { targets: [1, 3] }])
      expect(() => generate(lapsArena, 1, params), JSON.stringify(params)).toThrow(/arena param/);
  });
});

describe("scoring.par", () => {
  const record = (over: Partial<EpisodeRecord>): EpisodeRecord => ({
    targets: 2,
    reached: 2,
    frames: 100,
    crashes: 0,
    distance: 0,
    progress: 0,
    rotation: 0,
    flownFrames: 100,
    ...over,
  });

  it("rewards seconds under par for finished episodes only; absent = off", () => {
    const weights = parseScoring({ distance: 0, success: 1000, par: 10 });
    expect(weights.par).toBe(10);
    const tick = 0.015;
    expect(scoreEpisodes([record({ parFrames: 300 })], weights, tick)).toBeCloseTo(-10 * 200 * tick, 9);
    expect(scoreEpisodes([record({ parFrames: 80 })], weights, tick)).toBe(0); // slower than par
    expect(scoreEpisodes([record({ parFrames: 300, reached: 1 })], weights, tick)).toBe(1000); // not finished
    expect(scoreEpisodes([record({})], weights, tick)).toBe(0); // no par
    const off = parseScoring({ distance: 0, success: 1000 });
    expect("par" in off).toBe(false);
    expect(scoreEpisodes([record({ parFrames: 300 })], off, tick)).toBe(0);
    expect(() => parseScoring({ par: -1 })).toThrow(/scoring.par/);
  });
});

// --- training episodes behave as the race controller ---------------------------------------------

/** One frame of a scripted flight: the ship is put at `position` with `velocity`, then a frame runs. */
interface Frame {
  position: Vector2;
  velocity: Vector2;
}

/** A flight along `points` in steps of `step` units at `speed` (units/s), `speeds` per segment. */
function flight(points: Vector2[], speeds: number[], step = 40): Frame[] {
  const frames: Frame[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const along = b.minus(a);
    const n = Math.max(1, Math.ceil(along.length / step));
    const velocity = along.normalized().times(speeds[i - 1]!);
    for (let k = 1; k <= n; k++) frames.push({ position: a.plus(along.times(k / n)), velocity });
  }
  return frames;
}

/** A square, no rocks: portal (0, 0), checkpoint 1 (0, −600), checkpoint 2 (600, −600), finish (600, 0). */
const square = trackFromFile(
  parseTrackFile({
    format: TRACK_FORMAT_V2,
    name: "square",
    description: "test square",
    race: {
      start: { x: 0, y: 0, heading: 0 },
      checkpoints: [
        { x: 0, y: -600 },
        { x: 600, y: -600 },
      ],
      finish: { x: 600, y: 0 },
    },
  }),
);

/** Progress (course position) after each frame of a race on the square under `rules`. */
function raceProgress(rules: RaceRules, frames: Frame[]): number[] {
  const server = new GameServer({ random: seededRandom(1) }).loadTrack(square);
  const controller = server.raceController!;
  controller.setRules(rules);
  const client = new FakeClient(server);
  client.handshake("Racer");
  server.tick(); // joins on the portal
  // Finishing restarts the race at 0: from then on report the course's end.
  let finished = false;
  controller.onFinish = () => (finished = true);
  return frames.map((f) => {
    server.teleportPlayerTo(client.proxy, f.position, 0, f.velocity);
    server.tick();
    return finished ? controller.courseLength - 1 : (controller.progressOf(client.proxy) ?? -1);
  });
}

/** Targets reached after each frame of a training episode flown along the same frames. */
async function episodeProgress(spec: EpisodeSpec, frames: Frame[]): Promise<number[]> {
  const server = new GameServer({
    random: seededRandom(1),
    entityUpdatesPerTick: 0,
    sendOwnShipEveryTick: true,
  });
  const director = new ReplayDirector({ collisions: "none", autoRespawn: false });
  server.registerService(director);
  await server.start();
  const placed = placeScenario(server, { obstacles: [], episodes: [spec] });
  // All weights 0: the network's outputs stay 0, so the frames decide where the ship is.
  const model = MajorTom.random(DEFAULT_LAYOUT, () => 0.5);
  const script = new ArenaScript(model, placed.episodes, "end", server.tickSeconds);
  const { proxy } = await startScript(director, script);
  const progress = frames.map((f) => {
    server.teleportPlayerTo(proxy, f.position, 0, f.velocity);
    server.tick();
    return script.currentRecord?.reached ?? script.records[0]!.reached;
  });
  script.stop();
  server.stop();
  return progress;
}

/**
 * The square's race under `rules` as a training episode, built as race-legs cuts legs: the start on
 * the portal, the targets one lap (checkpoint 1, 2, the finish), gates where the race has them,
 * `laps` and the finish's speed limit as episode goals.
 */
function squareEpisode(rules: RaceRules): EpisodeSpec {
  const race = new RaceController({} as IGameServer);
  square.build(new World(), race, seededRandom(1));
  race.setRules(rules);
  const [start, ...targets] = race.checkpoints;
  return {
    start: { position: start!.position.clone(), orientation: start!.orientation },
    targets: targets.map((c, k) => {
      const width = race.gateWidth(k + 1);
      return {
        position: c.position.clone(),
        radius: c.radius,
        orientation: c.orientation,
        ...(width === undefined ? {} : { gate: { orientation: c.orientation, width } }),
      };
    }),
    timeLimitFrames: 100_000,
    ...(rules.laps === undefined ? {} : { laps: rules.laps }),
    ...(rules.finishMaxSpeed === undefined ? {} : { finishMaxSpeed: rules.finishMaxSpeed }),
  };
}

/** Race and training episode flown along the same frames: their progress, frame by frame. */
async function both(rules: RaceRules, frames: Frame[]): Promise<{ race: number[]; episode: number[] }> {
  return { race: raceProgress(rules, frames), episode: await episodeProgress(squareEpisode(rules), frames) };
}

const P = (x: number, y: number) => new Vector2(x, y);

// Flights run in steps of at most 45 units, and every plain checkpoint is a corner of the flight, so
// no frame puts the ship in the ring between the target radius (training: the centre inside it) and
// the target radius + the ship's (the race: the ship touching it), nor within a frame's movement of
// a boundary (training sees the ship before the frame's physics, the race after). So both count on
// the same frame. Gates are lines, the same in both.
const STEP = 45;
const PORTAL = P(0, 0);
const CP1 = P(0, -600);
const CP2 = P(600, -600);
const FINISH = P(600, 0);

describe("training episodes behave as the race controller (same flight, same progress per frame)", () => {
  it("laps: the checkpoints and the finish repeat; progress counts over all laps", async () => {
    const points = [PORTAL, CP1, CP2, FINISH, CP1, CP2, FINISH];
    const { race, episode } = await both({ laps: 2 }, flight(points, Array(points.length).fill(300), STEP));
    expect(race.at(-1)).toBe(6);
    expect(episode).toEqual(race);
  });

  it("directional gates: a wrong-way crossing doesn't count, the right way does", async () => {
    // Checkpoint 1's gate is the line x = 0 for |y + 600| ≤ 100, crossed towards +x; checkpoint 2's
    // is y = −600 for |x − 600| ≤ 100, crossed towards +y. First through gate 1 the wrong way, then
    // round and through it the right way; through gate 2; on to the finish.
    const points = [
      PORTAL,
      P(200, -550),
      P(-200, -550),
      P(-200, -650),
      P(200, -650),
      P(600, -700),
      P(600, -500),
      FINISH,
    ];
    const { race, episode } = await both(
      { gates: true },
      flight(points, Array(points.length).fill(300), STEP),
    );
    expect(race.at(-1)).toBe(3);
    const wrongWay = flight(points.slice(0, 3), [300, 300], STEP).length;
    expect(race[wrongWay - 1]).toBe(0); // crossed gate 1 backwards: nothing
    expect(episode).toEqual(race);
  });

  it("stop at the finish: only the last lap's finish needs the speed limit", async () => {
    // Lap 1 ends fast (counts: not the last lap); lap 2 arrives fast (doesn't count), then slows.
    const points = [PORTAL, CP1, CP2, FINISH, CP1, CP2, P(600, -50), FINISH];
    const speeds = [...Array(points.length - 2).fill(400), 30];
    const frames = flight(points, speeds, STEP);
    const { race, episode } = await both({ laps: 2, finishMaxSpeed: 100 }, frames);
    expect(race.at(-1)).toBe(6);
    const fast = flight(points.slice(0, -1), speeds, STEP).length;
    expect(race.indexOf(6)).toBeGreaterThanOrEqual(fast); // only once slow
    expect(race.indexOf(3)).toBeLessThan(frames.length / 2); // lap 1's finish counted at speed
    expect(episode).toEqual(race);
  });

  it("without goals, the same flight also gives the same progress", async () => {
    const points = [PORTAL, CP1, CP2, FINISH];
    const { race, episode } = await both({}, flight(points, Array(points.length).fill(300), STEP));
    expect(race.at(-1)).toBe(3);
    expect(episode).toEqual(race);
  });
});

describe("replays of goal arenas", () => {
  // That the flight stays the training's (arrows are decoration) is checked by lab-train.test.ts's
  // replay of a generated curriculum with gates.
  it("draw an arrow on every directional gate", async () => {
    const model = MajorTom.random(DEFAULT_LAYOUT, seededRandom(3));
    const options = {
      model,
      frames: 60,
      collisions: "obstacles" as const,
      crashMode: "end" as const,
      seed: 4,
      g: 2,
    };
    const arenas = [{ name: "gates", params: { episodes: 2, targets: [2, 2] } }];
    const replay = await ArenaReplay.create({ ...options, arenas });
    const arrows = [...replay.server.world.entities.values()].filter((e) => e.type === EntityType.ARROWS);
    expect(arrows).toHaveLength(4);
    while (!replay.done) replay.step(100);
    expect(replay.records.map((r) => r.targets)).toEqual([2, 2]);
    replay.dispose();
  });
});

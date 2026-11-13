import { describe, expect, it } from "vitest";
import { GameServer } from "./game-server";
import { seededRandom } from "./random";
import {
  headingToOrientation,
  parseTrackFile,
  TRACK_FORMAT,
  trackFromFile,
  TrackFileError,
} from "./track-file";
import { fileTracks, trackByName, type Track } from "./tracks";

const load = (track: Track, seed: number) => new GameServer({ random: seededRandom(seed) }).loadTrack(track);

/** Every entity in insertion order: type, position, radius (orientation separately, it is a float sum). */
const layout = (s: GameServer) =>
  [...s.world.entities.values()].map((e) => [e.type, e.position.x, e.position.y, e.radius]);
const orientations = (s: GameServer) => [...s.world.entities.values()].map((e) => e.orientation);

/** 64-bit FNV-1a of the world's layout, as hex (the server package has no node:crypto). */
const fingerprint = (s: GameServer) => {
  const text = JSON.stringify([
    layout(s),
    orientations(s),
    s.world.passiveCollisionEntities.length,
    s.raceController!.checkpoints.map((c) => [c.position.x, c.position.y, c.radius]),
  ]);
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < text.length; i++)
    h = ((h ^ BigInt(text.charCodeAt(i))) * 0x100000001b3n) & 0xffffffffffffffffn;
  return h.toString(16).padStart(16, "0");
};

/** `short` (scene 1 + race 1) written in the file format. */
const SHORT = {
  format: TRACK_FORMAT,
  name: "short-file",
  description: "scene 1 in the file format",
  race: { start: { x: 0, y: -200 }, checkpoints: [{ x: 0, y: -600 }], finish: { x: 0, y: -800 } },
  belts: [
    { x: -2000, y: 250, width: 4000, height: 4000 },
    { x: -300, y: -100, width: 200, height: -1000, count: 20 },
    { x: 100, y: -100, width: 200, height: -1000, count: 20 },
    { x: -150, y: -1300, width: 300, height: -300, count: 20 },
  ],
  arrows: [
    [0, -400, 0],
    [0, -200, 0],
    [100, -1200, 45],
    [-100, -1200, 315],
    [150, -1700, 270],
    [-150, -1700, 90],
  ],
};

/** `demo` (scene 2 + race 2) written in the file format. */
const DEMO = {
  format: TRACK_FORMAT,
  name: "demo-file",
  description: "scene 2 in the file format",
  race: {
    start: { x: 150, y: 0, heading: 90 },
    checkpoints: [
      { x: 2550, y: 0, heading: 180 },
      { x: 2550, y: 1200, heading: 270 },
      { x: 1350, y: 1200, heading: 0 },
      { x: 1350, y: -1200, heading: 270 },
      { x: 150, y: -1200, heading: 180 },
    ],
    finish: { x: 150, y: 200, heading: 0 },
  },
  belts: [
    { x: 250, y: -1100, width: 1000, height: 1000 },
    { x: 250, y: 100, width: 1000, height: 1000 },
    { x: 1450, y: -1100, width: 1000, height: 1000 },
    { x: 1450, y: 100, width: 1000, height: 1000 },
  ],
  arrows: [
    [350, 0, 90],
    [950, 0, 90],
    [1750, 0, 90],
    [2550, 0, 180],
    [2550, 1200, 270],
    [1350, 1200, 0],
    [1350, 300, 0],
    [1350, -300, 0],
    [1350, -1200, 270],
    [150, -1200, 180],
  ],
};

const minimal = (extra: Record<string, unknown> = {}) => ({
  format: TRACK_FORMAT,
  name: "tiny",
  description: "one checkpoint",
  race: { start: { x: 0, y: 0 }, checkpoints: [{ x: 0, y: -600 }], finish: { x: 0, y: -1200 } },
  ...extra,
});

describe("track files", () => {
  it("the code tracks are unchanged (fingerprints of demo, short and random for three seeds)", () => {
    // Recorded before track files existed. If this fails, an exam track changed: M4's yardstick moved.
    const prints = ["demo", "short", "random"].map((name) =>
      [1, 2, 3].map((seed) => fingerprint(load(trackByName(name), seed))),
    );
    expect(prints).toEqual(EXPECTED_FINGERPRINTS);
  });

  it.each([
    ["short", SHORT],
    ["demo", DEMO],
  ])("%s in the file format builds the same world as the code track", (name, raw) => {
    const fromFile = trackFromFile(parseTrackFile(raw));
    for (const seed of [1, 2, 3]) {
      const a = load(trackByName(name), seed);
      const b = load(fromFile, seed);
      expect(layout(b)).toEqual(layout(a));
      const oa = orientations(a);
      orientations(b).forEach((o, i) => expect(o).toBeCloseTo(oa[i]!, 12));
      expect(b.world.passiveCollisionEntities.length).toBe(a.world.passiveCollisionEntities.length);
    }
  });

  it("headings: 0 up, 90 right, 180 down, 270 left, in the game's orientation", () => {
    expect(headingToOrientation(0)).toBeCloseTo(Math.PI);
    expect(headingToOrientation(90)).toBeCloseTo(Math.PI * 1.5);
    expect(headingToOrientation(180)).toBeCloseTo(0);
    expect(headingToOrientation(270)).toBeCloseTo(Math.PI * 0.5);
    expect(headingToOrientation(-90)).toBeCloseTo(Math.PI * 0.5);
  });

  it("points without a heading face the next point; the finish faces along the last leg", () => {
    const server = load(
      trackFromFile(
        parseTrackFile(
          minimal({
            race: { start: { x: 0, y: 0 }, checkpoints: [{ x: 600, y: 0 }], finish: { x: 600, y: 600 } },
          }),
        ),
      ),
      1,
    );
    // Entities keep orientations in (−π, π]; compare modulo a full turn.
    const turn = (a: number) => Math.cos(a) + 10 * Math.sin(a);
    const [start, checkpoint, finish] = server.raceController!.checkpoints;
    expect(turn(start!.orientation)).toBeCloseTo(turn(headingToOrientation(90)));
    expect(turn(checkpoint!.orientation)).toBeCloseTo(turn(headingToOrientation(180)));
    expect(turn(finish!.orientation)).toBeCloseTo(turn(headingToOrientation(180)));
  });

  it("fixed asteroids collide; arrows don't; checkpoint radius is optional", () => {
    const server = load(
      trackFromFile(
        parseTrackFile(
          minimal({
            race: {
              start: { x: 0, y: 0 },
              checkpoints: [{ x: 0, y: -600, radius: 60 }],
              finish: { x: 0, y: -1200 },
            },
            asteroids: [
              [300, -600, 40],
              [-300, -600, 50],
            ],
            arrows: [[0, -300, 0]],
          }),
        ),
      ),
      1,
    );
    expect(server.world.passiveCollisionEntities.map((e) => [e.position.x, e.radius])).toEqual([
      [300, 40],
      [-300, 50],
    ]);
    expect(server.raceController!.checkpoints.map((c) => c.radius)).toEqual([100, 60, 100]);
  });

  it.each<[string, Record<string, unknown>, RegExp]>([
    ["a wrong format", { format: "asteroid-racers/track/v0" }, /format must be "asteroid-racers\/track\/v1"/],
    ["a bad name", { name: "My Track" }, /name must be lower case/],
    ["an unknown key", { speed: 3 }, /the track has an unknown key "speed"/],
    [
      "no checkpoints",
      { race: { start: { x: 0, y: 0 }, checkpoints: [], finish: { x: 0, y: -600 } } },
      /race.checkpoints must have at least one checkpoint/,
    ],
    [
      "a missing finish",
      { race: { start: { x: 0, y: 0 }, checkpoints: [{ x: 0, y: -600 }] } },
      /race is missing "finish"/,
    ],
    [
      "a non-number",
      { race: { start: { x: 0, y: "0" }, checkpoints: [{ x: 0, y: -600 }], finish: { x: 0, y: -1200 } } },
      /race.start.y must be a finite number/,
    ],
    ["a short asteroid", { asteroids: [[1, 2]] }, /asteroids\[0\] must be \[x, y, radius\]/],
    ["a zero radius", { asteroids: [[500, 500, 0]] }, /asteroids\[0\]\[2\] \(radius\) must be > 0/],
    [
      "a checkpoint inside an asteroid",
      {
        asteroids: [
          [500, 500, 10],
          [40, -620, 30],
        ],
      },
      /race.checkpoints\[0\] overlaps asteroids\[1\] at \(40, -620\)/,
    ],
    ["a blocked portal", { asteroids: [[0, 150, 60]] }, /race.start \(the portal\) overlaps asteroids\[0\]/],
    [
      "a blocked world spawn",
      {
        race: { start: { x: 0, y: -400 }, checkpoints: [{ x: 0, y: -900 }], finish: { x: 0, y: -1400 } },
        asteroids: [[0, 120, 30]],
      },
      /the world spawn \(0, 0\) overlaps asteroids\[0\]/,
    ],
    [
      "a belt over the finish",
      { belts: [{ x: -100, y: -1250, width: 200, height: 100 }] },
      /race.finish overlaps belts\[0\]/,
    ],
    [
      "a bad belt count",
      { belts: [{ x: 500, y: 500, width: 100, height: 100, count: 1.5 }] },
      /belts\[0\].count must be an integer/,
    ],
  ])("rejects %s with a clear error", (_, extra, message) => {
    expect(() => parseTrackFile(minimal(extra), "tracks/tiny.json")).toThrow(TrackFileError);
    expect(() => parseTrackFile(minimal(extra), "tracks/tiny.json")).toThrow(message);
    expect(() => parseTrackFile(minimal(extra), "tracks/tiny.json")).toThrow(/^tracks\/tiny.json: /);
  });

  it("file names must match track names and must not shadow code tracks", () => {
    expect(() => fileTracks({ other: minimal() })).toThrow(/must match the file name/);
    expect(() => fileTracks({ demo: minimal({ name: "demo" }) })).toThrow(/already a code track/);
    expect(Object.keys(fileTracks({ tiny: minimal() }))).toEqual(["tiny"]);
  });
});

const EXPECTED_FINGERPRINTS = [
  ["fcb0ac82196fdb2d", "4a425aef6c17e8e4", "7e76e2e35a822ae9"],
  ["f2b29cc5a3389683", "1a68bbdd645e5b80", "a12f6264a30d27eb"],
  ["530ec1571a6bcc3b", "c862c6562f5ecce0", "d74f533e8a8f1e15"],
];

import { World } from "@ar/shared";
import { describe, expect, it } from "vitest";
import type { IGameServer } from "./contracts";
import { GameServer, SHIP_RADIUS } from "./game-server";
import { RaceController } from "./race-controller";
import { seededRandom } from "./random";
import {
  buildGeneratedTrack,
  CENTRE_LINE_MARGIN,
  generatedTrack,
  generateTrack,
  GENERATOR_SHIP_RADIUS,
  TRACK_BAND_NAMES,
  TRACK_BANDS,
  trackSummary,
  validateGeneratedTrack,
  type GeneratedTrack,
  type LegKind,
  type TrackBand,
} from "./track-generator";
import { trackByName, TRACKS } from "./tracks";

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 7919 + 1);
const fingerprint = (track: GeneratedTrack) => fnv(JSON.stringify(track));
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const clone = (t: GeneratedTrack): GeneratedTrack => JSON.parse(JSON.stringify(t)) as GeneratedTrack;

describe("track generator", () => {
  it("uses the game's ship radius", () => {
    expect(GENERATOR_SHIP_RADIUS).toBe(SHIP_RADIUS);
  });

  it("the same seed and band give the same track; seed and band change it", () => {
    for (const band of TRACK_BAND_NAMES) {
      expect(JSON.stringify(generateTrack(5, band))).toBe(JSON.stringify(generateTrack(5, band)));
      expect(JSON.stringify(generateTrack(5, band))).not.toBe(JSON.stringify(generateTrack(6, band)));
    }
    expect(generateTrack(5, "easy").points).not.toEqual(generateTrack(5, "hard").points);
  });

  it("fingerprints (a change here changes every generated track)", () => {
    expect(TRACK_BAND_NAMES.map((band) => [1, 2, 3].map((s) => fingerprint(generateTrack(s, band))))).toEqual(
      FINGERPRINTS,
    );
  });

  it.each(TRACK_BAND_NAMES)("%s: every track of 60 seeds is valid", (band) => {
    const spec = TRACK_BANDS[band];
    for (const seed of SEEDS) {
      const track = generateTrack(seed, band);
      expect(validateGeneratedTrack(track), `${band}:${seed}`).toEqual([]);
      expect(track.legs).toHaveLength(spec.legs);
      expect(track.points).toHaveLength(spec.legs + 1);
      // Independent of the validator: race points clear of rocks, gates wider than the ship.
      for (const rock of track.rocks)
        for (const p of track.points)
          expect(dist(rock, p)).toBeGreaterThanOrEqual(p.radius + rock.radius - 1e-9);
      for (const gate of track.gates) {
        const [a, b] = gate.rocks.map((i) => track.rocks[i]!);
        expect(dist(a!, b!) - a!.radius - b!.radius).toBeGreaterThanOrEqual(
          2 * SHIP_RADIUS + CENTRE_LINE_MARGIN,
        );
        expect(gate.gap).toBe(spec.gateGap);
      }
      // The finish is never a gate and always has the game's finish radius.
      expect(track.points.at(-1)!.radius).toBe(100);
    }
  });

  it("the bands differ: more legs, sharper turns, more rocks on the line, narrower gaps", () => {
    const stats = (band: TrackBand) => {
      const s = SEEDS.map((seed) => trackSummary(generateTrack(seed, band)));
      return {
        legs: mean(s.map((x) => x.legs)),
        turn: mean(s.map((x) => x.meanTurn)),
        obstacles: mean(s.map((x) => x.obstacleRocks)),
        gap: Math.min(...s.map((x) => x.minGateGap)),
      };
    };
    const [easy, medium, hard] = TRACK_BAND_NAMES.map(stats) as [
      ReturnType<typeof stats>,
      ReturnType<typeof stats>,
      ReturnType<typeof stats>,
    ];
    expect(easy.legs).toBeLessThan(medium.legs);
    expect(medium.legs).toBeLessThan(hard.legs);
    // Mean turn at race points (degrees): about 39 / 62 / 77.
    expect(medium.turn - easy.turn).toBeGreaterThan(10);
    expect(hard.turn - medium.turn).toBeGreaterThan(5);
    // Field, belt and gate rocks per track: about 16 / 53 / 70.
    expect(medium.obstacles).toBeGreaterThan(easy.obstacles * 1.5);
    expect(hard.obstacles).toBeGreaterThan(medium.obstacles * 1.1);
    expect(easy.gap).toBeGreaterThan(medium.gap);
    expect(medium.gap).toBeGreaterThan(hard.gap);
    expect(TRACK_BANDS.easy.corridorWidth).toBeGreaterThan(TRACK_BANDS.medium.corridorWidth);
    expect(TRACK_BANDS.medium.corridorWidth).toBeGreaterThan(TRACK_BANDS.hard.corridorWidth);
  });

  it("every band uses every element; hairpins only from medium on", () => {
    for (const band of TRACK_BAND_NAMES) {
      const kinds = new Set<LegKind>();
      let hairpins = 0;
      for (const seed of SEEDS) {
        const track = generateTrack(seed, band);
        for (const leg of track.legs) {
          kinds.add(leg.kind);
          if (leg.hairpin) hairpins++;
        }
      }
      expect([...kinds].sort(), band).toEqual(["belt", "chicane", "corridor", "field", "gate", "straight"]);
      if (band === "easy") expect(hairpins).toBe(0);
      else expect(hairpins).toBeGreaterThan(0);
    }
  });

  it("validation finds rocks on race points, blocked legs, holes in walls and narrow gates", () => {
    const track = generateTrack(11, "medium");
    expect(validateGeneratedTrack(track)).toEqual([]);

    const onPoint = clone(track);
    onPoint.rocks.push({ ...onPoint.points[2]!, radius: 30, role: "field", leg: 1 });
    expect(validateGeneratedTrack(onPoint).join()).toMatch(/overlaps race point 2/);

    // A wall of rocks across the middle of leg 0 (a straight), far wider than the search box.
    const blocked = clone(track);
    const [a, b] = [blocked.legs[0]!.path[0]!, blocked.legs[0]!.path.at(-1)!];
    const len = dist(a, b);
    const [ux, uy] = [(b.x - a.x) / len, (b.y - a.y) / len];
    for (let c = -1200; c <= 1200; c += 40)
      blocked.rocks.push({
        x: a.x + (ux * len) / 2 - uy * c,
        y: a.y + (uy * len) / 2 + ux * c,
        radius: 30,
        role: "field",
        leg: 0,
      });
    const problems = validateGeneratedTrack(blocked).join();
    expect(problems).toMatch(/leg 0 \(straight\) is not flyable/);
    expect(problems).toMatch(/blocks the centre line of leg 0/);

    // Move a stretch of wall in the middle of a corridor piece far away (indices stay valid).
    const seed = SEEDS.find((s) => generateTrack(s, "easy").legs.some((l) => l.kind === "corridor"))!;
    const holed = clone(generateTrack(seed, "easy"));
    const l = holed.legs.findIndex((leg) => leg.kind === "corridor");
    const path = holed.legs[l]!.path;
    const mid = { x: (path[0]!.x + path[1]!.x) / 2, y: (path[0]!.y + path[1]!.y) / 2 };
    for (const r of holed.rocks) if (r.role === "wall" && r.leg === l && dist(r, mid) < 300) r.x += 1e6;
    expect(validateGeneratedTrack(holed).join()).toMatch(new RegExp(`corridor of leg ${l} has a hole`));

    const gated = clone(SEEDS.map((s) => generateTrack(s, "hard")).find((t) => t.gates.length > 0)!);
    const gate = gated.gates[0]!;
    for (const i of gate.rocks) gated.rocks[i]!.radius += gate.gap / 2 - 20;
    expect(validateGeneratedTrack(gated).join()).toMatch(/gate at race point \d+ is only \d+ wide/);
  });

  it("rejects unknown bands and bad seeds", () => {
    expect(() => generateTrack(1, "extreme" as TrackBand)).toThrow(/unknown track band/);
    expect(() => generateTrack(-1, "easy")).toThrow(/seed/);
    expect(() => generateTrack(1.5, "easy")).toThrow(/seed/);
  });
});

describe("generated tracks in the registry", () => {
  const NO_SERVER = {} as IGameServer;

  it("are listed per band after the other tracks", () => {
    expect(Object.keys(TRACKS).slice(-3)).toEqual(["generated:easy", "generated:medium", "generated:hard"]);
    for (const band of TRACK_BAND_NAMES) expect(TRACKS[`generated:${band}`]!.name).toBe(`generated:${band}`);
  });

  it("generated:<band>:<seed> is that generated track, whatever the world's seed", () => {
    const track = trackByName("generated:hard:42");
    expect(track.name).toBe("generated:hard:42");
    const layout = (seed: number) => {
      const server = new GameServer({ random: seededRandom(seed) }).loadTrack(track);
      return {
        rocks: server.world.passiveCollisionEntities.map((e) => [e.position.x, e.position.y, e.radius]),
        race: server.raceController!.checkpoints.map((c) => [c.position.x, c.position.y, c.radius]),
      };
    };
    expect(layout(1)).toEqual(layout(2));
    const g = generateTrack(42, "hard");
    expect(layout(1).rocks).toEqual(g.rocks.map((r) => [r.x, r.y, r.radius]));
    expect(layout(1).race).toEqual(g.points.map((p) => [p.x, p.y, p.radius]));
    for (const bad of [
      "generated:extreme:1",
      "generated:hard:",
      "generated:hard:-3",
      "generated:hard:99999999999",
    ])
      expect(() => trackByName(bad), bad).toThrow(/unknown track/);
  });

  it("generated:<band> takes its generator seed from the world's random", () => {
    const points = (seed: number) => {
      const server = new GameServer({ random: seededRandom(seed) }).loadTrack(
        trackByName("generated:medium"),
      );
      return server.raceController!.checkpoints.map((c) => [c.position.x, c.position.y]);
    };
    expect(points(3)).toEqual(points(3));
    expect(points(3)).not.toEqual(points(4));
  });

  it("builds rocks, arrows, then the race; race points face the next leg", () => {
    const track = generateTrack(8, "easy");
    const world = new World();
    const race = new RaceController(NO_SERVER);
    buildGeneratedTrack(track, world, race);
    expect(race.checkpoints).toHaveLength(track.points.length);
    expect(world.passiveCollisionEntities).toHaveLength(track.rocks.length);
    for (let i = 0; i < track.legs.length; i++) {
      const c = race.checkpoints[i]!;
      const next = track.legs[i]!.path[1]!;
      // The game's orientation: π faces up (−y), so the nose is (sin(o − π), −cos(o − π)).
      const nose = { x: Math.sin(c.orientation - Math.PI), y: -Math.cos(c.orientation - Math.PI) };
      const along = { x: next.x - c.position.x, y: next.y - c.position.y };
      const cos = (nose.x * along.x + nose.y * along.y) / Math.hypot(along.x, along.y);
      expect(cos).toBeCloseTo(1, 6);
    }
    expect(generatedTrack("easy", 8).name).toBe("generated:easy:8");
  });
});

/** FNV-1a of the JSON of generateTrack(seed 1, 2, 3) per band (easy, medium, hard). */
const FINGERPRINTS: string[][] = [
  ["236b24c9", "4ddcbe95", "ef532caa"],
  ["f157da18", "9e5c060b", "f85d5950"],
  ["7600457d", "d0e14f58", "6b1bbc36"],
];

/** FNV-1a (32 bit, hex) of a string: a fingerprint for byte-for-byte comparisons. */
function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, "0");
}

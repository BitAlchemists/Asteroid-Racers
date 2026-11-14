import { describe, expect, it } from "vitest";
import { GameServer, SHIP_RADIUS } from "./game-server";
import { seededRandom } from "./random";
import { fileTracks, trackByName } from "./tracks";
import circuit from "./tracks/circuit.json";

/**
 * Fairness of the hand-made tracks (M5, M7 S3), checked on the built world, so belts and later
 * format fields count too.
 */
const load = (name: string, seed = 1) =>
  new GameServer({ random: seededRandom(seed) }).loadTrack(trackByName(name));

const FILE_TRACKS = Object.keys(fileTracks());
/**
 * Tracks that are one closed corridor: no way out between the wall rocks, every leg in sight. (M5's
 * `canyon` is open past the finish and cuts a bend or two, so it is not on the list.)
 */
const CORRIDORS = ["hairpins", "straight-to-turn", "chicane", "circuit"];

interface Circle {
  x: number;
  y: number;
  r: number;
}
const world = (name: string) => {
  const server = load(name);
  const rocks: Circle[] = server.world.passiveCollisionEntities.map((e) => ({
    x: e.position.x,
    y: e.position.y,
    r: e.radius,
  }));
  const points: Circle[] = server.raceController!.checkpoints.map((c) => ({
    x: c.position.x,
    y: c.position.y,
    r: c.radius,
  }));
  return { rocks, points };
};

/**
 * Flood fill of where a ship's centre can be (grid of 10 units, rocks grown by the ship radius),
 * from the start portal: which race points it reaches and whether it gets out to the edge of the
 * area (400 units beyond every rock and race point).
 */
function flood(rocks: Circle[], points: Circle[]) {
  const cell = 10;
  const margin = 400;
  const xs = [...rocks, ...points].map((c) => c.x);
  const ys = [...rocks, ...points].map((c) => c.y);
  const x0 = Math.min(...xs) - margin;
  const y0 = Math.min(...ys) - margin;
  const w = Math.ceil((Math.max(...xs) + margin - x0) / cell) + 1;
  const h = Math.ceil((Math.max(...ys) + margin - y0) / cell) + 1;
  const blocked = new Uint8Array(w * h);
  for (const { x, y, r } of rocks) {
    const grown = r + SHIP_RADIUS;
    const [i0, i1] = [Math.floor((x - grown - x0) / cell), Math.ceil((x + grown - x0) / cell)];
    const [j0, j1] = [Math.floor((y - grown - y0) / cell), Math.ceil((y + grown - y0) / cell)];
    for (let i = Math.max(0, i0); i <= Math.min(w - 1, i1); i++)
      for (let j = Math.max(0, j0); j <= Math.min(h - 1, j1); j++)
        if (Math.hypot(x0 + i * cell - x, y0 + j * cell - y) < grown) blocked[j * w + i] = 1;
  }
  const index = (p: Circle) => Math.round((p.y - y0) / cell) * w + Math.round((p.x - x0) / cell);
  const seen = new Uint8Array(w * h);
  const queue = [index(points[0]!)];
  seen[queue[0]!] = 1;
  let escapes = false;
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q]!;
    const i = c % w;
    const j = (c - i) / w;
    if (i === 0 || j === 0 || i === w - 1 || j === h - 1) escapes = true;
    for (const n of [i > 0 ? c - 1 : -1, i < w - 1 ? c + 1 : -1, j > 0 ? c - w : -1, j < h - 1 ? c + w : -1])
      if (n >= 0 && !blocked[n] && !seen[n]) {
        seen[n] = 1;
        queue.push(n);
      }
  }
  return { reached: points.map((p) => seen[index(p)] === 1), escapes };
}

/** Distance from (px, py) to the segment a–b. */
function segmentDistance(a: Circle, b: Circle, px: number, py: number): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(a.x + t * dx - px, a.y + t * dy - py);
}

describe("hand-made tracks", () => {
  it("the M7 tracks are registered after the M5 tracks", () => {
    expect(FILE_TRACKS).toEqual([
      "slalom",
      "gauntlet",
      "canyon",
      "hairpins",
      "straight-to-turn",
      "dense-belt",
      "chicane",
      "gate-row",
      "circuit",
      "pit-stop",
    ]);
  });

  it.each(FILE_TRACKS)("%s is the same world for every seed", (name) => {
    const layout = (s: GameServer) =>
      [...s.world.entities.values()].map((e) => [
        e.type,
        e.position.x,
        e.position.y,
        e.radius,
        e.orientation,
      ]);
    expect(layout(load(name, 2))).toEqual(layout(load(name, 1)));
    expect(layout(load(name, 7))).toEqual(layout(load(name, 1)));
  });

  it.each(FILE_TRACKS)("%s: a ship can reach every race point from the start", (name) => {
    const { rocks, points } = world(name);
    expect(flood(rocks, points).reached).toEqual(points.map(() => true));
  });

  it.each(CORRIDORS)("%s is a closed corridor: no gap between rocks lets a ship out", (name) => {
    const { rocks, points } = world(name);
    expect(flood(rocks, points).escapes).toBe(false);
  });

  it.each([...CORRIDORS, "gate-row"])(
    "%s: every leg is a clear line of sight, a ship's width from every rock",
    (name) => {
      const { rocks, points } = world(name);
      // A lap track also runs from the finish to the first checkpoint again.
      if (name === "circuit" && circuit.race.laps > 1) points.push(points[1]!);
      const blocked: string[] = [];
      for (let k = 1; k < points.length; k++)
        for (const rock of rocks)
          if (segmentDistance(points[k - 1]!, points[k]!, rock.x, rock.y) < rock.r + SHIP_RADIUS) {
            blocked.push(`leg ${k} by the rock at (${rock.x}, ${rock.y})`);
            break;
          }
      expect(blocked).toEqual([]);
    },
  );
});

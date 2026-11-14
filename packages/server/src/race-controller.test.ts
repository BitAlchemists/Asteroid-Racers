import { Checkpoint, CheckpointState, MessageType, Vector2 } from "@ar/shared";
import { describe, expect, it } from "vitest";
import { GameServer } from "./game-server";
import {
  crossesGate,
  describeRules,
  finishMessage,
  RACE_MESSAGE_SENDER,
  type RaceFinish,
  type RaceRules,
} from "./race-controller";
import { parseRaceModes, raceModesQuery, withRaceRules } from "./race-modes";
import { seededRandom } from "./random";
import { FakeClient } from "./test-support";
import { parseTrackFile, TRACK_FORMAT_V2, trackFromFile } from "./track-file";
import { trackByName, type Track } from "./tracks";

/**
 * A square, no rocks: portal (0, 0) facing up, checkpoint 1 at (0, −600), checkpoint 2 at
 * (600, −600), the finish at (600, 0). `race` adds v2 goal fields.
 */
function square(race: Record<string, unknown> = {}, checkpoint1: Record<string, unknown> = {}): Track {
  return trackFromFile(
    parseTrackFile({
      format: TRACK_FORMAT_V2,
      name: "square",
      description: "test square",
      race: {
        start: { x: 0, y: 0, heading: 0 },
        checkpoints: [
          { x: 0, y: -600, ...checkpoint1 },
          { x: 600, y: -600 },
        ],
        finish: { x: 600, y: 0 },
        ...race,
      },
    }),
  );
}

/** A server with `track` and one racer who has joined (on the portal, first tick). */
function racing(track: Track) {
  const server = new GameServer({ random: seededRandom(1) }).loadTrack(track);
  const race = server.raceController!;
  const client = new FakeClient(server);
  client.handshake("Racer");
  server.tick(); // spawns on the portal at (0, 0): joins
  expect(race.isClientInRace(client.proxy)).toBe(true);
  const finishes: RaceFinish[] = [];
  race.onFinish = (_, finish) => finishes.push(finish);
  /** Puts the ship at (x, y) with velocity (vx, vy) and runs one frame. */
  const at = (x: number, y: number, vx = 0, vy = 0) => {
    server.teleportPlayerTo(client.proxy, new Vector2(x, y), 0, new Vector2(vx, vy));
    server.tick();
  };
  const raceChat = () =>
    client
      .all(MessageType.CHAT)
      .filter((m) => m.from === RACE_MESSAGE_SENDER)
      .map((m) => m.text);
  const states = () => {
    const views = new Map<number, CheckpointState>();
    for (const e of client.entities()) if (e instanceof Checkpoint) views.set(e.id, e.state);
    return race.checkpoints.map((c) => views.get(c.id));
  };
  return { server, race, client, at, finishes, raceChat, states };
}

describe("race controller: default rules", () => {
  it("are unchanged: every message of two flights over demo and slalom (recorded before M7 S2)", () => {
    // The race's whole conversation with a racer flying both tracks twice (teleported through the
    // checkpoints, at speed) and then idling: the 64-bit FNV-1a of every envelope it received.
    // Recorded with the pre-S2 race controller (aae464e).
    const out: string[] = [];
    for (const name of ["demo", "slalom"]) {
      const server = new GameServer({ random: seededRandom(3) }).loadTrack(trackByName(name));
      const race = server.raceController!;
      const client = new FakeClient(server);
      client.handshake("T");
      server.teleportPlayerTo(client.proxy, race.start!.position, 0);
      server.tick();
      for (let lap = 0; lap < 2; lap++)
        for (let i = 1; i < race.checkpoints.length; i++) {
          const c = race.checkpoints[i]!.position;
          server.teleportPlayerTo(client.proxy, c.plus(new Vector2(30, 0)), 0, new Vector2(400, 0));
          server.tick();
          server.tick();
        }
      for (let i = 0; i < 100; i++) server.tick();
      out.push(
        JSON.stringify(client.received, (_, v: unknown) => (typeof v === "bigint" ? v.toString() : v)),
      );
    }
    let h = 0xcbf29ce484222325n;
    const text = out.join("|");
    for (let i = 0; i < text.length; i++)
      h = ((h ^ BigInt(text.charCodeAt(i))) * 0x100000001b3n) & 0xffffffffffffffffn;
    expect([h.toString(16), text.length]).toEqual(["3a4f82a4582b27c8", 421177]);
  });

  it("have no goals, one lap and a course of the checkpoints; no race chat", () => {
    const { race, at, raceChat, finishes } = racing(square());
    expect(race.rules).toEqual({});
    expect(race.hasGoals).toBe(false);
    expect(race.courseLength).toBe(race.checkpoints.length);
    at(0, -600);
    at(600, -600);
    at(600, 0, 500, 0); // fast through the finish: counts
    expect(finishes).toHaveLength(1);
    expect(raceChat()).toEqual([]);
  });
});

describe("race controller: goal types", () => {
  it("stop at the finish: too fast doesn't count (one warning), slow enough does", () => {
    const { race, client, at, raceChat, finishes } = racing(
      square({ finish: { x: 600, y: 0, maxSpeed: 100 } }),
    );
    expect(race.rules).toEqual({ finishMaxSpeed: 100 });
    expect(raceChat()).toEqual(["Race rules: stop at the finish (speed ≤ 100)."]);
    at(0, -600, 300, 0); // intermediate checkpoints count at any speed
    at(600, -600, 300, 0);
    expect(race.progressOf(client.proxy)).toBe(2);
    at(600, 0, 300, 0);
    at(600, 0, 250, 0);
    expect(finishes).toHaveLength(0);
    expect(race.progressOf(client.proxy)).toBe(2);
    expect(raceChat().filter((t) => t.startsWith("Too fast"))).toEqual([
      "Too fast for the finish (300 > 100): stop inside it.",
    ]);
    at(600, 0, 80, 0);
    expect(finishes).toHaveLength(1);
    expect(race.progressOf(client.proxy)).toBe(0); // restarted
  });

  it("directional gates: only crossing the line forwards counts", () => {
    const { race, client, at, raceChat } = racing(square({}, { heading: 0, width: 200 }));
    expect(race.gateWidth(1)).toBe(200);
    expect(race.checkpoints[1]!.radius).toBe(100); // width / 2
    expect(race.gateCount).toBe(1);

    at(0, -900); // a jump from the portal: no crossing
    at(0, -700);
    at(0, -500); // backwards across the line
    expect(race.progressOf(client.proxy)).toBe(0);
    expect(raceChat()).toContain("Wrong way through the gate: cross it along the arrow.");
    at(0, -550);
    at(0, -590); // inside the circle, not across the line
    expect(race.progressOf(client.proxy)).toBe(0);
    at(150, -500);
    at(150, -700); // forwards, but outside the width
    expect(race.progressOf(client.proxy)).toBe(0);
    at(0, -500); // (backwards again)
    at(0, -700); // forwards through the gate
    expect(race.progressOf(client.proxy)).toBe(1);
  });

  it("a teleport (respawn) across a gate doesn't count", () => {
    const { race, client, at } = racing(square({}, { heading: 0, width: 200 }));
    at(0, -200);
    at(0, -900); // a 700-unit jump in one frame
    expect(race.progressOf(client.proxy)).toBe(0);
  });

  it("laps: the checkpoints and the finish repeat; progress counts over all laps", () => {
    const { race, client, at, raceChat, finishes, states } = racing(square({ laps: 2 }));
    expect(race.courseLength).toBe(1 + 3 * 2);
    expect(race.checkpointIndexAt(4)).toBe(1);
    at(0, -600);
    at(600, -600);
    at(600, 0); // end of lap 1
    expect(finishes).toHaveLength(0);
    expect(race.progressOf(client.proxy)).toBe(3);
    expect(raceChat()).toContain("Lap 2 of 2.");
    expect(states().slice(1)).toEqual([
      CheckpointState.CURRENT,
      CheckpointState.FUTURE,
      CheckpointState.FUTURE,
    ]);
    expect(race.nextCheckpointOf(client.proxy)).toBe(race.checkpoints[1]);
    at(600, -600); // out of order: nothing
    expect(race.progressOf(client.proxy)).toBe(3);
    at(0, -600);
    at(600, -600);
    expect(race.progressOf(client.proxy)).toBe(5);
    at(600, 0);
    expect(finishes).toEqual([expect.objectContaining({ laps: 2 })]);
  });

  it("laps: a crash mid-lap respawns at the last checkpoint cleared", () => {
    const { race, client, at } = racing(square({ laps: 2 }));
    at(0, -600);
    at(600, -600);
    at(600, 0);
    at(0, -600); // lap 2, checkpoint 1: position 4
    expect(race.spawnEntityForPlayer(client.proxy)).toBe(race.checkpoints[1]);
  });

  it("stop at the finish applies only at the end of the last lap", () => {
    const { client, race, at, finishes } = racing(
      square({ laps: 2, finish: { x: 600, y: 0, maxSpeed: 50 } }),
    );
    at(0, -600);
    at(600, -600);
    at(600, 0, 400, 0); // the lap line: speed doesn't matter
    expect(race.progressOf(client.proxy)).toBe(3);
    at(0, -600);
    at(600, -600);
    at(600, 0, 400, 0);
    expect(finishes).toHaveLength(0);
    at(600, 0);
    expect(finishes).toHaveLength(1);
  });

  it("time trials: the finish reports the race time and par", () => {
    const { server, at, finishes, raceChat } = racing(square({ par: 0.05 }));
    at(0, -600);
    at(600, -600);
    at(600, 0);
    // Joined in frame 1, finished in frame 4: three frames of race time.
    expect(finishes).toHaveLength(1);
    expect(finishes[0]!.time).toBeCloseTo(3 * server.tickSeconds, 12);
    expect(finishes[0]!.par).toBe(0.05);
    expect(raceChat()).toContain(finishMessage(finishes[0]!));
    expect(finishMessage({ time: 42.346, par: 40, laps: 1 })).toBe(
      "Finished in 42.35 s (par 40.0 s, +2.35 s).",
    );
    expect(finishMessage({ time: 39, par: 40, laps: 1 })).toBe("Finished in 39.00 s (par 40.0 s, −1.00 s).");
    expect(finishMessage({ time: 39, laps: 1 })).toBe("Finished in 39.00 s.");
  });

  it("rejects bad rules", () => {
    const { race } = racing(square());
    expect(() => race.setRules({ laps: 0 })).toThrow(/laps/);
    expect(() => race.setRules({ laps: 1.5 })).toThrow(/laps/);
    expect(() => race.setRules({ finishMaxSpeed: 0 })).toThrow(/finishMaxSpeed/);
    expect(() => race.setRules({ par: -1 })).toThrow(/par/);
  });

  it("crossesGate: direction, width and the line itself", () => {
    const c = new Vector2(0, 0);
    const up = Math.PI; // travel direction (0, −1)
    const v = (x: number, y: number) => new Vector2(x, y);
    expect(crossesGate(v(0, 10), v(0, -10), c, up, 100)).toBe(1);
    expect(crossesGate(v(0, -10), v(0, 10), c, up, 100)).toBe(-1);
    expect(crossesGate(v(0, 10), v(0, 0), c, up, 100)).toBe(1); // reaching the line counts
    expect(crossesGate(v(0, 0), v(0, -10), c, up, 100)).toBe(0); // already counted
    expect(crossesGate(v(0, 20), v(0, 10), c, up, 100)).toBe(0);
    expect(crossesGate(v(49, 10), v(49, -10), c, up, 100)).toBe(1);
    expect(crossesGate(v(51, 10), v(51, -10), c, up, 100)).toBe(0);
    // Diagonal move: the crossing point counts, not the end points.
    expect(crossesGate(v(-80, 10), v(80, -10), c, up, 100)).toBe(1);
    // Facing right (3π/2): travel (1, 0).
    expect(crossesGate(v(-5, 0), v(5, 0), c, 1.5 * Math.PI, 10)).toBe(1);
  });
});

describe("race modes (game)", () => {
  /** A query string as the page's URLSearchParams would read it (keys without "=" have value ""). */
  const params = (query: string) => {
    const map = new Map<string, string>();
    for (const part of query.split("&").filter(Boolean)) {
      const [key, ...value] = part.split("=");
      map.set(key!, decodeURIComponent(value.join("=")));
    }
    return { get: (name: string) => map.get(name) ?? null };
  };

  it("parse from the URL and back; absent = no overrides", () => {
    expect(parseRaceModes(params(""))).toEqual({});
    const rules: RaceRules = { laps: 3, finishMaxSpeed: 120, gates: true, par: 45, timeTrial: true };
    expect(raceModesQuery(rules)).toBe("laps=3&stop=120&gates&par=45&timetrial");
    expect(parseRaceModes(params(raceModesQuery(rules)))).toEqual(rules);
    expect(() => parseRaceModes(params("laps=0"))).toThrow(/laps/);
    expect(() => parseRaceModes(params("stop=fast"))).toThrow(/stop/);
    expect(() => parseRaceModes(params("par="))).toThrow(/par/);
  });

  it("withRaceRules overrides a track's rules and draws arrows on new gates; no overrides = the track", () => {
    const demo = trackByName("demo");
    expect(withRaceRules(demo, {})).toBe(demo);
    const plain = new GameServer({ random: seededRandom(1) }).loadTrack(demo);
    const server = new GameServer({ random: seededRandom(1) }).loadTrack(
      withRaceRules(demo, { gates: true, laps: 2 }),
    );
    const race = server.raceController!;
    expect(race.rules).toEqual({ gates: true, laps: 2 });
    const inner = race.checkpoints.length - 2;
    expect(race.gateCount).toBe(inner);
    expect(race.gateWidth(0)).toBeUndefined(); // portal and finish stay plain
    expect(race.gateWidth(race.checkpoints.length - 1)).toBeUndefined();
    expect(server.world.entities.size).toBe(plain.world.entities.size + inner);
    expect(describeRules(race.rules, race.gateCount)).toBe(
      `2 laps · ${inner} directional gates (cross along the arrow)`,
    );
  });

  it("a v2 file's goal fields become the race's rules; overrides win", () => {
    const track = square({ laps: 3, par: 60, finish: { x: 600, y: 0, maxSpeed: 90 } }, { width: 240 });
    const server = new GameServer({ random: seededRandom(1) }).loadTrack(withRaceRules(track, { laps: 1 }));
    const race = server.raceController!;
    expect(race.rules).toEqual({ laps: 1, par: 60, finishMaxSpeed: 90 });
    expect(race.gateWidth(1)).toBe(240);
    // The file's gate arrow, and no second one from the override.
    expect([...server.world.entities.values()].filter((e) => e.type === 5 /* ARROWS */)).toHaveLength(1);
  });
});

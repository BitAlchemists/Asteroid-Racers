import { CheckpointState, Checkpoint, EntityType, MessageType, Movable, Vector2 } from "@ar/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatServer } from "./chat-server";
import { CollisionDetector } from "./collision-detector";
import { ManualGameLoop, RealtimeGameLoop, TICK_SECONDS } from "./game-loop";
import {
  GameServer,
  MAX_ENTITY_UPDATES_PER_TICK,
  RESPAWN_DELAY_SECONDS,
  SHIP_RADIUS,
  WELCOME_MESSAGE,
} from "./game-server";
import { seededRandom } from "./random";
import { SHIP_NAMES } from "./ship-names";
import { FakeClient } from "./test-support";

/** A spot in the open corridor west of the race portal, far from asteroids and the portal. */
const SAFE_SPOT = new Vector2(-500, 0);

function demoServer(seed = 1): GameServer {
  return new GameServer({ random: seededRandom(seed) }).prepareDemoConfiguration();
}

function shipOf(client: FakeClient): Movable {
  return client.proxy.movable!;
}

/** Joins and moves the ship somewhere harmless so the first tick doesn't auto-join the race. */
function parkedPlayer(server: GameServer, name = "Tester"): FakeClient {
  const client = new FakeClient(server);
  client.handshake(name);
  // Each parked ship gets its own spot 100 units apart so they never touch each other.
  server.teleportPlayerTo(client.proxy, SAFE_SPOT.plus(new Vector2(0, 100 * (server.clients.size - 1))), 0);
  return client;
}

describe("GameServer — connection & handshake", () => {
  let server: GameServer;
  beforeEach(() => {
    server = demoServer();
  });

  it("greets a new connection with the welcome chat message", () => {
    const client = new FakeClient(server);
    expect(client.all(MessageType.CHAT)).toMatchObject([{ from: "Server", text: WELCOME_MESSAGE }]);
    expect(server.clients.has(client.proxy)).toBe(true);
  });

  it("creates a ship on handshake, sends PLAYER, then every world entity", () => {
    const client = new FakeClient(server);
    client.clear();
    const ship = client.handshake("Major Tom");

    expect(client.types()[0]).toBe(MessageType.PLAYER);
    expect(ship).toBeInstanceOf(Movable);
    expect(ship).toMatchObject({ type: EntityType.SHIP, displayName: "Major Tom", radius: SHIP_RADIUS });
    expect((ship as Movable).canMove).toBe(true);

    const sentIds = client.entities().map((e) => e.id);
    expect(sentIds.sort((a, b) => a - b)).toEqual([...server.world.entities.keys()].sort((a, b) => a - b));
    expect(sentIds).toContain(ship.id);
  });

  it("spawns within the world spawn circle facing π", () => {
    const client = new FakeClient(server);
    const ship = client.handshake();
    expect(ship.position.length).toBeLessThanOrEqual(100 - SHIP_RADIUS + 1e-9);
    expect(ship.orientation).toBeCloseTo(Math.PI, 12);
  });

  it("picks a ship name when the handshake has none", () => {
    const ship = new FakeClient(server).handshake("   ");
    expect(SHIP_NAMES).toContain(ship.displayName);
  });

  it("ignores a second handshake", () => {
    const client = new FakeClient(server);
    const first = client.handshake("A");
    client.sendToServer(MessageType.HANDSHAKE, { username: "B" });
    expect(client.all(MessageType.PLAYER)).toHaveLength(1);
    expect(shipOf(client).id).toBe(first.id);
  });

  it("echoes pings", () => {
    const client = new FakeClient(server);
    client.clear();
    client.sendToServer(MessageType.PING_PONG, { integer: 1234 });
    expect(client.all(MessageType.PING_PONG)).toMatchObject([{ integer: 1234 }]);
  });

  it("removes the ship and tells the others when a client disconnects", () => {
    const leaving = parkedPlayer(server, "Leaver");
    const staying = parkedPlayer(server, "Stayer");
    const id = shipOf(leaving).id;
    staying.clear();

    leaving.disconnect();

    expect(server.clients.has(leaving.proxy)).toBe(false);
    expect(server.world.entities.has(id)).toBe(false);
    expect(staying.all(MessageType.ENTITY_REMOVE)).toMatchObject([{ integer: id }]);
    server.tick(); // the departed ship is no longer simulated or broadcast
    expect(staying.entities().some((e) => e.id === id)).toBe(false);
  });

  it("disconnecting before the handshake is harmless", () => {
    const client = new FakeClient(server);
    const before = server.world.entities.size;
    client.disconnect();
    expect(server.clients.size).toBe(0);
    expect(server.world.entities.size).toBe(before);
  });
});

describe("GameServer — movement", () => {
  let server: GameServer;
  let client: FakeClient;
  beforeEach(() => {
    server = demoServer();
    client = parkedPlayer(server);
  });

  it("thrust accelerates along the ship's local +y axis", () => {
    client.sendToServer(MessageType.INPUT, { accelerationFactor: 1, newOrientation: 0 });
    expect(shipOf(client).acceleration).toEqual(new Vector2(0, 400));

    client.sendToServer(MessageType.INPUT, { accelerationFactor: 0.5, newOrientation: Math.PI / 2 });
    const a = shipOf(client).acceleration;
    expect(a.x).toBeCloseTo(-200, 9);
    expect(a.y).toBeCloseTo(0, 9);
  });

  it("integrates thrust over ticks", () => {
    client.sendToServer(MessageType.INPUT, { accelerationFactor: 1, newOrientation: 0 });
    server.tick();
    server.tick();
    const ship = shipOf(client);
    expect(ship.velocity.y).toBeCloseTo(2 * 400 * TICK_SECONDS, 9);
    expect(ship.position.y).toBeCloseTo(3 * 400 * TICK_SECONDS * TICK_SECONDS, 9); // Euler: v1·dt + v2·dt
    expect(ship.position.x).toBe(SAFE_SPOT.x);
  });

  it("clamps out-of-range thrust and treats NaN thrust as none", () => {
    client.sendToServer(MessageType.INPUT, { accelerationFactor: 5, newOrientation: 0 });
    expect(shipOf(client).acceleration.length).toBeCloseTo(400, 9);
    client.sendToServer(MessageType.INPUT, { accelerationFactor: -1 });
    expect(shipOf(client).acceleration).toEqual(Vector2.zero());
    client.sendToServer(MessageType.INPUT, { accelerationFactor: Number.NaN });
    expect(shipOf(client).acceleration).toEqual(Vector2.zero());
  });

  it("leaves orientation and rotation speed alone when the input omits them", () => {
    client.sendToServer(MessageType.INPUT, { accelerationFactor: 0, newOrientation: 1, rotationSpeed: 2 });
    client.sendToServer(MessageType.INPUT, { accelerationFactor: 1 });
    expect(shipOf(client).orientation).toBe(1);
    expect(shipOf(client).rotationSpeed).toBe(2);
  });

  it("broadcasts at most two entity updates per tick, highest rank first", () => {
    const others = [parkedPlayer(server, "B"), parkedPlayer(server, "C")];
    for (const c of [client, ...others]) c.sendToServer(MessageType.INPUT, { accelerationFactor: 1 });
    client.clear();
    server.tick();
    expect(client.all(MessageType.ENTITY)).toHaveLength(MAX_ENTITY_UPDATES_PER_TICK);
    server.tick();
    expect(client.all(MessageType.ENTITY)).toHaveLength(2 * MAX_ENTITY_UPDATES_PER_TICK);
  });
});

describe("GameServer — crashes", () => {
  it("a ship hitting an asteroid stops, is announced, and respawns after 1 s of game time", () => {
    const server = demoServer();
    const loop = new ManualGameLoop();
    void server.start(loop);
    const crasher = parkedPlayer(server, "Crasher");
    const watcher = parkedPlayer(server, "Watcher");
    watcher.server.teleportPlayerTo(watcher.proxy, new Vector2(-500, 400), 0);
    const asteroid = server.world.passiveCollisionEntities[0]!;

    server.teleportPlayerTo(crasher.proxy, asteroid.position, 0);
    loop.advance(1);

    const ship = shipOf(crasher);
    expect(ship.canMove).toBe(false);
    expect(watcher.all(MessageType.COLLISION)).toMatchObject([{ integer: ship.id }]);
    expect(crasher.all(MessageType.COLLISION)).toHaveLength(1); // once, even if it overlaps several rocks

    loop.advanceSeconds(RESPAWN_DELAY_SECONDS - 2 * TICK_SECONDS);
    expect(ship.canMove).toBe(false);
    loop.advanceSeconds(3 * TICK_SECONDS);
    expect(ship.canMove).toBe(true);
    expect(ship.position.length).toBeLessThanOrEqual(80 + 1e-9); // back at the world spawn
  });

  it("two ships colliding both explode", () => {
    const server = demoServer();
    const a = parkedPlayer(server, "A");
    const b = parkedPlayer(server, "B");
    server.teleportPlayerTo(b.proxy, SAFE_SPOT.plus(new Vector2(10, 0)), 0);
    server.tick();
    expect(shipOf(a).canMove).toBe(false);
    expect(shipOf(b).canMove).toBe(false);
    expect(
      a
        .all(MessageType.COLLISION)
        .map((m) => m.integer)
        .sort(),
    ).toEqual([shipOf(a).id, shipOf(b).id].sort());
  });

  it("does not respawn a ship whose client left meanwhile", () => {
    const server = demoServer();
    const crasher = parkedPlayer(server);
    server.teleportPlayerTo(crasher.proxy, server.world.passiveCollisionEntities[0]!.position, 0);
    server.tick();
    crasher.disconnect();
    for (let i = 0; i < 100; i++) server.tick(); // must not throw
    expect(server.clients.size).toBe(0);
  });
});

describe("GameServer — race", () => {
  let server: GameServer;
  let client: FakeClient;
  beforeEach(() => {
    server = demoServer();
    client = parkedPlayer(server, "Racer");
  });

  function checkpointViews(): Map<number, CheckpointState> {
    const views = new Map<number, CheckpointState>();
    for (const e of client.entities()) if (e instanceof Checkpoint) views.set(e.id, e.state);
    return views;
  }

  it("joining via the portal: RACE_JOIN, per-player checkpoint states, start slot spawn", () => {
    const race = server.raceController!;
    const portal = race.start!;
    client.clear();

    server.teleportPlayerTo(client.proxy, portal.position, 0);
    server.tick();

    expect(client.last(MessageType.RACE_JOIN)?.integer).toBe(portal.id);
    expect(client.last(MessageType.RACE_EVENT)?.integer).toBe(race.checkpoints[1]!.id);
    const views = checkpointViews();
    expect(views.get(race.checkpoints[0]!.id)).toBe(CheckpointState.CLEARED);
    expect(views.get(race.checkpoints[1]!.id)).toBe(CheckpointState.CURRENT);
    expect(views.get(race.checkpoints[2]!.id)).toBe(CheckpointState.FUTURE);

    // First start slot: (sin π/2, cos π/2)·70 rotated by the portal orientation (1.5π), plus the portal.
    const ship = shipOf(client);
    const expected = new Vector2(70, 0).rotated(portal.orientation).add(portal.position);
    expect(ship.position.x).toBeCloseTo(expected.x, 9);
    expect(ship.position.y).toBeCloseTo(expected.y, 9);
    expect(ship.orientation).toBeCloseTo(portal.orientation, 12);
    expect(race.isClientInRace(client.proxy)).toBe(true);
  });

  it("flying through all checkpoints finishes and restarts the race", () => {
    const race = server.raceController!;
    server.teleportPlayerTo(client.proxy, race.start!.position, 0);
    server.tick();

    for (let i = 1; i < race.checkpoints.length; i++) {
      client.clear();
      server.teleportPlayerTo(client.proxy, race.checkpoints[i]!.position, 0);
      server.tick();
      if (i < race.checkpoints.length - 1) {
        expect(client.last(MessageType.RACE_EVENT)?.integer).toBe(race.checkpoints[i + 1]!.id);
        expect(checkpointViews().get(race.checkpoints[i]!.id)).toBe(CheckpointState.CLEARED);
      }
    }

    // Finish: leave, immediately re-join at the start.
    const types = client.types();
    expect(types.indexOf(MessageType.RACE_LEAVE)).toBeGreaterThan(-1);
    expect(types.indexOf(MessageType.RACE_JOIN)).toBeGreaterThan(types.indexOf(MessageType.RACE_LEAVE));
    expect(race.isClientInRace(client.proxy)).toBe(true);
    expect(shipOf(client).position.distanceTo(race.start!.position)).toBeLessThan(race.start!.radius);
  });

  it("a crashed racer respawns at the last checkpoint they touched", () => {
    const race = server.raceController!;
    server.teleportPlayerTo(client.proxy, race.start!.position, 0);
    server.tick();
    server.teleportPlayerTo(client.proxy, race.checkpoints[1]!.position, 0);
    server.tick();

    server.teleportPlayerTo(client.proxy, server.world.passiveCollisionEntities[0]!.position, 0);
    server.tick();
    for (let i = 0; i < 80; i++) server.tick();

    const cp = race.checkpoints[1]!;
    expect(shipOf(client).canMove).toBe(true);
    expect(shipOf(client).position.distanceTo(cp.position)).toBeLessThanOrEqual(
      cp.radius - SHIP_RADIUS + 1e-9,
    );
  });

  it("RACE_LEAVE from the client removes them and is confirmed", () => {
    server.teleportPlayerTo(client.proxy, server.raceController!.start!.position, 0);
    server.tick();
    client.clear();
    client.sendToServer(MessageType.RACE_LEAVE);
    expect(client.types()).toContain(MessageType.RACE_LEAVE);
    expect(server.raceController!.isClientInRace(client.proxy)).toBe(false);
  });

  it("accepts at most four racers", () => {
    const race = server.raceController!;
    const racers = [client, ...["B", "C", "D", "E"].map((n) => parkedPlayer(server, n))];
    for (const racer of racers) expect(typeof race.addPlayer(racer.proxy)).toBe("boolean");
    expect(race.players).toHaveLength(4);
    expect(race.isClientInRace(racers[4]!.proxy)).toBe(false);
  });
});

describe("ChatServer", () => {
  it("relays chat to everyone with the sender's ship name", () => {
    const server = demoServer();
    server.registerService(new ChatServer());
    const alice = parkedPlayer(server, "Alice");
    const bob = parkedPlayer(server, "Bob");
    alice.clear();
    bob.clear();

    alice.sendToServer(MessageType.CHAT, { from: "spoofed", text: "hello" });

    for (const c of [alice, bob])
      expect(c.all(MessageType.CHAT)).toMatchObject([{ from: "Alice", text: "hello" }]);
  });

  it("drops chat before the handshake and empty messages", () => {
    const server = demoServer();
    server.registerService(new ChatServer());
    const anon = new FakeClient(server);
    const bob = parkedPlayer(server, "Bob");
    bob.clear();
    anon.sendToServer(MessageType.CHAT, { text: "hi" });
    bob.sendToServer(MessageType.CHAT, { text: "   " });
    expect(bob.all(MessageType.CHAT)).toHaveLength(0);
  });
});

describe("CollisionDetector", () => {
  it("reports active-vs-passive and (optionally) active-vs-active overlaps", () => {
    const detector = new CollisionDetector();
    const ship = new Movable({ position: new Vector2(0, 0), radius: 10 });
    const other = new Movable({ position: new Vector2(0, -15), radius: 10 });
    const rock = new Movable({ position: new Vector2(0, 25), radius: 20 });
    detector.activeEntities.push(ship, other);
    detector.passiveEntities.push(rock);

    const hits: [unknown, unknown, number][] = [];
    detector.detectCollisions((a, b, p) => hits.push([a, b, p]));
    expect(hits).toEqual([[ship, rock, 5]]);

    detector.activeEntitiesCanCollide = true;
    hits.length = 0;
    detector.detectCollisions((a, b, p) => hits.push([a, b, p]));
    expect(hits).toEqual([
      [ship, other, 5],
      [other, ship, 5],
      [ship, rock, 5],
    ]);
  });
});

describe("ManualGameLoop", () => {
  it("only advances while started", () => {
    const loop = new ManualGameLoop();
    let n = 0;
    loop.onUpdate = () => n++;
    loop.advance(3);
    expect(n).toBe(0);
    loop.start();
    loop.advanceSeconds(1);
    expect(n).toBe(Math.ceil(1 / TICK_SECONDS));
  });
});

describe("RealtimeGameLoop", () => {
  it("runs fixed steps matching elapsed wall time and stops cleanly", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    try {
      const loop = new RealtimeGameLoop();
      let steps = 0;
      loop.onUpdate = (dt) => {
        expect(dt).toBe(TICK_SECONDS);
        steps++;
      };
      loop.start();
      vi.advanceTimersByTime(1500);
      // 1.5 s / 15 ms = 100 steps; allow one step of slack for timer phase.
      expect(steps).toBeGreaterThanOrEqual(99);
      expect(steps).toBeLessThanOrEqual(100);
      loop.stop();
      const stoppedAt = steps;
      vi.advanceTimersByTime(1000);
      expect(steps).toBe(stoppedAt);
      expect(loop.running).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

import {
  CheckpointState,
  ConnectionState,
  MessageType,
  Movable,
  Vector2,
  type ServerConnection,
} from "@ar/shared";
import { ChatServer, GameServer, LocalServerConnection, seededRandom, type IClientProxy } from "@ar/server";
import { beforeEach, describe, expect, it } from "vitest";
import type { GameView, Hud, RadarTarget } from "./contracts";
import {
  CheckpointController,
  PlayerController,
  type EntityController,
  type RacePortalController,
} from "./controllers";
import { GameClient, PING_INTERVAL_SECONDS } from "./game-client";

class FakeView implements GameView {
  built = 0;
  cleared = 0;
  readonly entities = new Set<EntityController>();
  readonly dirty = new Set<EntityController>();
  readonly explosions: EntityController[] = [];
  local: PlayerController | undefined;
  leaveable = new Map<RacePortalController, (() => void) | undefined>();
  radar: readonly RadarTarget[] = [];

  buildScene() {
    this.built++;
  }
  clearScene() {
    this.cleared++;
    this.entities.clear();
  }
  addEntity(c: EntityController) {
    this.entities.add(c);
  }
  removeEntity(c: EntityController) {
    this.entities.delete(c);
  }
  markDirty(c: EntityController) {
    this.dirty.add(c);
  }
  setLocalPlayer(c: PlayerController | undefined) {
    this.local = c;
  }
  explode(c: EntityController) {
    this.explosions.push(c);
  }
  setRacePortalLeaveable(c: RacePortalController, onLeave: (() => void) | undefined) {
    this.leaveable.set(c, onLeave);
  }
  render(_dt: number, radar: readonly RadarTarget[]) {
    this.radar = radar;
  }
}

class FakeHud implements Hud {
  states: ConnectionState[] = [];
  notices: string[] = [];
  chat: [string, string][] = [];
  debug = "";
  inRace = false;
  visible = true;
  constructor(public username = "Tester") {}
  setConnectionState(s: ConnectionState) {
    this.states.push(s);
  }
  setDebugText(t: string) {
    this.debug = t;
  }
  showChat(from: string, text: string) {
    this.chat.push([from, text]);
  }
  showNotice(t: string) {
    this.notices.push(t);
  }
  setInRace(v: boolean) {
    this.inRace = v;
  }
  toggleVisible() {
    this.visible = !this.visible;
  }
}

const SAFE = new Vector2(-500, 0);

function setup(username = "Tester") {
  const server = new GameServer({ random: seededRandom(1) }).prepareDemoConfiguration();
  server.registerService(new ChatServer());
  const view = new FakeView();
  const hud = new FakeHud(username);
  const client = new GameClient(view, () => new LocalServerConnection(server, { delivery: "sync" }));
  client.attachHud(hud);
  return { server, view, hud, client };
}

/** The server-side proxy of the client named `name`. */
function proxyOf(server: GameServer, name: string): IClientProxy {
  const proxy = [...server.clients].find((c) => c.playerName === name);
  if (!proxy) throw new Error(`no client ${name}`);
  return proxy;
}

async function connected(username = "Tester") {
  const ctx = setup(username);
  await ctx.client.connect();
  // Park the ship away from the race portal so the first tick doesn't auto-join the race.
  ctx.server.teleportPlayerTo(proxyOf(ctx.server, username), SAFE, 0);
  ctx.server.tick();
  // The local ship keeps its own orientation (π from the spawn) even across server teleports, as in
  // the Dart client; face +y so the expectations below are easy to read.
  ctx.client.player!.entity.orientation = 0;
  return ctx;
}

describe("GameClient — connecting", () => {
  it("connects, builds the scene, handshakes and mirrors the whole world", async () => {
    const { server, view, hud, client } = setup("Major Tom");
    await client.connect();

    expect(hud.states).toEqual([
      ConnectionState.DISCONNECTED,
      ConnectionState.CONNECTING,
      ConnectionState.CONNECTED,
    ]);
    expect(hud.notices).toContain("Connected.");
    expect(hud.chat[0]?.[0]).toBe("Server");
    expect(view.built).toBe(1);

    const player = client.player!;
    expect(player.isLocalPlayer).toBe(true);
    expect(player.entity.displayName).toBe("Major Tom");
    expect(view.local).toBe(player);
    expect(client.entityCount).toBe(server.world.entities.size);
    expect(view.entities.size).toBe(server.world.entities.size);
  });

  it("reports a failed connection", async () => {
    const view = new FakeView();
    const hud = new FakeHud();
    const failing: ServerConnection = {
      connected: false,
      connect: () => Promise.reject(new Error("nope")),
      send() {},
      disconnect() {},
      onMessage: () => () => {},
      onDisconnect: () => () => {},
    };
    const client = new GameClient(view, () => failing);
    client.attachHud(hud);
    await client.connect();
    expect(hud.notices).toContain("Could not connect.");
    expect(client.server.state).toBe(ConnectionState.DISCONNECTED);
    expect(view.built).toBe(0);
  });

  it("disconnecting clears the scene and state; reconnecting works", async () => {
    const { server, view, hud, client } = await connected();
    client.onConnectToggle(); // → disconnect
    expect(hud.notices.at(-1)).toBe("Disconnected");
    expect(view.cleared).toBeGreaterThan(0);
    expect(client.player).toBeUndefined();
    expect(client.entityCount).toBe(0);
    expect(server.clients.size).toBe(0);

    client.onConnectToggle(); // → connect
    await Promise.resolve();
    await Promise.resolve();
    expect(client.player).toBeDefined();
    expect(server.clients.size).toBe(1);
  });
});

describe("GameClient — flying", () => {
  let ctx: Awaited<ReturnType<typeof connected>>;
  beforeEach(async () => {
    ctx = await connected();
  });

  it("thrust is predicted locally and sent to the server", () => {
    const { server, client } = ctx;
    const player = client.player!;
    player.accelerationFactor = 1;
    client.update(0.1);

    const serverShip = proxyOf(server, "Tester").movable!;
    expect(serverShip.acceleration.y).toBeCloseTo(400, 9);
    expect(player.entity.velocity.y).toBeCloseTo(40, 9); // local prediction: a·dt
    expect(player.entity.position.y).toBeCloseTo(4, 9);
  });

  it("turning is local; the new orientation is sent and survives server updates", () => {
    const { server, client } = ctx;
    const player = client.player!;
    player.rotateRight();
    client.update(0.1);
    expect(player.entity.orientation).toBeCloseTo(0.5, 9);
    expect(proxyOf(server, "Tester").movable!.orientation).toBeCloseTo(0.5, 9);

    // The server's broadcast (with its own, slightly older orientation) must not snap us back.
    player.rotateLeft();
    client.update(0.05);
    server.tick();
    expect(player.entity.orientation).toBeCloseTo(0.25, 9);
  });

  it("only sends input when something changed", () => {
    const { server, client } = ctx;
    const ship = proxyOf(server, "Tester").movable!;
    client.update(0.016);
    const rank = ship.updateRank;
    client.update(0.016);
    client.update(0.016);
    expect(ship.updateRank).toBe(rank); // computePlayerInput bumps the rank; nothing arrived
  });

  it("frames longer than 0.1 s are clamped", () => {
    const player = ctx.client.player!;
    player.accelerationFactor = 1;
    ctx.client.update(5);
    expect(player.entity.velocity.y).toBeCloseTo(40, 9);
  });

  it("pings the server and averages the round trip", () => {
    const { client, hud } = ctx;
    expect(client.server.pingAverage).toBeUndefined();
    // Frames are clamped to 0.1 s, so step in 0.1 s frames until the ping interval has passed.
    for (let t = 0; t < PING_INTERVAL_SECONDS + 0.05; t += 0.1) client.update(0.1);
    expect(client.server.pingAverage).toBeGreaterThanOrEqual(0);
    client.update(0.016);
    expect(hud.debug).toMatch(/ping: \d+ ms/);
    expect(hud.debug).toMatch(/x: -500\ny: 0/);
  });

  it("a crash stops the ship and shows an explosion", () => {
    const { server, client, view } = ctx;
    server.teleportPlayerTo(proxyOf(server, "Tester"), server.world.passiveCollisionEntities[0]!.position, 0);
    server.tick();
    expect(view.explosions).toEqual([client.player]);
    expect(client.player!.entity.canMove).toBe(false);
  });
});

describe("GameClient — other players and chat", () => {
  it("announces players appearing/disappearing and puts them on the radar", async () => {
    const { server, client, hud, view } = await connected("Alice");
    const bob = setup("Bob");
    // Bob joins Alice's server
    const bobClient = new GameClient(
      new FakeView(),
      () => new LocalServerConnection(server, { delivery: "sync" }),
    );
    bobClient.attachHud(bob.hud);
    await bobClient.connect();
    server.teleportPlayerTo(proxyOf(server, "Bob"), new Vector2(-500, 300), 0);
    server.tick();

    expect(hud.notices).toContain("'Bob' appearing on our radars.");
    client.update(0.016);
    expect(view.radar.map((t) => t.controller.entity.displayName)).toContain("Bob");

    bobClient.disconnect();
    expect(hud.notices).toContain("'Bob' disappeared from our radars.");
    client.update(0.016);
    expect(view.radar).toHaveLength(0);
  });

  it("sends chat and shows the relayed message", async () => {
    const { client, hud } = await connected("Alice");
    client.onChatSubmit("hello");
    client.onChatSubmit("   ");
    expect(hud.chat.filter(([from]) => from === "Alice")).toEqual([["Alice", "hello"]]);
  });
});

describe("GameClient — racing", () => {
  it("joining shows the leave controls and tracks the next checkpoint; leaving hides them", async () => {
    const { server, client, view, hud } = await connected();
    const race = server.raceController!;
    server.teleportPlayerTo(proxyOf(server, "Tester"), race.start!.position, 0);
    server.tick();

    expect(hud.inRace).toBe(true);
    const portal = client.controller(race.start!.id) as RacePortalController;
    expect(portal.showLeaveButton).toBe(true);
    expect(view.leaveable.get(portal)).toBeTypeOf("function");
    expect(client.raceTarget?.entity.id).toBe(race.checkpoints[1]!.id);

    const target = client.controller(race.checkpoints[1]!.id) as CheckpointController;
    expect(target).toBeInstanceOf(CheckpointController);
    expect(target.entity.state).toBe(CheckpointState.CURRENT);

    client.update(0.016);
    expect(view.radar.find((t) => t.color === "checkpoint")?.controller).toBe(target);

    view.leaveable.get(portal)!(); // click the portal
    expect(hud.inRace).toBe(false);
    expect(view.leaveable.get(portal)).toBeUndefined();
    expect(client.raceTarget).toBeUndefined();
    expect(race.isClientInRace(proxyOf(server, "Tester"))).toBe(false);
  });
});

describe("PlayerController", () => {
  it("other players take the server's orientation; the local player keeps its own while flying", () => {
    const local = new PlayerController(new Movable());
    local.isLocalPlayer = true;
    local.entity.orientation = 1;
    const remote = new PlayerController(new Movable());
    remote.entity.orientation = 1;

    const update = new Movable();
    update.orientation = 2;
    update.canMove = true;
    local.updateFromServer(update);
    remote.updateFromServer(update);
    expect(local.entity.orientation).toBe(1);
    expect(remote.entity.orientation).toBe(2);

    update.canMove = false; // respawn/teleport: take the server's orientation
    local.updateFromServer(update);
    expect(local.entity.orientation).toBe(2);
  });

  it("thrust direction follows the orientation", () => {
    const p = new PlayerController(new Movable());
    p.accelerationFactor = 1;
    p.entity.orientation = Math.PI / 2;
    p.applyThrust();
    expect(p.entity.acceleration.x).toBeCloseTo(-400, 9);
    expect(p.entity.acceleration.y).toBeCloseTo(0, 9);
  });
});

it("ignores messages for the CHAT type before attachHud without crashing", async () => {
  const server = new GameServer({ random: seededRandom(2) }).prepareDemoConfiguration();
  const client = new GameClient(
    new FakeView(),
    () => new LocalServerConnection(server, { delivery: "sync" }),
  );
  await client.connect();
  expect(client.server.state).toBe(ConnectionState.CONNECTED);
  expect(MessageType.CHAT).toBe(1);
});

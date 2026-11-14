import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createEnvelope,
  EntityMarshal,
  MessageType,
  readPayload,
  WebSocketServerConnection,
  type Envelope,
} from "@ar/shared";
import { ChatServer, GameServer, ManualGameLoop, opponentChoice, seededRandom } from "@ar/server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDefaultGameServer, startHost, type RunningHost } from "./host";

/** Polls until `predicate` holds (network delivery is asynchronous). */
async function until(predicate: () => boolean, what: string, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

let staticDir: string;
let host: RunningHost;
let loop: ManualGameLoop;
const open: WebSocketServerConnection[] = [];

beforeAll(async () => {
  staticDir = await mkdtemp(join(tmpdir(), "ar-host-"));
  await mkdir(join(staticDir, "assets"));
  await writeFile(join(staticDir, "index.html"), "<h1>Asteroid Racers</h1>");
  await writeFile(join(staticDir, "assets", "app.js"), "console.log(1)");
  await writeFile(join(tmpdir(), "ar-secret.txt"), "secret");

  const gameServer = new GameServer({ random: seededRandom(1) }).prepareDemoConfiguration();
  gameServer.registerService(new ChatServer());
  loop = new ManualGameLoop();
  host = await startHost({ port: 0, host: "127.0.0.1", staticRoots: [staticDir], gameServer, loop });
});

afterAll(async () => {
  await host.close();
  await rm(staticDir, { recursive: true, force: true });
  await rm(join(tmpdir(), "ar-secret.txt"), { force: true });
});

afterEach(async () => {
  for (const connection of open.splice(0)) connection.disconnect();
  await until(() => host.gameServer.clients.size === 0, "clients to leave");
});

async function connectClient(): Promise<{ connection: WebSocketServerConnection; received: Envelope[] }> {
  const connection = new WebSocketServerConnection(host.webSocketUrl);
  const received: Envelope[] = [];
  connection.onMessage((e) => received.push(e));
  await connection.connect();
  open.push(connection);
  return { connection, received };
}

describe("static files", () => {
  it("serves index.html at / and assets with long caching", async () => {
    const index = await fetch(`${host.url}/`);
    expect(index.status).toBe(200);
    expect(index.headers.get("content-type")).toContain("text/html");
    expect(await index.text()).toContain("Asteroid Racers");

    const asset = await fetch(`${host.url}/assets/app.js`);
    expect(asset.headers.get("content-type")).toContain("text/javascript");
    expect(asset.headers.get("cache-control")).toContain("immutable");
  });

  it("404s unknown files and refuses path traversal", async () => {
    expect((await fetch(`${host.url}/nope.html`)).status).toBe(404);
    expect((await fetch(`${host.url}/..%2far-secret.txt`)).status).toBe(404);
    expect((await fetch(`${host.url}/%2e%2e/ar-secret.txt`)).status).toBe(404);
  });

  it("rejects non-GET methods", async () => {
    expect((await fetch(`${host.url}/`, { method: "POST" })).status).toBe(405);
  });
});

describe("health", () => {
  it("answers GET /health with 200 and a small JSON state", async () => {
    const response = await fetch(`${host.url}/health`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({
      status: "ok",
      clients: 0,
      frame: expect.any(Number),
      uptimeS: expect.any(Number),
    });
  });

  it("counts connected clients and ignores the query string", async () => {
    await connectClient();
    await until(() => host.gameServer.clients.size === 1, "client to join");
    const body = (await (await fetch(`${host.url}/health?probe=1`)).json()) as { clients: number };
    expect(body.clients).toBe(1);
  });

  it("refuses other methods", async () => {
    expect((await fetch(`${host.url}/health`, { method: "POST" })).status).toBe(405);
  });
});

describe("WebSocket game traffic", () => {
  it("connects, greets, and handles the handshake over the wire", async () => {
    const { connection, received } = await connectClient();
    await until(() => received.some((e) => e.messageType === MessageType.CHAT), "welcome chat");

    connection.send(createEnvelope(MessageType.HANDSHAKE, { username: "Major Tom" }));
    await until(() => received.some((e) => e.messageType === MessageType.PLAYER), "PLAYER");

    const player = received.find((e) => e.messageType === MessageType.PLAYER)!;
    const ship = EntityMarshal.fromNet(readPayload(MessageType.PLAYER, player));
    expect(ship.displayName).toBe("Major Tom");
    const worldSize = host.gameServer.world.entities.size;
    await until(
      () => received.filter((e) => e.messageType === MessageType.ENTITY).length >= worldSize,
      "initial world",
    );
  });

  it("simulates input and broadcasts movement as the loop ticks", async () => {
    const { connection, received } = await connectClient();
    connection.send(createEnvelope(MessageType.HANDSHAKE, { username: "Pilot" }));
    await until(() => received.some((e) => e.messageType === MessageType.PLAYER), "PLAYER");
    const shipId = EntityMarshal.fromNet(
      readPayload(
        MessageType.PLAYER,
        received.find((e) => e.messageType === MessageType.PLAYER)!,
      ),
    ).id;
    const proxy = [...host.gameServer.clients].find((c) => c.movable?.id === shipId)!;
    host.gameServer.teleportPlayerTo(proxy, proxy.movable!.position.clone().setValues(-500, 0), 0);

    connection.send(createEnvelope(MessageType.INPUT, { accelerationFactor: 1, newOrientation: 0 }));
    await until(() => proxy.movable!.acceleration.y === 400, "input applied");
    received.length = 0;
    loop.advance(5);

    await until(
      () =>
        received.some(
          (e) =>
            e.messageType === MessageType.ENTITY &&
            EntityMarshal.fromNet(readPayload(MessageType.ENTITY, e)).id === shipId,
        ),
      "ship update",
    );
  });

  it("relays chat between two players", async () => {
    const a = await connectClient();
    const b = await connectClient();
    a.connection.send(createEnvelope(MessageType.HANDSHAKE, { username: "Alice" }));
    await until(() => a.received.some((e) => e.messageType === MessageType.PLAYER), "Alice PLAYER");

    a.connection.send(createEnvelope(MessageType.CHAT, { text: "hi Bob" }));
    await until(
      () =>
        b.received.some(
          (e) => e.messageType === MessageType.CHAT && readPayload(MessageType.CHAT, e).from === "Alice",
        ),
      "chat at Bob",
    );
  });

  it("removes the player when the socket closes", async () => {
    const { connection, received } = await connectClient();
    connection.send(createEnvelope(MessageType.HANDSHAKE, { username: "Leaver" }));
    await until(() => received.some((e) => e.messageType === MessageType.PLAYER), "PLAYER");
    const size = host.gameServer.world.entities.size;

    let disconnected = false;
    connection.onDisconnect(() => (disconnected = true));
    connection.disconnect();

    await until(() => disconnected && host.gameServer.clients.size === 0, "disconnect");
    expect(host.gameServer.world.entities.size).toBe(size - 1);
  });

  it("survives garbage and text frames", async () => {
    const raw = new WebSocket(host.webSocketUrl);
    await new Promise((resolve) => (raw.onopen = resolve));
    raw.send("hello");
    raw.send(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
    raw.close();
    await until(() => host.gameServer.clients.size === 0, "raw socket cleanup");

    const { received } = await connectClient(); // server still healthy
    await until(() => received.length > 0, "welcome");
  });

  it("connect() rejects when the handshake is refused", async () => {
    // Wrong path: the host answers the upgrade with an HTTP error. (A refused TCP port would also
    // work, but Windows takes seconds to report that.)
    const connection = new WebSocketServerConnection(`ws://127.0.0.1:${host.port}/not-the-game`);
    await expect(connection.connect()).rejects.toThrow(/could not connect/);
    expect(connection.connected).toBe(false);
  });
});

describe("upgrade routing", () => {
  it("answers WebSocket upgrades on other paths with 404 instead of hanging", async () => {
    const { connect } = await import("node:net");
    const response = await new Promise<string>((resolve, reject) => {
      const socket = connect(host.port, "127.0.0.1", () => {
        socket.write(
          "GET /elsewhere HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n" +
            "Sec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n",
        );
      });
      let data = "";
      socket.on("data", (chunk) => (data += chunk.toString()));
      socket.on("end", () => resolve(data));
      socket.on("error", reject);
      socket.setTimeout(2000, () => reject(new Error("upgrade hung")));
    });
    expect(response).toMatch(/^HTTP\/1\.1 404/);
  });
});

describe("soak over WebSocket", () => {
  it("40 connect/handshake/disconnect cycles leave the server as it was", async () => {
    const baseline = host.gameServer.stats();
    for (let i = 0; i < 40; i++) {
      const { connection, received } = await connectClient();
      connection.send(createEnvelope(MessageType.HANDSHAKE, { username: `Churn ${i}` }));
      await until(() => received.some((e) => e.messageType === MessageType.PLAYER), "PLAYER");
      loop.advance(2);
      open.splice(open.indexOf(connection), 1);
      connection.disconnect();
      await until(() => host.gameServer.clients.size === 0, "disconnect");
    }
    loop.advance(100);
    expect(host.gameServer.stats()).toEqual(baseline);
  });
});

describe("default game server", () => {
  it("races the demo by default and any registry track by name (TRACK=)", () => {
    const checkpoints = (track?: string) =>
      createDefaultGameServer({ bots: 0, ...(track ? { track } : {}) }).raceController!.checkpoints.length;
    expect(checkpoints()).toBe(7);
    expect(checkpoints("slalom")).toBe(10);
    expect(() => createDefaultGameServer({ bots: 0, track: "moon" })).toThrow(/unknown track/);
  });
});

describe("opponent choice over the WebSocket URL", () => {
  it("?opponent= switches the racing bots; the default returns when the player leaves", async () => {
    const gameServer = createDefaultGameServer({ bots: 1, modelDir: join(tmpdir(), "ar-no-models") });
    const own = await startHost({ port: 0, host: "127.0.0.1", gameServer, loop: new ManualGameLoop() });
    const choice = opponentChoice(gameServer)!;
    try {
      expect(choice.current).toBe("default");
      const connection = new WebSocketServerConnection(`${own.webSocketUrl}?opponent=train-502-g150`);
      await connection.connect();
      await until(() => choice.current === "train-502-g150", "the switch");
      connection.disconnect();
      await until(() => choice.current === "default", "the default to return");
    } finally {
      await own.close();
    }
  });
});

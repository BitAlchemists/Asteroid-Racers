import { createEnvelope, EntityMarshal, MessageType, readPayload, type Envelope } from "@ar/shared";
import { describe, expect, it } from "vitest";
import { ClientProxy } from "./client-proxy";
import { GameServer } from "./game-server";
import { LocalServerConnection } from "./local-connection";
import { seededRandom } from "./random";

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function setup(options: ConstructorParameters<typeof LocalServerConnection>[1] = {}) {
  const server = new GameServer({ random: seededRandom(1) }).prepareDemoConfiguration();
  const connection = new LocalServerConnection(server, options);
  const received: Envelope[] = [];
  connection.onMessage((e) => received.push(e));
  return { server, connection, received };
}

describe("LocalServerConnection", () => {
  it("delivers asynchronously by default (no re-entrancy)", async () => {
    const { connection, received } = setup();
    const connecting = connection.connect(); // awaiting would already run the queued microtasks
    expect(connection.connected).toBe(true);
    expect(received).toHaveLength(0); // welcome chat is still in flight
    await connecting;
    await flush();
    expect(received.map((e) => e.messageType)).toEqual([MessageType.CHAT]);
  });

  it("delivers synchronously when asked (headless trainer)", async () => {
    const { connection, received } = setup({ delivery: "sync" });
    await connection.connect();
    expect(received.map((e) => e.messageType)).toEqual([MessageType.CHAT]);
    connection.send(createEnvelope(MessageType.HANDSHAKE, { username: "Bot" }));
    expect(received[1]?.messageType).toBe(MessageType.PLAYER);
  });

  it.each([false, true])("handshake works end to end (encode=%s)", async (encode) => {
    const { server, connection, received } = setup({ encode });
    await connection.connect();
    connection.send(createEnvelope(MessageType.HANDSHAKE, { username: "Luke" }));
    await flush();

    const player = received.find((e) => e.messageType === MessageType.PLAYER)!;
    const ship = EntityMarshal.fromNet(readPayload(MessageType.PLAYER, player));
    expect(ship.displayName).toBe("Luke");
    expect(server.world.entities.get(ship.id)?.displayName).toBe("Luke");
    expect(received.filter((e) => e.messageType === MessageType.ENTITY)).toHaveLength(
      server.world.entities.size,
    );
  });

  it("client disconnect removes the player and notifies both sides once", async () => {
    const { server, connection } = setup();
    let disconnects = 0;
    connection.onDisconnect(() => disconnects++);
    await connection.connect();
    connection.send(createEnvelope(MessageType.HANDSHAKE, { username: "Leia" }));
    await flush();
    const before = server.world.entities.size;

    connection.disconnect();
    connection.disconnect();

    expect(disconnects).toBe(1);
    expect(connection.connected).toBe(false);
    expect(server.clients.size).toBe(0);
    expect(server.world.entities.size).toBe(before - 1);
  });

  it("server-side disconnect reaches the client", async () => {
    const { server, connection } = setup();
    let disconnected = false;
    connection.onDisconnect(() => (disconnected = true));
    await connection.connect();
    const proxy = [...server.clients][0];
    expect(proxy).toBeInstanceOf(ClientProxy);
    (proxy as ClientProxy).disconnect();
    expect(disconnected).toBe(true);
    expect(server.clients.size).toBe(0);
  });

  it("drops messages that are in flight when the link closes, and sends after close", async () => {
    const { server, connection, received } = setup();
    void connection.connect(); // welcome chat now queued
    connection.disconnect();
    await flush();
    expect(received).toHaveLength(0);
    connection.send(createEnvelope(MessageType.HANDSHAKE, { username: "late" }));
    await flush();
    expect(server.clients.size).toBe(0);
  });

  it("can reconnect with a fresh client proxy", async () => {
    const { server, connection } = setup();
    await connection.connect();
    connection.disconnect();
    await connection.connect();
    expect(server.clients.size).toBe(1);
    expect(connection.connected).toBe(true);
  });
});

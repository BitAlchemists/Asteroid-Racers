import {
  createEnvelope,
  decodeEnvelope,
  encodeEnvelope,
  EntityMarshal,
  MessageType,
  readPayload,
  type Connection,
  type Entity,
  type Envelope,
  type PayloadArgs,
  type Payload,
  type Unsubscribe,
} from "@ar/shared";
import { ClientProxy } from "./client-proxy";
import type { CollisionMode } from "./contracts";
import type { GameServer } from "./game-server";

/**
 * Scripted client for tests: the server sees a normal {@link Connection}; the test sends envelopes
 * "from the client" and inspects everything the server sent back. Every message goes through
 * protobuf encoding, like on a real wire.
 */
export class FakeClient implements Connection {
  readonly received: Envelope[] = [];
  readonly proxy: ClientProxy;
  connected = true;
  private messageListeners: ((envelope: Envelope) => void)[] = [];
  private disconnectListeners: (() => void)[] = [];

  constructor(
    readonly server: GameServer,
    { collisions = "all", autoRespawn = true }: { collisions?: CollisionMode; autoRespawn?: boolean } = {},
  ) {
    this.proxy = new ClientProxy(this, server, collisions, autoRespawn);
    server.connectClient(this.proxy);
  }

  // --- Connection (server side) ---
  send(envelope: Envelope): void {
    this.received.push(decodeEnvelope(encodeEnvelope(envelope)));
  }
  onMessage(listener: (envelope: Envelope) => void): Unsubscribe {
    this.messageListeners.push(listener);
    return () => (this.messageListeners = this.messageListeners.filter((l) => l !== listener));
  }
  onDisconnect(listener: () => void): Unsubscribe {
    this.disconnectListeners.push(listener);
    return () => (this.disconnectListeners = this.disconnectListeners.filter((l) => l !== listener));
  }
  disconnect(): void {
    if (!this.connected) return;
    this.connected = false;
    for (const listener of [...this.disconnectListeners]) listener();
  }

  // --- test driver (client side) ---
  sendToServer<T extends MessageType>(type: T, ...args: PayloadArgs<T>): void {
    const envelope = decodeEnvelope(encodeEnvelope(createEnvelope(type, ...args)));
    for (const listener of [...this.messageListeners]) listener(envelope);
  }

  handshake(username = "Tester"): Entity {
    this.sendToServer(MessageType.HANDSHAKE, { username });
    return this.ship();
  }

  /** The client's ship as last announced by the server in a PLAYER message. */
  ship(): Entity {
    const player = this.last(MessageType.PLAYER);
    if (!player) throw new Error("no PLAYER message received");
    return EntityMarshal.fromNet(player);
  }

  /** Payloads of all received messages of `type`, oldest first. */
  all<T extends MessageType>(type: T): Payload<T>[] {
    return this.received.filter((e) => e.messageType === type).map((e) => readPayload(type, e));
  }

  last<T extends MessageType>(type: T): Payload<T> | undefined {
    return this.all(type).at(-1);
  }

  /** Received ENTITY updates as world entities. */
  entities(): Entity[] {
    return this.all(MessageType.ENTITY).map((net) => EntityMarshal.fromNet(net));
  }

  types(): MessageType[] {
    return this.received.map((e) => e.messageType);
  }

  clear(): void {
    this.received.length = 0;
  }
}

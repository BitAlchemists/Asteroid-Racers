import {
  ConnectionEvents,
  decodeEnvelope,
  encodeEnvelope,
  getLogger,
  type Connection,
  type Envelope,
  type ServerConnection,
  type Unsubscribe,
} from "@ar/shared";
import { ClientProxy } from "./client-proxy";
import type { CollisionMode } from "./contracts";
import type { GameServer } from "./game-server";

const log = getLogger("services.net.LocalServerConnection");

export interface LocalConnectionOptions {
  /**
   * Round-trip every message through protobuf bytes, exactly like the network would. Slower; useful to
   * catch encoding bugs in singleplayer. (Dart's `debug` flag.)
   */
  encode?: boolean;
  /**
   * `"microtask"` (default) delivers asynchronously, like the network and like Dart's broadcast
   * streams, so a handler that replies never re-enters its caller. `"sync"` delivers immediately —
   * for the headless trainer, which steps the server in a tight loop.
   */
  delivery?: "microtask" | "sync";
  /** What the player's ship collides with (default `all`); see {@link CollisionMode}. */
  collisions?: CollisionMode;
  /** Respawn automatically after a crash (default true). */
  autoRespawn?: boolean;
}

/** One direction-agnostic end of the in-memory pipe. */
class LocalEndpoint implements Connection {
  readonly events = new ConnectionEvents();
  peer!: LocalEndpoint;

  constructor(private readonly link: LocalLink) {}

  get connected(): boolean {
    return this.link.open;
  }

  send(envelope: Envelope): void {
    if (!this.link.open) return;
    this.link.deliver(this.peer, envelope);
  }

  onMessage(listener: (envelope: Envelope) => void): Unsubscribe {
    return this.events.onMessage(listener);
  }

  onDisconnect(listener: () => void): Unsubscribe {
    return this.events.onDisconnect(listener);
  }

  disconnect(): void {
    this.link.close();
  }
}

class LocalLink {
  open = true;
  readonly client: LocalEndpoint;
  readonly server: LocalEndpoint;

  constructor(private readonly options: Required<LocalConnectionOptions>) {
    this.client = new LocalEndpoint(this);
    this.server = new LocalEndpoint(this);
    this.client.peer = this.server;
    this.server.peer = this.client;
  }

  deliver(to: LocalEndpoint, envelope: Envelope): void {
    const message = this.options.encode ? encodeEnvelope(envelope) : envelope;
    const receive = () => {
      if (!this.open) return; // dropped: the link closed while the message was in flight
      to.events.emitMessage(message instanceof Uint8Array ? decodeEnvelope(message) : message);
    };
    if (this.options.delivery === "sync") receive();
    else queueMicrotask(receive);
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    // Server side first, so the game removes the player before the client reacts.
    this.server.events.emitDisconnect();
    this.client.events.emitDisconnect();
    this.server.events.clear();
    this.client.events.clear();
  }
}

/**
 * In-process connection to a {@link GameServer}: singleplayer runs server and client in one page,
 * and AI bots connect to the server they live in. Each `connect()` creates a fresh {@link ClientProxy}.
 */
export class LocalServerConnection implements ServerConnection {
  private link: LocalLink | undefined;
  private readonly events = new ConnectionEvents();
  private readonly options: Required<LocalConnectionOptions>;

  constructor(
    private readonly server: GameServer,
    {
      encode = false,
      delivery = "microtask",
      collisions = "all",
      autoRespawn = true,
    }: LocalConnectionOptions = {},
  ) {
    this.options = { encode, delivery, collisions, autoRespawn };
  }

  get connected(): boolean {
    return this.link?.open ?? false;
  }

  connect(): Promise<void> {
    if (this.connected) return Promise.resolve();
    const link = new LocalLink(this.options);
    this.link = link;
    link.client.onMessage((envelope) => this.events.emitMessage(envelope));
    link.client.onDisconnect(() => this.events.emitDisconnect());

    log.finest("connect()");
    const proxy = new ClientProxy(
      link.server,
      this.server,
      this.options.collisions,
      this.options.autoRespawn,
    );
    this.server.connectClient(proxy);
    return Promise.resolve();
  }

  send(envelope: Envelope): void {
    if (this.link?.open) this.link.client.send(envelope);
    else log.info("send() while disconnected; message dropped");
  }

  onMessage(listener: (envelope: Envelope) => void): Unsubscribe {
    return this.events.onMessage(listener);
  }

  onDisconnect(listener: () => void): Unsubscribe {
    return this.events.onDisconnect(listener);
  }

  disconnect(): void {
    this.link?.close();
  }
}

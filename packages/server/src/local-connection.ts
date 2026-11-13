import {
  ConnectionEvents,
  decodeEnvelope,
  encodeEnvelope,
  getLogger,
  type Connection,
  type Envelope,
  type Movable,
  type MovementInput,
  type ServerConnection,
  type Unsubscribe,
} from "@ar/shared";

function isPresent(value: number | undefined): value is number {
  return value !== undefined && !Number.isNaN(value);
}
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
  /**
   * Training fast path (needs `delivery: "sync"`, no `encode`): the bot's movement input and its
   * own-ship updates skip envelopes and dispatchers and go straight to the server and the bot, at
   * the same moment and with the same guards as the messages. Results are identical. Other
   * messages still travel as envelopes.
   */
  direct?: boolean;
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
    if (this.options.delivery === "sync") this.receive(to, message);
    else queueMicrotask(() => this.receive(to, message));
  }

  private receive(to: LocalEndpoint, message: Envelope | Uint8Array): void {
    if (!this.open) return; // dropped: the link closed while the message was in flight
    to.events.emitMessage(message instanceof Uint8Array ? decodeEnvelope(message) : message);
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
  /** The server side of the current link (for the direct input path). */
  private serverProxy: ClientProxy | undefined;
  /**
   * Receives the own ship on a direct link (set by the bot). It gets the server's own object: it must
   * copy what it keeps and never change it.
   */
  directShipSink: ((movable: Movable) => void) | undefined;

  constructor(
    private readonly server: GameServer,
    {
      encode = false,
      delivery = "microtask",
      collisions = "all",
      autoRespawn = true,
      direct = false,
    }: LocalConnectionOptions = {},
  ) {
    this.options = { encode, delivery, collisions, autoRespawn, direct };
  }

  /** Whether movement input and own-ship updates take the direct path. */
  get direct(): boolean {
    return this.options.direct && this.options.delivery === "sync" && !this.options.encode;
  }

  /**
   * Movement input without an envelope, for a direct link: the same as `movePlayer` → INPUT message
   * → the server's INPUT handler (NaN fields are dropped like the protobuf marshalling does).
   */
  directInput(input: MovementInput): void {
    const proxy = this.serverProxy;
    if (!this.link?.open || !proxy) return;
    if (!proxy.movable?.canMove) return;
    const clean: MovementInput = {};
    if (isPresent(input.accelerationFactor)) clean.accelerationFactor = input.accelerationFactor;
    if (isPresent(input.newOrientation)) clean.newOrientation = input.newOrientation;
    if (isPresent(input.rotationSpeed)) clean.rotationSpeed = input.rotationSpeed;
    this.server.computePlayerInput(proxy, clean);
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
    this.serverProxy = proxy;
    if (this.direct) {
      // Stands in for ENTITY(snapshot) → ServerProxy → updateEntity(snapshot.clone()); the sink copies.
      proxy.directOwnShip = (movable) => {
        if (link.open) this.directShipSink?.(movable);
      };
    }
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

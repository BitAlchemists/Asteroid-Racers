import { getLogger } from "../logging";
import type { ServerConnection, Unsubscribe } from "../net/connection";
import { attachedShip, EntityMarshal } from "../net/entity-marshal";
import { createEnvelope, MessageDispatcher, type Payload } from "../net/messages";
import { MessageType, type Envelope } from "../net/proto/index";
import type { Entity } from "../world/entity";
import { Movable, type MovementInput } from "../world/movable";

const log = getLogger("shared.client.ServerProxy");
const QUIET_TYPES = new Set([MessageType.PING_PONG, MessageType.ENTITY]);

/** What the server can tell a client. Implemented by the rendering game client and by AI bots. */
export interface IGameClient {
  updateEntity(entity: Entity): void;
  createPlayer(ship: Movable): void;
  handleCollision(entityId: number): void;
  removeEntity(entityId: number): void;
  joinRace(portalEntityId: number): void;
  activateNextCheckpoint(checkpointEntityId: number): void;
  leaveRace(): void;
}

export enum ConnectionState {
  DISCONNECTED = 0,
  CONNECTING = 1,
  CONNECTED = 2,
}

/** Weight of a new ping sample in the running average. */
const PING_SMOOTHING = 0.2;

/**
 * Client-side protocol handler: turns server messages into {@link IGameClient} calls and offers typed
 * senders for everything a client can say. Shared by the browser client and AI bots.
 */
export class ServerProxy {
  /** Extra handlers (e.g. CHAT) can be registered here. */
  readonly dispatcher = new MessageDispatcher<void>();
  private connection: ServerConnection | undefined;
  private subscriptions: Unsubscribe[] = [];
  private disconnectListeners: (() => void)[] = [];
  private connectionState = ConnectionState.DISCONNECTED;
  private readonly startTime = Date.now();
  private averagePing: number | undefined;
  private readonly onEntity = (net: Payload<MessageType.ENTITY>) =>
    this.client.updateEntity(EntityMarshal.fromNet(net));

  constructor(private readonly client: IGameClient) {
    this.dispatcher
      .on(MessageType.ENTITY, this.onEntity)
      .on(MessageType.ENTITY_REMOVE, ({ integer }) => client.removeEntity(integer))
      .on(MessageType.PLAYER, (net) => {
        const ship = EntityMarshal.fromNet(net);
        if (ship instanceof Movable) client.createPlayer(ship);
        else log.warning(`PLAYER message for non-ship entity ${ship.id}`);
      })
      .on(MessageType.PING_PONG, ({ integer }) => this.onPong(integer))
      .on(MessageType.COLLISION, ({ integer }) => client.handleCollision(integer))
      .on(MessageType.RACE_JOIN, ({ integer }) => client.joinRace(integer))
      .on(MessageType.RACE_EVENT, ({ integer }) => client.activateNextCheckpoint(integer))
      .on(MessageType.RACE_LEAVE, () => client.leaveRace());
  }

  get state(): ConnectionState {
    return this.connectionState;
  }

  /** Smoothed round-trip time in ms (undefined until the first pong). */
  get pingAverage(): number | undefined {
    return this.averagePing;
  }

  /** Opens the connection. Resolves when messages can flow (the handshake is sent separately). */
  async connect(connection: ServerConnection): Promise<void> {
    if (this.connectionState !== ConnectionState.DISCONNECTED) throw new Error("already connected");
    log.fine("connect()");
    this.connection = connection;
    this.subscriptions = [
      connection.onMessage((envelope) => this.receive(envelope)),
      connection.onDisconnect(() => this.onDisconnected()),
    ];
    this.connectionState = ConnectionState.CONNECTING;
    try {
      await connection.connect();
    } catch (error) {
      this.cleanUp();
      throw error;
    }
    this.connectionState = ConnectionState.CONNECTED;
  }

  disconnect(): void {
    this.connection?.disconnect();
  }

  onDisconnect(listener: () => void): Unsubscribe {
    this.disconnectListeners.push(listener);
    return () => {
      this.disconnectListeners = this.disconnectListeners.filter((l) => l !== listener);
    };
  }

  send(envelope: Envelope): void {
    if (this.connection?.connected) this.connection.send(envelope);
  }

  sendHandshake(desiredUsername: string): void {
    this.send(createEnvelope(MessageType.HANDSHAKE, { username: desiredUsername }));
  }

  movePlayer(input: MovementInput): void {
    this.send(createEnvelope(MessageType.INPUT, EntityMarshal.movementInputToNet(input)));
  }

  requestLeaveRace(): void {
    this.send(createEnvelope(MessageType.RACE_LEAVE));
  }

  sendChat(text: string): void {
    this.send(createEnvelope(MessageType.CHAT, { text }));
  }

  ping(): void {
    this.send(createEnvelope(MessageType.PING_PONG, { integer: Date.now() - this.startTime }));
  }

  private onPong(sentAt: number): void {
    const sample = Date.now() - this.startTime - sentAt;
    this.averagePing =
      this.averagePing === undefined
        ? sample
        : sample * PING_SMOOTHING + this.averagePing * (1 - PING_SMOOTHING);
  }

  private receive(envelope: Envelope): void {
    if (!QUIET_TYPES.has(envelope.messageType)) {
      log.fine(() => `receiving message type ${MessageType[envelope.messageType]}`);
    }
    try {
      // A ship sent in process: copy its snapshot instead of building and decoding the payload
      // (same result as the ENTITY handler, which still runs if someone replaced it).
      if (
        envelope.messageType === MessageType.ENTITY &&
        (this.dispatcher.handler(MessageType.ENTITY) as unknown) === this.onEntity
      ) {
        const ship = attachedShip(envelope);
        if (ship) {
          this.client.updateEntity(ship.clone());
          return;
        }
      }
      if (!this.dispatcher.dispatch(envelope, undefined)) {
        log.warning(`no message handler for message type ${MessageType[envelope.messageType]}`);
      }
    } catch (error) {
      log.severe(`error handling message type ${MessageType[envelope.messageType]}`, error);
    }
  }

  private onDisconnected(): void {
    this.cleanUp();
    for (const listener of [...this.disconnectListeners]) listener();
  }

  /** Drops the connection's listeners so a closed connection can't keep the client alive. */
  private cleanUp(): void {
    for (const unsubscribe of this.subscriptions) unsubscribe();
    this.subscriptions = [];
    this.connection = undefined;
    this.connectionState = ConnectionState.DISCONNECTED;
  }
}

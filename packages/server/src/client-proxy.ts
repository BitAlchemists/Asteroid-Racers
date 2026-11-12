import {
  createEnvelope,
  EntityMarshal,
  getLogger,
  MessageType,
  type Connection,
  type Envelope,
  type Movable,
  type Unsubscribe,
} from "@ar/shared";
import type { IClientProxy } from "./contracts";
import type { GameServer } from "./game-server";
import { randomInt } from "./random";
import { SHIP_NAMES } from "./ship-names";

const log = getLogger("GameServer.ClientProxy");
const QUIET_TYPES = new Set([MessageType.PING_PONG, MessageType.INPUT]);

/**
 * Server-side endpoint of one client connection: forwards incoming envelopes to the server's
 * dispatcher and tells the server when the connection drops.
 */
export class ClientProxy implements IClientProxy {
  movable: Movable | undefined;
  private readonly subscriptions: Unsubscribe[];

  constructor(
    private readonly connection: Connection,
    private readonly server: GameServer,
    /** False for ghosts (AI training bots): no crashes, no race joining. */
    readonly canCollide = true,
  ) {
    this.subscriptions = [
      connection.onMessage((envelope) => this.onMessage(envelope)),
      connection.onDisconnect(() => this.onDisconnect()),
    ];
  }

  get playerName(): string | undefined {
    return this.movable?.displayName;
  }

  send(envelope: Envelope): void {
    if (this.connection.connected) this.connection.send(envelope);
  }

  /** Server-initiated disconnect. */
  disconnect(): void {
    this.connection.disconnect();
  }

  private onMessage(envelope: Envelope): void {
    if (!QUIET_TYPES.has(envelope.messageType)) {
      log.fine(() => `receiving message type ${MessageType[envelope.messageType]}`);
    }
    try {
      if (!this.server.dispatcher.dispatch(envelope, this)) {
        log.warning(`no message handler for message type ${envelope.messageType}`);
      }
    } catch (error) {
      log.severe(`error handling message type ${envelope.messageType}`, error);
    }
  }

  private onDisconnect(): void {
    for (const unsubscribe of this.subscriptions) unsubscribe();
    this.subscriptions.length = 0;
    this.server.disconnectClient(this);
  }
}

/** Registers the core client → server message handlers (handshake, input, ping, leaving a race). */
export function registerCoreHandlers(server: GameServer): void {
  server.dispatcher
    .on(MessageType.HANDSHAKE, (handshake, client) => {
      if (client.movable) {
        log.warning(`ignoring repeated handshake from ${client.playerName}`);
        return;
      }
      const username = handshake.username.trim() || SHIP_NAMES[randomInt(server.random, SHIP_NAMES.length)]!;
      server.registerPlayer(client, username, client.canCollide ?? true);

      client.send(createEnvelope(MessageType.PLAYER, EntityMarshal.toNet(client.movable!)));
      // TODO(port): queue these so a big world doesn't flood a fresh client (same TODO as the original).
      for (const entity of server.world.entities.values()) {
        client.send(createEnvelope(MessageType.ENTITY, EntityMarshal.toNet(entity)));
      }
    })
    .on(MessageType.INPUT, (input, client) => {
      if (!client.movable?.canMove) return;
      server.computePlayerInput(client, EntityMarshal.movementInputFromNet(input));
    })
    .on(MessageType.PING_PONG, (_payload, client, envelope) => {
      client.send(envelope);
    })
    .on(MessageType.RACE_LEAVE, (_payload, client) => {
      server.clientLeavesRace(client);
    });
}

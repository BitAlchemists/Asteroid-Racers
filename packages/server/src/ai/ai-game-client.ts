import {
  EntityType,
  getLogger,
  MessageType,
  Movable,
  ServerProxy,
  type Entity,
  type IGameClient,
  type ServerConnection,
} from "@ar/shared";

const log = getLogger("services.ai.AIGameClient");

/** Steers a bot's ship once per server frame. */
export interface VehicleController {
  step(dt: number): void;
}

/** Entity types a bot remembers (it doesn't care about asteroids or arrows). */
const REMEMBERED = new Set([
  EntityType.SHIP,
  EntityType.LAUNCH_PLATFORM,
  EntityType.CHECKPOINT,
  EntityType.FINISH,
]);

/**
 * A bot that plays like a real client: it connects through a {@link ServerConnection}, keeps a local
 * copy of what the server tells it, and sends movement input through the {@link ServerProxy}.
 */
export class AIGameClient implements IGameClient {
  readonly proxy: ServerProxy;
  /** The bot's own ship, as last reported by the server. */
  ship: Movable | undefined;
  readonly entities = new Map<number, Entity>();
  readonly otherShips = new Set<Entity>();
  vehicle: VehicleController | undefined;

  /** Hooks for scripts. */
  onEntityUpdate: ((entity: Entity) => void) | undefined;
  onJoinRace: ((portalId: number) => void) | undefined;
  onNextCheckpoint: ((checkpoint: Entity | undefined) => void) | undefined;
  /** The bot's own ship crashed. */
  onCrash: (() => void) | undefined;

  private pendingConnect: { resolve: () => void; reject: (error: Error) => void } | undefined;

  constructor(
    private readonly connection: ServerConnection,
    readonly username = "Major Tom",
  ) {
    this.proxy = new ServerProxy(this);
    this.proxy.dispatcher.on(MessageType.CHAT, () => {}); // bots don't read chat
    this.proxy.onDisconnect(() => {
      this.pendingConnect?.reject(new Error("disconnected before the handshake completed"));
      this.pendingConnect = undefined;
    });
  }

  get connected(): boolean {
    return this.connection.connected;
  }

  /** Connects and handshakes; resolves once the server has given us a ship. */
  connect(): Promise<void> {
    log.fine("connect()");
    const ready = new Promise<void>((resolve, reject) => {
      this.pendingConnect = { resolve, reject };
    });
    this.proxy.connect(this.connection).then(
      () => this.proxy.sendHandshake(this.username),
      (error: unknown) => {
        this.pendingConnect?.reject(error instanceof Error ? error : new Error(String(error)));
        this.pendingConnect = undefined;
      },
    );
    return ready;
  }

  disconnect(): void {
    this.proxy.disconnect();
  }

  step(dt: number): void {
    this.vehicle?.step(dt);
  }

  // --- IGameClient -------------------------------------------------------------------

  createPlayer(ship: Movable): void {
    this.ship = ship;
    this.entities.set(ship.id, ship);
    this.pendingConnect?.resolve();
    this.pendingConnect = undefined;
  }

  updateEntity(update: Entity): void {
    this.onEntityUpdate?.(update);
    const known = this.entities.get(update.id);
    if (known) {
      known.copyFrom(update);
      return;
    }
    if (!REMEMBERED.has(update.type)) return;
    this.entities.set(update.id, update);
    if (update.type === EntityType.SHIP) this.otherShips.add(update);
  }

  removeEntity(entityId: number): void {
    const entity = this.entities.get(entityId);
    if (!entity) return;
    this.entities.delete(entityId);
    this.otherShips.delete(entity);
  }

  handleCollision(entityId: number): void {
    const entity = this.entities.get(entityId);
    if (entity instanceof Movable) entity.canMove = false;
    if (entity !== undefined && entity === this.ship) this.onCrash?.();
  }

  joinRace(portalId: number): void {
    log.fine(`joinRace: ${portalId}`);
    this.onJoinRace?.(portalId);
  }

  activateNextCheckpoint(checkpointId: number): void {
    log.fine(`activateNextCheckpoint: ${checkpointId}`);
    this.onNextCheckpoint?.(this.entities.get(checkpointId));
  }

  leaveRace(): void {
    log.fine("leaveRace");
  }
}

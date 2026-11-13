import type { Entity, Envelope, MessageDispatcher, Movable, MovementInput, Vector2, World } from "@ar/shared";

/**
 * What a player's ship collides with:
 * - `all`: asteroids and other ships, and it can join races (normal play);
 * - `obstacles`: asteroids only; ships pass through each other and never join races (training);
 * - `none`: nothing at all, a ghost (the original training mode).
 */
export type CollisionMode = "all" | "obstacles" | "none";

/** The server's handle on one connected client (human, or AI bot connected in-process). */
export interface IClientProxy {
  /** The client's ship; undefined until the handshake has been processed. */
  movable: Movable | undefined;
  readonly playerName: string | undefined;
  /** Defaults to `all`. */
  readonly collisions?: CollisionMode;
  /** Respawn automatically after a crash (default true). Training arenas turn this off and decide themselves. */
  readonly autoRespawn?: boolean;
  send(envelope: Envelope): void;
}

/** What services (chat, AI directors) and the race controller may use of the game server. */
export interface IGameServer {
  readonly world: World;
  readonly clients: ReadonlySet<IClientProxy>;
  /** Seconds of simulated time since start. */
  readonly gameTime: number;
  /** Register handlers for client → server messages here. */
  readonly dispatcher: MessageDispatcher<IClientProxy>;

  registerService(service: IServerService): void;

  connectClient(client: IClientProxy): void;
  disconnectClient(client: IClientProxy): void;
  registerPlayer(client: IClientProxy, desiredUsername: string): void;
  spawnEntity(entity: Entity): void;
  despawnEntity(entity: Entity): void;
  /** Spawns `entity` as something ships crash into. */
  addObstacle(entity: Entity): void;
  removeObstacle(entity: Entity): void;
  computePlayerInput(client: IClientProxy, input: MovementInput): void;
  teleportPlayerTo(client: IClientProxy, position: Vector2, orientation: number, velocity?: Vector2): void;
  clientLeavesRace(client: IClientProxy): void;

  broadcastMessage(envelope: Envelope, except?: ReadonlySet<IClientProxy>): void;
  sendMessageToClientsExcept(envelope: Envelope, client: IClientProxy): void;

  /** Runs `callback` after `seconds` of game time (not wall time, so headless training stays exact). */
  schedule(seconds: number, callback: () => void): void;
}

/** A plug-in that runs inside the server's frame (chat, AI directors). All hooks are optional. */
export interface IServerService {
  /** Called once from `GameServer.registerService`. */
  attach?(server: IGameServer): void;
  start?(): void | Promise<void>;
  preUpdate?(dt: number): void;
  update?(dt: number): void;
  postUpdate?(dt: number): void;
}

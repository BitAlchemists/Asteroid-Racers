import {
  createEnvelope,
  Entity,
  EntityMarshal,
  EntityType,
  getLogger,
  MessageDispatcher,
  MessageType,
  Movable,
  PhysicsSimulator,
  RacePortal,
  Vector2,
  World,
  type Envelope,
  type MovementInput,
} from "@ar/shared";
import { registerCoreHandlers } from "./client-proxy";
import { CollisionDetector } from "./collision-detector";
import type { IClientProxy, IGameServer, IServerService } from "./contracts";
import { TICK_SECONDS, type GameLoop } from "./game-loop";
import { RaceController } from "./race-controller";
import { seededRandom, type Random } from "./random";
import { SceneController } from "./scene-controller";

const log = getLogger("GameServer");

export const WELCOME_MESSAGE = "Welcome to the 'Apollo 13' development server.";
export const SHIP_RADIUS = 20;
/** Thrust at accelerationFactor 1, in units/s². */
export const MAX_ACCELERATION = 400;
export const RESPAWN_DELAY_SECONDS = 1;
/** Entity updates broadcast per tick, highest updateRank first (bandwidth throttle from the original). */
export const MAX_ENTITY_UPDATES_PER_TICK = 2;

export interface GameServerOptions {
  /** Source of randomness for world generation and spawn points. Defaults to `Math.random`. */
  random?: Random;
  /** Simulation step in seconds. */
  tickSeconds?: number;
}

interface Timer {
  at: number;
  seq: number;
  callback: () => void;
}

/**
 * The authoritative simulation. Transport-agnostic: clients are {@link IClientProxy}s, the frame is
 * driven by any {@link GameLoop}, so the same server runs in Node, in the browser (singleplayer)
 * and headless for AI training.
 */
export class GameServer implements IGameServer {
  readonly world = new World();
  readonly dispatcher = new MessageDispatcher<IClientProxy>();
  readonly random: Random;
  readonly tickSeconds: number;

  private readonly clientSet = new Set<IClientProxy>();
  private readonly services: IServerService[] = [];
  private readonly physics = new PhysicsSimulator();
  private readonly crashDetector = new CollisionDetector();
  private readonly joinRaceDetector = new CollisionDetector();
  private readonly entityToClient = new Map<Entity, IClientProxy>();
  private race: RaceController | undefined;
  private spawn = new Entity({ type: EntityType.UNKNOWN, radius: 100, orientation: Math.PI });
  private loop: GameLoop | undefined;
  private timers: Timer[] = [];
  private timerSeq = 0;
  private time = 0;
  private frame = 0;

  constructor({ random = Math.random, tickSeconds = TICK_SECONDS }: GameServerOptions = {}) {
    this.random = random;
    this.tickSeconds = tickSeconds;
    this.crashDetector.activeEntitiesCanCollide = true;
    registerCoreHandlers(this);
  }

  get clients(): ReadonlySet<IClientProxy> {
    return this.clientSet;
  }

  get gameTime(): number {
    return this.time;
  }

  get frameCount(): number {
    return this.frame;
  }

  get raceController(): RaceController | undefined {
    return this.race;
  }

  /** Builds the demo world: scene 2 with its corridor race. */
  prepareDemoConfiguration(): this {
    SceneController.createScene2(this.world, this.random);

    const race = new RaceController(this);
    SceneController.createRace2(this.world, race);
    this.useRace(race);

    this.crashDetector.passiveEntities.push(...this.world.passiveCollisionEntities);
    return this;
  }

  /** Makes `race` the active race and lets ships join it by touching its portal. */
  useRace(race: RaceController): void {
    this.race = race;
    if (race.start) this.joinRaceDetector.passiveEntities.push(race.start);
  }

  registerService(service: IServerService): void {
    service.attach?.(this);
    this.services.push(service);
  }

  /** Attaches the loop and starts all services. Without a loop, drive the server with {@link tick}. */
  async start(loop?: GameLoop): Promise<void> {
    log.info("Starting Game Server...");
    if (loop) {
      this.loop = loop;
      loop.onUpdate = (dt) => this.tick(dt);
      loop.start();
    }
    for (const service of this.services) {
      log.info(`Starting service ${service.constructor.name}`);
      await service.start?.();
    }
  }

  stop(): void {
    this.loop?.stop();
    this.loop = undefined;
  }

  // --- client lifecycle -------------------------------------------------------

  connectClient(client: IClientProxy): void {
    this.clientSet.add(client);
    client.send(createEnvelope(MessageType.CHAT, { from: "Server", text: WELCOME_MESSAGE }));
  }

  disconnectClient(client: IClientProxy): void {
    if (!this.clientSet.delete(client)) return;
    const movable = client.movable;
    if (!movable) {
      log.info("client disconnected before handshake");
      return;
    }
    this.physics.removeMovable(movable);
    this.crashDetector.deactivate(movable);
    this.joinRaceDetector.deactivate(movable);
    this.clientLeavesRace(client);
    this.entityToClient.delete(movable);
    this.despawnEntity(movable);
  }

  /** Creates the client's ship and spawns it. Bots that must not crash or join races pass `canCollide = false`. */
  registerPlayer(client: IClientProxy, desiredUsername: string, canCollide = true): void {
    const player = new Movable({ radius: SHIP_RADIUS, displayName: desiredUsername });
    this.spawnEntity(player);
    this.entityToClient.set(player, client);
    client.movable = player;

    if (canCollide) this.joinRaceDetector.activate(player);
    this.physics.addMovable(player);
    this.spawnPlayer(client, canCollide);
  }

  // --- frame ------------------------------------------------------------------

  /** One simulation frame. Public so tests and the trainer can step the server directly. */
  tick(dt: number = this.tickSeconds): void {
    try {
      for (const service of this.services) service.preUpdate?.(dt);

      this.physics.simulateRotation(dt);
      this.physics.simulateTranslation(dt);

      for (const service of this.services) service.update?.(dt);
      this.checkCollisions();
      this.race?.update();

      for (const service of this.services) service.postUpdate?.(dt);
      this.broadcastUpdates();

      this.time += dt;
      this.frame++;
      this.runDueTimers();
    } catch (error) {
      log.severe(`error in frame ${this.frame}`, error);
    }
  }

  schedule(seconds: number, callback: () => void): void {
    this.timers.push({ at: this.time + seconds, seq: this.timerSeq++, callback });
  }

  private runDueTimers(): void {
    if (this.timers.length === 0) return;
    const due = this.timers
      .filter((t) => t.at <= this.time + 1e-9)
      .sort((a, b) => a.at - b.at || a.seq - b.seq);
    if (due.length === 0) return;
    this.timers = this.timers.filter((t) => !due.includes(t));
    for (const timer of due) timer.callback();
  }

  private checkCollisions(): void {
    this.crashDetector.detectCollisions((ship, other) => this.onShipCrash(ship, other));
    this.joinRaceDetector.detectCollisions((ship, portal) => this.onShipTouchRacePortal(ship, portal));
  }

  private onShipCrash(ship: Entity, _other: Entity): void {
    // A ship can hit several things in one frame; only the first collision counts.
    if (!(ship instanceof Movable) || !this.crashDetector.deactivate(ship)) return;
    ship.canMove = false;
    this.broadcastMessage(createEnvelope(MessageType.COLLISION, { integer: ship.id }));

    this.schedule(RESPAWN_DELAY_SECONDS, () => {
      const client = this.entityToClient.get(ship);
      if (client && this.world.entities.has(ship.id)) this.spawnPlayer(client);
    });
  }

  private onShipTouchRacePortal(ship: Entity, portal: Entity): void {
    const client = this.entityToClient.get(ship);
    if (!client || !(portal instanceof RacePortal) || !(portal.raceController instanceof RaceController))
      return;
    // As in the original, touching the portal is a one-time ticket: the ship is not re-armed after
    // leaving the race (finishing re-joins it directly).
    this.joinRaceDetector.deactivate(ship);
    portal.raceController.addPlayer(client);
  }

  /** Sends the highest-ranked changed entities to everyone; the rest age and win a later frame. */
  private broadcastUpdates(): void {
    const changed = [...this.world.entities.values()].filter((e) => e.updateRank > 0);
    changed.sort((a, b) => b.updateRank - a.updateRank);
    for (const entity of changed) entity.updateRank += 1;

    for (const entity of changed.slice(0, MAX_ENTITY_UPDATES_PER_TICK)) {
      entity.updateRank = 0;
      this.broadcastMessage(createEnvelope(MessageType.ENTITY, EntityMarshal.toNet(entity)));
    }
  }

  // --- players & entities -------------------------------------------------------

  /** Puts the ship at a random point of its spawn area (race checkpoint or the world spawn). */
  spawnPlayer(client: IClientProxy, canCollide = true): void {
    const movable = client.movable;
    if (!movable) return;

    const spawn = this.race?.isClientInRace(client) ? this.race.spawnEntityForPlayer(client) : this.spawn;
    const offset = this.randomPointInUnitCircle().scale(Math.max(0, spawn.radius - movable.radius));
    if (canCollide) this.crashDetector.activate(movable);
    this.teleportPlayerTo(client, spawn.position.plus(offset), spawn.orientation);
  }

  teleportPlayerTo(client: IClientProxy, position: Vector2, orientation: number): void {
    const movable = client.movable;
    if (!movable) return;
    movable.position = position.clone();
    movable.orientation = orientation;
    movable.canMove = true;
    movable.velocity = Vector2.zero();
    movable.acceleration = Vector2.zero();
    movable.rotationSpeed = 0;
    movable.updateRank += 1;
  }

  /**
   * Applies steering input. A missing/NaN orientation or rotation speed leaves it unchanged; thrust is
   * recomputed from scratch every time (missing = no thrust) and clamped to 0..1.
   */
  computePlayerInput(client: IClientProxy, input: MovementInput): void {
    const movable = client.movable;
    if (!movable) return;
    movable.updateRank += 1;

    let thrust = input.accelerationFactor ?? 0;
    if (!Number.isFinite(thrust) || thrust < 0 || thrust > 1) {
      log.warning(`getting unsanitized input from ${client.playerName}`);
      thrust = Number.isFinite(thrust) ? Math.min(1, Math.max(0, thrust)) : 0;
    }

    if (input.newOrientation !== undefined && !Number.isNaN(input.newOrientation)) {
      movable.orientation = input.newOrientation;
    }
    if (input.rotationSpeed !== undefined && !Number.isNaN(input.rotationSpeed)) {
      movable.rotationSpeed = input.rotationSpeed;
    }

    // Thrust points along the ship's local +y axis, rotated by its orientation.
    movable.acceleration =
      thrust !== 0 ? new Vector2(0, MAX_ACCELERATION * thrust).rotated(movable.orientation) : Vector2.zero();
  }

  clientLeavesRace(client: IClientProxy): void {
    this.race?.removePlayer(client);
  }

  spawnEntity(entity: Entity): void {
    this.world.addEntity(entity);
    entity.updateRank += 1;
  }

  despawnEntity(entity: Entity): void {
    this.world.removeEntity(entity);
    this.broadcastMessage(createEnvelope(MessageType.ENTITY_REMOVE, { integer: entity.id }));
  }

  // --- messaging ----------------------------------------------------------------

  broadcastMessage(envelope: Envelope, except?: ReadonlySet<IClientProxy>): void {
    // Copy first: a send may disconnect a client and mutate the set.
    for (const client of [...this.clientSet]) {
      if (!except?.has(client)) client.send(envelope);
    }
  }

  sendMessageToClientsExcept(envelope: Envelope, client: IClientProxy): void {
    this.broadcastMessage(envelope, new Set([client]));
  }

  /** Uniform point in the unit disc (rejection sampling, so spawns aren't denser at the center). */
  private randomPointInUnitCircle(): Vector2 {
    for (;;) {
      const point = new Vector2(this.random() * 2 - 1, this.random() * 2 - 1);
      if (point.length <= 1) return point;
    }
  }
}

/** Convenience for demos and tests: a seeded server with the demo world. */
export function createDemoServer(seed?: number): GameServer {
  return new GameServer(seed === undefined ? {} : { random: seededRandom(seed) }).prepareDemoConfiguration();
}

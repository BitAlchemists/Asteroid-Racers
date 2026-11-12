import {
  ConnectionState,
  getLogger,
  MessageType,
  PhysicsSimulator,
  ServerProxy,
  type Entity,
  type IGameClient,
  type Movable,
  type ServerConnection,
} from "@ar/shared";
import type { GameView, Hud, HudActions, RadarTarget } from "./contracts";
import {
  EntityController,
  PlayerController,
  RacePortalController,
  type CheckpointController,
} from "./controllers";

const log = getLogger("GameClient");

/** How often the client measures its round trip to the server. */
export const PING_INTERVAL_SECONDS = 0.5;
/** Frames longer than this (tab in background, debugger) are clamped so ships don't jump. */
export const MAX_FRAME_SECONDS = 0.1;
const FPS_SMOOTHING = 0.05;

/**
 * Game logic of the browser client: keeps entity controllers in sync with the server, predicts the
 * local ship (rotation and translation), sends input when it changes, and drives the view and HUD.
 */
export class GameClient implements IGameClient, HudActions {
  readonly server: ServerProxy;
  private readonly simulator = new PhysicsSimulator();
  private readonly controllers = new Map<number, EntityController>();
  private readonly otherPlayers = new Set<PlayerController>();
  private localPlayer: PlayerController | undefined;
  private racePortal: RacePortalController | undefined;
  private nextCheckpoint: EntityController | undefined;
  private hud: Hud | undefined;

  private previous = { acceleration: 0, orientation: 0, rotation: 0 };
  private sincePing = 0;
  private fps: number | undefined;

  constructor(
    private readonly view: GameView,
    private readonly createConnection: () => ServerConnection,
  ) {
    this.server = new ServerProxy(this);
    this.server.dispatcher.on(MessageType.CHAT, ({ from, text }) => this.hud?.showChat(from, text));
    this.server.onDisconnect(() => this.onDisconnected());
  }

  attachHud(hud: Hud): void {
    this.hud = hud;
    hud.setConnectionState(this.server.state);
  }

  get player(): PlayerController | undefined {
    return this.localPlayer;
  }

  get entityCount(): number {
    return this.controllers.size;
  }

  controller(entityId: number): EntityController | undefined {
    return this.controllers.get(entityId);
  }

  get raceTarget(): EntityController | undefined {
    return this.nextCheckpoint;
  }

  // --- connection -----------------------------------------------------------------

  async connect(): Promise<void> {
    if (this.server.state !== ConnectionState.DISCONNECTED) return;
    log.info("Connecting...");
    const connecting = this.server.connect(this.createConnection());
    this.hud?.setConnectionState(this.server.state);
    try {
      await connecting;
    } catch (error) {
      log.info(`could not connect: ${String(error)}`);
      this.hud?.showNotice("Could not connect.");
      this.hud?.setConnectionState(this.server.state);
      return;
    }
    log.info("Connected");
    this.hud?.showNotice("Connected.");
    this.hud?.setConnectionState(this.server.state);
    this.view.buildScene();
    this.server.sendHandshake(this.hud?.username ?? "");
  }

  disconnect(): void {
    this.server.disconnect();
  }

  private onDisconnected(): void {
    this.hud?.showNotice("Disconnected");
    this.hud?.setConnectionState(this.server.state);
    this.hud?.setInRace(false);
    this.view.setLocalPlayer(undefined);
    this.view.clearScene();
    this.localPlayer = undefined;
    this.racePortal = undefined;
    this.nextCheckpoint = undefined;
    this.otherPlayers.clear();
    this.controllers.clear();
    this.simulator.reset();
  }

  // --- HUD actions -------------------------------------------------------------------

  onConnectToggle(): void {
    switch (this.server.state) {
      case ConnectionState.DISCONNECTED:
        void this.connect();
        break;
      case ConnectionState.CONNECTED:
        this.disconnect();
        break;
      case ConnectionState.CONNECTING:
        break;
    }
  }

  onChatSubmit(text: string): void {
    if (text.trim()) this.server.sendChat(text);
  }

  onLeaveRace(): void {
    this.server.requestLeaveRace();
  }

  // --- frame ---------------------------------------------------------------------------

  /** One rendered frame: predict, send input if it changed, ping, refresh view and HUD. */
  update(rawDt: number): void {
    const dt = Math.min(Math.max(rawDt, 0), MAX_FRAME_SECONDS);
    const radar: RadarTarget[] = [];
    let debug = "";

    const player = this.localPlayer;
    if (player) {
      const ship = player.entity;
      player.applyThrust();
      // Rotation is predicted locally for precise steering; thrust is authoritative on the server.
      this.simulator.simulateRotation(dt);

      if (
        player.accelerationFactor !== this.previous.acceleration ||
        ship.orientation !== this.previous.orientation ||
        ship.rotationSpeed !== this.previous.rotation
      ) {
        this.server.movePlayer({
          accelerationFactor: player.accelerationFactor,
          newOrientation: ship.orientation,
          rotationSpeed: ship.rotationSpeed,
        });
      }
      this.previous = {
        acceleration: player.accelerationFactor,
        orientation: ship.orientation,
        rotation: ship.rotationSpeed,
      };

      this.simulator.simulateTranslation(dt);
      this.view.markDirty(player);

      for (const other of this.otherPlayers) radar.push({ controller: other, color: "player" });
      if (this.nextCheckpoint) radar.push({ controller: this.nextCheckpoint, color: "checkpoint" });

      debug += `x: ${Math.trunc(ship.position.x)}\ny: ${Math.trunc(ship.position.y)}\n`;
    }

    this.sincePing += dt;
    if (this.sincePing >= PING_INTERVAL_SECONDS && this.server.state === ConnectionState.CONNECTED) {
      this.sincePing = 0;
      this.server.ping();
    }

    if (rawDt > 0) {
      const sample = 1 / rawDt;
      this.fps = this.fps === undefined ? sample : sample * FPS_SMOOTHING + this.fps * (1 - FPS_SMOOTHING);
    }
    const ping = this.server.pingAverage;
    debug += `ping: ${ping === undefined ? "–" : Math.round(ping)} ms\nFPS: ${Math.round(this.fps ?? 0)}`;
    this.hud?.setDebugText(debug);

    this.view.render(dt, radar);
  }

  // --- IGameClient ---------------------------------------------------------------------

  createPlayer(ship: Movable): void {
    const existing = this.controllers.get(ship.id);
    if (existing) this.view.removeEntity(existing);

    const player = new PlayerController(ship);
    player.isLocalPlayer = true;
    this.localPlayer = player;
    this.controllers.set(ship.id, player);
    this.view.addEntity(player);
    this.view.setLocalPlayer(player);
    this.simulator.reset();
    this.simulator.addMovable(ship);
  }

  updateEntity(entity: Entity): void {
    const existing = this.controllers.get(entity.id);
    if (existing) {
      if (existing.updateFromServer(entity)) this.view.markDirty(existing);
      return;
    }

    const controller = EntityController.create(entity);
    this.controllers.set(entity.id, controller);
    this.view.addEntity(controller);
    if (controller instanceof PlayerController && controller.isNamedShip) {
      this.otherPlayers.add(controller);
      this.hud?.showNotice(`'${entity.displayName}' appearing on our radars.`);
    }
  }

  removeEntity(entityId: number): void {
    const controller = this.controllers.get(entityId);
    if (!controller) return;
    this.view.removeEntity(controller);
    this.controllers.delete(entityId);
    if (controller === this.nextCheckpoint) this.nextCheckpoint = undefined;
    if (controller instanceof PlayerController && this.otherPlayers.delete(controller)) {
      this.hud?.showNotice(`'${controller.entity.displayName}' disappeared from our radars.`);
    }
  }

  handleCollision(entityId: number): void {
    const controller = this.controllers.get(entityId);
    if (!controller) {
      log.warning(`cannot handle collision: no entity ${entityId}`);
      return;
    }
    if (controller instanceof PlayerController) controller.entity.canMove = false;
    this.view.explode(controller);
  }

  joinRace(portalEntityId: number): void {
    const portal = this.controllers.get(portalEntityId);
    if (!(portal instanceof RacePortalController)) {
      log.warning(`RACE_JOIN for unknown portal ${portalEntityId}`);
      return;
    }
    this.racePortal = portal;
    portal.showLeaveButton = true;
    this.view.setRacePortalLeaveable(portal, () => this.onLeaveRace());
    this.hud?.setInRace(true);
  }

  activateNextCheckpoint(checkpointEntityId: number): void {
    this.nextCheckpoint = this.controllers.get(checkpointEntityId) as CheckpointController | undefined;
  }

  leaveRace(): void {
    if (this.racePortal) {
      this.racePortal.showLeaveButton = false;
      this.view.setRacePortalLeaveable(this.racePortal, undefined);
    }
    this.racePortal = undefined;
    this.nextCheckpoint = undefined;
    this.hud?.setInRace(false);
  }
}

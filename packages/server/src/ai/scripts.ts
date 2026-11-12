import { CheckpointState, EntityType, getLogger, type Checkpoint, type Entity, Vector2 } from "@ar/shared";
import type { IGameServer } from "../contracts";
import type { AIGameClient } from "./ai-game-client";
import type { Evaluator } from "./evaluators";
import type { MajorTom } from "./network";
import { TargetVehicleController } from "./target-vehicle-controller";

const log = getLogger("services.ai.Script");

export enum ScriptState {
  READY = "ready",
  RUNNING = "running",
  ENDED = "ended",
}

/** What a script needs from the director running it. */
export interface ScriptHost {
  readonly server: IGameServer | undefined;
  createClient(name?: string): AIGameClient;
  destroyClient(client: AIGameClient): void;
  /** Runs `callback` after `seconds` of game time. */
  schedule(seconds: number, callback: () => void): void;
}

/** A bot behaviour with a lifetime: `run()` resolves when the script has ended. */
export abstract class Script {
  state = ScriptState.READY;
  host!: ScriptHost;
  client: AIGameClient | undefined;
  protected vehicle: TargetVehicleController | undefined;
  private finished: (() => void) | undefined;

  constructor(readonly network: MajorTom) {}

  async run(): Promise<void> {
    if (this.state !== ScriptState.READY) {
      log.warning(`run() called in state ${this.state}`);
      return;
    }
    const client = this.host.createClient(this.botName());
    this.client = client;
    this.vehicle = new TargetVehicleController(client, this.network);
    client.vehicle = this.vehicle;
    this.attach(client);

    const done = new Promise<void>((resolve) => (this.finished = resolve));
    try {
      await client.connect();
    } catch (error) {
      log.info(`bot could not connect: ${String(error)}`);
      this.finish();
      return done;
    }
    client.proxy.onDisconnect(() => this.finish());
    this.state = ScriptState.RUNNING;
    this.started();
    return done;
  }

  /** Called every server frame (after physics) while running. */
  step(_dt: number): void {}

  /** Ends the script and disconnects its bot. Safe to call more than once. */
  stop(): void {
    this.finish();
  }

  protected botName(): string {
    return "Major Tom";
  }

  /** Hook up client callbacks before connecting. */
  protected attach(_client: AIGameClient): void {}

  /** The bot has its ship. */
  protected started(): void {}

  protected finish(): void {
    if (this.state === ScriptState.ENDED) return;
    this.state = ScriptState.ENDED;
    const client = this.client;
    if (client) {
      client.vehicle = undefined;
      client.onEntityUpdate = client.onJoinRace = client.onNextCheckpoint = undefined;
      client.disconnect();
      this.host.destroyClient(client);
    }
    this.client = undefined;
    this.vehicle = undefined;
    this.finished?.();
    this.finished = undefined;
  }
}

/**
 * Racing demo (the Dart RaceTargetScript): fly to the race portal to join, then chase each checkpoint
 * the server announces. Like the original, the bot waits a few seconds before going for a new
 * target, which gives human players a head start. Runs until stopped.
 */
export class RaceTargetScript extends Script {
  constructor(
    network: MajorTom,
    readonly delaySeconds = 5,
    private readonly name = "Major Tom",
  ) {
    super(network);
  }

  protected override botName(): string {
    return this.name;
  }

  protected override attach(client: AIGameClient): void {
    let portalTargeted = false;
    client.onEntityUpdate = (entity) => {
      if (entity.type === EntityType.LAUNCH_PLATFORM && !portalTargeted) {
        portalTargeted = true;
        this.later(() => client.entities.get(entity.id) ?? entity);
      }
    };
    client.onNextCheckpoint = (checkpoint) => {
      if (checkpoint) this.later(() => checkpoint);
    };
  }

  private later(target: () => Entity): void {
    this.host.schedule(this.delaySeconds, () => {
      if (this.state !== ScriptState.ENDED && this.vehicle) this.vehicle.target = target();
    });
  }
}

export interface TrainingScriptOptions {
  /** Where the ship starts each target (RespawnTargetTrainingScript). */
  spawn?: Vector2;
  /** Frames allowed per target (each frame is one server tick). */
  maxFramesPerTarget?: number;
}

/** Default time per target: 4.5 s at the 15 ms server tick. */
export const DEFAULT_FRAMES_PER_TARGET = Math.trunc(4500 / 15);

/**
 * Training run (the Dart RaceTargetTrainingScript): fly through `targets` in order; a target counts as
 * reached inside its radius, or is given up after `maxFramesPerTarget`. An {@link Evaluator} scores the
 * flight; the script ends after the last target.
 */
export class RaceTargetTrainingScript extends Script {
  readonly spawn: Vector2;
  readonly maxFramesPerTarget: number;
  currentTarget: Checkpoint | undefined;
  private nextTargetIndex = 0;
  private frames = 0;

  constructor(
    network: MajorTom,
    readonly targets: readonly Checkpoint[],
    readonly evaluator: Evaluator,
    { spawn = Vector2.zero(), maxFramesPerTarget = DEFAULT_FRAMES_PER_TARGET }: TrainingScriptOptions = {},
  ) {
    super(network);
    this.spawn = spawn;
    this.maxFramesPerTarget = maxFramesPerTarget;
  }

  protected override botName(): string {
    return this.network.name;
  }

  protected override started(): void {
    if (this.targets.length === 0) this.finish();
    else this.runNextTarget();
  }

  override step(_dt: number): void {
    if (this.state !== ScriptState.RUNNING) return;
    const ship = this.client?.ship;
    const target = this.currentTarget;
    if (!ship || !target) return;

    if (ship.position.distanceTo(target.position) < target.radius) {
      this.onTargetFinished();
      return;
    }
    if (this.frames++ >= this.maxFramesPerTarget) this.onTargetFinished();
  }

  /** Positions the ship for the next target (no-op: fly on from wherever we are). */
  protected placeShip(): void {}

  private runNextTarget(): void {
    const target = this.targets[this.nextTargetIndex++]!;
    this.currentTarget = target;
    target.state = CheckpointState.CURRENT;
    target.updateRank += 1;
    this.placeShip();
    if (this.vehicle) this.vehicle.target = target;
    this.frames = 0;
  }

  private onTargetFinished(): void {
    const previous = this.currentTarget;
    if (previous) {
      previous.state = CheckpointState.FUTURE;
      previous.updateRank += 1;
    }
    if (this.nextTargetIndex < this.targets.length) this.runNextTarget();
    else this.finish();
  }

  protected override finish(): void {
    this.currentTarget = undefined;
    super.finish();
  }
}

/** Training variant that teleports the ship back to `spawn`, facing the target's orientation, for every target. */
export class RespawnTargetTrainingScript extends RaceTargetTrainingScript {
  protected override placeShip(): void {
    const server = this.host.server;
    const ship = this.client?.ship;
    const target = this.currentTarget;
    if (!server || !ship || !target) return;
    const proxy = [...server.clients].find((c) => c.movable?.id === ship.id);
    if (proxy) server.teleportPlayerTo(proxy, this.spawn, target.orientation);
  }
}

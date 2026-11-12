import {
  Checkpoint,
  CheckpointState,
  createEnvelope,
  Entity,
  EntityMarshal,
  EntityType,
  MessageType,
  RacePortal,
  Vector2,
} from "@ar/shared";
import { CollisionDetector } from "./collision-detector";
import type { IClientProxy, IGameServer } from "./contracts";

const PORTAL_RADIUS = 100;
const CHECKPOINT_RADIUS = 100;
const START_SLOT_RADIUS = 15;

/**
 * One race: a start portal, a chain of checkpoints and a finish. Checkpoint 0 sits on the portal and
 * the last one on the finish. Each racer's progress is the index of the last checkpoint they touched;
 * clients see per-player checkpoint states via ENTITY messages sent only to them.
 */
export class RaceController {
  readonly checkpoints: Checkpoint[] = [];
  readonly maxPlayers: number;
  private portal: RacePortal | undefined;
  private finishEntity: Entity | undefined;
  /** Racer → index of the last checkpoint they touched. Insertion order = join order. */
  private readonly progress = new Map<IClientProxy, number>();

  constructor(
    private readonly server: IGameServer,
    { maxPlayers = 4 }: { maxPlayers?: number } = {},
  ) {
    this.maxPlayers = maxPlayers;
  }

  get start(): RacePortal | undefined {
    return this.portal;
  }

  get finish(): Entity | undefined {
    return this.finishEntity;
  }

  get players(): IClientProxy[] {
    return [...this.progress.keys()];
  }

  /** Creates the start portal with `maxPlayers` start slots on a half circle, plus checkpoint 0. */
  addStart(x: number, y: number, orientation: number): RacePortal {
    const portal = new RacePortal({ position: new Vector2(x, y), radius: PORTAL_RADIUS, orientation });
    for (let i = 0; i < this.maxPlayers; i++) {
      const angle = Math.PI / 2 - (Math.PI / Math.max(1, this.maxPlayers - 1)) * i;
      // Relative to the portal and *not* rotated: clients position the slot markers themselves;
      // the world position is computed in spawnEntityForPlayer.
      const position = new Vector2(Math.sin(angle), Math.cos(angle)).scale(PORTAL_RADIUS * 0.7);
      portal.positions.push(
        new Entity({ type: EntityType.UNKNOWN, position, radius: START_SLOT_RADIUS, orientation }),
      );
    }
    portal.raceController = this;
    this.portal = portal;
    // Dart passed the radius as orientation here (an old bug); the portal's orientation is what was meant.
    this.addCheckpoint(x, y, orientation);
    return portal;
  }

  addCheckpoint(x: number, y: number, orientation: number, radius = CHECKPOINT_RADIUS): Checkpoint {
    const checkpoint = new Checkpoint({ position: new Vector2(x, y), radius, orientation });
    checkpoint.state = this.checkpoints.length === 0 ? CheckpointState.CURRENT : CheckpointState.FUTURE;
    this.checkpoints.push(checkpoint);
    return checkpoint;
  }

  addFinish(x: number, y: number, orientation: number): void {
    this.finishEntity = new Entity({
      type: EntityType.FINISH,
      position: new Vector2(x, y),
      radius: CHECKPOINT_RADIUS,
      orientation,
    });
    this.addCheckpoint(x, y, orientation);
  }

  /** Advances racers that touch their next checkpoint; finishing restarts the race for that player. */
  update(): void {
    const finished: IClientProxy[] = [];

    for (const [client, lastTouched] of this.progress) {
      const movable = client.movable;
      const next = this.checkpoints[lastTouched + 1];
      if (!movable || !next || CollisionDetector.penetration(movable, next) <= 0) continue;

      this.progress.set(client, lastTouched + 1);
      sendCheckpointUpdate(client, next, CheckpointState.CLEARED);

      const afterNext = this.checkpoints[lastTouched + 2];
      if (afterNext) sendCheckpointUpdate(client, afterNext, CheckpointState.CURRENT);
      else finished.push(client);
    }

    for (const client of finished) this.playerReachedFinish(client);
  }

  isClientInRace(client: IClientProxy): boolean {
    return this.progress.has(client);
  }

  /** Puts the player on a start slot. Returns false when the race is full. */
  addPlayer(client: IClientProxy): boolean {
    if (this.progress.size >= this.maxPlayers || !this.portal) return false;

    client.send(createEnvelope(MessageType.RACE_JOIN, { integer: this.portal.id }));
    this.resetCheckpointsForPlayer(client);

    const spawn = this.spawnEntityForPlayer(client);
    this.server.teleportPlayerTo(client, spawn.position, spawn.orientation);
    return true;
  }

  removePlayer(client: IClientProxy): void {
    if (!this.progress.delete(client)) return;
    client.send(createEnvelope(MessageType.RACE_LEAVE));
  }

  /**
   * Where a racer (re)spawns: their start slot at the beginning (slots are assigned by ship id), or
   * the last checkpoint they touched.
   */
  spawnEntityForPlayer(client: IClientProxy): Entity {
    const lastTouched = this.progress.get(client) ?? 0;
    const portal = this.portal;
    const movable = client.movable;

    if (lastTouched === 0 && portal && movable) {
      const racers = this.players.sort((a, b) => (a.movable?.id ?? 0) - (b.movable?.id ?? 0));
      const slot = portal.positions[racers.indexOf(client)] ?? portal.positions[0];
      const spawn = slot ? slot.clone() : new Entity({ orientation: portal.orientation });
      spawn.radius = movable.radius;
      spawn.position = spawn.position.rotated(portal.orientation).add(portal.position);
      return spawn;
    }
    return this.checkpoints[lastTouched]!;
  }

  private resetCheckpointsForPlayer(client: IClientProxy): void {
    this.progress.set(client, 0);
    this.checkpoints.forEach((checkpoint, i) => {
      const state =
        i === 0 ? CheckpointState.CLEARED : i === 1 ? CheckpointState.CURRENT : CheckpointState.FUTURE;
      sendCheckpointUpdate(client, checkpoint, state);
    });
  }

  private playerReachedFinish(client: IClientProxy): void {
    this.removePlayer(client);
    this.addPlayer(client);
  }
}

/** Tells one client how a checkpoint looks for them; CURRENT also announces it as the next target. */
export function sendCheckpointUpdate(
  client: IClientProxy,
  checkpoint: Checkpoint,
  state: CheckpointState,
): void {
  if (state === CheckpointState.CURRENT) {
    client.send(createEnvelope(MessageType.RACE_EVENT, { integer: checkpoint.id }));
  }
  const view = checkpoint.clone();
  view.state = state;
  client.send(createEnvelope(MessageType.ENTITY, EntityMarshal.toNet(view)));
}

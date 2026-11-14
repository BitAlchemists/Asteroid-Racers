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
/** A ship that moves farther than this in one frame was teleported (respawn): no gate crossing. */
const TELEPORT_JUMP = 300;
/** Who race messages (laps, finish times, warnings) come from in the chat. */
export const RACE_MESSAGE_SENDER = "Race";

/**
 * Optional goal rules of a race (M7). Absent (`{}`) = today's rules: touch the checkpoints in order,
 * no stop at the finish, one lap, no times reported. Per-checkpoint gates come from
 * {@link RaceController.addCheckpoint}; `gates` here turns every other checkpoint into one too.
 */
export interface RaceRules {
  /**
   * Laps (integer ≥ 1, default 1). A lap is checkpoints 1…n−1 and then the finish; the finish ends
   * the race only after the last lap.
   */
  laps?: number;
  /** Stop at the finish: the final finish counts only while the ship is at most this fast (units/s). */
  finishMaxSpeed?: number;
  /** Par time of the whole race in seconds (time trial). */
  par?: number;
  /** Report finish times (implied by `par`). */
  timeTrial?: boolean;
  /** Every checkpoint between the portal and the finish is a directional gate of width 2 × radius. */
  gates?: boolean;
}

/** A racer's finished race, as reported to {@link RaceController.onFinish}. */
export interface RaceFinish {
  /** Seconds of game time from joining the race to the frame the finish counted. */
  time: number;
  par?: number;
  laps: number;
}

/**
 * Does the move `from` → `to` cross the gate at `center`, facing `orientation` (the game's radians:
 * travel direction (−sin, cos)), `width` wide? 1 = crossed in the gate's direction, −1 = backwards,
 * 0 = not crossed (or outside the gate's width). Forwards counts once the centre is on or past the
 * line. Only the ship's centre counts.
 */
export function crossesGate(
  from: Vector2,
  to: Vector2,
  center: Vector2,
  orientation: number,
  width: number,
): -1 | 0 | 1 {
  const dx = -Math.sin(orientation);
  const dy = Math.cos(orientation);
  const s0 = (from.x - center.x) * dx + (from.y - center.y) * dy;
  const s1 = (to.x - center.x) * dx + (to.y - center.y) * dy;
  let direction: -1 | 1;
  if (s0 < 0 && s1 >= 0) direction = 1;
  else if (s0 >= 0 && s1 < 0) direction = -1;
  else return 0;
  const f = s0 / (s0 - s1);
  const qx = from.x + f * (to.x - from.x) - center.x;
  const qy = from.y + f * (to.y - from.y) - center.y;
  // Offset along the gate line, the direction (−dy, dx).
  return Math.abs(-qx * dy + qy * dx) <= width / 2 ? direction : 0;
}

/** The rules in a short phrase for players, e.g. "3 laps · stop at the finish (speed ≤ 120)". */
export function describeRules(rules: RaceRules, gates = 0): string {
  const parts: string[] = [];
  const laps = rules.laps ?? 1;
  if (laps > 1) parts.push(`${laps} laps`);
  if (gates > 0) parts.push(`${gates} directional gate${gates === 1 ? "" : "s"} (cross along the arrow)`);
  if (rules.finishMaxSpeed !== undefined) parts.push(`stop at the finish (speed ≤ ${rules.finishMaxSpeed})`);
  if (rules.par !== undefined) parts.push(`time trial, par ${rules.par.toFixed(1)} s`);
  else if (rules.timeTrial) parts.push("time trial");
  return parts.length === 0 ? "touch the checkpoints in order" : parts.join(" · ");
}

/** "Finished in 42.35 s (par 40.0 s, +2.35 s)." */
export function finishMessage(finish: RaceFinish): string {
  const time = `${finish.time.toFixed(2)} s`;
  if (finish.par === undefined) return `Finished in ${time}.`;
  const delta = finish.time - finish.par;
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "±";
  return `Finished in ${time} (par ${finish.par.toFixed(1)} s, ${sign}${Math.abs(delta).toFixed(2)} s).`;
}

/**
 * One race: a start portal, a chain of checkpoints and a finish. Checkpoint 0 sits on the portal and
 * the last one on the finish. Each racer's progress is their position on the course: the number of
 * checkpoints they cleared, counted over all laps (with one lap, simply the index of the last
 * checkpoint touched). Clients see per-player checkpoint states via ENTITY messages sent only to
 * them. Optional {@link RaceRules} and gates add laps, a stop at the finish, directional gates and
 * par times; without them the race and its messages are exactly the original ones.
 */
export class RaceController {
  readonly checkpoints: Checkpoint[] = [];
  readonly maxPlayers: number;
  private portal: RacePortal | undefined;
  private finishEntity: Entity | undefined;
  private raceRules: RaceRules = {};
  /** Checkpoints added as gates, with their width. */
  private readonly gateWidths = new Map<Checkpoint, number>();
  /** Racer → position on the course (see the class doc). Insertion order = join order. */
  private readonly progress = new Map<IClientProxy, number>();
  /** Racer → ship position on the previous frame (kept only while the race has gates). */
  private readonly lastPositions = new Map<IClientProxy, Vector2>();
  /** Racer → game time when they joined. */
  private readonly startTimes = new Map<IClientProxy, number>();
  /** Racers inside the finish too fast (warned once per visit). */
  private readonly tooFast = new Set<IClientProxy>();
  /**
   * Called when a racer clears their next checkpoint, with their new course position; the last one,
   * {@link courseLength} − 1, is the final finish.
   */
  onCheckpoint: ((client: IClientProxy, position: number) => void) | undefined;
  /** Called when a racer finishes, before the race restarts for them. */
  onFinish: ((client: IClientProxy, finish: RaceFinish) => void) | undefined;

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

  get rules(): Readonly<RaceRules> {
    return this.raceRules;
  }

  /** Sets the race's goal rules (before racers join), after checking them. */
  setRules(rules: RaceRules): void {
    if (rules.laps !== undefined && (!Number.isInteger(rules.laps) || rules.laps < 1))
      throw new Error(`race laps must be an integer ≥ 1, got ${rules.laps}`);
    if (rules.finishMaxSpeed !== undefined && !(rules.finishMaxSpeed > 0))
      throw new Error(`race finishMaxSpeed must be > 0, got ${rules.finishMaxSpeed}`);
    if (rules.par !== undefined && !(rules.par > 0))
      throw new Error(`race par must be > 0, got ${rules.par}`);
    this.raceRules = { ...rules };
  }

  get laps(): number {
    return this.raceRules.laps ?? 1;
  }

  /** Course positions: the portal (0), then every checkpoint after it, once per lap. */
  get courseLength(): number {
    const perLap = this.checkpoints.length - 1;
    return perLap < 1 ? this.checkpoints.length : 1 + perLap * this.laps;
  }

  /** The checkpoint index at a course position. */
  checkpointIndexAt(position: number): number {
    const perLap = this.checkpoints.length - 1;
    return position <= 0 || perLap < 1 ? position : ((position - 1) % perLap) + 1;
  }

  /** The width of checkpoint `index` as a directional gate, or undefined for a plain checkpoint. */
  gateWidth(index: number): number | undefined {
    const checkpoint = this.checkpoints[index];
    if (!checkpoint) return undefined;
    const width = this.gateWidths.get(checkpoint);
    if (width !== undefined) return width;
    return this.raceRules.gates && index > 0 && index < this.checkpoints.length - 1
      ? 2 * checkpoint.radius
      : undefined;
  }

  /** Number of directional gates. */
  get gateCount(): number {
    let n = 0;
    for (let i = 0; i < this.checkpoints.length; i++) if (this.gateWidth(i) !== undefined) n++;
    return n;
  }

  /** True when any goal rule is active (anything beyond today's rules). */
  get hasGoals(): boolean {
    const r = this.raceRules;
    return (
      this.laps > 1 ||
      r.finishMaxSpeed !== undefined ||
      r.par !== undefined ||
      !!r.timeTrial ||
      this.gateCount > 0
    );
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

  /**
   * Adds a checkpoint. With `gateWidth` it is a directional gate: it counts only when a ship's centre
   * crosses the line through it, across `orientation` and `gateWidth` wide, in the direction of
   * `orientation` (see {@link crossesGate}).
   */
  addCheckpoint(
    x: number,
    y: number,
    orientation: number,
    radius = CHECKPOINT_RADIUS,
    gateWidth?: number,
  ): Checkpoint {
    const checkpoint = new Checkpoint({ position: new Vector2(x, y), radius, orientation });
    checkpoint.state = this.checkpoints.length === 0 ? CheckpointState.CURRENT : CheckpointState.FUTURE;
    this.checkpoints.push(checkpoint);
    if (gateWidth !== undefined) {
      if (!(gateWidth > 0)) throw new Error(`gate width must be > 0, got ${gateWidth}`);
      this.gateWidths.set(checkpoint, gateWidth);
    }
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

  /** Advances racers that clear their next checkpoint; finishing restarts the race for that player. */
  update(): void {
    const finished: IClientProxy[] = [];
    const tracksPositions = this.gateWidths.size > 0 || !!this.raceRules.gates;
    const courseLength = this.courseLength;
    const perLap = this.checkpoints.length - 1;

    for (const [client, position] of this.progress) {
      const movable = client.movable;
      let previous: Vector2 | undefined;
      if (tracksPositions) {
        previous = this.lastPositions.get(client);
        if (movable) this.lastPositions.set(client, movable.position.clone());
        else this.lastPositions.delete(client);
        if (previous && movable && previous.distanceTo(movable.position) > TELEPORT_JUMP)
          previous = undefined;
      }
      const nextPosition = position + 1;
      if (nextPosition >= courseLength) continue;
      const index = this.checkpointIndexAt(nextPosition);
      const next = this.checkpoints[index];
      if (!movable || !next) continue;

      const gate = this.gateWidth(index);
      if (gate !== undefined) {
        const crossing = previous
          ? crossesGate(previous, movable.position, next.position, next.orientation, gate)
          : 0;
        if (crossing < 0) this.tell(client, "Wrong way through the gate: cross it along the arrow.");
        if (crossing <= 0) continue;
      } else if (CollisionDetector.penetration(movable, next) <= 0) {
        this.tooFast.delete(client);
        continue;
      }

      const final = nextPosition === courseLength - 1;
      const maxSpeed = this.raceRules.finishMaxSpeed;
      if (final && maxSpeed !== undefined && movable.velocity.length > maxSpeed) {
        if (!this.tooFast.has(client)) {
          this.tooFast.add(client);
          const speed = Math.round(movable.velocity.length);
          this.tell(client, `Too fast for the finish (${speed} > ${maxSpeed}): stop inside it.`);
        }
        continue;
      }
      this.tooFast.delete(client);

      this.progress.set(client, nextPosition);
      this.onCheckpoint?.(client, nextPosition);
      sendCheckpointUpdate(client, next, CheckpointState.CLEARED);

      if (final) {
        finished.push(client);
      } else if (index === perLap) {
        // The finish of a lap that isn't the last: the course starts over at checkpoint 1.
        for (let i = 1; i <= perLap; i++) {
          const state = i === 1 ? CheckpointState.CURRENT : CheckpointState.FUTURE;
          sendCheckpointUpdate(client, this.checkpoints[i]!, state);
        }
        this.tell(client, `Lap ${nextPosition / perLap + 1} of ${this.laps}.`);
      } else {
        sendCheckpointUpdate(client, this.checkpoints[index + 1]!, CheckpointState.CURRENT);
      }
    }

    for (const client of finished) this.playerReachedFinish(client);
  }

  /** The racer's position on the course (0 = the portal), or undefined when not racing. */
  progressOf(client: IClientProxy): number | undefined {
    return this.progress.get(client);
  }

  /** The checkpoint the racer has to clear next, or undefined when not racing (or done). */
  nextCheckpointOf(client: IClientProxy): Checkpoint | undefined {
    const position = this.progress.get(client);
    if (position === undefined || position + 1 >= this.courseLength) return undefined;
    return this.checkpoints[this.checkpointIndexAt(position + 1)];
  }

  isClientInRace(client: IClientProxy): boolean {
    return this.progress.has(client);
  }

  /** Puts the player on a start slot. Returns false when the race is full. */
  addPlayer(client: IClientProxy, { announce = true }: { announce?: boolean } = {}): boolean {
    if (this.progress.size >= this.maxPlayers || !this.portal) return false;

    client.send(createEnvelope(MessageType.RACE_JOIN, { integer: this.portal.id }));
    this.resetCheckpointsForPlayer(client);
    this.startTimes.set(client, this.server.gameTime);
    if (announce && this.hasGoals)
      this.tell(client, `Race rules: ${describeRules(this.raceRules, this.gateCount)}.`);

    const spawn = this.spawnEntityForPlayer(client);
    this.server.teleportPlayerTo(client, spawn.position, spawn.orientation);
    return true;
  }

  removePlayer(client: IClientProxy): void {
    if (!this.progress.delete(client)) return;
    this.lastPositions.delete(client);
    this.startTimes.delete(client);
    this.tooFast.delete(client);
    client.send(createEnvelope(MessageType.RACE_LEAVE));
  }

  /**
   * Where a racer (re)spawns: their start slot at the beginning (slots are assigned by ship id), or
   * the last checkpoint they cleared.
   */
  spawnEntityForPlayer(client: IClientProxy): Entity {
    const position = this.progress.get(client) ?? 0;
    const portal = this.portal;
    const movable = client.movable;

    if (position === 0 && portal && movable) {
      const racers = this.players.sort((a, b) => (a.movable?.id ?? 0) - (b.movable?.id ?? 0));
      const slot = portal.positions[racers.indexOf(client)] ?? portal.positions[0];
      const spawn = slot ? slot.clone() : new Entity({ orientation: portal.orientation });
      spawn.radius = movable.radius;
      spawn.position = spawn.position.rotated(portal.orientation).add(portal.position);
      return spawn;
    }
    return this.checkpoints[this.checkpointIndexAt(position)]!;
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
    const started = this.startTimes.get(client);
    const finish: RaceFinish = {
      time: started === undefined ? 0 : this.server.gameTime - started,
      laps: this.laps,
      ...(this.raceRules.par === undefined ? {} : { par: this.raceRules.par }),
    };
    this.onFinish?.(client, finish);
    if (this.hasGoals) this.tell(client, finishMessage(finish));
    this.removePlayer(client);
    this.addPlayer(client, { announce: false });
  }

  private tell(client: IClientProxy, text: string): void {
    client.send(createEnvelope(MessageType.CHAT, { from: RACE_MESSAGE_SENDER, text }));
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

import type { Checkpoint } from "@ar/shared";
import type { EpisodeSpec } from "./arenas";
import type { AIGameClient } from "./ai-game-client";
import type { MajorTom } from "./network";
import type { EpisodeRecord } from "./scoring";
import { Script, ScriptState } from "./scripts";

/** What to do when the ship crashes: `end` the episode (the rest of it is charged), or `respawn` at its start. */
export type CrashMode = "end" | "respawn";

/** An episode whose targets exist in the world as checkpoints (shared by all candidates). */
export interface PlacedEpisode {
  spec: EpisodeSpec;
  targets: Checkpoint[];
}

/**
 * Flies one candidate through a list of episodes and records what happened in each. Runs after the
 * physics every frame: it first adds to the distance integral, then checks the target and the time
 * limit — the same order the original training script and evaluator used.
 */
export class ArenaScript extends Script {
  readonly records: EpisodeRecord[] = [];
  private episodeIndex = -1;
  private targetIndex = 0;
  private frames = 0;
  private crashed = false;
  private record: EpisodeRecord | undefined;

  constructor(
    network: MajorTom,
    readonly episodes: readonly PlacedEpisode[],
    private readonly crashMode: CrashMode = "end",
    private readonly tickSeconds = 0.015,
  ) {
    super(network);
  }

  get currentTarget(): Checkpoint | undefined {
    return this.episodes[this.episodeIndex]?.targets[this.targetIndex];
  }

  protected override botName(): string {
    return this.network.name;
  }

  protected override attach(client: AIGameClient): void {
    client.onCrash = () => (this.crashed = true);
  }

  protected override started(): void {
    this.nextEpisode();
  }

  override step(dt: number): void {
    if (this.state !== ScriptState.RUNNING) return;
    const ship = this.client?.ship;
    const target = this.currentTarget;
    const record = this.record;
    const episode = this.episodes[this.episodeIndex];
    if (!ship || !target || !record || !episode) return;

    const distance = ship.position.distanceTo(target.position);
    record.distance += (distance + Math.abs(ship.rotationSpeed)) * dt;
    record.frames++;

    if (this.crashed) {
      this.crashed = false;
      record.crashes++;
      if (this.crashMode === "end") {
        const remaining = Math.max(0, episode.spec.timeLimitFrames + 1 - record.frames);
        record.distance += distance * remaining * this.tickSeconds;
        record.frames += remaining;
        this.nextEpisode();
        return;
      }
      // respawn: back to the start; the clock keeps running
      this.placeShip(episode.spec);
    } else {
      const maxSpeed = episode.spec.targets[this.targetIndex]?.maxSpeed;
      if (distance < target.radius && (maxSpeed === undefined || ship.velocity.length <= maxSpeed)) {
        record.reached++;
        this.targetIndex++;
        if (this.targetIndex >= episode.targets.length) this.nextEpisode();
        else if (this.vehicle) this.vehicle.target = this.currentTarget;
        return;
      }
    }
    if (this.frames++ >= episode.spec.timeLimitFrames) this.nextEpisode();
  }

  private nextEpisode(): void {
    if (this.record) this.records.push(this.record);
    this.record = undefined;
    this.episodeIndex++;
    const episode = this.episodes[this.episodeIndex];
    if (!episode) {
      this.finish();
      return;
    }
    this.targetIndex = 0;
    this.frames = 0;
    this.crashed = false;
    this.record = { targets: episode.targets.length, reached: 0, frames: 0, crashes: 0, distance: 0 };
    this.placeShip(episode.spec);
    if (this.vehicle) this.vehicle.target = this.currentTarget;
    if (episode.targets.length === 0) this.nextEpisode();
  }

  private placeShip(spec: EpisodeSpec): void {
    const server = this.host.server;
    const ship = this.client?.ship;
    if (!server || !ship) return;
    const proxy = [...server.clients].find((c) => c.movable?.id === ship.id);
    if (proxy)
      server.teleportPlayerTo(proxy, spec.start.position, spec.start.orientation, spec.start.velocity);
  }
}

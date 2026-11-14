import type { ConnectionState } from "@ar/shared";
import type { EntityController, PlayerController, RacePortalController } from "./controllers";

export type RadarColor = "player" | "checkpoint";

export interface RadarTarget {
  controller: EntityController;
  color: RadarColor;
}

/** Everything the game logic asks of the renderer. Implemented with PixiJS; faked in tests. */
export interface GameView {
  /** Builds the scene layers (called on connect). */
  buildScene(): void;
  /** Tears the scene down (called on disconnect). */
  clearScene(): void;
  addEntity(controller: EntityController): void;
  removeEntity(controller: EntityController): void;
  /** Refreshes the display object from the entity in the next frame. */
  markDirty(controller: EntityController): void;
  setLocalPlayer(controller: PlayerController | undefined): void;
  explode(controller: EntityController): void;
  setRacePortalLeaveable(controller: RacePortalController, onLeave: (() => void) | undefined): void;
  /** Called once per frame after the simulation step. */
  render(dt: number, radarTargets: readonly RadarTarget[]): void;
}

/** The HTML overlay: the game menu, debug readout and chat. */
export interface Hud {
  /** The name to ask the server for (set on the start page). */
  readonly username: string;
  setConnectionState(state: ConnectionState): void;
  /** The connection ended without the player asking, or could not be made: `reason` says which. */
  connectionLost(reason: string): void;
  setDebugText(text: string): void;
  showChat(from: string, text: string): void;
  showNotice(text: string): void;
  setInRace(inRace: boolean): void;
  toggleVisible(): void;
}

/** Callbacks the HUD fires; wired by the game client. */
export interface HudActions {
  onChatSubmit(text: string): void;
  onLeaveRace(): void;
  /** Connect again after the connection was lost. */
  onReconnect(): void;
  /** Close the connection on purpose (leaving the page): no "connection lost" dialog. */
  onQuit(): void;
}

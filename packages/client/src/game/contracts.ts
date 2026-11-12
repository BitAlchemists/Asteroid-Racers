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

/** The HTML overlay: connection controls, debug readout and chat. */
export interface Hud {
  readonly username: string;
  setConnectionState(state: ConnectionState): void;
  setDebugText(text: string): void;
  showChat(from: string, text: string): void;
  showNotice(text: string): void;
  setInRace(inRace: boolean): void;
  toggleVisible(): void;
}

/** Callbacks the HUD fires; wired by the game client. */
export interface HudActions {
  onConnectToggle(): void;
  onChatSubmit(text: string): void;
  onLeaveRace(): void;
}

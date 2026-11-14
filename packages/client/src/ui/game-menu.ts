import { ConnectionState } from "@ar/shared";

/**
 * The in-game menu (D1 follow-up): what the HUD panel and the menu dialog offer, per game mode and
 * connection state. Pure logic, so it is tested without a DOM; `HtmlHud` draws it.
 *
 * - Singleplayer (the server runs in the page): Restart race, Change track, Back to menu.
 * - Multiplayer: Leave race (stay on the server and fly free; the start pad rejoins), Back to menu
 *   (closes the WebSocket first). When the server goes away (restart, deploy) the dialog opens by
 *   itself with Reconnect and Back to menu, instead of a dead canvas.
 */

export type GameMode = "singleplayer" | "multiplayer";

export type MenuAction = "resume" | "leave-race" | "restart" | "change-track" | "reconnect" | "back-to-menu";

export interface MenuState {
  mode: GameMode;
  connection: ConnectionState;
  inRace: boolean;
  /** The connection ended without the player asking (or could not be made); the text says why. */
  lost?: string | undefined;
}

export interface MenuButton {
  action: MenuAction;
  label: string;
  disabled?: boolean;
}

export interface MenuDialog {
  title: string;
  message: string;
  buttons: MenuButton[];
  /** False while the connection is lost: Esc and "Resume" cannot hide the dialog then. */
  dismissable: boolean;
}

export const MENU_LABELS: Record<MenuAction, string> = {
  resume: "Resume",
  "leave-race": "Leave race",
  restart: "Restart race",
  "change-track": "Change track",
  reconnect: "Reconnect",
  "back-to-menu": "Back to menu",
};

const button = (action: MenuAction, disabled = false): MenuButton =>
  disabled ? { action, label: MENU_LABELS[action], disabled } : { action, label: MENU_LABELS[action] };

/** Buttons always on screen in the HUD panel, besides the "Menu" button. */
export function panelButtons(state: MenuState): MenuButton[] {
  if (state.mode === "multiplayer" && state.inRace && state.connection === ConnectionState.CONNECTED)
    return [button("leave-race")];
  return [];
}

/** The menu dialog for the current state. */
export function menuDialog(state: MenuState): MenuDialog {
  if (state.mode === "singleplayer") {
    return {
      title: "Menu",
      message: "Singleplayer: the race runs in this page.",
      buttons: [button("resume"), button("restart"), button("change-track"), button("back-to-menu")],
      dismissable: true,
    };
  }
  if (state.lost !== undefined || state.connection === ConnectionState.DISCONNECTED) {
    const reconnecting = state.connection === ConnectionState.CONNECTING;
    return {
      title: "Disconnected",
      message: reconnecting ? "Reconnecting…" : (state.lost ?? "Not connected to the server."),
      buttons: [
        { ...button("reconnect", reconnecting), ...(reconnecting ? { label: "Reconnecting…" } : {}) },
        button("back-to-menu"),
      ],
      dismissable: false,
    };
  }
  if (state.connection === ConnectionState.CONNECTING) {
    return {
      title: "Menu",
      message: "Connecting to the server…",
      buttons: [button("resume"), button("back-to-menu")],
      dismissable: true,
    };
  }
  return {
    title: "Menu",
    message: state.inRace
      ? "Leave race: you stay on the server and fly free; fly into the green start pad to race again."
      : "You are not in a race: fly into the green start pad to join.",
    buttons: [button("resume"), ...(state.inRace ? [button("leave-race")] : []), button("back-to-menu")],
    dismissable: true,
  };
}

/** Whether the dialog must be open: a lost connection opens it and keeps it open. */
export function menuForcedOpen(state: MenuState): boolean {
  return !menuDialog(state).dismissable;
}

/** Where the page-level actions go; injected so the logic can be tested without a browser. */
export interface MenuNavigation {
  /** The start page. */
  menuUrl: string;
  /** Singleplayer "Change track": the start page's track picker. */
  changeTrackUrl: string;
  navigate(url: string): void;
  reload(): void;
}

/** What the game client does for the menu. */
export interface MenuClient {
  onLeaveRace(): void;
  onReconnect(): void;
  /** Closes the connection on purpose (no "connection lost" dialog). */
  onQuit(): void;
}

/** Runs one menu action. Returns whether the dialog should close afterwards. */
export function runMenuAction(action: MenuAction, client: MenuClient, nav: MenuNavigation): boolean {
  switch (action) {
    case "resume":
      return true;
    case "leave-race":
      client.onLeaveRace();
      return true;
    case "reconnect":
      client.onReconnect();
      return false;
    case "restart":
      nav.reload();
      return false;
    case "change-track":
      client.onQuit();
      nav.navigate(nav.changeTrackUrl);
      return false;
    case "back-to-menu":
      client.onQuit();
      nav.navigate(nav.menuUrl);
      return false;
  }
}

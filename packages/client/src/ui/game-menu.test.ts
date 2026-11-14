import { ConnectionState } from "@ar/shared";
import { describe, expect, it } from "vitest";
import {
  menuDialog,
  menuForcedOpen,
  panelButtons,
  runMenuAction,
  type MenuClient,
  type MenuNavigation,
  type MenuState,
} from "./game-menu";

const { CONNECTED, CONNECTING, DISCONNECTED } = ConnectionState;

const actions = (state: MenuState) => menuDialog(state).buttons.map((b) => b.action);

describe("game menu — singleplayer", () => {
  const racing: MenuState = { mode: "singleplayer", connection: CONNECTED, inRace: true };

  it("offers restart, change track and the start page; never disconnect or leave race", () => {
    expect(actions(racing)).toEqual(["resume", "restart", "change-track", "back-to-menu"]);
    expect(actions({ ...racing, inRace: false })).toEqual(actions(racing));
    expect(panelButtons(racing)).toEqual([]);
    expect(menuDialog(racing).dismissable).toBe(true);
  });

  it("is never forced open", () => {
    expect(menuForcedOpen({ ...racing, connection: DISCONNECTED })).toBe(false);
  });
});

describe("game menu — multiplayer", () => {
  const flying: MenuState = { mode: "multiplayer", connection: CONNECTED, inRace: false };

  it("in a race: Leave race in the panel and in the menu", () => {
    const racing = { ...flying, inRace: true };
    expect(panelButtons(racing).map((b) => b.action)).toEqual(["leave-race"]);
    expect(actions(racing)).toEqual(["resume", "leave-race", "back-to-menu"]);
    expect(menuDialog(racing).message).toMatch(/start pad/);
  });

  it("flying free: no Leave race; the menu says how to join", () => {
    expect(panelButtons(flying)).toEqual([]);
    expect(actions(flying)).toEqual(["resume", "back-to-menu"]);
    expect(menuDialog(flying).message).toMatch(/start pad to join/);
  });

  it("while connecting: resume or go back", () => {
    const state = { ...flying, connection: CONNECTING };
    expect(actions(state)).toEqual(["resume", "back-to-menu"]);
    expect(menuForcedOpen(state)).toBe(false);
  });

  it("a lost connection forces the dialog open with Reconnect and Back to menu", () => {
    const lost: MenuState = {
      ...flying,
      connection: DISCONNECTED,
      lost: "The connection to the server was lost.",
    };
    const dialog = menuDialog(lost);
    expect(dialog.title).toBe("Disconnected");
    expect(dialog.message).toBe("The connection to the server was lost.");
    expect(actions(lost)).toEqual(["reconnect", "back-to-menu"]);
    expect(dialog.dismissable).toBe(false);
    expect(menuForcedOpen(lost)).toBe(true);
    expect(panelButtons({ ...lost, inRace: true })).toEqual([]);
  });

  it("reconnecting disables Reconnect until the connection is back", () => {
    const state: MenuState = { ...flying, connection: CONNECTING, lost: "gone" };
    const [reconnect, back] = menuDialog(state).buttons;
    expect(reconnect).toEqual({ action: "reconnect", label: "Reconnecting…", disabled: true });
    expect(back?.disabled).toBeUndefined();
    expect(menuDialog(state).message).toBe("Reconnecting…");
    expect(menuForcedOpen(state)).toBe(true);
  });
});

describe("runMenuAction", () => {
  function fakes() {
    const calls: string[] = [];
    const client: MenuClient = {
      onLeaveRace: () => calls.push("leave"),
      onReconnect: () => calls.push("reconnect"),
      onQuit: () => calls.push("quit"),
    };
    const nav: MenuNavigation = {
      menuUrl: "index.html",
      changeTrackUrl: "index.html#track-heading",
      navigate: (url) => calls.push(`go ${url}`),
      reload: () => calls.push("reload"),
    };
    return { calls, client, nav };
  }

  it("Back to menu closes the connection before leaving the page", () => {
    const { calls, client, nav } = fakes();
    expect(runMenuAction("back-to-menu", client, nav)).toBe(false);
    expect(calls).toEqual(["quit", "go index.html"]);
  });

  it("Change track goes to the start page's track picker", () => {
    const { calls, client, nav } = fakes();
    runMenuAction("change-track", client, nav);
    expect(calls).toEqual(["quit", "go index.html#track-heading"]);
  });

  it("Restart reloads; Leave race and Resume close the menu; Reconnect keeps it open", () => {
    const { calls, client, nav } = fakes();
    expect(runMenuAction("restart", client, nav)).toBe(false);
    expect(runMenuAction("leave-race", client, nav)).toBe(true);
    expect(runMenuAction("resume", client, nav)).toBe(true);
    expect(runMenuAction("reconnect", client, nav)).toBe(false);
    expect(calls).toEqual(["reload", "leave", "reconnect"]);
  });
});

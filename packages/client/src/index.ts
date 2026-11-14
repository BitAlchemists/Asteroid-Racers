import type { ServerConnection } from "@ar/shared";
import { Application } from "pixi.js";
import { GameClient } from "./game/game-client";
import { bindKeyboard } from "./game/keyboard-input";
import { bindTouch, wantsTouchControls } from "./game/touch-input";
import { PixiGameView, type PixiGameViewOptions } from "./render/pixi-game-view";
import { HtmlHud } from "./ui/html-hud";

export { GameClient } from "./game/game-client";
export * from "./game/contracts";
export * from "./game/controllers";
export { PixiGameView } from "./render/pixi-game-view";
export { HtmlHud } from "./ui/html-hud";
export * from "./game/touch-input";

export interface StartGameOptions extends PixiGameViewOptions {
  /** Creates a fresh connection for each (re)connect. */
  connection: () => ServerConnection;
  /** Where the canvas and HUD go. Defaults to document.body. */
  parent?: HTMLElement;
  /** Connect right away (as the Dart client did). */
  autoConnect?: boolean;
}

export interface RunningGame {
  app: Application;
  client: GameClient;
  hud: HtmlHud;
  destroy(): void;
}

/** World scale on a touch screen: small screens see about 700 units across their short side. */
export function phoneZoom(width: number, height: number): number {
  return Math.min(1, Math.max(0.55, Math.min(width, height) / 700));
}

/** Boots the full-window PixiJS client with HUD and keyboard controls. */
export async function startGame({
  connection,
  parent = document.body,
  autoConnect = true,
  ...viewOptions
}: StartGameOptions): Promise<RunningGame> {
  const touchUi = wantsTouchControls(window);
  const app = new Application();
  await app.init({
    background: "#000000",
    resizeTo: window,
    antialias: true,
    // Sharp on phone screens; desktops render as before.
    ...(touchUi ? { resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true } : {}),
  });
  app.canvas.classList.add("game-canvas");
  parent.append(app.canvas);

  const view = new PixiGameView(app, viewOptions);
  const client = new GameClient(view, connection);
  const hud = new HtmlHud(parent, client);
  client.attachHud(hud);

  const unbindKeys = bindKeyboard(window, client, () => hud.toggleVisible());
  // Phones and tablets (or `?touch`): a touch layer under the HUD, and the world zoomed out a bit.
  const touch = touchUi ? bindTouch(parent, client, hud.root) : undefined;
  app.ticker.add((ticker) => {
    if (touch) {
      const { width, height } = app.screen;
      view.zoom = phoneZoom(width, height);
      touch.update(ticker.deltaMS / 1000);
    }
    client.update(ticker.deltaMS / 1000);
  });

  if (autoConnect) void client.connect();

  return {
    app,
    client,
    hud,
    destroy() {
      unbindKeys();
      touch?.destroy();
      client.disconnect();
      hud.root.remove();
      app.destroy(true, { children: true });
    },
  };
}

export { ReplayController, SPEEDS } from "./replay/replay-controller";
export { ReplayView, type CameraMode } from "./replay/replay-view";
export { mountReplayViewer, type ReplayViewer, type ReplayViewerOptions } from "./replay/replay-viewer";

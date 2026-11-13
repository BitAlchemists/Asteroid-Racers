import type { ServerConnection } from "@ar/shared";
import { Application } from "pixi.js";
import { GameClient } from "./game/game-client";
import { bindKeyboard } from "./game/keyboard-input";
import { PixiGameView, type PixiGameViewOptions } from "./render/pixi-game-view";
import { HtmlHud } from "./ui/html-hud";

export { GameClient } from "./game/game-client";
export * from "./game/contracts";
export * from "./game/controllers";
export { PixiGameView } from "./render/pixi-game-view";
export { HtmlHud } from "./ui/html-hud";

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

/** Boots the full-window PixiJS client with HUD and keyboard controls. */
export async function startGame({
  connection,
  parent = document.body,
  autoConnect = true,
  ...viewOptions
}: StartGameOptions): Promise<RunningGame> {
  const app = new Application();
  await app.init({ background: "#000000", resizeTo: window, antialias: true });
  app.canvas.classList.add("game-canvas");
  parent.append(app.canvas);

  const view = new PixiGameView(app, viewOptions);
  const client = new GameClient(view, connection);
  const hud = new HtmlHud(parent, client);
  client.attachHud(hud);

  const unbindKeys = bindKeyboard(window, client, () => hud.toggleVisible());
  app.ticker.add((ticker) => client.update(ticker.deltaMS / 1000));

  if (autoConnect) void client.connect();

  return {
    app,
    client,
    hud,
    destroy() {
      unbindKeys();
      client.disconnect();
      hud.root.remove();
      app.destroy(true, { children: true });
    },
  };
}

export { ReplayController, SPEEDS } from "./replay/replay-controller";
export { ReplayView, type CameraMode } from "./replay/replay-view";
export { mountReplayViewer, type ReplayViewer, type ReplayViewerOptions } from "./replay/replay-viewer";

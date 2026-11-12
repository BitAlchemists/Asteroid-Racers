import { Application, Text } from "pixi.js";

/**
 * Phase 0 placeholder: boots a full-window PixiJS stage. The real GameClient
 * (renderer, controllers, views, GUI) replaces this in phase 4.
 */
export async function bootStage(mode: string): Promise<Application> {
  const app = new Application();
  await app.init({ background: "#000000", resizeTo: window, antialias: true });
  document.body.appendChild(app.canvas);

  const label = new Text({
    text: `Asteroid Racers — ${mode}\nEstablishing satellite connection...`,
    style: { fill: "#ffffff", fontFamily: "Open Sans, sans-serif", fontSize: 24, align: "center" },
  });
  label.anchor.set(0.5);
  const center = () => label.position.set(app.screen.width / 2, app.screen.height / 2);
  center();
  app.renderer.on("resize", center);
  app.stage.addChild(label);

  return app;
}

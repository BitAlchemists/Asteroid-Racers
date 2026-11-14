import { startGame } from "@ar/client";
import { WebSocketServerConnection } from "@ar/shared";

// Multiplayer: talk to the Node game server. In development Vite proxies /ws to it; in production
// the game server serves this page itself, so the same origin works in both cases.
const scheme = location.protocol === "https:" ? "wss" : "ws";
const params = new URLSearchParams(location.search);
const base = params.get("server") ?? `${scheme}://${location.host}/ws`;
// `?opponent=<showcase model id>` asks the shared server to switch its racing bots to that model.
const opponent = params.get("opponent");
const url = opponent
  ? `${base}${base.includes("?") ? "&" : "?"}opponent=${encodeURIComponent(opponent)}`
  : base;

await startGame({
  connection: () => new WebSocketServerConnection(url),
  debugCollisions: params.has("collisions"),
});

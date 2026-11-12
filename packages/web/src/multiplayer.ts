import { startGame } from "@ar/client";
import { WebSocketServerConnection } from "@ar/shared";

// Multiplayer: talk to the Node game server. In development Vite proxies /ws to it; in production
// the game server serves this page itself, so the same origin works in both cases.
const scheme = location.protocol === "https:" ? "wss" : "ws";
const url = new URLSearchParams(location.search).get("server") ?? `${scheme}://${location.host}/ws`;

await startGame({
  connection: () => new WebSocketServerConnection(url),
  debugCollisions: new URLSearchParams(location.search).has("collisions"),
});

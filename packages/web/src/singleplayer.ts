import { startGame } from "@ar/client";
import { ChatServer, GameServer, LocalServerConnection, RealtimeGameLoop } from "@ar/server";

// Singleplayer: the authoritative server runs right here in the page.
const server = new GameServer().prepareDemoConfiguration();
server.registerService(new ChatServer());
// AI racers join here once the AI service is ported (phase 5).
await server.start(new RealtimeGameLoop());

const debug = new URLSearchParams(location.search);
await startGame({
  // `?encode` round-trips every message through protobuf, like the network would (catches codec bugs).
  connection: () => new LocalServerConnection(server, { encode: debug.has("encode") }),
  debugCollisions: debug.has("collisions"),
});

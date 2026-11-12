import { startGame } from "@ar/client";
import {
  ChatServer,
  GameServer,
  LocalServerConnection,
  RealtimeGameLoop,
  registerAIRacingService,
} from "@ar/server";

const params = new URLSearchParams(location.search);

// Singleplayer: the authoritative server runs right here in the page, with a racing bot to beat
// (`?bots=n` for more or none).
const server = new GameServer().prepareDemoConfiguration();
server.registerService(new ChatServer());
const bots = params.has("bots") ? Math.max(0, Number(params.get("bots")) || 0) : 1;
if (bots > 0) registerAIRacingService(server, undefined, { bots });
await server.start(new RealtimeGameLoop());

await startGame({
  // `?encode` round-trips every message through protobuf, like the network would (catches codec bugs).
  connection: () => new LocalServerConnection(server, { encode: params.has("encode") }),
  debugCollisions: params.has("collisions"),
});

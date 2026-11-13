import { startGame } from "@ar/client";
import {
  ChatServer,
  GameServer,
  LocalServerConnection,
  RealtimeGameLoop,
  registerAIRacingService,
  TRACKS,
} from "@ar/server";

const params = new URLSearchParams(location.search);

// Singleplayer: the authoritative server runs right here in the page, with a racing bot to beat
// (`?bots=n` for more or none) on the track `?track=<name>` (default demo; the menu offers them all).
const trackName = params.get("track") ?? "demo";
const track = TRACKS[trackName];
if (!track) console.warn(`unknown track ${JSON.stringify(trackName)}, racing demo instead`);
const server = new GameServer().loadTrack(track ?? TRACKS.demo!);
server.registerService(new ChatServer());
const bots = params.has("bots") ? Math.max(0, Number(params.get("bots")) || 0) : 1;
if (bots > 0) registerAIRacingService(server, undefined, { bots });
await server.start(new RealtimeGameLoop());

await startGame({
  // `?encode` round-trips every message through protobuf, like the network would (catches codec bugs).
  connection: () => new LocalServerConnection(server, { encode: params.has("encode") }),
  debugCollisions: params.has("collisions"),
});

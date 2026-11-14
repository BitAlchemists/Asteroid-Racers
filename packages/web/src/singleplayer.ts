import { startGame } from "@ar/client";
import {
  ChatServer,
  GameServer,
  LocalServerConnection,
  parseRaceModes,
  RealtimeGameLoop,
  registerAIRacingService,
  TRACKS,
  withRaceRules,
  type RaceRules,
} from "@ar/server";

const params = new URLSearchParams(location.search);

// Singleplayer: the authoritative server runs right here in the page, with a racing bot to beat
// (`?bots=n` for more or none) on the track `?track=<name>` (default demo; the menu offers them all).
// Race modes (`?laps=3&stop=100&gates&par=45&timetrial`, see race-modes.ts) override the track's rules.
const trackName = params.get("track") ?? "demo";
const track = TRACKS[trackName];
if (!track) console.warn(`unknown track ${JSON.stringify(trackName)}, racing demo instead`);
let modes: RaceRules = {};
try {
  modes = parseRaceModes(params);
} catch (error) {
  console.warn(`${String(error)}; racing with the track's own rules`);
}
const server = new GameServer().loadTrack(withRaceRules(track ?? TRACKS.demo!, modes));
server.registerService(new ChatServer());
const bots = params.has("bots") ? Math.max(0, Number(params.get("bots")) || 0) : 1;
if (bots > 0) registerAIRacingService(server, undefined, { bots });
await server.start(new RealtimeGameLoop());

await startGame({
  // `?encode` round-trips every message through protobuf, like the network would (catches codec bugs).
  connection: () => new LocalServerConnection(server, { encode: params.has("encode") }),
  debugCollisions: params.has("collisions"),
});

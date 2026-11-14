import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Level, setLogLevel } from "@ar/shared";
import { createDefaultGameServer, DEFAULT_PORT, startHost } from "./host";
import { RACE_ROTATION } from "./track-categories";
import { DEFAULT_ROUND_SECONDS } from "./track-lobby";

setLogLevel("", Level.INFO);

const here = dirname(fileURLToPath(import.meta.url));
const webDist = resolve(here, "../../web/dist");
const port = Number(process.env.PORT) || DEFAULT_PORT;

if (!existsSync(webDist)) {
  console.warn(
    `No built web client at ${webDist} — run "npm run build" to serve it here, ` +
      `or use "npm run dev" (Vite proxies /ws to this server).`,
  );
}

// BOTS=n sets the number of racing bots (default 1, 0 for none).
const bots = process.env.BOTS === undefined ? 1 : Math.max(0, Number(process.env.BOTS) || 0);
// TRACK unset (or "rotation"): rotate through the race tracks with player votes, starting with demo.
// TRACK=<name>: that one track, fixed, no rotation (any track of the registry in @ar/server).
// ROUND_SECONDS: the longest round on one track when nobody finishes (default 240).
const trackEnv = process.env.TRACK?.trim() || "rotation";
const roundSeconds = Number(process.env.ROUND_SECONDS) || DEFAULT_ROUND_SECONDS;
const host = await startHost({
  port,
  staticRoots: [webDist],
  gameServer:
    trackEnv === "rotation"
      ? createDefaultGameServer({ bots, rotation: RACE_ROTATION, roundSeconds })
      : createDefaultGameServer({ bots, track: trackEnv }),
});

const shutdown = (signal: string) => {
  console.log(`${signal} received, shutting down`);
  host.close().then(
    () => process.exit(0),
    (error: unknown) => {
      console.error(error);
      process.exit(1);
    },
  );
};
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

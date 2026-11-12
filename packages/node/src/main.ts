import { proto } from "@ar/shared";
import { SERVER_PACKAGE } from "@ar/server";

// Phase 0 placeholder. The HTTP + WebSocket host (replacing legacy tcp_server) lands in phase 3.
console.log(
  `Asteroid Racers node host placeholder — ${SERVER_PACKAGE} wired up, ` +
    `${Object.keys(proto.MessageType).filter((k) => isNaN(Number(k))).length} message types known.`,
);

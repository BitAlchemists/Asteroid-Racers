import { createDemoServer } from "@ar/server";

// Phase 2 placeholder: builds the demo world. The HTTP + WebSocket host (replacing legacy tcp_server)
// lands in phase 3.
const server = createDemoServer();
console.log(
  `Asteroid Racers: demo world ready with ${server.world.entities.size} entities ` +
    `(${server.raceController?.checkpoints.length ?? 0} race checkpoints). Network host arrives in phase 3.`,
);

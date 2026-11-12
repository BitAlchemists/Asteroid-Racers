import { describe, expect, it } from "vitest";
import { AIGameClient } from "./ai/ai-game-client";
import { GameServer } from "./game-server";
import { LocalServerConnection } from "./local-connection";
import { seededRandom } from "./random";

/**
 * Leak audit (phase 6): the Dart server leaked memory per connection (the `aahhh` branch). Here we
 * churn through many clients doing everything a player can do and check that the server's
 * bookkeeping returns exactly to where it started.
 */
describe("soak: connection churn leaves nothing behind", () => {
  it.each(["sync", "microtask"] as const)("300 clients with %s delivery", async (delivery) => {
    const server = new GameServer({ random: seededRandom(1) }).prepareDemoConfiguration();
    const baseline = server.stats();
    const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
    const random = seededRandom(2);
    let peakRacers = 0;
    let peakTimers = 0;

    for (let round = 0; round < 30; round++) {
      const bots = Array.from(
        { length: 10 },
        (_, i) => new AIGameClient(new LocalServerConnection(server, { delivery }), `Bot ${round}.${i}`),
      );
      await Promise.all(bots.map((bot) => bot.connect()));

      for (const proxy of server.clients) {
        const roll = random();
        if (roll < 0.3)
          server.teleportPlayerTo(proxy, server.world.passiveCollisionEntities[0]!.position, 0); // crash
        else if (roll < 0.6) server.teleportPlayerTo(proxy, server.raceController!.start!.position, 0); // race
      }
      for (let t = 0; t < 10; t++) {
        server.tick();
        for (const bot of bots) bot.proxy.movePlayer({ accelerationFactor: 1, rotationSpeed: 1 });
        bots[0]!.proxy.ping();
      }
      await flush();
      const busy = server.stats();
      peakRacers = Math.max(peakRacers, busy.racers!);
      peakTimers = Math.max(peakTimers, busy.timers!);
      // Leave in the middle of everything: crashed (respawn pending), racing, flying.
      for (const bot of bots) bot.disconnect();
      await flush();
    }

    // The churn really exercised races and pending respawns.
    expect(peakRacers).toBeGreaterThan(0);
    expect(peakTimers).toBeGreaterThan(0);

    // Let pending respawn timers run out.
    for (let t = 0; t < 100; t++) server.tick();
    expect(server.stats()).toEqual(baseline);
  });
});

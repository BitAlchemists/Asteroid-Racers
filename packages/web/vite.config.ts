import { resolve } from "node:path";
import { defineConfig } from "vite";

/** Where `npm run server` listens; the dev server forwards WebSocket traffic there. */
const gameServerPort = Number(process.env.GAME_SERVER_PORT) || 1337;

export default defineConfig({
  // Relative URLs, so the build works from any sub-path (e.g. GitHub Pages under /Asteroid-Racers/).
  base: "./",
  server: {
    port: Number(process.env.PORT) || 5180,
    strictPort: true,
    proxy: {
      "/ws": { target: `ws://localhost:${gameServerPort}`, ws: true },
      "/lobby": { target: `http://localhost:${gameServerPort}` },
    },
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, "index.html"),
        singleplayer: resolve(import.meta.dirname, "singleplayer.html"),
        multiplayer: resolve(import.meta.dirname, "multiplayer.html"),
        watch: resolve(import.meta.dirname, "watch.html"),
        showcase: resolve(import.meta.dirname, "showcase.html"),
      },
    },
  },
});

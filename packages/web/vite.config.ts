import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  server: { port: Number(process.env.PORT) || 5180, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, "index.html"),
        singleplayer: resolve(import.meta.dirname, "singleplayer.html"),
        multiplayer: resolve(import.meta.dirname, "multiplayer.html"),
      },
    },
  },
});

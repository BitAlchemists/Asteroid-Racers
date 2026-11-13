import { resolve } from "node:path";
import { defineConfig } from "vite";

/**
 * Builds the evo-lab renderer plugin into <repo>/dist/lab-plugin/render.js (an ES module; chunks load
 * relative to it). lab.config.json declares it under "ui". evo-lab serves the folder as it is on disk.
 */
export default defineConfig({
  base: "./",
  build: {
    outDir: resolve(import.meta.dirname, "../../dist/lab-plugin"),
    emptyOutDir: true,
    lib: {
      entry: resolve(import.meta.dirname, "src/render.ts"),
      formats: ["es"],
      fileName: () => "render.js",
    },
    target: "es2022",
  },
});

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
    rolldownOptions: {
      output: {
        // Every third-party module (PixiJS above all) in one vendor chunk that render.js imports.
        // evo-lab's "Reload plugin" re-imports render.js with a cache-busting query but keeps the
        // chunks it imports: render.js must hold no PixiJS module, or its top-level extension
        // registrations run a second time against the cached registry ("Extension type application
        // already has a handler"). The vendor chunk's name only changes with its content, so a
        // reload reuses the evaluated one.
        codeSplitting: { groups: [{ name: "vendor", test: /[\\/]node_modules[\\/]/ }] },
      },
    },
  },
});

// Bundles the multiplayer host (packages/node/src/main.ts) into one ESM file for the container
// image: packages/node/dist/main.mjs. Workspace packages, `ws`, the protobuf runtime and the JSON
// imports (tracks, bundled model) all end up in it, so the runtime image needs no node_modules
// and no tsx. The output keeps main.ts's relative path to the web client (../../web/dist).
import { build } from "esbuild";

await build({
  entryPoints: ["packages/node/src/main.ts"],
  outfile: "packages/node/dist/main.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  legalComments: "linked",
  // Optional native speed-ups that `ws` tries to require inside try/catch.
  external: ["bufferutil", "utf-8-validate"],
  // `ws` is CommonJS and requires Node built-ins; give the ESM bundle a real `require`.
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
  logLevel: "info",
});

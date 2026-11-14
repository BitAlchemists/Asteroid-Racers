# Asteroid Racers multiplayer host: the web client over HTTP and the game at /ws on one port.
#
#   docker build -t asteroid-racers .
#   docker run --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges \
#     -p 1337:1337 asteroid-racers
#
# Env: PORT (default 1337), BOTS (racing bots, default 1), TRACK (default demo).
# Health: GET /health -> 200 {"status":"ok","clients":..,"frame":..,"uptimeS":..}.
# See doc/deploy.md.

# Keep in step with .nvmrc (major version).
ARG NODE_VERSION=22

# ---- build: install everything, build the web client, bundle the server ----
FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
COPY packages/node/package.json packages/node/
COPY packages/web/package.json packages/web/
COPY packages/lab-plugin/package.json packages/lab-plugin/
RUN npm ci --no-audit --no-fund
COPY . .
# The web client (packages/web/dist), then the host as one ESM file (packages/node/dist/main.mjs)
# with every dependency and JSON import (tracks, bundled model) inside: no node_modules at runtime.
RUN npm run build && npm run build:server

# ---- runtime: Node and two build outputs, nothing else ----
FROM node:${NODE_VERSION}-alpine AS runtime
# The server never needs a package manager; dropping them shrinks the image and the scan surface.
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx \
      /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-*
ENV NODE_ENV=production \
    PORT=1337
WORKDIR /app
# Same relative layout as the repo: main.mjs finds the client at ../../web/dist.
COPY --from=build /src/packages/node/dist/ packages/node/dist/
COPY --from=build /src/packages/web/dist/ packages/web/dist/
# Non-root (the image's `node` user, uid/gid 1000). Files stay root-owned and read-only to it;
# the server writes nothing, so a read-only root filesystem works.
USER node
EXPOSE 1337
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||1337)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "--enable-source-maps", "packages/node/dist/main.mjs"]

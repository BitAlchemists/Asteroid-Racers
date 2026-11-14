# Deploying Asteroid Racers

The game runs online at https://asteroid-racers.cypherpunk.agency as one container: the web client
over HTTP and the game at `/ws` (WebSocket) on one port. The server side (Caddy for TLS, docker
compose, the deploy command) belongs to the Infra session; this repo provides the image and the
workflow that builds it.

## Image

- `ghcr.io/bitalchemists/asteroid-racers:<commit sha>`, built from the root `Dockerfile`.
- Build stage: `npm ci`, `npm run build` (web client), `npm run build:server`. The last one bundles
  `packages/node/src/main.ts` with esbuild into one file, `packages/node/dist/main.mjs`, which
  holds all dependencies and the JSON imports (tracks, bundled model).
- Runtime stage: `node:22-alpine` (major version from `.nvmrc`) without npm/yarn, plus the bundle
  and `packages/web/dist`. No `node_modules`, no tsx, no sources. About 62 MB.
- Runs as the non-root `node` user (uid/gid 1000). It writes nothing to disk, so it runs with a
  read-only root filesystem, `cap_drop: [ALL]` and `no-new-privileges`. No writable paths are
  needed; a tmpfs at `/tmp` is fine but unused.
- Local build and run:

  ```sh
  docker build -t asteroid-racers .
  docker run --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges \
    -p 1337:1337 asteroid-racers
  ```

  The image needs no buildx (`DOCKER_BUILDKIT=0` works).

## Environment

| Variable        | Default    | Meaning                                                                    |
| --------------- | ---------- | -------------------------------------------------------------------------- |
| `PORT`          | `1337`     | HTTP and WebSocket port                                                    |
| `BOTS`          | `1`        | AI racing bots in the world (`0` for none)                                 |
| `TRACK`         | `rotation` | `rotation`: the race tracks in turn, with votes; `<name>`: that track only |
| `ROUND_SECONDS` | `240`      | rotation only: the longest round on one track when nobody finishes         |

`TRACK` unset (or `rotation`) is the live default since the D1 follow-up of 2026-11-14 (it used to be
`demo`, fixed). `TRACK=<name>` (any track of the registry in `@ar/server`, e.g. `TRACK=demo`) keeps
one fixed track with no rotation and no voting, as before.

### Track rotation

The race tracks (`packages/node/src/track-categories.ts`: demo, canyon, gauntlet, circuit, random,
generated:easy, generated:medium, generated:hard) are played in that order. Skill tracks are for
singleplayer only.

- A round on a track ends at the first finish (bots count) or after `ROUND_SECONDS` of game time.
- The track then switches as soon as no human is racing. A human counts as racing once they have
  left their start slot or cleared a checkpoint; someone waiting on the start grid (for example
  just after a finish) is carried to the new track's grid. While the switch waits, the chat says
  "… It starts when the current race is over." An idle racer away from the grid holds the
  rotation until they leave the race or disconnect.
- Players vote with `/vote <track>` in the chat or the "Vote next track" box on the multiplayer
  page; one vote per player, gone when they disconnect; most votes wins, ties go to rotation
  order; votes reset at each switch. `/tracks` shows the state.
- Bots restart on the new track with the model they flew; the opponent choice is kept.
- `GET /lobby` returns the state as JSON (current and next track, votes, whether the switch is
  waiting); for a fixed track `{ "fixed": true, "current": … }`. It only reads counters, like
  `/health`. The multiplayer page polls it every 4 s.

Bots use the bundled model (`packages/server/src/ai/models/`); the container has no `db/`.

## Health

`GET /health` (or `HEAD`) always answers 200 while the process serves HTTP, with a small JSON body:

```json
{ "status": "ok", "clients": 1, "frame": 1585, "uptimeS": 23 }
```

`clients` counts connected clients including the AI bots; `frame` is the simulation frame, so a
stuck game loop shows as a frame that stops growing. The handler only reads counters; it is safe to
probe every 30 s. A degraded state is reported in the body, never as a 5xx. The image has a
`HEALTHCHECK` that probes it with Node's `fetch`.

## Multiplayer

All players share one world in one process: whoever opens `multiplayer.html` joins the same game,
sees the other ships and can chat and race. The page derives its WebSocket URL from its own location
(`wss://<host>/ws` on https, `ws://` on http), so behind Caddy it uses `wss://` with no
configuration. Tested through the image on 2026-11-14: two headless players joined, each received
the other's ship, chat was relayed, and the browser client played through the container.

Limits and timeouts, as the code stands:

- **No cap on clients.** Each one costs simulation and bandwidth: the server sends entity updates
  to every client every tick. A race has 4 start slots (`RaceController`'s `maxPlayers`); more
  players can fly the world but not join that race.
- **Message size:** client messages over 64 KiB close the socket (`MAX_MESSAGE_BYTES`). A client
  that falls behind by more than 4 MiB of queued updates is disconnected (`MAX_BUFFERED_BYTES`).
- **No idle timeout and no server-side heartbeat.** The server never closes a quiet client, and a
  connection is busy anyway (updates every tick). A dead client whose TCP connection never closes
  is only dropped when its send buffer passes 4 MiB. The client's ping is for the latency display.
- **State is in memory.** A deploy or restart disconnects everyone; the client then has to
  reconnect. One replica only: a second container would be a second, separate world.
- **No Origin check and no rate limits** on `/ws`; there are no accounts, so nothing to steal, but
  any site could open sockets to the game.
- **Caddy** (Infra): `reverse_proxy` forwards WebSocket upgrades by itself and has no idle timeout
  on upgraded connections. On a config reload it closes them at once unless `stream_close_delay` is
  set (for example `stream_close_delay 5m`), so every reload drops all players.

## Releasing: the `production` branch

- `ci.yml` checks every push, as before.
- `.github/workflows/deploy.yml` runs only on a push to `production` (or by hand,
  `workflow_dispatch`): `npm ci`, `npm run check`, docker build, Trivy scan (fails on HIGH or
  CRITICAL findings that have a fix), push to ghcr.io tagged with the commit sha. The pushed digest
  is a job output and appears in the run's summary.
- The `deploy` job (supplied by Infra, infra@cc8391c) then logs in keyless through Workload
  Identity Federation (only this repo on `refs/heads/production` is admitted), runs
  `ssh web-server "deploy asteroid-racers sha256:<digest>"` through an IAP tunnel to the VM's
  forced-command deploy gate, and checks `/health` and `/` on
  https://asteroid-racers.cypherpunk.agency. The gate waits for a healthy container and fails if the
  running image isn't the digest. It needs the repo secret `VM_DEPLOY_SSH_KEY` (set by Infra).
- To release: fast-forward `production` to a `main` commit that passed CI, and push it:

  ```sh
  git push origin main:production
  ```

## One-time setup

- **Make the package private.** The first push creates
  `ghcr.io/bitalchemists/asteroid-racers`. Because the repository is public, the package may
  start public. In GitHub: organisation BitAlchemists → Packages → `asteroid-racers` → Package
  settings → Danger Zone → Change visibility → Private. The VM's pull fails while the package is
  public, so the very first run's deploy job fails: flip the package to private, then re-run the
  failed job. The VM's pull credential is Infra's.
- Optionally protect the `production` branch (no force pushes).

## Content Security Policy

Everything the pages load is same-origin (scripts, styles, `logo.png`); there are no fonts or CDN
URLs. A strict `default-src 'self'` policy works with no exceptions (fixed in `ca62851`, checked in
a browser with the policy set as a header: start, singleplayer, multiplayer, watch and showcase
pages show no CSP errors):

- PixiJS's renderers check `new Function` at start. The client imports `pixi.js/unsafe-eval` before
  creating the `Application` (`packages/client/src/index.ts`, `replay/replay-viewer.ts`), which
  replaces the check, so no `'unsafe-eval'` is needed. Any new page that creates a PixiJS
  `Application` must do the same.
- No inline styles: the start page uses a class, and the replay viewer's CSS is a constructed
  style sheet (`replay-viewer.css`).
- `'self'` covers the same-host WebSocket at `/ws`.
- `multiplayer.html?server=<url>` connects to another server; `connect-src 'self'` blocks that, as
  intended in production.

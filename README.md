# Asteroid Racers

Asteroid Racers is a multiplayer browser game: race your spaceship against other players and AI bots
through an asteroid field, in the weightlessness of outer space.

It started out in Dart (2014–2019) and now runs on Node.js and TypeScript, with PixiJS rendering. The
last Dart version is commit
[`8ba7989`](https://github.com/BitAlchemists/Asteroid-Racers/tree/8ba79895fa6ed878d0024dc54f050228363b6772);
[PORTING_PLAN.md](PORTING_PLAN.md) explains the port and what changed.

## Quick start

You need Node.js 22 or newer.

```bash
npm install
```

**Singleplayer** — the game server runs inside the page, together with one racing bot:

```bash
npm run dev
```

Then open <http://localhost:5180/singleplayer.html>.

**Multiplayer** — build the web client once, then start the game server, which also serves the pages:

```bash
npm run build
```

```bash
npm run server
```

Then open <http://localhost:1337/multiplayer.html> in as many tabs or browsers as you like.

While developing, you can keep `npm run dev` and `npm run server` running together: the dev server
forwards `/ws` to the game server, so <http://localhost:5180/multiplayer.html> works with hot reload.

## How to play

| Key                  | Action                    |
| -------------------- | ------------------------- |
| `←` `→` (or `A` `D`) | turn                      |
| `↑` (or `W`)         | thrust                    |
| `1`                  | show / hide the interface |

Fly onto the green start pad to join the race, then fly through the checkpoints: yellow is your next
one, green ones are cleared, red ones are still ahead. The radar ring around your ship points at other
players (green) and your next checkpoint (yellow). Crashing into an asteroid or another ship blows you
up; you respawn after a second (at your last checkpoint while racing). Click the pad or "Leave race"
to leave the race. The chat is at the bottom: click into it, press Enter to send, Esc to go back.

Page options: `?bots=n` sets the number of bots in singleplayer (0 for none), `?collisions` draws
collision circles, `?encode` (singleplayer) sends every message through the binary network encoding.

## AI racers

The bots are small neural networks ("Major Tom", 4 inputs → 2 outputs: thrust and turn rate) that are
**evolved**, not trained by backpropagation: each generation, the best brain so far and 99 mutated
copies of it fly a 16-target course at once, and the one that stays closest to its targets wins.

```bash
npm run train -- --generations 200
```

Training runs headless at about 28× real time with all 100 brains flying at once (about 5 s per generation). The winner is
saved to `db/<name>/luke.txt` (the same format the Dart trainer used) with a log next to it, and a new
run continues where the last one stopped; Ctrl+C keeps the last finished generation. When a trained
brain exists in `db/`, `npm run server` uses it instead of the bundled one. To ship a new default brain:

```bash
npm run train -- --generations 200 --export packages/server/src/ai/brains/default-brain.json
```

Other knobs: `BOTS=3 npm run server` for more bots on the server, and

```bash
npm run bot -- --url ws://localhost:1337/ws --name "Luke"
```

sends a bot to any running server over the network. `npm run train -- --help` lists all options.

> The bundled brain is an interim one (48 generations); a longer training run is still to do.

## Deploying

- **Singleplayer only (static hosting):** `npm run build` writes a self-contained site to
  `packages/web/dist/` with relative URLs, so it works from any path — e.g. GitHub Pages under
  `/Asteroid-Racers/`, or any static file host. The game server runs in the browser; the multiplayer
  page needs a game server and shows "Could not connect" without one.
- **Multiplayer:** run `npm run build`, then `npm run server` on a machine with Node 22. Settings via
  environment variables: `PORT` (default 1337), `BOTS` (default 1). It serves the pages and the game on
  the same origin (`/ws`), so a reverse proxy only needs to forward WebSocket upgrades; behind HTTPS the
  page connects with `wss://` automatically.

## Development

```bash
npm run check
```

runs the typecheck, lint, format check and all tests (CI runs the same, plus a build and a short
training run). Other scripts: `npm test`, `npm run test:watch`, `npm run lint`, `npm run format`, and
`npm run proto` to regenerate the TypeScript codecs after changing a file in `proto/`.

```
proto/              wire protocol (protobuf, unchanged from the Dart version)
packages/shared/    world model, physics, protocol codecs, client protocol (ServerProxy), logging
packages/server/    authoritative game server, races, scenes, chat, AI — runs in Node and in the browser
packages/client/    PixiJS renderer, game client logic, HTML HUD, keyboard input
packages/node/      Node entry points: HTTP + WebSocket host, trainer, remote bot
packages/web/       Vite pages: landing page, singleplayer, multiplayer
```

The server never cares how a client is connected: browsers use WebSockets, singleplayer and the bots
use an in-process connection, and everything speaks the same protobuf messages.

## Thanks

To Mozilla and Little Workshop for the inspiration provided by BrowserQuest, and John McCutchan for
the inspiration provided by the `game_loop` library (see [doc/THANKS](doc/THANKS)).

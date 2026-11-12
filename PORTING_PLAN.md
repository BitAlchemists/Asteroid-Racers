# Asteroid Racers — Dart → Node.js/TypeScript port plan

Source: `master` @ 8ba7989 (2019-10-27), ~6.3k lines of Dart 1.x (pre-null-safety, `pub build` / dart2js era).

## Decisions so far

| Topic              | Decision                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| Language           | TypeScript (strict)                                                                                 |
| Renderer           | PixiJS (replaces StageXL + stagexl_particle)                                                        |
| Approach           | Port + modernize (fix rough edges as we go, keep gameplay identical)                                |
| Wire protocol      | Keep protobuf, reuse the existing `.proto` files via `@bufbuild/protobuf`                           |
| `aahhh` branch     | Review its 2017 memory-leak fix and port whatever master is still missing                           |
| Neuro-evolution AI | Port it: MajorTom MLP, mutation, training director, evaluators, demo director, headless trainer CLI |
| `rnn` branch       | Not ported (unfinished experiment; the network interface stays generic enough to add it later)      |

## Current architecture (Dart)

```
web/                 browser entry points: singleplayer (server runs in browser) + multiplayer (WebSocket)
lib/shared/          world model (Entity, Movable, Checkpoint, RacePortal, PhysicsSimulator), protobuf net layer, UI widgets
lib/game_server/     authoritative GameServer: physics tick, collision detection, race controller, scene generation
lib/game_client/     StageXL renderer, controllers per entity type, views (planets, sun, stations, starfield, explosions)
lib/services/net/    ServerConnection: LocalServerConnection (in-process) | WebSocketServerConnection
lib/services/chat/   chat service (client + server)
lib/services/ai/     neural-net bots that connect as regular clients; training + demo directors
lib/tcp_server/      dart:io HTTP + WebSocket server, static file handler
bin/                 run_server, run_bot, train_bots, run_test
```

Key property worth keeping: the server is transport-agnostic — the same GameServer runs in the browser (singleplayer, LocalServerConnection) or in a process (multiplayer, WebSocket), and AI bots are just clients.

## Target layout (npm workspaces monorepo)

```
packages/
  shared/    world model, physics, math (Vector2), protobuf codecs, logging — isomorphic, no DOM/Node APIs
  server/    GameServer, collision, race, scene, chat-server, AI service — isomorphic (runs in Node AND browser)
  client/    PixiJS renderer, controllers, views, GUI, chat window, input
  node/      Node entry points: HTTP + WebSocket host (ws), bot runner, trainer CLI
  web/       Vite app: singleplayer.html + multiplayer.html
proto/       the existing .proto files (single source of truth)
```

Tooling: Node 22 LTS, TypeScript (project references, `tsc -b`), Vite, `tsx`, `ws`, `@bufbuild/protobuf` + `protoc-gen-es` via `buf generate` (chosen over protobufjs: first-class TS output, maintained, proto2 support), Vitest, ESLint/Prettier.

## Library mapping

| Dart                                         | Node/TS replacement                                                                                                                            |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `stagexl`                                    | `pixi.js` v8 (display list ≈ 1:1: Sprite/Container/Graphics/Text)                                                                              |
| `stagexl_particle`                           | `@pixi/particle-emitter` or a small hand-written emitter (only used for explosions)                                                            |
| `vector_math` Vector2                        | small own `Vector2` class in `shared` (only a handful of ops used)                                                                             |
| `protobuf` 0.4 + generated `.pb.dart`        | `@bufbuild/protobuf` codegen from `proto/`                                                                                                     |
| `game_loop` (+ isolate variant)              | own fixed-timestep loop: `requestAnimationFrame` client, `setInterval`/`setImmediate` server, headless "as fast as possible" loop for training |
| `dart:io` HttpServer/WebSocket + `mime_type` | Node `http` + `ws` (+ `sirv`/express static)                                                                                                   |
| `logging`                                    | `pino` or a thin hierarchical logger (the code relies on per-name log levels)                                                                  |
| `neural_network` 0.0.4                       | hand-written MLP (~100 lines) — see AI section                                                                                                 |
| `dart:isolate`                               | `worker_threads` (only if we keep parallel training)                                                                                           |
| `library`/`part` files                       | ES modules                                                                                                                                     |

## Phases

Each phase ends with something runnable.

**0. Setup** ✅ — npm workspaces, TS project refs, ESLint + Prettier, Vitest, Vite (multi-page), `proto/` + `buf generate` → `packages/shared/src/net/proto/gen`, wire-format golden test. Dart sources moved to `legacy/dart/` for reference while porting (deleted in phase 6); original tree tagged `dart-legacy`. Port work lives on branch `node-port`.

**1. Shared core** ✅ — `Vector2` (vector_math-style API, float64 instead of float32), `wrapAngle`, `Entity`/`Movable`/`Checkpoint`/`RacePortal` (Dart enums → TS enums with identical wire values), `World`, `PhysicsSimulator` (same Euler order), `EntityMarshal`, typed `payloadSchemas` + `MessageDispatcher` (replaces the string-keyed handler maps), `Connection` interface, hierarchical logger. 43 unit tests; physics expectations are hand-derived from the Dart algorithm since Dart 1.x can no longer be run.

**2. Server (headless)** ✅ — `GameServer`, `ClientProxy`, `CollisionDetector`, `RaceController`, `SceneController` (all scenes/races), `ChatServer`, `RealtimeGameLoop` + `ManualGameLoop` (fixed 15 ms step). Fixes vs. Dart: respawn timer runs on game time (exact under headless training), seeded RNG option, a ship crashes once per frame even if it touches several rocks, NaN thrust → 0, repeated handshakes ignored, chat needs a ship name and is capped at 500 chars, start/finish checkpoint orientation bug (radius passed as angle). Kept as-is: top-2 entity updates per tick; touching the portal is a one-time ticket (no re-join after RACE_LEAVE). 32 server tests using a scripted `FakeClient`.

**3. Transport + Node host** ✅ — `ServerConnection` interface; `LocalServerConnection` (in-process, microtask or sync delivery, optional protobuf round-trip); `WebSocketServerConnection` on the WHATWG WebSocket (browser and Node 22, so remote bots can use it too); Node host with `ws` at `/ws`, static file serving of `packages/web/dist` (port 1337, `PORT` env), graceful shutdown; Vite dev server proxies `/ws`. Fixes vs. Dart: upgrades on other paths get a 404 instead of hanging, 64 KB message limit, slow clients (>4 MB queued) are dropped, undecodable frames are ignored. 18 transport tests incl. a real WebSocket end-to-end run.

**4. Client renderer (PixiJS)** ✅ — `ServerProxy` in `shared` (reused by bots); `GameClient` logic (prediction, input-on-change, ping, radar targets, race UI state) separated from rendering via `GameView`/`Hud` interfaces and tested against a real server; `PixiGameView` with all StageXL drawings ported (ship, asteroids, checkpoints, arrows, finish, portal, planets, sun, satellite, star field + twinkle, station, explosion, thrust particles, radar); HTML HUD replaces the canvas widgets (username remembered, chat, debug readout, Leave race button); arrows/WASD, `1` toggles the HUD. Singleplayer runs the server in the page; multiplayer uses `/ws` on the same origin. Verified in the browser: flying, crash + respawn, race join, two players seeing each other. Known, kept from Dart: the local ship ignores server orientation while it can move, so race-start/respawn headings don’t apply locally.

- singleplayer: server + client in one page via LocalServerConnection
- multiplayer: client → WebSocket → Node server

**5. AI (neuro-evolution)** ✅

- `MajorTom`: tanh MLP on Float64Array weights (layout 4-10-8-6-4-2), relative/absolute mutators. JSON identical to the Dart `MajorTomSerializer` (bias weight first per neuron). **Bug found:** the Dart bias neuron always output 0, so bias weights never mattered; new brains use 1 and store `bias_output`, old files load with 0 and behave as trained.
- Bots are real clients (`AIGameClient` over `LocalServerConnection`, or WebSocket via `npm run bot`); `TargetVehicleController` computes the same 4 inputs / 2 outputs.
- Scripts: `RaceTargetScript` (join race, chase checkpoints after a 5 s delay; timers on game time), `RaceTargetTrainingScript`, `RespawnTargetTrainingScript`. Evaluators: least / sum / quadratic-sum (default) / time. `TargetGenerator`: flux-compensator course, circle, ring track.
- Directors: `DemoDirector` (latest brain from a `BrainStore`, loops its scripts, backs off on failures) and `TrainingDirector` (winner + 99 mutants fly at once, winner saved, per-run log).
- Training fixes vs. `master`: training bots are ghosts (`canCollide: false`, as in the collision-free `aahhh` training); the training server sends every bot its own ship each tick (the 2-per-tick throttle starved 100 bots) and delivers messages synchronously so bots react in the same frame. The `aahhh` leak fixes (cancel subscriptions, drop references on disconnect) are covered by the phase 3/4 connection cleanup.
- `npm run train` (~5 s per 100-brain generation; `db/<name>/luke.txt` + log; Ctrl+C keeps the last winner) and `npm run bot`. The Node server and singleplayer add one racing bot (`BOTS=n`, `?bots=n`); a trained brain in `db/` overrides the bundled one.
- Bundled brain is **interim**: 48 generations (seed 2026, best score 69.5k → 33.9k, plateaued at brain gen 15). A proper training run is postponed — run `npm run train -- --generations 200 --export packages/server/src/ai/brains/default-brain.json` (~16 min) and commit the result.
- Not done: `worker_threads` parallelism (not needed at this speed); the `rnn` branch (by decision).

**6. Modernize & clean up** ✅

- Leak audit: `GameServer.stats()` exposes the server's bookkeeping; soak tests churn 300 in-process clients (crashing, racing, leaving mid-respawn, both delivery modes) and 40 WebSocket clients, and require every count to return to its starting value.
- Typed message map: done in phases 1–2 (`payloadSchemas` + `MessageDispatcher`).
- Legacy Dart sources removed from the branch (still on `master` and at the local `dart-legacy` tag), including `_needs_refactoring`.
- The handshake's "queue the initial world" TODO is closed as not needed: the demo world is 143 entities ≈ 7 KB.
- Static deploy: Vite builds with relative URLs; verified the build running from a sub-path on a plain static server (singleplayer incl. bot). No Pages deploy workflow was added, because publishing to `gh-pages` is the owner's decision; the README describes it.
- CI (`.github/workflows/ci.yml`): `npm ci`, `npm run check`, build, and a 2-generation training run.
- README rewritten (play, controls, AI training, deploy, layout); `doc/CHANGELOG.md` has a v0.7 entry.
- Dev-only advisory left open: `minimatch` ReDoS in the ESLint toolchain (fix needs a breaking downgrade); production dependencies audit clean.

### Open items after the port

- Train the shipped brain properly (see phase 5).
- The local ship ignores the server's orientation while it can move, so race-start / respawn headings don't apply locally (Dart behaviour).
- Touching the race portal is a one-time ticket: after leaving a race you can't rejoin without reconnecting (Dart behaviour).
- Players and bots share one spawn circle, so they can spawn into each other and explode (Dart behaviour).

## Risks / things to verify

- **Physics parity**: Dart `double` == JS `number`, so math should match exactly if the update order is preserved. Use golden tests.
- **Protobuf 0.4 quirks**: proto2 `required` fields and default values — `@bufbuild/protobuf` handles proto2 (a golden test already checks Vector2 bytes), but verify encode/decode against bytes produced by the Dart build if we ever need interop (probably not; it's a full replacement).
- **StageXL → Pixi differences**: coordinate/rotation conventions (radians vs degrees, pivot vs anchor), text rendering, hit-testing for buttons.
- **`aahhh` vs master**: master's 2019 commit branched from the same parent (2016) and appears to redo much of `aahhh`'s refactor; need a file-by-file check of which leak fixes are actually missing.
- **Saved networks**: trained brains were stored as JSON under `db/<name>/` (not in the repo). If you still have them, the JSON format can be read by the TS port.

## What the AI is (for your decision)

**Neuro-evolution (on master)**

- Bots are ordinary game clients ("AI as a real client", 2019 refactor) steered by a feed-forward neural net called _MajorTom_.
- Net: topology `[4, 10, 8, 6, 4, 2]`, tanh activations, bias neuron ("Umbral"), random init in [-1, 1].
- Inputs (4): angle to target, distance to target, angle of velocity, speed. Outputs (2): thrust (0..1) and rotation speed (±5).
- Training = simple evolutionary loop, **no backprop**: load the last winner from `db/<name>/`, clone it N times, mutate weights (relative or absolute random perturbation), let every clone fly through a fixed sequence of checkpoint targets (respawned at each target, ~4.5 s each), score with an evaluator (default: Σ (distance-to-target + |rotation speed|)·dt, lower = better), keep the single best, write it back, repeat forever. `bin/train_bots.dart` runs the server headless and as fast as possible.
- Demo director: loads trained nets and lets them race in the live world.

**`rnn` branch (1 commit, 2019, "start supporting RNNs")**

- Generalizes `MajorTom` into a `NeuralNetwork` base class and adds a recurrent net (`RNN`, ~280 lines) + its serializer, trained by the same evolutionary director with a `[4, 2]` config.
- It's a start: wiring in the trainer exists, but it's unfinished/unvalidated.

Decision: port neuro-evolution; leave the RNN branch out.

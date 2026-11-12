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

**1. Shared core** — `Vector2`, `Entity`/`Movable`/`Checkpoint`/`RacePortal` (Dart enums-as-classes → TS enums), `World`, `PhysicsSimulator`, `EntityMarshal` (entity ⇄ protobuf), `Envelope` dispatch. Unit tests for physics & marshalling (golden values from the Dart implementation).

**2. Server (headless)** — `GameServer`, `ClientProxy`, `CollisionDetector`, `RaceController`, `SceneController`, chat server. Fixed-timestep loop. Test with a scripted fake client: handshake → input → entity updates → race join/finish.

**3. Transport + Node host** — `Connection` abstraction, `LocalServerConnection` (in-memory, async queue), `WebSocket` connection (binary frames), Node HTTP/WS server replacing `tcp_server` (port 1337). `npm run server`.

**4. Client renderer (PixiJS)** — `ServerProxy`, `GameClient`, entity controllers, views (planet, sun, satellite, station builder, parallax star background, explosion particles), GUI/buttons/windows, chat window, keyboard input. Then the two entry pages:

- singleplayer: server + client in one page via LocalServerConnection
- multiplayer: client → WebSocket → Node server

**5. AI (neuro-evolution)** —

- `MajorTom` MLP (tanh, bias neuron, weights in [-1, 1]) + relative/absolute mutators, hand-written, no ML library.
- JSON serializer compatible with the old `db/<name>/` format (so old brains load if they turn up).
- Bots as clients: `AIGameClient`, `VehicleController`, `TargetVehicleController` (same 4 inputs / 2 outputs), `TargetGenerator`.
- Scripts: `RaceTargetScript`, `RaceTargetTrainingScript`, `RespawnTargetTrainingScript`.
- Evaluators: least-distance, sum-distance, quadratic-sum (default), time-to-target.
- Directors: training (evolution loop, report log) and demo (load nets, race in live world).
- `npm run train` (headless, max-speed loop, optional `worker_threads` for parallel populations) and `npm run bot`.
- Ship a freshly trained default brain in the repo so demo bots work out of the box.

**6. Modernize & clean up** — leak audit (fold in `aahhh` findings: subscriptions not cancelled, clients not destroyed), replace stringly-typed handlers with typed message map, delete `_needs_refactoring`, README with new run instructions, deploy notes (old `gh-pages` branch → static Vite build).

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

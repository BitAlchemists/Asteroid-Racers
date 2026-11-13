# History

What actually happened, session by session. This file is append-only: the newest entry goes at the
bottom. Plans say what we intended; this file says what we did, what we found, and where we
deviated or got something wrong.

---

## 2026-11-12 — Port, phases 0–4

Plan: [`plans/PORTING_PLAN.md`](plans/PORTING_PLAN.md). Decisions: TypeScript, PixiJS, port and
modernize, keep protobuf, include the `aahhh` leak fix, port the neuro-evolution AI, leave out the
`rnn` branch.

| Commit    | What                                                                                    |
| --------- | --------------------------------------------------------------------------------------- |
| `b09ad9b` | Phase 0: npm workspaces (`@ar/shared`, `server`, `client`, `node`, `web`), TS project refs, Vite, Vitest, ESLint, Prettier, CI |
| `ee21b80` | Phase 1: shared world model, physics, wire protocol (`@bufbuild/protobuf`, proto2 files kept) |
| `e9b2b8b` | Phase 2: headless game server, fixed 15 ms tick, `ManualGameLoop` for tests             |
| `1339333` | Phase 3: local and WebSocket transports, Node host on port 1337 at `/ws`                |
| `2666fc2` | Phase 4: PixiJS client, HTML HUD                                                        |

Issues fixed along the way:

- The `.gitignore` inherited from Dart ignored `packages/`.
- I overwrote `.gitattributes` without reading it first (reported to the user).
- On Windows, a refused WebSocket handshake fires `error` but no `close`, so the client now ends the
  connection on either event.
- `ws` with a `path` option left other upgrade requests hanging; switched to `noServer` plus a 404.

## 2026-11-13 — Port, phases 5–6

| Commit    | What                                                                       |
| --------- | -------------------------------------------------------------------------- |
| `72156d4` | Phase 5: neuro-evolution AI (MLP, (1+99) elitist evolution, training server) |
| `3f4d854` | Fix: exclude the generated brain JSON from Prettier                        |
| `45036c4` | Phase 6: clean up and modernize, remove the Dart sources (tag `dart-legacy`, local only) |
| `ad5dd45` | Docs point at the last Dart commit `8ba7989` instead of the master branch  |

- **Found during the port:** in the Dart network the bias neuron always output 0. New brains store
  `bias_output: 1`; legacy brains still load with 0.
- **Deviation:** the full 200-generation training was stopped ("lets train the AI later"). An
  interim 48-generation brain was shipped as `default-brain.json` (score 33,937).
- **Mistake:** the Phase 5 commit went in although the format check failed, because I checked the
  output with grep instead of the exit code. `3f4d854` fixes it. Since then: commit only when
  `npm run check` exits 0.
- **Mistake:** I said training ran at "2,800× real time". The correct figure is ~28×. Docs fixed and
  the user told.
- `master` was fast-forwarded to the port and renamed to `main`.

## 2026-11-13 — Evo Lab adapter and train-1

| Commit    | What                                                                                  |
| --------- | ------------------------------------------------------------------------------------- |
| `0921ce0` | Evo Lab adapter: `lab.config.json`, `scripts/lab-train.mjs`, protocol v1 worker with exact resume |
| `0fb495b` | Report dependency versions in `hello`; leaderboard ranks only `score`                 |
| `eb244a1` | Exclude test files from the binding                                                   |
| `76aa45c` | Remove the per-project worker cap (the machine-wide runner shares slots)              |

- Protocol details were worked out with the Evo Lab session; it reviewed and approved the adapter.
- **train-1:** 200 generations, seed 2026, run through Evo Lab on the machine runner (port 4320).
  - Best score 19,050 (the interim brain scores 33,937).
  - On 5 unseen courses with different headings: 34,853 vs 36,015 for the interim brain, so the
    gain barely transfers.
  - In the real race (5 minutes × 3 layouts) neither brain reaches a checkpoint. The interim brain
    flies off into space; train-1 crashes 56–95 times near the start.
  - **Cause:** the training course spans ~1,000 units with no obstacles, while race legs are
    1,200–2,400 units apart with asteroids in between.
  - Decision: keep the interim brain in the game until training is fixed.
- **Found:** a score wobble of less than 1 point within a run. Probable cause: the bot's first
  frame sees the stale spawn position before the teleport. Planned fix: M1 step 1.

## 2026-11-13 — Roadmap and working model

- Brainstormed training arenas, then answered the user's questions about inputs, engine fitness,
  race courses, observer mode and determinism (same seed gives the same result).
- Agreed: build the infrastructure first, then use Evo Lab for experiments.
- Wrote [`ROADMAP.md`](ROADMAP.md), [`plans/M1-training-foundations.md`](plans/M1-training-foundations.md),
  this file and `CLAUDE.md`. Moved `PORTING_PLAN.md` to `doc/plans/`.
- Local commits are not pushed yet.

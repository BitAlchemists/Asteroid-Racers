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

## 2026-11-13 — M1: training foundations

Plan: [`plans/M1-training-foundations.md`](plans/M1-training-foundations.md), approved by the user
("Start M1").

| Commit    | What                                                                                     |
| --------- | ---------------------------------------------------------------------------------------- |
| `2fc91ea` | M1.1: a teleport sends the owner its new state at once; optional velocity                |
| `16c0c02` | M1.2: collision modes `all` / `obstacles` / `none`, `autoRespawn`, obstacles added while running |
| `735813a` | M1.3+4: arenas (`legacy`, `point-to-point`), ArenaScript, scoring library, held-out scenarios |
| `c5dac09` | M1.5: a brain spec in every brain's JSON, an input registry                              |
| `3a8cd73` | M1.6: training config (`brain`, `arenas`, `scoring`, `collisions`, `crashMode`, `heldOut`), checkpoint v2 |
| `1a1f4cb` | Kill-and-resume test on point-to-point too                                               |

- **Teleport bug confirmed:** a test that flies one unchanged brain for 3 generations got 6
  different scores before the fix and the same score every time after it. The stale first frame
  affected both the bot's inputs and the evaluator.
- **Bug found by the tests:** in `respawn` crash mode, a ship that crashed on every frame never ran
  out of time, because the crash branch skipped the time-limit check. Fixed before the commit.
- **Deviations from the plan:**
  - Steps 3 and 4 are one commit, because the arena runner and the scorer share the episode records.
  - Obstacles cannot move yet (the plan's type allowed a velocity).
  - The brain spec stores `inputs` and `outputs`; the layout comes from the weights, so it is not
    stored twice.
  - The trainer now numbers generations from the start of the run (`firstGeneration`), so a resumed
    run makes the same scenarios.
- **Speed:** no slowdown. train-2 averaged 4.6 s per generation against 7.7 s for train-1; the gain
  comes from episodes ending as soon as the target is reached. train-3, with collisions on, averaged
  3.8 s.

### Baselines (Evo Lab, seed 2026)

| Run     | Setup                                                    | Best score (gen 1 → 25 → 50 → 200)   | Success |
| ------- | -------------------------------------------------------- | ------------------------------------ | ------- |
| train-1 | before M1, original course                               | 68,999 → 34,555 → 33,937 → 19,050    | (not measured) |
| train-2 | `legacy` arena, default config (after the teleport fix)  | 63,977 → 17,175 → 13,168 → 13,109    | 16/16 targets |
| train-3 | `point-to-point`, 8 episodes, 20 asteroids, collisions `obstacles`, scoring distance 1 / missed target 1000 / crash 500, 2 held-out, 50 gens | 65,755 → 23,717 → 16,667 (gen 50) | 88 % training, 75 % held-out |

- **train-2 did not match train-1 within noise, as the plan expected.** It is much better (13,109 vs
  19,050) and gets there by generation 50. Two things changed together: the teleport fix (selection
  no longer sees a noisy first frame), and the course's start headings (now drawn from the derived
  scenario seed instead of the mutation generator). This run cannot tell them apart; an A/B run
  with the old headings would. Also, since teleports no longer move the score, scores from before
  M1 are not comparable with scores after it.
- **train-3** shows the new path works from config alone. Held-out success went from 13 % in
  generation 1 to 75 % by generation 50, so on this arena the brains learn something that carries
  over to unseen scenarios, unlike train-1 on the original course.
- Not checked yet: how train-2 or train-3 brains do in the real race. That is the race exam in M2.
- Pushed to `main` at the user's request; CI passed on `b45baa7` (run 43399450644). M1 is done.
  GitHub reports one moderate Dependabot alert (`minimatch`); its automatic update PR failed. Not
  looked at yet.

## 2026-11-13 — Rename brain to model; M2 plan

| Commit    | What                                                                                          |
| --------- | --------------------------------------------------------------------------------------------- |
| `d309cae` | M1 marked done                                                                                |
| `24d13f1` | Rename "brain" to "model" (user's request): files, types, the training config key `model`, the bot flag `--model` |

- The old config key `brain` and the flag `--brain` are still accepted, so runs from before the
  rename (train-2, train-3) can be continued. Their Evo Lab configs still say `brain`.
- `result.json` now says `modelGeneration` instead of `brainGeneration`.
- Earlier history entries and finished plans keep the old word on purpose (append-only).
- Wrote [`plans/M2-measurement.md`](plans/M2-measurement.md), waiting for the user's OK. It moves the
  "held-out next to training" roadmap item to done (shipped in M1).
- The Evo Lab session reported that experiments (plan, approve, screen, report, sign-off) and the
  leaderboard are live. Experiments fit M5; nothing to change now.

## 2026-11-13 — M2: measurement (race exam, snapshots)

Plan: [`plans/M2-measurement.md`](plans/M2-measurement.md), approved by the user ("Start M2").

| Commit    | What                                                                                 |
| --------- | ------------------------------------------------------------------------------------ |
| `b016a06` | M2 plan                                                                              |
| `11f18ef` | M2.1: track registry (`demo`, `short`, `random`), `GameServer.loadTrack`             |
| `e2f2f4a` | M2.2: exam runner (game rules, real racing bot, start on the portal, 3-minute limit) |
| `deb16c9` | M2.3: training saves winner snapshots to `RUN_DIR/gens/gNNNN.json`                   |
| `fc7a969` | M2.4: `exam` method (Evo Lab evaluation-only runs with `inputRun` / `inputGens`)     |
| `9767c5d` | M2.5: `npm run exam`, short exam in CI                                               |

- **Asked the Evo Lab session** how snapshots and inputs from another run work. Answers:
  - snapshots in `RUN_DIR/gens/` with a `snapshot` field on the `gen` event;
  - evaluation-only runs (contract A9) with `--input-run` and `--input-gens`, and `g` = the source
    generation.
  Evo Lab needed no changes.
- **Deviations from the plan** (the plan is edited to match):
  - snapshots go to `gens/`, not `models/`;
  - the exam method is not resumable (about 1.5 s per model, deterministic), so the exact-resume
    item was dropped.
- **Correction of an earlier finding:** before M1 I reported that neither the bundled model nor
  train-1 reaches a single checkpoint in the real race. That test made the bot fly to the race portal
  first and wait 5 s before each target. The exam starts the ship on the portal with no delay, and
  then every model reaches checkpoints. The flight to the portal was where they flew off into space.
  So the earlier claim was true only for that setup, not for racing in general.

### Baseline exams (Evo Lab, default exam: `demo`, `short`, 5 random tracks, 3 minutes each, exam seed 1)

| Exam   | Model                                   | Exam score | Checkpoints | Finished | Crashes |
| ------ | --------------------------------------- | ---------- | ----------- | -------- | ------- |
| exam-1 | bundled (interim, 48 gens)              | 27,626     | 53 %        | 1 of 7   | 121     |
| exam-2 | train-1 winner (g200, before M1)        | 28,245     | 57 %        | 2 of 7   | 181     |
| exam-3 | train-2 winner (g200, `legacy` after M1) | 14,690     | 74 %        | 4 of 7   | 201     |
| exam-4 | train-3 winner (g50, `point-to-point`)  | 18,774     | 66 %        | 4 of 7   | 206     |

- None of these reaches even the first checkpoint of `demo` (the corridor race players see); they
  crash 38–65 times in its corridors.
- Two of the five random tracks catch every model: they stall about 500 units from a checkpoint and
  crash about 60 times. Probably asteroids near that checkpoint; it can be looked at once there is a
  watch page (M3).

### train-4 and the exam along a run (exam-5)

train-4: the train-3 setup (point-to-point, 8 episodes, 20 asteroids, collisions `obstacles`,
scoring distance 1 / missed target 1000 / crash 500, 2 held-out) for 150 generations, seed 2026,
snapshots every 10. exam-5 examined all 15 snapshots.

| g   | Training score | Held-out success | Exam score | Checkpoints | Finished |
| --- | -------------- | ---------------- | ---------- | ----------- | -------- |
| 10  | 35,761         | 75 %             | 17,406     | 70 %        | 2 of 7   |
| 30  | 21,092         | 88 %             | 12,673     | 77 %        | 5 of 7   |
| 50  | 16,667         | 75 %             | 18,774     | 66 %        | 4 of 7   |
| 80  | 9,501          | 100 %            | 20,374     | 64 %        | 2 of 7   |
| 110 | 16,670         | 81 %             | **3,579**  | **94 %**    | **6 of 7** |
| 140 | 7,061          | 81 %             | 9,563      | 83 %        | 5 of 7   |
| 150 | 14,384         | 94 %             | 9,581      | 83 %        | 5 of 7   |

- **First models to finish `demo`:** g110 in 77.5 s and g150 in 85.5 s, with 5 and 3 crashes.
- **The exam does not follow the training score.** g80 has the best training score so far (9,501,
  100 % held-out) but one of the worst exams. g110 has a middling training score and by far the best
  exam. The training scenarios change every generation, so a single generation's training score is
  noisy, and point-to-point flights are not races. Selecting or stopping on the exam (or training on
  race-like arenas) are candidates for M4/M5.
- train-3 g50 and train-4 g50 have the same exam score (18,774): train-4 repeats train-3's setup and
  seed, so its first 50 generations are identical. Determinism holding across runs, as expected.
- **Model promotion:** train-4 g110 is the best racer so far, by far. Per `CLAUDE.md`, putting it into
  the game is the user's call. Not done.

### Other

- The Evo Lab session asked whether we need GPU acceleration (no: tiny networks, the time is in the
  game simulation, and results must be bit-identical) and a shared model pool (later, for M5: only
  for starting runs from a model, never for swapping models between running runs). It pointed out
  that `imports` at enqueue can already hand a run a starting model; useful for M5 curriculum runs.
  Our training worker does not read `--import` yet.
- Pushed to `main` at the user's request; CI passed on `13d7240` (run 43412565833), including the
  new exam step. M2 is done.

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

## 2026-11-13 — M3 plan

- The user asked whether the watch page belongs in Evo Lab. My answer: mostly yes, as a renderer
  plugin, built from one replay viewer that the game's watch page reuses. Replays re-simulate
  instead of recording, which works because everything is deterministic.
- Asked the Evo Lab session about renderer plugins and read its contract (`docs/contract-v1-draft.md`
  section C, `examples/toy/ui/render.js`):
  - a Vite output folder works and is not part of the run binding;
  - the plugin may run its own PixiJS app, but must clean up completely;
  - thumbnails must be static pictures;
  - exam runs can find their source model through the manifest's `inputRun`.
- Wrote [`plans/M3-visibility.md`](plans/M3-visibility.md), waiting for the user's OK. New in it
  compared to the roadmap: path traces in training snapshots and exam snapshots, so thumbnails need
  no simulation.
- Also from the Evo Lab session: `js/lablib.mjs`, a ready-made helper for Node workers. We keep our
  own workers for now and look at it again in M5 (for `--import`).

## 2026-11-13 — M3: visibility (replay viewer, Evo Lab plugin, watch page)

Plan: [`plans/M3-visibility.md`](plans/M3-visibility.md), approved by the user ("Start M3").

| Commit    | What                                                                                     |
| --------- | ---------------------------------------------------------------------------------------- |
| `af79f72` | M3.1: replay core (`ArenaReplay`, `ExamReplay`); arena config, scenarios and placement shared with the trainer |
| `e06a3f9` | M3.2: flight paths in training snapshots (`trace`) and exam snapshots (`exam-snapshot/v1`) |
| `1d17e52` | M3.3: replay viewer (controller, Pixi view, DOM shell), replay sources                   |
| `c4a7e8f` | M3.5: watch page (`watch.html`), `modelFromJson` shared by node and browser              |
| `c526b96` | Format fix for `c4a7e8f` (see mistakes below)                                            |
| `a6f99fa` | M3.4: Evo Lab renderer plugin (`packages/lab-plugin`, built into `dist/lab-plugin/`)     |
| `a863f66` | Thumbnail sizing fix; `snapshotEvery` default 1; plugin opens on the overview camera     |

- **Exactness holds:** replaying a generation's winner alone reproduces the best score recorded
  while 100 candidates flew at once, to the last digit, for point-to-point with asteroids (crashes
  ending or respawning) and for legacy. The replayed paths equal the recorded traces. An exam
  replay ends with exactly the exam's flight result (the exam itself now runs through the replay).
- **Order changed:** step 5 (watch page) was built before step 4 (plugin), as the simplest place to
  see the viewer.
- **Changes beyond the plan:**
  - `snapshotEvery` now defaults to 1 instead of 10 (about 10 KB per generation), so every
    filmstrip slot gets a thumbnail and every generation can be watched. The cost: examining all
    snapshots of a 200-generation run takes about 5 minutes instead of 30 s (`inputGens` can pick
    fewer).
  - Evo Lab draws the leader card and the run-detail view with the same mode and size, so the
    plugin cannot tell them apart. Both get the full viewer; only compare is compact. The plan's
    "autoplay at 2× with muted controls" for the leader card is dropped.
- **Checked in the browser** (pane hidden, so no animation):
  - the watch page renders and its controls work;
  - in Evo Lab, train-5 (a new 30-generation run) shows the viewer and path thumbnails, and exam-6
    shows the exam flights with the model fetched from train-5;
  - stepping through 10 generations leaves exactly one viewer and one canvas on the page, so
    cleanup works.
  - Bug found and fixed: Evo Lab passes 0 as the thumbnail height.
- **Mistake:** `c4a7e8f` was committed although `npm run check` failed (formatting), because I
  chained the commit with `;` instead of gating it on the exit code: the same slip as in Phase 5.
  Fixed in `c526b96`. Since then every commit command checks `$?` of `npm run check` itself.

### Findings (step 6)

- **The "two random tracks where every model stalls" are crash loops.** On both tracks an asteroid
  lies on the straight line between two checkpoints:
  - the model flies straight at the next checkpoint, hits the rock, and respawns at the last
    checkpoint (game rule);
  - then it flies the same line into the same rock again: 35 to 68 crashes per flight, oscillating
    in place until time runs out.
  - The models cannot avoid it: their inputs are target angle, target distance, velocity angle and
    speed. Nothing senses asteroids.
- **train-4 g80 vs g110:** g80 is caught in three such loops (66, 66 and 59 crashes), g110 in one.
  Most of the difference in their exam scores is which rocks happen to lie on a checkpoint line, not
  better flying. g110's lead is partly luck.
- **Consequences for M4/M5:**
  - Obstacle sensors ("whiskers") are the most direct next experiment.
  - Arenas with rocks on the direct line would force avoidance.
  - The exam needs more random tracks, so one trap weighs less.
  - Promoting g110 into the game should wait until a model can avoid rocks.

### Checked with the browser pane visible

- The watch page plays: the bundled model finishes `short` in 4.5 s, as the exam measured. On
  `demo` it heads north into the upper-left asteroid block instead of east down the corridor and
  crashes there again and again.
- A train-5 snapshot loaded through the watch page's file input flies `demo`.
- The Evo Lab plugin plays train-5's episodes on the overview camera with its full controls bar.
- Bugs found and fixed (`503946b` and the commit after it):
  - entity ids restart in every replay's world, so after switching flights the view drew the new
    track with the previous track's shapes (checkpoints looked like asteroids); nodes are now rebuilt
    per replay;
  - after the finish every checkpoint now shows as cleared;
  - the viewer's `.bar` class collided with Evo Lab's own `.bar` style, which squeezed the controls
    to 80 × 12 px; the viewer's classes are now prefixed `ar-`.
- The animation could not be checked while the pane was hidden: the browser pauses animation frames
  for a hidden page. Everything else above was checked then.

## 2026-11-13 — M4 plan

- Wrote [`plans/M4-content.md`](plans/M4-content.md), waiting for the user's OK. Shaped by the M3
  findings:
  - a `gauntlet` track and a `rock-in-line` arena reproduce the crash-loop situation on purpose;
  - exam v2 has 15 random tracks instead of 5, so one trap weighs less;
  - tier-2 baselines are expected to show missing obstacle sensing as a ceiling, which is where
    M5's sensor experiments start.
- Dropped moving obstacles from the roadmap's tier 3, because the game has none.
- Pushed to `main` at the user's request; CI passed on `ab90101` (run 43437647970), including the
  plugin build. M3 is done.

## 2026-11-13 — Roadmap change: perception before content

- The user liked the content plan, but pointed out that models cannot see obstacles yet. They
  proposed a milestone for that first, combined with a harness that tests model variants, because
  the solution needs experimentation.
- Roadmap restructured:
  - new **M4 Perception** ([`plans/M4-perception.md`](plans/M4-perception.md), waiting for approval);
  - content becomes **M5** (`plans/M4-content.md` → `plans/M5-content.md`; `rock-in-line` moved to
    M4; final OK after M4);
  - experiments become **M6** (obstacle sensing moved out to M4).
- Read Evo Lab's `docs/experiments.md`. Its experiments become the harness: switches, matched seeds,
  a baseline gate, a decision rule and sign-off. Consequences for the design:
  - sensors are new config keys, absent by default;
  - `hidden` moves out of the method's default config so it can be switched;
  - training runs get an optional in-run exam, so decisions can be about racing.
- Design point found while planning: the bot drops asteroid messages today, so sensors need it to
  keep them first.

## 2026-11-13 — M4: perception (in progress)

Plan: [`plans/M4-perception.md`](plans/M4-perception.md), approved by the user ("Start M4").

| Commit    | What                                                                                       |
| --------- | ------------------------------------------------------------------------------------------ |
| `b569a25` | M4.1: the bot keeps asteroids; obstacle grid; stored baseline fixtures guard byte-identity |
| `800f258` | M4.2: four sensors as switches (`sensors`, `hidden`); `model` block out of the method defaults |
| `b1224ec` | M4.2b: the viewer draws what sensors see (built by a subagent, reviewed)                   |
| `72267a2` | M4.3: `rock-in-line` arena                                                                 |
| `8213463` | M4.4: race exam inside training runs (`exam` switch)                                       |
| `ea848ea` | M4.5: harness: `stateHash` per generation, `npm run experiment -- draft`, `doc/experiments.md` |
| `3b5080d` | E1 and E2 plans; `CLAUDE.md` notes                                                         |

- **The subagent** (the user allowed them) built the viewer's sensor drawing while I built the arena
  and the in-run exam in other files.
- **A stale plugin build** showed an error for sensor models in Evo Lab, because `dist/lab-plugin`
  had been built before sensors existed. Rebuilt; `CLAUDE.md` now says to rebuild after code changes.
- **Experiments are approved by me** ("Claude, per the M4 plan the user approved"), since the user
  approved the plan that specifies E1 to E4.

### E1 noise floor (m4-e1-noise-floor, closed)

Blind models on the standard M4 setup, seeds 1 to 5, 150 generations (runs train-6..10 to g50,
continued as train-12..16). Report: [`experiments/m4-e1-noise-floor.report.md`](../experiments/m4-e1-noise-floor.report.md).

| at g150 | mean | sd | range |
| --- | --- | --- | --- |
| exam score | 66,420 | 28,180 | 44,070 – 107,100 |
| exam crashes (17 flights) | 611 | 108 | 515 – 766 |
| race checkpoints reached | 55 % | 19 % | 27 % – 71 % |
| races finished | 39 % | 20 % | 12 % – 59 % |

- The exam is very noisy between seeds, and barely improves during training (75k → 70k → 66k).
- **Deviation:** E2's `minEffect` is 10,000 (10 more race checkpoints), not one sd (28,000) as
  E1's plan said. On top of the 2 × paired-SE test, a full sd would hide real improvements.

### Model size (the user's question)

- The user asked whether the network is big enough for more inputs, and whether there is
  established science on choosing its size (the 4-10-8-6-4-2 layers were a guess).
- Literature check:
  - no formula exists; fixed-topology neuroevolution treats the hidden size as trial and error;
  - NEAT evolves the size instead (mixed evidence against well-chosen fixed networks);
  - in RL, control-network width must be tuned per task, small widths (16–32) are often best, and
    bigger is not always better;
  - our deep, narrow shape (down to 4 neurons) is unusual and may be a bottleneck with 30 inputs;
  - with a fixed per-weight mutation rate, bigger networks also get more mutations per child.
- Proposed to the user (waiting for an answer):
  - a capacity experiment in parallel with E2, on the model with all four sensors, comparing one and
    two hidden layers of 16 or 32 neurons, plus a variant with the mutation rate scaled to network
    size;
  - no sensor is dropped just for losing at today's size.
- The Evo Lab session is adding multi-level switches (`levels`) for that.

### E2 sensor comparison (m4-e2-sensors, running)

One-at-a-time: blind baseline vs `whiskers`, `sectors`, `nearest`, `lineCheck`; seeds 1 to 5; screen
at 50, final at 150; decision on `exam` (2 × paired SE, `minEffect` 10,000, 4 of 5 seeds). The gate
uses E1's first-look runs.

### E2 result (m4-e2-sensors, closed)

Report: [`experiments/m4-e2-sensors.report.md`](../experiments/m4-e2-sensors.report.md). The baseline
gate passed: all 5 blind baseline runs reproduced (stateHash g1–g5), so the sensor code changed
nothing for blind models.

| sensor | g50 (screen) | g150 |
| --- | --- | --- |
| `lineCheck` | better: −40,300, 5/5 seeds | −18,800, 2/5 seeds: no clear difference (g100: −30,700, 4/5) |
| `whiskers` | +700, no clear difference | screened out |
| `sectors` | +7,200, no clear difference | screened out |
| `nearest` | +20,500 (tends worse), no clear difference | screened out |

- **`lineCheck` at g150 vs blind** (same seeds):
  - exam crashes 392 vs 611 (fewer in 4/5 seeds);
  - training success 80 % vs 68 %; held-out success 63 % vs 54 %.
  - The exam score is too noisy for the rule.
- **New best racer:** `lineCheck` seed 3 (train-54): exam 19,170, 87 % of race checkpoints, 88 % of
  races finished, 136 crashes. Every blind model crashed 515–766 times.
- **Whiskers at g50** crash less than blind (268–497 vs 455–743), but some barely race (train-28: 12 %
  of checkpoints, nothing finished). Seeing makes some models cautious rather than skilful.
- **Reading:**
  - the sensors that add many inputs (7–9) did not help at today's network size, and the one that
    adds 2 did. That fits a capacity limit (4-10-8-6-4-2, and more mutated weights per child), which
    is what the user suspected;
  - the exam is very noisy at 5 seeds;
  - 150 generations may be short for richer inputs.

### Sensor check after E2 (asked by the user)

- **The sensors fire where there are rocks.** I recorded the model inputs in replays of the training
  scenarios and of exam races:
  - whiskers: non-zero 59–87 % of ticks in training, 90–100 % in the exam;
  - sectors: 84–100 % and 93–100 %;
  - lineCheck: 30 % in rock-in-line and 0 % in point-to-point, because scattered rocks rarely sit in
    the corridor to the target; 5–43 % in the exam;
  - nearest: always non-zero, because empty slots read 1.
- **The best model uses its sensor.** train-54 g150 re-flew the full exam and matched the recorded
  result (125 of 143 checkpoints, 136 crashes). With the lineCheck inputs forced to 0 it reached 75
  checkpoints with 596 crashes, which is blind-model level.
- **Why a later generation can be worse:** training scenarios are redrawn every generation from
  (seed, generation). The parent is re-scored on the new scenarios, and the best of 100 on one set
  is often a lucky child. The exam is never optimised directly.
- **Noise:** at g150 the paired exam differences of lineCheck vs blind ranged from −10,600 to
  +65,700, which is bimodal across seeds. The paired crash difference is steadier: 219 ± 200.

### M4 plan rewritten after E2 (agreed with the user)

- **Why:**
  - The user asked whether the model size is right, whether the basic inputs are well formatted,
    why the whiskers range is 600, how whiskers and sectors differ, and whether the numbers should
    be bigger.
  - A review of all training and config parameters against the physics and measured flights found:
    - angle inputs jump behind the ship;
    - the velocity angle is noise when slow;
    - inputs are small;
    - relative mutation almost never flips a weight's sign and drifts weights toward 0;
    - a single parent is replaced by lucky children;
    - crashes are cheap (500 against about 5,000 distance cost per episode);
    - training rocks are about 5× sparser than in the exam;
    - a 600 sensor range covers only speeds up to about 600 units/s (models reach 900–1,500).
- **Measured** (train-54, train-48, train-52 at g150):
  - speed median 200–300 units/s, p90 470–640, maximum 900–1,500;
  - two of the three models never used more than 90 % thrust.
- **New plan:**
  - step 6, setup switches (absent = off): `encoding: "v2"`, Gaussian `mutation`, `parents`,
    `initRange`, sensor `mode: "time"`, `nearest.pad: "flag"`;
  - step 7, task v2 by decision: crash cost 3,000, 2 rocks in line, 80 scattered, 16 + 8 episodes,
    6 held-out, seeds 1–10;
  - experiments E3 noise floor v2, E4 learner, E5 sensors again, E6 capacity, E7 confirmation.
- **Scope:** network size and part of the mutation and selection work moved from M6 to M4
  (roadmap updated).
- **Mistake:** when the user asked about model size, I answered with a proposal and a scheduling
  question instead of a direct recommendation. The user had to ask again. The recommendation is
  yes: change the layers, in E6, after the setup fixes.

### M4 step 6: training setup switches

All switches are absent when off. The stored baseline fixtures (legacy, p2p) still reproduce byte
for byte, and all earlier tests pass unchanged.

- **`encoding: "v2"`:** the inputs `targetSin`, `targetCos`, `targetDistanceSoft` (d / (d + 500)),
  `forwardSpeed` and `sideSpeed` (÷ 500), in the input registry (`ENCODINGS` in `model-spec.ts`).
  The game's bot and the trainer share `TargetVehicleController`, so v2 models play exactly as
  trained. A test flies a v2 model through the exam and its replay and gets equal results.
- **`mutation: { kind: "gaussian", sigma, rate? }`** (`mutateGaussian`, Box–Muller). Tested to be
  unbiased and to flip signs.
- **`parents: μ`:** (μ + λ) selection in `TrainingDirector`. The checkpoint stores all parents, and
  the `stateHash` covers them when the switch is on.
- **`initRange`:** range of the random starting weights.
- **Sensors:**
  - `horizon` (time to impact) for whiskers, sectors and lineCheck. Closing speed counts as at least
    100 units/s, and the default range becomes 2,500.
  - `nearest.flag: 1`: a "present" input per slot; empty slots read all 0.
- **Tests:** `setup-switches.test.ts` (new), plus a worker test with all switches on, including a
  kill-and-resume equal to an uninterrupted run, and seven new config validation cases.
- **Deviation from the plan:** the sensor options are numeric (`horizon: 2` instead of
  `mode: "time"`, `flag: 1` instead of `pad: "flag"`), like the other sensor parameters. The plan
  is updated.
- The plugin was rebuilt. Not yet done: any training run with the new switches (step 7 starts
  with a short check run).

### M4 step 7: task v2 checked; E3 started

- **Check run** (5 generations, seed 1, task v2 with lineCheck):
  - 12–20 s per generation, rising as models survive longer, plus 6.4 s per exam. The old task took
    6–8 s (train-47, train-52 with 5 runs in parallel). So a run takes 45–60 minutes.
  - Rock placement works: every generation has 24 rocks in line (12 episodes × 2) and 80 scattered
    rocks.
  - Crash cost against detour: a detour costs a few hundred unit-seconds of distance. A crash
    respawns at the episode start (re-flying ≥ 3,000 unit-seconds) plus 3,000. Crashing no longer
    pays.
- **Decision:** episodes stay at 16 + 8. The plan's 20-minute rule assumed 5 slots; with 20 worker
  slots and 24 threads the wall-time budget still holds. The plan is updated.
- **Mistake:** I ran the check run directly in this session instead of through Evo Lab. It was
  invisible in the UI, blocked the session for 90 s, and timed generations on an idle machine. The
  user asked why. Check runs go through the lab from now on.
- **E3 `m4-e3-noise-floor-v2`:** plan in `experiments/`, approved (the user approved step 7 and then
  E3). 10 runs to g50, train-57..66, running.

### Replay viewer goal display; S1 plan written

- **Viewer** (the user said the goal was unclear in Evo Lab):
  - only the current target is drawn, filled yellow with a thick ring, with a dashed line from the
    ship to it;
  - a white cross marks the episode start;
  - the caption states the goal;
  - "All targets" (key `t`) shows the other episodes' targets again;
  - the sensor's rock outline changed from yellow to orange-red.
  - Commit f4b7f9b. Checked in Evo Lab after a full page reload.
- **Friction:** Evo Lab's "Reload plugin" fails with "Extension type application already has a
  handler", because PixiJS registers its extensions a second time. A full page reload works. This
  is a limitation of our plugin, not of Evo Lab.
- **Training speed** (the user asked): about 21 s per generation with 10 runs in parallel (Evo Lab
  `analyze`, train-57 and train-64). That is about 1,000 ticks/s per run, about 70,000
  ship-steps/s, about 14 µs CPU per ship-step. The tick counts are estimated.
- **S1 training-speed plan** written (`doc/plans/S1-training-speed.md`), waiting for approval.

### M4 step 7b: curriculum switch

- **Asked by the user:** a smoother difficulty curve, first a clear line of sight, then more rocks.
  The plan was updated first (step 7b, experiment E3b; commit 802e66c).
- **`curriculum` switch** (commit 89af824, built on branch `m4-curriculum` in its own worktree
  because the S1 agent works in main, then fast-forwarded):
  - default levels: clear line → 1 rock → +20 scattered → 2 rocks + 40 → the v2 task;
  - level up after `streak` (3) generations with winner success ≥ `success` (0.8);
  - held-out scenarios on the last level;
  - level and streak in the checkpoint and the `stateHash`;
  - `level` on every gen event;
  - snapshots record their generation's arenas, and the plugin replays from them.
  - Tests: level-ups 0, 1, 2, 2 in a 4-generation run; exact resume and equal hashes; a replay from
    the snapshot's arenas places exactly the rocks training flew; config validation; defaults.
    `npm run check` green (226 tests).
- **E3b plan** written (`experiments/m4-e3b-curriculum.md`). It starts after E3 and after S1's
  baseline bench, which needs the machine to itself.
- Also answered: the viewer shows only lineCheck because E3's models have only that sensor;
  whiskers, sectors and nearest were E2 arms and return in E5.

### E3 result (m4-e3-noise-floor-v2, closed) and the generation-150 collapse

Report: [`experiments/m4-e3-noise-floor-v2.report.md`](../experiments/m4-e3-noise-floor-v2.report.md).
Runs: screen train-57..66, final train-67..76 (seeds 1–10). Task v2 with lineCheck, today's learner.

| metric | g50 | g100 | g150 |
| --- | --- | --- | --- |
| exam (mean ± sd) | 68,710 ± 41,490 | 42,160 ± 27,440 | 96,360 ± 49,030 |
| exam crashes | 146 ± 84 | 162 ± 46 | 190 ± 113 |
| exam checkpoints | 54 % | 72 % | 35 % |
| exam races finished | 42 % | 59 % | 25 % |
| training success | 13 % | 28 % | 14 % |

- **At g100** the v2 task looked like a clear step up: exam 42,160 against E1's blind 66,420 (at
  g150), and crashes 162 against 611.
- **After g100, 5 of 10 seeds collapsed:**
  - exam checkpoints at g150 fell to 0–8 % (seeds 5–9);
  - seed 7 dropped from 93 % at g120 to 1 % at g130;
  - seed 5 dropped from 87 % at g80 to 0 % at g150.
  - The collapsed g150 winners reach 0–1 of 24 training targets, crash 1–8 times and fly
    450–1,000 units per 9 s episode. The good seeds (1, 2) reach 10–14 targets and fly
    1,150–1,280. The collapsed models hover: passive, not crashing.
- **Cause, measured** with a temporary replay script (deleted):
  - seed 7's g127 winner (12 of 24 targets, 5 crashes, score 149,449) flew g128's new scenarios
    with 47 crashes in respawn loops: score 260,875 (distance 108,875 + 11 × 1,000 +
    47 × 3,000);
  - the passive g128 winner scored 204,469 on them (0 targets, 2 crashes);
  - on g129 and g130's scenarios the racer would have scored 206,453 and 195,666: about the
    passive level.
  - With crash cost 3,000, unlimited respawns and one parent re-scored on fresh scenarios, one
    crash-loop draw lets a passive child win, and the racer is lost for good.
  - Training score alone hid this: good and collapsed winners all score 184,000–212,000.
- **Signed off** with that reason. The proposed plan amendment (crash cap switch, `parents: 10` as
  the likely default, reading g100 as well) is in the M4 plan, marked PROPOSED, for the user.
- **E4 drafted:** `experiments/m4-e4-learner.md` (encoding v2, Gaussian mutation, parents 10,
  lineCheck horizon 2). Not created in Evo Lab; its baseline waits for E3b's result.
- **Evo Lab friction (reported to the Evo Lab session):** E3b declared E3's runs as
  `baseline.runs`. The gate re-ran them to g5 (train-77..86, passed), and then the experiment
  started 10 new baseline runs (train-88..97). That is by design (`docs/experiments.md`: every
  screen and continuation run is fresh and owned by the experiment), but it doubles a one-switch
  experiment on a busy machine. Suggested: an opt-in reuse of stored runs after a full,
  bit-identical gate.

### Replay viewer: model inputs panel, curriculum level, "Reload plugin" fixed

- **Asked by the user**, built in worktree `ar-viewer` (branch `viewer`) because other agents work in
  main. Commit 228a740 (code), fast-forwarded into main; plugin rebuilt in the main checkout.
- **Model inputs panel** (button "Inputs", key `i`; on by default, off in compact mode): one row per
  input neuron with its name, a bar over −1..1 and the value (values outside the range are clipped
  and shown orange), then thrust 0..1 and turn −1..1.
  - Names: the spec's inputs, then `whiskers[i]`, `sectors[i]`, `nearest[i].present/angle/dist/radius`,
    `lineCheck.near/offset` (`inputNames` in model-spec.ts).
  - `Replay.inputs?()` (ArenaReplay, ExamReplay) reads `TargetVehicleController.lastActivation()`:
    references to the controller's input buffer and the network's output array; names built on the
    first call. The hot path only stores one reference: no allocation, no extra random numbers, same
    order of computation. A test flies two identical replays, one watched, and checks the positions
    are equal every frame and that re-activating the shown inputs gives the shown outputs.
  - Note: these files are in the `binding`, so the binding hash changed with no change to training.
- **Curriculum level**: the caption says "level i/n" and thumbnails get an "Li/n" badge. The level
  comes from matching the snapshot's `arenas` against `applyLevel` of each configured level, with the
  gen's `level` metric as fallback. Old snapshots and runs without the switch show nothing.
- **"Reload plugin"** failed with "Extension type application already has a handler". Cause:
  render.js contained PixiJS modules whose top-level code registers extensions, and Evo Lab re-imports
  only render.js (cache-busting query) while the chunks it imports stay cached, so the registrations
  ran again against the cached registry. Fix: the plugin build puts every node_modules module into
  one `vendor-<hash>.js` chunk (rolldown `codeSplitting.groups`), so render.js has no PixiJS code.
- **Checked in Evo Lab** (built-in browser):
  - train-64: the panel shows 6 inputs live, `targetDistance` 1.01 clipped in orange. Clicking
    "Reload plugin" twice gave no error and no console errors, and the replay kept playing;
  - train-98 (curriculum): caption "train-98 · g23 · level 2/5" (the metric says level 1, 0-based).
    Thumbnails show L1/5 up to g17 and L2/5 from g19;
  - exam-6: the panel works for exam flights (4 inputs);
  - key `i` toggles the panel.
- `npm run check` green (231 tests).

### 2026-11-13 — M4: `crashLimit` switch (crash cap adopted)

- **Decision:** the user approved item 1 of the PROPOSED plan amendment after E3 (the crash cap).
  The plan marks it ADOPTED; items 2 (`parents: 10` as default) and 3 (read g100 too) stay
  proposals.
- **`crashLimit: N` switch** (integer ≥ 1, absent = no limit = the old behaviour), built on branch
  `crash-limit` in its own worktree (S1 and the viewer agent work in main), then fast-forwarded:
  - with `crashMode: "respawn"` an episode ends at its N-th crash; the rest of its time is charged
    at the crash distance, exactly as `crashMode: "end"` charges it (same code path in
    `ArenaScript`);
  - with `crashMode: "end"` it is accepted and changes nothing (every crash already ends the
    episode); a test shows the records are identical. Chosen over rejecting the combination, so
    the switch can sit on any baseline without a config error;
  - wired through `TrainingServiceOptions` → `TrainingOptions` → `ArenaScript`; it applies to
    training and held-out episodes. The exam is not affected (its own flights and rules);
  - `ArenaReplay` / `arenaReplaySource` take it, and the Evo Lab plugin passes `config.crashLimit`,
    so replays fly the episodes exactly as trained. The plugin was rebuilt in main after landing.
- **Tests:** unit (a rock on the start: `crashLimit: 1` + respawn gives exactly the `end` records;
  `crashLimit: 3` ends both episodes at 3 crashes with the whole time charged; `end` + limit =
  `end`); replay (a dense-rock setup with `crashLimit: 2` replays every winner to its recorded score,
  and without the option the replay scores differently); worker (deterministic, kill-and-resume
  equal to an uninterrupted run, winners never exceed the limit and some hit it, and the stateHash
  sequence differs from the same run without the switch); config validation (`0`, `1.5`). The
  stored baseline fixtures are unchanged (byte-identical with the switch absent).
- **E4 draft** (`experiments/m4-e4-learner.md`) gets `crashLimit: 3` as a fifth one-at-a-time
  switch (about 60 runs instead of 50). Still a draft: not created in Evo Lab.
- `doc/experiments.md` lists the switch.
- **Commit:** one commit, "M4: crashLimit switch (crash cap per episode, adopted after E3)".

## 2026-11-13 — S1: training speed (side track, done)

Plan: [`plans/S1-training-speed.md`](plans/S1-training-speed.md), approved by the user. Done by a
subagent next to M4's experiments.

| Commit    | What                                                                                   |
| --------- | -------------------------------------------------------------------------------------- |
| `f127ac7` | S1.1: `ticks` and `tps` metrics on every `gen` event (not in result.json or stateHash); bench workload `experiments/bench/train-v2.json` |
| `bb74f86` | S1.2: `experiments/bench/cpuprofile-to-labprof.mjs` (node `--cpu-prof` → Evo Lab `hotspots` input) |
| `3b021fa` | S1.3: the speed-ups (bit-identical)                                                    |
| (this)    | S1.4: gate and A/B results, workload at concurrency 1 and 4, hotspot report, docs      |

**Measured, not estimated.** A generation of the task v2 setup is about **101,500 game ticks**
(the plan guessed 21,600: episodes run to their own limits, and held-out episodes are flown by one
ship). Before S1 a run did about 5,000–7,000 ticks/s with other runs on the machine.

**Hotspots before** (`node --cpu-prof`, train-64 g50 → g53, share of sampled CPU, self time):
`ObstacleGrid.near` 9.4 %, `Vector2.distanceTo` (collisions, 100 ships × ~110 rocks per tick)
9.1 %, protobuf encoding (`ensureCapacity` 8.2 %, `finish` 4.5 %, `BinaryReader` 4.3 %, plus
`create`/`toBinary`/`fromBinary` helpers): about 30 % in total for messages that never leave the
process, `network.activate` 4.6 %, `firstOnLine` (lineCheck) 4.4 %, `broadcastUpdates` 3.1 %
self (37 % cumulative: the own-ship update of every bot every tick), GC 3.3 %.

**Hotspots after** (same workload, `experiments/bench/hotspots-s1.txt`): sampled CPU per
generation 21.4 s → 5.1 s (× 0.24). Top now: `network.activate` 15 %, `near` 14 %,
`detectCollisions` 9.5 %, `preUpdate` (inlined controller) 8.5 %, `broadcastUpdates` 4.9 %,
`firstOnLine` 4.2 %, GC 3.4 %. Protobuf encoding is gone from the profile.

**What changed (S1.3),** all exact by construction and checked against stored hashes:
- in-process receivers read the payload message the sender built; bytes only for the wire;
- own-ship ENTITY messages carry a snapshot that the receiver copies (instead of
  `toNet`/protobuf/`fromNet`);
- no closure per message in the sync local link; no per-tick sort of entity ranks when nothing is
  broadcast;
- collisions: an exact per-axis shortcut before `hypot` (`hypot ≥ max(|dx|, |dy|)`);
- obstacle grid: compressed-row cells and stamp deduplication (tested against the old grid,
  including equal ids, duplicates and a sparse world); lineCheck without per-rock allocations.

**Correctness (Evo Lab).** Baseline record `lab/profiles/train-v2/baseline-caec82f274b8.json`
(quality run train-87, code before S1.3). Candidate train-109 on the merged code:
`candidate-25c5d32c7da3.json`. Gate: **bit-identical** (stateHash equal at g51–g56, score and
exam metrics equal). Locally also: result.json bytes equal (sha256 `5915a9ef…`).

**Speed: paired A/B outside the runner** (commit `b4fcbb5` before the merge = A, `3b021fa` = B;
train-64 g50 → g54, seed 8; median `tps` of g52–g54 over all copies; A and B alternating,
CPU load and busy runner slots logged before each step):

| repeat | load (busy slots) | c1 A → B | c4 A → B |
| --- | --- | --- | --- |
| 1 | A 97 % (20) / B 20 % (11) | 3,913 → 25,654 | 4,182 → 21,813 |
| 2 | 25–39 % (10–11), both sides | 6,516 → 26,066 (4.0×) | 5,382 → 22,682 (4.2×) |
| 3 | A 38 % (10) / B 17–23 % (0–2) | 7,011 → 32,124 | 7,387 → 29,546 |

Repeat 2 is the only one with the same load on both sides: **about 4× ticks/s per run** at
concurrency 1 and 4. Repeats 1 and 3 had the load change between A and B (E3b's runs ended), so
they overstate the gain. The Evo Lab bench runs show the same direction under different loads:
train-87 2,670–4,959 tps (20 busy slots), train-109 11,544–12,892 tps.

**Decisions and deviations** (also in the plan's "Changes"):
- the workload runs to g56 with one quality seed (8): a from-checkpoint workload keeps the source
  run's seed;
- by the user's change of instructions (S1 must not block other work, E3b held all 20 slots):
  bench speed steps at concurrency 1 and 4, the queued baseline speed run train-108 stopped, the
  baseline record holds the quality run only, and speed was measured as the A/B above. No
  concurrency-10 figure; step 5 (scaling) not done.
- Optimisations were developed in a worktree (`../asteroid-racers-s1`, branch `s1-speed`) and
  merged fast-forward after rebasing onto main twice (main moved: curriculum, viewer, crashLimit).
- Real runs started on the new code will show the speed in their `tps` metric; none had started
  when this entry was written.

**Mistakes:**
- I started the candidate bench with `lab bench` under a 60 s `timeout`. The bench job lived in
  that CLI process, so killing it left the status file "running" with a dead `serverPid` after
  train-109 finished. I recorded the candidate and ran the gate with Evo Lab's profile module
  directly (`recordExperiment`, `compareExperiments`, `saveGate`); `lab gate` on the two records
  gives the same class.
- The first edit of `lab-train.ts` went through Python on Windows and turned the file into CRLF;
  converted back before the commit.

**Evo Lab friction (for the Evo Lab session):**
- `hotspots` reads only labprof cProfile exports; Node workers need a converter for `.cpuprofile`
  (ours is `experiments/bench/cpuprofile-to-labprof.mjs`).
- `lab bench` started from the CLI runs the job in the CLI process: when the CLI dies, the job dies
  silently and the status stays "running".
- A bench step whose run is stopped fails the whole bench, and nothing is saved; `record --save`
  then rebuilds from all `bench:<id>:` runs (mixing code versions when both sides exist).
- Bench speed steps queue behind a full budget for as long as other experiments hold it; there is
  no way to run them at a lower priority or outside the slots.
- `lab status` warns that the runner runs other evo-lab code than the client (7115b68d21c2 vs
  a1c2ec48e999).

### E3b result: the curriculum wins at g150 (m4-e3b-curriculum, closed)

- **Screen at g50:**
  - exam effect −10,390 against 2 × se 18,120, 6/10 seeds better: no clear difference, so Evo Lab
    continued no runs;
  - every curriculum run was still on level 1 (one rock in line, no scattered rocks);
  - the baseline arm (train-88..97) reproduced E3's g50 numbers exactly.
- **Continued to g150 anyway** (the user decided): `lab continue` from the g50 checkpoints,
  train-110..119, compared with E3's g150 runs train-67..76 on the same seeds.

  | seed | E3 exam | curriculum exam | E3 exam checkpoints | curriculum exam checkpoints | level at g150 (first gen at level 4) |
  |---|---|---|---|---|---|
  | 1 | 23,582 | 92,146 | 0.85 | 0.38 | 1 |
  | 2 | 26,918 | 19,006 | 0.88 | 0.87 | 4 (g65) |
  | 3 | 83,687 | 15,909 | 0.45 | 0.90 | 4 (g130) |
  | 4 | 72,840 | 9,931 | 0.51 | 0.94 | 4 (g78) |
  | 5 | 146,129 | 9,955 | 0.00 | 0.94 | 2 |
  | 6 | 139,131 | 44,369 | 0.05 | 0.71 | 1 |
  | 7 | 134,161 | 9,844 | 0.08 | 0.94 | 4 (g100) |
  | 8 | 142,159 | 9,083 | 0.03 | 0.94 | 3 |
  | 9 | 136,004 | 34,409 | 0.07 | 0.77 | 2 |
  | 10 | 59,000 | 82,620 | 0.60 | 0.44 | 1 |

- **g150, paired:**
  - exam 96,360 → 32,730 (effect −63,630, 2 × se 44,420, 8/10 better);
  - exam crashes 190 → 147;
  - races finished 25 % → 71 %;
  - training success 14 % → 68 %;
  - held-out success on the v2 task 12 % → 49 %.
  - **The decision rule is met, crashes are lower: the curriculum wins.**
  - At g100 it fell just short (−16,690 against 16,920, 7/10).
- **Collapse:** E3 had 5 seeds collapse (exam checkpoints < 10 % at g150 after ≥ 50 % earlier). The
  curriculum had none. Seed 1 fell from 0.71 to 0.38, the only notable decline.
- **New best exam scores**, about 9,000–10,000: seeds 4, 5, 7 and 8 reach 94 % of exam checkpoints,
  and 88–94 % of races finished. The previous best was 19,170 (train-54).
- **Levels:**
  - 4 seeds reached the v2 task (level 4), at g65, g78, g100 and g130;
  - one reached level 3, two reached level 2;
  - three stayed on level 1 for all 150 generations (seeds 1, 6, 10).
  - The level-up rule (80 % success, 3 generations in a row) looks too strict for level 1. Proposed
    in the M4 plan: lower `success` to about 0.6, for the user to decide.
- **Speed (S1 code):** the continued runs did median 19,610 ticks/s (12,467–32,143); their first
  50 generations on the old code did median 3,591. The machine load differed between the two.
- **Decision:** the curriculum (`curriculum: {}`) joins the baseline for E4.
- **Evo Lab:** E3b closed with the reason above. The screen rule stopped an arm whose effect only
  shows after its levels progress. For curriculum-style switches, a screen at g50 is too early.

### E4 learner (m4-e4-learner): run, report saved, NOT signed off

- **Plan** (commit 9c77011): baseline is E3b's winner (task v2 + lineCheck + `curriculum: {}`);
  stored baseline runs train-98..107. Six one-at-a-time arms; seeds 1–10; screen g100; final g150.
  Approved on the user's "Yes, start E4".
- **Gate:** passed. All 10 baseline runs reproduced (stateHash g1–g5) on today's code, which
  includes the S1 speed-ups, the viewer change and crashLimit.
- **Screen at g100** (paired exam effect vs baseline, 2 × se, seeds better). Lower exam is better.

| arm | exam | crashes | checkpoints | finished | success | heldOutSucc | effect (2se, better) | collapsed | levels (seeds 1–10) | tps median |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| baseline | 25,500 | 161 | 0.83 | 0.79 | 0.61 | 0.46 | – | 0 | 1,4,1,4,1,1,4,1,1,1 | 14,282 |
| encoding v2 | 31,000 | 207 | 0.79 | 0.72 | 0.70 | 0.47 | +5,575 (13,974, 6/10) | 0 | 2,3,1,1,4,1,2,4,1,1 | 13,521 |
| mutation gaussian 0.2 | 39,600 | 220 | 0.74 | 0.67 | 0.58 | 0.39 | +14,097 (25,551, 3/10) | 0 | 1,1,1,3,2,1,1,1,3,1 | 14,834 |
| parents 10 | 23,900 | 177 | 0.84 | 0.80 | 0.73 | 0.59 | −1,540 (12,453, 3/10) | 0 | 1,4,4,4,4,4,1,3,3,1 | 13,932 |
| lineCheck horizon 2 | 43,000 | 230 | 0.74 | 0.64 | 0.57 | 0.44 | +17,580 (10,037, 2/10): worse | 0 | 1,4,3,2,4,1,1,1,1,1 | 14,220 |
| crashLimit 3 | 33,500 | 262 | 0.78 | 0.74 | 0.63 | 0.47 | +8,078 (14,145, 3/10) | 0 | 2,4,1,2,4,1,4,3,1,1 | 14,120 |
| curriculum success 0.6 | 43,100 | 175 | 0.71 | 0.59 | 0.59 | 0.45 | +17,681 (10,978, 1/10): worse | 0 | 1,2,4,4,4,1,4,1,4,4 | 18,572 |

- **Screen rule:** the two "worse" arms (horizon, success 0.6) were informative and continued, with
  the baseline. The other four were screened out with no clear difference.
- **Final g150:**

| arm | exam | crashes | checkpoints | finished | success | heldOutSucc | effect (2se, better) | collapsed | levels | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| baseline | 32,700 | 147 | 0.78 | 0.71 | 0.68 | 0.49 | – | 0 | 1,4,4,4,2,1,4,3,2,1 | – |
| lineCheck horizon 2 | 41,500 | 177 | 0.72 | 0.67 | 0.59 | 0.45 | +8,764 (29,157, 4/10) | 1 | 1,4,4,4,4,1,1,1,1,1 | no clear difference |
| curriculum success 0.6 | 29,900 | 148 | 0.80 | 0.75 | 0.60 | 0.49 | −2,831 (12,289, 5/10) | 0 | 2,4,4,4,4,3,4,1,4,4 | no clear difference |

  (Collapsed = exam checkpoints < 10 % at g150 after ≥ 50 % earlier.) The baseline's g150 values
  equal E3b's continued curriculum runs, as expected.
- **Reading:**
  - No switch wins. Evo Lab's verdict is "no clear difference" for all six (four screened out at
    g100).
  - `curriculum.success: 0.6` got 8 of 10 seeds to level 3–4 by g150 (baseline: 5 of 10) without
    hurting the exam at g150. It was worse at g100, while seeds were still climbing.
  - `parents: 10` had the best g100 numbers (exam 23,900, held-out success 0.59, 6 seeds at level 4)
    but was not continued: its effect is not beyond noise.
  - Time-to-impact lineCheck is worse at g100 and not better at g150.
  - No arm collapsed at g100, and only one seed collapsed at g150 (horizon arm). The curriculum
    baseline seems to prevent E3's collapse on its own.
- **Speed:** median 13,500–18,600 ticks/s per run with up to 20 runs in parallel; the whole E4 took
  about 50 minutes of wall time.
- **Not signed off:** adoption is the user's decision. Report: `experiments/m4-e4-learner.report.md`.

### Best-practice research; M4 plan rewritten (agreed with the user)

- **Research:** the user asked how such trainings are best conducted. A research agent compared our
  setup with the literature: Such et al. 2017, Salimans et al. 2017, Hansen's CMA-ES tutorial,
  World Models, Togelius & Lucas, Agarwal et al. 2021 and more. The write-up, with sources and
  reliability markers, is in [`research/neuroevolution-best-practices.md`](research/neuroevolution-best-practices.md).
- **Main findings:**
  - nothing re-checks the best of 99 noisy children before it replaces the parent: the winner's
    curse, and the mechanism behind E3's collapse;
  - a 17-race exam is underpowered for small effects;
  - our relative mutation is non-standard, and E4's Gaussian arm (σ 0.2 on 10 % of the weights)
    was not the standard form either;
  - CMA-ES suits about 250 weights;
  - 10-8-6-4 is unusually deep for a small control task;
  - scoring rewards hovering, and a progress term is the usual fix.
- **What we already do right:** shared scenarios per generation, re-scoring the parent, a staged
  curriculum, a few egocentric task-specific sensors, paired seeds.
- **The user agreed to rewrite the plan.** `doc/plans/M4-perception.md` now has:
  - step 8: `reevaluate`, exam v2 (102 races every 25 generations) with IQM and bootstrap CIs, the
    standard Gaussian (`rate: 1`, σ 0.03), `hidden: [16]` and `[]`, a `progress` score term,
    `curriculum.keepEasy`;
  - step 9: CMA-ES;
  - experiments E5 (noise floor v3), E6 (learner done properly), E7 (CMA-ES), E8 (richer sensors
    again, capacity folded in), E9 (confirmation at g300).
  - The old E5–E7 are superseded, with the reason recorded.
  - `doc/ROADMAP.md` is updated: re-evaluation and CMA-ES move from M6 into M4; quality diversity
    is listed for later.
- **Checked while rewriting:**
  - `mutation: { kind: "gaussian", rate: 1 }` already works, since `rate` is accepted in (0, 1];
  - `hidden: []` passes the config check, and `MajorTom` builds and activates a [4, 2] network;
  - 17 exam races take about 1.6 s on the S1 code (train-250), so 102 races take about 10 s;
  - Evo Lab's reports have no IQM or bootstrap CIs.

### M6 plan written; M5 game side started

- **M6 plan** written (`doc/plans/M6-experiments.md`, commit 453b714), waiting for approval:
  - lookahead (needs a `chain` arena), latency and robustness, crossover, mutation schedules,
    curriculum v2 (needs M5), MAP-Elites (optional);
  - experiments X1–X7;
  - a readiness report before any model goes into the game.
  - Switch code for steps 1–4 can be built before M4 ends.
- **M5 game side started** (user approved): track format, three tracks, track picker. It works in
  its own worktree, and the exam, existing tracks and training arenas stay unchanged.

### E4 signed off; E4b confirmation (parents 10 + curriculum success 0.6)

- **E4 closed** in Evo Lab (user decision): no switch wins. `parents: 10` and
  `curriculum.success: 0.6` went to a combined confirmation; lineCheck `horizon` and Gaussian
  mutation are dropped.
- **E4b `m4-e4b-confirm`:**
  - leave-one-out with two switches (baseline, `full`, each alone), seeds 1–10, all arms to g150;
  - the screen is at g150 and `final` at 151, because Evo Lab requires `final.gen` > `screen.gen`;
  - plan and report in `experiments/`; gate passed (train-230..239 identical to train-98..107,
    stateHash g1–g5); 40 runs (train-240..279, continuations train-280..).

  | arm | g | exam | crashes | checkpoints | finished | success | held-out | levels by seed (0–4) |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | baseline | 100 | 25,466 | 161 | 0.83 | 0.79 | 0.61 | 0.46 | 1,4,1,4,1,1,4,1,1,1 |
  | baseline | 150 | 32,727 | 147 | 0.78 | 0.71 | 0.68 | 0.49 | 1,4,4,4,2,1,4,3,2,1 |
  | full (both) | 100 | 31,835 | 183 | 0.79 | 0.74 | 0.70 | 0.56 | 1,4,4,4,4,4,1,1,4,1 |
  | full (both) | 150 | 18,268 | 147 | 0.88 | 0.84 | 0.73 | 0.60 | 1,4,4,4,4,4,4,3,4,1 |
  | success 0.6 only | 150 | 29,896 | 148 | 0.80 | 0.75 | 0.60 | 0.49 | 2,4,4,4,4,3,4,1,4,4 |
  | parents 10 only | 150 | 32,835 | 175 | 0.78 | 0.72 | 0.77 | 0.60 | 1,4,4,4,4,4,2,4,4,1 |

- **Decision at g150:**
  - `full` vs baseline: −14,460 (2 × se 18,250), 5 of 10 seeds better, so no clear difference. The
    rule is not met; crashes are equal (147).
  - Contribution of parents, given success 0.6 (`full` vs success 0.6 only): −11,630 (2 × se
    10,030), 8 of 10 seeds better, so better.
  - Contribution of success 0.6, given parents 10: −14,570 (2 × se 19,480), no clear difference.
  - Parents alone vs baseline: +108, no effect. The two switches seem to help only together.
- **Collapse:** none in any arm (exam checkpoints < 10 % at g150 after having been ≥ 50 %).
- **Speed:** median `tps` per arm 11,300–14,100, with up to 20 runs in parallel.
- **Mistake:** I committed the small plan fix (`final.gen` 151) before running `npm run check`.
  The check run right after passed (doc-only change), but the order broke the rule.
- **Not signed off:** adoption is the user's decision.

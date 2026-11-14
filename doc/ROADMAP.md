# Roadmap

The goal: AI racers that can actually fly the game's race courses. To get there we first build the
training infrastructure (arenas, measurement, visibility). Then we use Evo Lab to run experiments:
new inputs, network sizes, curricula and mutation strategies.

How we work is described in [`CLAUDE.md`](../CLAUDE.md). Each milestone gets its own plan in
[`doc/plans/`](plans/) before work starts. What actually happened goes in [`HISTORY.md`](HISTORY.md).

## Where we stand (2026-11-14)

- **Done:** M1–M5, M7 (Benchmark v2), the speed side tracks S1 and S2, and D1 (the game is live).
- **Baseline** (adopted by the user after M6 batch A and decision point 2): M4's default setup (task
  v2, `lineCheck`, curriculum at 60 %, 10 parents) + the residual controller (scale 0.5) + the
  progress reward (3) + `curriculum.keepEasy: 0.25`. Runs train-585..604: exam3 51.9 at g150 (20
  seeds); without keepEasy 50.4.
- **Decision rule:** exam3 averaged over g125–150 per seed (adopted 2026-11-14), IQM over 20 seeds,
  paired 95 % bootstrap CI, `minEffect`, vetoes. No cap on experiments per phase (the budget rule
  was dropped 2026-11-14).
- **Yardstick:** exam v3's `exam3` (0–100), with `exam3Crashes` as a veto. The scripted controller
  alone scores 52.6. 20 seeds detect about 2–3 points. Exam v2 (checkpoints about 0.90) is
  saturated and kept for continuity.
- **Known problems:**
  - **exam3 is flat at about 50 from g5 to g150:** the network learns crash avoidance, not racing.
    The training task is mastered by g13–18, so curriculum tweaks on it do nothing (batch B);
  - medium and hard generated tracks: exam3 medium about 14–20, hard about 20 (crash loops in
    narrow corridors and belts);
  - single generations' winners can drop sharply on one exam: residual models sometimes freeze at
    the start (seed 5 at g150), see the history.
- **M6 decision point 2, decided by the user 2026-11-14:** after the combination check
  (`m6-a3-combination`, rotation 20: no win, fewer crashes, slower) and batch B (`m6-b-curriculum`:
  keepEasy +1.4, below the 3-point minimum; plateau, m5tiers, heldOutCurrent no effect; m7gen
  worse):
  - rotation 20 not adopted ("I'd rather have faster races"): finish time matters more than fewer
    crashes. The residual controller already made it largely obsolete (spin about 1 → 0.3);
  - keepEasy 0.25 adopted; the averaged decision rule adopted; the budget rule dropped.
- **Now:** M8 (race training) is planned and waits for the user's approval. M6 pauses after decision
  point 2 and resumes after M8.

## Milestones

Status: ⬜ not started · 🟡 in progress · ✅ done

### M1 — Training foundations ✅

Plan: [`plans/M1-training-foundations.md`](plans/M1-training-foundations.md). Done 2026-11-13; CI
green on `b45baa7`.

Make the trainer generic enough that new courses, inputs and scoring are config rather than code:

- Fix the stale first frame on teleport (the cause of the score wobble within a run).
- **Arena** interface: seeded scenarios that change every generation, plus a held-out set.
- A **model spec** stored with every model: which inputs, the layout, and the output mapping.
- Collision groups: bots hit asteroids but not each other.
- A scoring library (success, time, crashes) with configurable weights.
- Everything selectable from the Evo Lab config.

**Done when** the legacy course runs as an arena with results that match train-1 within noise, and a
second arena (point-to-point) runs from config alone.

### M2 — Measurement ✅

Plan: [`plans/M2-measurement.md`](plans/M2-measurement.md), approved 2026-11-13. Done 2026-11-13;
CI green on `13d7240`. Best racer so far: train-4 g110 (exam 3,579, finishes 6 of 7 races).

- **Race exam:** an Evo Lab evaluate-only method. It flies a model through the real race tracks and
  reports checkpoints reached, finish time and crashes.
- Model snapshots at each generation (or every K generations), so the exam can be scored along a run.
- ~~Held-out scores shown next to training scores, so overfitting is visible.~~ Done in M1
  (`heldOut`, `heldOutSuccess` metrics).

### M3 — Visibility ✅

Plan: [`plans/M3-visibility.md`](plans/M3-visibility.md), approved 2026-11-13. Done 2026-11-13;
CI green on `ab90101`

- One replay viewer that re-simulates any flight exactly (model + scenario + seed), used in two
  places:
  - an **Evo Lab renderer plugin** (the main way to watch): any generation of a training run, any
    exam flight, path thumbnails in the filmstrip;
  - an in-game **watch page**: the bundled model or a model file on any track.

### M4 — Perception ✅

Plan: [`plans/M4-perception.md`](plans/M4-perception.md), approved 2026-11-13

Models cannot see asteroids (M3 finding: crash loops on rocks in line). This milestone finds out,
by experiment, how a model should sense obstacles:

- candidate sensors as switchable inputs (e.g. whiskers, sectors, nearest obstacles, a clear-line
  check), a `rock-in-line` arena that demands avoidance, and an exam metric inside training runs;
- a variant harness on Evo Lab experiments: matched seeds, a baseline gate, a decision rule on the
  race exam;
- a training setup that can learn from sensors (input encoding, mutation, selection, the
  training task), fixed after the E2 review;
- experiments, done: E1 noise floor, E2 sensors (`lineCheck` wins), E3 noise floor v2, E3b
  curriculum (wins, ends the passive collapse), E4 learner switches and E4b (no clear difference;
  the user adopted `parents: 10` + `curriculum.success: 0.6` as the default by judgement);
- **closing** (agreed 2026-11-13): the goal is met (exam about 18,300 vs 66,400 blind, crashes
  147 vs 611, races finished 84 % vs 39 %). What remains: step 8 lands, and E9 confirms the
  default setup at g300 with the 102-race exam. E5–E8 and CMA-ES moved to M6.

### S1 — Training speed ✅ (side track)

Plan: [`plans/S1-training-speed.md`](plans/S1-training-speed.md), done 2026-11-13: about 4× ticks/s per
run, bit-identical (Evo Lab gate). Step 5 (parallel scaling) not done.

Training runs at about 1,000 game ticks/s per run (about 14 µs CPU per ship-step). Profile it,
remove the overheads, and prove with Evo Lab's bench and gate that results stay bit-identical while
ticks/s at least double. Runs in the gaps between M4's experiments.

### S2 — Training speed, round 2 ✅ (side track)

Plan: [`plans/S2-training-speed-2.md`](plans/S2-training-speed-2.md), approved by the user 2026-11-13

The ranked speed-ups from the performance analysis: a training fast path for bots, a faster
`lineCheck` query, a collision grid, batched network passes. Goal ≥ 1.4× training ship-steps/s and
about 1.6× faster exams, bit-identical.

Done 2026-11-13: 1.55× (one run) and 1.66× (10 runs) training ship-steps/s, exam 1.49× (one run),
Evo Lab gate bit-identical. Batched network passes skipped (under the 3 % bar). New switch
`heldOutEvery: N`.

### M5 — Content ✅

Plan: [`plans/M5-content.md`](plans/M5-content.md). Game side (track files, three tracks, track
picker) and training side (six tiered arenas, the watch page's arena mode, baseline runs) done
2026-11-13.

- A track file format, three hand-designed tracks (`slalom`, `gauntlet`, `canyon`) and a track
  picker in the game.
- Tiered training arenas: tier 1 `stop`, `turn-and-go`, `chain`; tier 2 `corridor`, `field`;
  tier 3 `race-legs`. Moving obstacles are dropped: the game has none.
- ~~Race exam v2~~: moved to M4 (step 8).

### M6 — Experiments 🟡 (paused after decision point 2 for M8)

Plan: [`plans/M6-experiments.md`](plans/M6-experiments.md), approved 2026-11-13. All switch code for
phases 1–5 is built, 3.4's `controller` switch included. Optional MAP-Elites is not built. Paused
2026-11-14 for M8 (race training); it resumes after M8, on the M8 setup.

Five phases, each ending in a decision point where the user decides what is adopted:

1. **Measurement ✅:** 1.1 re-evaluation, no clear difference, stays out. The yardstick: the IQM of
   exam checkpoints at g150, 10 seeds; it can detect about 3 points.
2. **Rewards, metrics and curriculum:**
   - 2.0 headline metrics ✅;
   - 2.1 progress reward (fixes the reward trap; a prerequisite for 2.6 and 3.1);
   - 2.2 crash and miss costs;
   - 2.3 time to target (lower priority: speed already pays);
   - 2.4 mixing easy episodes;
   - 2.5 plateau rule;
   - 2.6 tiered curriculum (5 levels from M5's arenas);
   - 2.7 level-aware held-out;
   - 2.8 rotation cost (against spinning).
3. **Perception and control:**
   - 3.1 lookahead (nose and corner frames): moved into M8;
   - 3.2 richer sensors;
   - 3.3 network size;
   - 3.4 residual policy / heading output (the scripted controller steers, the network corrects).
4. **The learner:** 4.1 standard mutation, 4.2 crossover, 4.3 mutation schedules, 4.4 CMA-ES.
5. **Robustness and readiness:** 5.1 latency and noise, 5.2 final confirmation, then the readiness
   report for the game (the user decides on promotion).

Only if needed: Q.1 quality diversity (MAP-Elites).

**Order** (agreed with the user):
1. ✅ Skills exam and 3.4's `controller` switch built.
2. ✅ Batch A (2.1 progress, 2.2 costs, 2.8 rotation, 3.4 residual), decided 2026-11-14: residual 0.5
   and progress 3 adopted by judgement.
3. ✅ M7 (Benchmark v2): exam v3 is the yardstick from now on.
4. ✅ The combination check `m6-a3-combination` (rotation 20 on the new baseline), 20 seeds, exam3:
   no win by the rule (fewer crashes, slower); not adopted (user, 2026-11-14: faster races
   matter more).
5. ✅ Batch B `m6-b-curriculum` (2.4, 2.5, 2.6 in two variants, 2.7) on the new baseline without
   rotation, reusing step 4's baseline runs: no win by the rule (keepEasy +1.4, below the 3-point
   minimum; m7gen worse). Decision point 2 (2026-11-14): keepEasy 0.25 adopted by judgement, the
   rest dropped; decisions on exam3 averaged over g125–150; budget rule dropped.
6. ⏸ **M6 pauses here** (agreed 2026-11-14): M8 race training comes first. Phase 3.1 (lookahead)
   moves into M8, tested together with race training.
7. After M8, on the M8 setup: phase 3.2 (sensors) and 3.3 (network size), then phase 4 (the
   learner).
8. Phase 5 (robustness and readiness) last.

### M7 — Benchmark v2 ✅

Plan: [`plans/M7-benchmark-v2.md`](plans/M7-benchmark-v2.md), approved by the user 2026-11-14.
Inserted between M6's batch A and the rest of M6. Done 2026-11-14: all acceptance items ticked; M6's
combination check and batch B are planned on exam v3.

- S1 ✅: a procedural track generator with corridors, hairpins, gates, rock fields, straights into
  tight turns, belts and chicanes, in difficulty bands (`generated:<band>`, arena
  `generated-legs`).
- S2 ✅: goal types, in the race controller, as optional game modes and in training: stop at the
  finish, directional gates, time trials with par times, laps. Track format v2.
- S3 ✅: 7 more hand-made tracks (10 in total), in track format v2.
- S4 ✅: exam v3.0, with a pre-registered primary score `exam3` (0–100) that doesn't saturate and
  a profile per difficulty band, goal type and skill (`npm run exam3`, `exam: { v3: {} }`). It
  shows the residual controller's gain that exam v2 missed. Exam v2 is kept for comparison.
- S5 ✅: the generator and goal types available to training and the curriculum: goal params on
  `generated-legs` and `race-legs` (gates, stop, laps, par), arenas `gates` and `laps`, an opt-in
  `scoring.par`, generated levels in tiered curricula.

### M8 — Race training 🟡 (planned, waiting for approval)

Plan: [`plans/M8-race-training.md`](plans/M8-race-training.md), written 2026-11-14; waits for the
user's approval. Inserted between M6's decision point 2 and the rest of M6 (direction agreed
2026-11-14).

Make races the main training task, so the network learns racing and not only crash avoidance:

- many fresh generated race legs per generation (12 tracks), in levels easy → medium → hard
  promoted by success, with easy material kept in; goal types mixed in once the basics work;
- lookahead (M6 3.1), tested together with race training;
- a check of the generator's traps (S5's first leg into a corridor wall, S4's four stall races);
  exam v3.0 stays frozen;
- selection robust against single-winner flukes; decisions on exam3 averaged over g125–150;
- the hand-made tracks and the exam3 seeds are never trained on.

**Done when**, each by a 20-seed pre-registered test: exam3 clearly rises with training, medium and
hard are well above today's 14–20, and the M8 setup beats the scripted controller's 52.6 on exam3.

### D1 — Deploy and showcase ✅ (side track)

Put the game online at https://asteroid-racers.cypherpunk.agency. No separate plan: the scope came
with the user's request.

- **Deploy:** a container image (`Dockerfile`, non-root, read-only root filesystem), `GET /health`,
  and `.github/workflows/deploy.yml` (push to `production` → check, build, Trivy scan, push to
  ghcr.io). The server side (Caddy, compose, the deploy job) belongs to the Infra session. See
  [`deploy.md`](deploy.md).
- **Showcase and phone play** (plan [`plans/D1-showcase.md`](plans/D1-showcase.md)): touch
  controls and a phone layout; a showcase page that flies the latest accepted model (train-502
  g150, residual 0.5) and comparison models through every track, the skill arenas and exam v2,
  with live and headless results; racing against a showcase model (`?opponent=`). No model is
  promoted into the game: the user decides after real races.
- **Live** since 2026-11-14 (first deploy run 43593522141, verified by Infra). Routine releases:
  push to `production`.

## Open questions

Each question below has a default we work with until it is answered.

| Question                                                        | Working assumption                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------------------- |
| What counts as "good"? Finishing, lap time, or beating humans?  | Finish the race tracks reliably first, then lap time.               |
| Neuro-evolution only, or other algorithms too (e.g. RL)?        | Neuro-evolution only; keep the model interface algorithm-neutral.   |
| Are extra sensors (whiskers) fair, given human players lack them? | Allowed for experiments; decide before shipping a model into the game. |
| Who designs the tracks? Is there a track picker for players?    | Hand-designed by us in M5; a simple picker in the game.             |
| Are trained models promoted into the game automatically?        | Manually, after the race exam.                                      |
| When do local commits get pushed?                               | Only when the user asks.                                            |

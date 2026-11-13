# Roadmap

The goal: AI racers that can actually fly the game's race courses. To get there we first build the
training infrastructure (arenas, measurement, visibility). Then we use Evo Lab to run experiments:
new inputs, network sizes, curricula and mutation strategies.

How we work is described in [`CLAUDE.md`](../CLAUDE.md). Each milestone gets its own plan in
[`doc/plans/`](plans/) before work starts. What actually happened goes in [`HISTORY.md`](HISTORY.md).

## Where we stand (2026-11-13)

- The Dart → Node.js/TypeScript port is finished ([plan](plans/PORTING_PLAN.md), all phases ✅).
- Evo Lab runs training through `lab.config.json` → `scripts/lab-train.mjs`, with protocol v1 and
  exact resume.
- **train-1** (200 generations, seed 2026) reached a best score of 19,050. The bundled interim model
  scores 33,937. The improvement does not carry over to the game:
  - On 5 unseen courses: 34,853 vs 36,015.
  - In real races, neither model reaches a single checkpoint.
- **Why:** the training course covers only ~1,000 units and has no obstacles, while race legs are
  1,200–2,400 units apart with asteroids in between. The bots learn the one course they are trained
  on, not how to race.

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

### M4 — Perception 🟡

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

### M5 — Content 🟡 (game side)

Plan: [`plans/M5-content.md`](plans/M5-content.md). Game side (track files, three tracks, track
picker) started 2026-11-13 with the user's OK; the training side waits for M4.

- A track file format, three hand-designed tracks (`slalom`, `gauntlet`, `canyon`) and a track
  picker in the game.
- Tiered training arenas: tier 1 `stop`, `turn-and-go`, `chain`; tier 2 `corridor`, `field`;
  tier 3 `race-legs`. Moving obstacles are dropped: the game has none.
- ~~Race exam v2~~: moved to M4 (step 8).

### M6 — Experiments 🟡

Plan: [`plans/M6-experiments.md`](plans/M6-experiments.md), approved 2026-11-13. Switch code (steps
1–4) is built (lookahead, input delay and noise with a robustness exam, crossover, mutation
schedules); experiments start once M4 is closed.

Five phases, each ending in a decision point (at most 6 experiments per phase):

1. **Measurement:** 1.1 noise floor with re-evaluation.
2. **Rewards, metrics and curriculum** (the most important phase): 2.0 headline metrics, 2.1 progress
   reward, 2.2 crash and miss costs, 2.3 time to target (optional), 2.4 mixing easy episodes, 2.5
   level-up thresholds, 2.6 tiered arenas (from M5), 2.7 level-aware held-out.
3. **Perception and capacity:** 3.1 lookahead, 3.2 richer sensors, 3.3 network size.
4. **The learner:** 4.1 standard Gaussian mutation, 4.2 crossover, 4.3 mutation schedules, 4.4 CMA-ES
   (optional, last).
5. **Robustness and readiness:** 5.1 latency and noise, 5.2 final confirmation at g300, then the
   readiness report for the game (the user decides on promotion).

Only if needed: Q.1 quality diversity (MAP-Elites).

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

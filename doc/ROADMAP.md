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

### M3 — Visibility 🟡

Plan: [`plans/M3-visibility.md`](plans/M3-visibility.md), approved 2026-11-13. All steps are done and the
acceptance items are ticked, except CI, which runs only after a push

- One replay viewer that re-simulates any flight exactly (model + scenario + seed), used in two
  places:
  - an **Evo Lab renderer plugin** (the main way to watch): any generation of a training run, any
    exam flight, path thumbnails in the filmstrip;
  - an in-game **watch page**: the bundled model or a model file on any track.

### M4 — Content ⬜

Plan: [`plans/M4-content.md`](plans/M4-content.md) (waiting for approval)

- A track file format, three hand-designed tracks (`slalom`, `gauntlet`, `canyon`) and a track
  picker in the game.
- Tiered training arenas: tier 1 `stop`, `turn-and-go`, `chain`; tier 2 `rock-in-line`, `corridor`,
  `field`; tier 3 `race-legs`. Moving obstacles are dropped: the game has none.
- Race exam v2 with the new tracks and 15 random tracks, so a single crash loop weighs less.

### M5 — Experiments ⬜

Each one is an Evo Lab experiment, compared against a baseline on the race exam:

1. Curriculum (tiered arenas) vs the current single course.
2. Inputs: lookahead to the next target and beyond, obstacle whiskers.
3. Network size and shape.
4. Mutation and population strategy (rate and strength schedules, (μ+λ), crossover).
5. Latency and robustness (delayed inputs, noise).

## Open questions

Each question below has a default we work with until it is answered.

| Question                                                        | Working assumption                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------------------- |
| What counts as "good"? Finishing, lap time, or beating humans?  | Finish the race tracks reliably first, then lap time.               |
| Neuro-evolution only, or other algorithms too (e.g. RL)?        | Neuro-evolution only; keep the model interface algorithm-neutral.   |
| Are extra sensors (whiskers) fair, given human players lack them? | Allowed for experiments; decide before shipping a model into the game. |
| Who designs the tracks? Is there a track picker for players?    | Hand-designed by us in M4; a simple picker in the game.             |
| Are trained models promoted into the game automatically?        | Manually, after the race exam.                                      |
| When do local commits get pushed?                               | Only when the user asks.                                            |

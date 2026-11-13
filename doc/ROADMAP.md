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
- **train-1** (200 generations, seed 2026) reached a best score of 19,050. The bundled interim brain
  scores 33,937. The improvement does not carry over to the game:
  - On 5 unseen courses: 34,853 vs 36,015.
  - In real races, neither brain reaches a single checkpoint.
- **Why:** the training course covers only ~1,000 units and has no obstacles, while race legs are
  1,200–2,400 units apart with asteroids in between. The bots learn the one course they are trained
  on, not how to race.

## Milestones

Status: ⬜ not started · 🟡 in progress · ✅ done

### M1 — Training foundations ⬜

Plan: [`plans/M1-training-foundations.md`](plans/M1-training-foundations.md)

Make the trainer generic enough that new courses, inputs and scoring are config rather than code:

- Fix the stale first frame on teleport (the cause of the score wobble within a run).
- **Arena** interface: seeded scenarios that change every generation, plus a held-out set.
- A **brain spec** stored with every brain: which inputs, the layout, and the output mapping.
- Collision groups: bots hit asteroids but not each other.
- A scoring library (success, time, crashes) with configurable weights.
- Everything selectable from the Evo Lab config.

**Done when** the legacy course runs as an arena with results that match train-1 within noise, and a
second arena (point-to-point) runs from config alone.

### M2 — Measurement ⬜

- **Race exam:** an Evo Lab evaluate-only method. It flies a brain through the real race tracks and
  reports checkpoints reached, finish time and crashes.
- Brain snapshots at each generation (or every K generations), so the exam can be scored along a run.
- Held-out scores shown next to training scores, so overfitting is visible.

### M3 — Visibility ⬜

- **Watch page:** an in-game spectator mode. Pick a brain (bundled, file or Evo Lab run snapshot) and
  an arena or track, then watch it fly with a free or follow camera.
- An Evo Lab renderer plugin, so a run's snapshots can be replayed from the Evo Lab UI.

### M4 — Content ⬜

- Tier 0–1 arenas: straight-line target, turn-and-go, stop on target, slalom.
- A track file format, 3–4 hand-designed race tracks, and a track picker in the game.
- Tier 2–3 arenas: asteroid fields, moving obstacles, full laps.

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
| Neuro-evolution only, or other algorithms too (e.g. RL)?        | Neuro-evolution only; keep the brain interface algorithm-neutral.   |
| Are extra sensors (whiskers) fair, given human players lack them? | Allowed for experiments; decide before shipping a brain into the game. |
| Who designs the tracks? Is there a track picker for players?    | Hand-designed by us in M4; a simple picker in the game.             |
| Are trained brains promoted into the game automatically?        | Manually, after the race exam.                                      |
| When do local commits get pushed?                               | Only when the user asks.                                            |

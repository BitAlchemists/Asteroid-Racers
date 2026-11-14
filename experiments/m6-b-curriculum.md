# Experiment: m6-b-curriculum

M6 batch B (phase 2b, the curriculum), agreed with the user 2026-11-14 ("yes" to "close M7 and
start the combination check, then batch B"). One experiment, one switch per arm, all against the
new M6 baseline **without** rotation cost; the user's decision on `scoring.rotation` (from
`m6-a3-combination`) is not waited for. Judged on exam v3. It replaces the four per-arm drafts
`m6-2-4-keep-easy.md`, `m6-2-5-thresholds.md`, `m6-2-6-tiered-curriculum.md` and
`m6-2-7-heldout-level.md`, which predate exam v3 and the new baseline.

**Baseline:** exactly `m6-a3-combination`'s baseline arm: M4's default setup (E9's config) +
`controller: {kind: "residual", scale: 0.5}` + `scoring.progress: 3`, exam v2 + exam v3 + skills
every 25 generations. Its g150 runs (train-545..564, seeds 1–20) are reused (`reuse: true`); the
gate re-runs them to g5 first.

**Arms:**

| Arm | Switch | Question |
| --- | --- | --- |
| 2.4 keep easy | `curriculum.keepEasy: 0.25` | Does keeping a quarter of each arena's episodes from earlier levels prevent forgetting? |
| 2.5 plateau | `curriculum.plateau: {}` (floor 0.5, patience 10, alpha 0.2, minGain 0.02), next to the fixed 0.6 rule | Does moving up when success stops improving help seeds that stall on a level? |
| 2.6 tiered, M5 arenas (`m5tiers`) | `curriculum.levels`: 5 levels, below | Do levels built from M5's skill arenas beat levels that only add rocks? |
| 2.6 tiered, M7 generated (`m7gen`) | `curriculum.levels`: 4 levels, below | Do levels of generated race tracks with the M7 goal types beat them? |
| 2.7 level-aware held-out | `curriculum.heldOutCurrent: true` | A measurement: does a held-out metric at the flown level track the exam better? |

**2.6, `m5tiers`** (unchanged from `m6-2-6-tiered-curriculum.md`, ordered by M5's measured
difficulty): `stop` + `turn-and-go` → `chain` + `race-legs` → rock-in-line 1 rock + point-to-point 20
rocks → 2 rocks + 40 rocks → the v2 task. `corridor` and `field` are left out (too hard as gates in
M5). Its prerequisite, the progress term against the multi-target reward trap, is in the baseline
now.

**2.6, `m7gen`** (from `m7-s5-generated-curriculum.md`, the M7 S5 example, not run before):
generated easy legs + `stop` + `gates` → easy/medium legs with the track's own directional gates +
gated `laps` → medium legs (+ a stop at the end) → hard legs + medium/hard with a stop + the v2
task. **Caveat:** exam v3 races are mostly generated tracks, so this arm trains on the exam's
distribution (not its tracks: training draws 32-bit track seeds, the exam uses fixed seeds
300001–340005). That is the point of the arm (the exam is meant to look like the races we want to
win), but its exam3 gain is partly expected by construction; the hand-made and skills categories
and exam v2 are the out-of-distribution check.

**2.7** changes no training choice: the extra held-out flight runs on its own servers, so its
`stateHash` and exam scores should equal the baseline's seed for seed (checked; a difference would
be a bug). Its decision is not on exam3 but on the measurement question (below).

```json experiment
{
  "id": "m6-b-curriculum",
  "question": "On the new M6 baseline (M4 default + residual 0.5 + progress 3), which of keepEasy 0.25 (2.4), the plateau rule (2.5) and a tiered curriculum of M5 arenas or of M7 generated tracks (2.6) raises the IQM of exam3 at g150; and does a level-aware held-out (2.7) track the exam?",
  "hypothesis": "The M7 generated curriculum raises exam3 (it trains on race-like tracks); keepEasy and plateau show no clear effect; the M5 tiered curriculum raises skills but not exam3 at g150 (late arrival at the race task).",
  "method": "train",
  "baseline": {
    "config": {
      "generations": 300,
      "arenas": [
        { "name": "rock-in-line", "params": { "episodes": 16, "rocks": 2 } },
        { "name": "point-to-point", "params": { "episodes": 8, "asteroids": 80 } }
      ],
      "collisions": "obstacles",
      "crashMode": "respawn",
      "scoring": { "distance": 1, "success": 1000, "time": 0, "crashes": 3000, "progress": 3 },
      "controller": { "kind": "residual", "scale": 0.5 },
      "heldOut": 6,
      "exam": { "every": 25, "randomTracks": 100, "skills": {}, "v3": {} },
      "sensors": { "lineCheck": {} },
      "curriculum": { "success": 0.6 },
      "parents": 10
    },
    "runs": [
      "train-545", "train-546", "train-547", "train-548", "train-549",
      "train-550", "train-551", "train-552", "train-553", "train-554",
      "train-555", "train-556", "train-557", "train-558", "train-559",
      "train-560", "train-561", "train-562", "train-563", "train-564"
    ],
    "reuse": true
  },
  "switches": [
    {
      "key": "curriculum.keepEasy",
      "on": 0.25,
      "note": "2.4: round(0.25 x episodes) per arena from a seeded earlier level"
    },
    {
      "key": "curriculum.plateau",
      "on": {},
      "note": "2.5: plateau rule with defaults (floor 0.5, patience 10, alpha 0.2, minGain 0.02), next to the fixed success 0.6 rule"
    },
    {
      "key": "curriculum.levels",
      "levels": [
        [
          { "arenas": [
            { "name": "stop", "params": { "episodes": 8 } },
            { "name": "turn-and-go", "params": { "episodes": 8 } } ] },
          { "arenas": [
            { "name": "chain", "params": { "episodes": 6 } },
            { "name": "race-legs", "params": { "episodes": 8 } } ] },
          { "arenas": [
            { "name": "rock-in-line", "params": { "episodes": 16, "rocks": 1 } },
            { "name": "point-to-point", "params": { "episodes": 8, "asteroids": 20 } } ] },
          { "arenas": [
            { "name": "rock-in-line", "params": { "episodes": 16, "rocks": 2 } },
            { "name": "point-to-point", "params": { "episodes": 8, "asteroids": 40 } } ] },
          { "arenas": [
            { "name": "rock-in-line", "params": { "episodes": 16, "rocks": 2 } },
            { "name": "point-to-point", "params": { "episodes": 8, "asteroids": 80 } } ] }
        ],
        [
          { "arenas": [
            { "name": "generated-legs", "params": { "bands": ["easy"], "episodes": 8, "legs": 2 } },
            { "name": "stop", "params": { "episodes": 4 } },
            { "name": "gates", "params": { "episodes": 4 } } ] },
          { "arenas": [
            { "name": "generated-legs", "params": { "bands": ["easy", "medium"], "episodes": 8, "legs": 3, "gates": "track" } },
            { "name": "laps", "params": { "episodes": 2, "laps": 2 } } ] },
          { "arenas": [
            { "name": "generated-legs", "params": { "bands": ["medium"], "episodes": 8, "legs": 3, "gates": "track" } },
            { "name": "generated-legs", "params": { "bands": ["medium"], "episodes": 4, "legs": 2, "stop": 100 } } ] },
          { "arenas": [
            { "name": "generated-legs", "params": { "bands": ["hard"], "episodes": 8, "legs": 3, "gates": "track" } },
            { "name": "generated-legs", "params": { "bands": ["medium", "hard"], "episodes": 4, "legs": 2, "stop": 100 } },
            { "name": "rock-in-line", "params": { "episodes": 16, "rocks": 2 } },
            { "name": "point-to-point", "params": { "episodes": 8, "asteroids": 80 } } ] }
        ]
      ],
      "labels": ["m5tiers", "m7gen"],
      "note": "2.6: m5tiers = stop+turn-and-go -> chain+race-legs -> 1 rock+20 -> 2 rocks+40 -> v2 task; m7gen = generated easy (+stop, gates) -> easy/medium with own gates (+laps) -> medium (+stop) -> hard + v2 task"
    },
    {
      "key": "curriculum.heldOutCurrent",
      "on": true,
      "note": "2.7: measurement only; training identical to the baseline (stateHash checked)"
    }
  ],
  "design": "one-at-a-time",
  "seeds": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  "screen": { "gen": 150, "metric": "exam3", "aggregate": "iqm", "keep": "either" },
  "final": { "gen": 151 },
  "decision": {
    "metric": "exam3",
    "gen": 150,
    "aggregate": "iqm",
    "ci": "bootstrap",
    "ciLevel": 0.95,
    "resamples": 10000
  },
  "minEffect": { "exam3": 3 },
  "gate": { "gen": 5 },
  "report": { "gens": [50, 100, 150] }
}
```

## Question

Which curriculum change makes better racers on exam v3 on the new M6 baseline, and does a held-out
metric at the flown level show progress earlier?

## Hypothesis

The M7 generated curriculum raises exam3, because it trains on race-like tracks. keepEasy and
plateau show no clear effect: the baseline's runs reach the last level early (batch A: level 4 by
g25 for the residual arm). The M5 tiered curriculum raises skills but not exam3 at g150.

## Baseline

`m6-a3-combination`'s baseline arm, reused: M4's default setup (task v2, `lineCheck`, curriculum at
0.6, 10 parents, crashes respawn, scoring distance 1 / success 1000 / crashes 3000, held-out 6) +
residual controller 0.5 + progress 3; exam v2 (102 races) + exam v3 + skills every 25 generations.
Stored runs: train-545..564 (g150). No rotation cost.

## Runs

5 arms × 20 seeds = 100 new runs to g150 (the baseline is reused; 20 gate check runs to g5). The
machine runner's budget is 20 parallel runs (the knee), so the runs queue. The `m7gen` arm flies
about 1.8–3 × the baseline's ship-steps per generation (M7 S5 smoke runs). Estimate 2–3 hours.

## Decision rule

Pre-registered before any run of this experiment; the same rule as `m6-a3-combination`, per arm
against the baseline:

- **Primary metric:** `exam3` at g150, IQM over seeds 1–20, paired 95 % bootstrap CI (10,000
  resamples).
- **Win:** the CI of the IQM effect excludes 0 in the arm's favour and the effect is at least 3
  points.
- **Vetoes** (`npm run iqm`, same pairing, IQM, 95 % bootstrap CI):
  1. `exam3Crashes` at g150 clearly higher (CI entirely above 0);
  2. `examCheckpoints` (exam v2) at g150 worse: CI entirely below 0 and the estimate at or below
     −0.03.
- **2.7** is not decided on exam3 (training is identical by design; its exam3 must equal the
  baseline's, else it is a bug). Its measurement question: over the generations g25…g150 of each
  run, is the rank correlation between `heldOutCurrentSuccess` and `exam3` higher than between
  `heldOutSuccess` and `exam3`? Reported descriptively (median over seeds), with the share of
  generations where the run is below the last level (where the two metrics differ at all).
- **Reported alongside:** the exam3 profile per category, `exam3Finished`, `exam3TimeVsPar`, exam v2
  (`examCheckpoints`, `examFinished`, `examCrashes`), `level` per seed at g50/g100/g150 (when does
  each seed reach the last level?), `heldOutSuccess`, the skill metrics (the main evidence for 2.4,
  forgetting, and 2.6, what the levels teach), and exam3 at g50 and g100.
- **Power:** as in `m6-a3-combination`: 20 seeds detect about 4–8 exam3 points (M7 S4 calibration);
  the achieved power is reported.

## Risks

- **Late arrival:** tiered arms reach the race task later; exam3 at g150 may understate them.
  `level` per seed is reported; a g300 continuation is a follow-up for the user to decide.
- **`m7gen` level 3 may be out of reach:** hard generated tracks are near the floor (S1, S4); runs
  may stay on level 2, which has no v2-task arenas.
- **One generated track per arena per generation** (S5): a generation's success depends a lot on
  its single track, which makes level-ups noisy.
- **Interaction with rotation:** if the user adopts rotation 20 from `m6-a3-combination`, these
  results are on the baseline without it.

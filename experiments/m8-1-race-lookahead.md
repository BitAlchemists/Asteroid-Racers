# Experiment: m8-1-race-lookahead

Status: **DRAFT, NOT RUN.** Not created in Evo Lab. Part of the M8 plan
([`../doc/plans/M8-race-training.md`](../doc/plans/M8-race-training.md), step 3), which waits for the
user's approval. Before `exp new`: steps 1 and 2 of the plan land (averaged-decision tools, the
exam-seed guard, the multi-track smoke run, the generator check). If step 2 adds `generator: 2`, every
`generated-legs` entry below gets `"generator": 2`.

**Question.** Does training on many fresh generated race legs per generation (race levels easy →
medium → hard), with and without lookahead, make exam3 rise with training, and raise it above the
keepEasy baseline?

**Baseline:** the adopted M6 baseline (M4 default + residual 0.5 + progress 3 +
`curriculum.keepEasy: 0.25`, adopted by the user 2026-11-14). Its runs exist: batch B's keepEasy
arm, train-585..604 (seeds 1–20, g150), reused (`reuse: true`). If step 1's guard changes the code
binding, the gate's check runs are continued as the baseline instead (one wave, about 15 minutes).

**Switches** (factorial 2 × 2; arms: baseline, +race, +lookahead, +race +lookahead):

| Switch | Value | What it changes |
| --- | --- | --- |
| `curriculum.levels` (`race`) | 3 tiered levels, below | the training task: 12 generated tracks per generation, fresh every generation |
| `lookahead` | `{ "legs": 2, "frame": "corner" }` | inputs: the turn at the next two targets (M6 3.1's corner arm) |

**Race levels** (each `generated-legs` entry is one track per generation, with its own seed stream;
1 episode of 3 legs per track; promoted at success 0.6 as today):

| Level | Generated tracks | Plus |
| --- | --- | --- |
| 0 easy | 12 easy | rock-in-line 8 × 2 rocks, point-to-point 4 × 80 (the v2 task at half size) |
| 1 medium | 4 easy + 8 medium | the same |
| 2 hard | 2 easy + 4 medium + 6 hard | the same |

Easy material stays in every level (easy tracks, the v2 task), and keepEasy moves a quarter of the
v2 entries' episodes to an earlier level. Entries with 1 episode get no keepEasy share (k =
round(0.25) = 0). Held-out: 6 scenarios per entry, so 84 for the winner per generation.

**Never trained on:** the hand-made and goal tracks (`race-legs` is not used) and the exam3 seeds
(step 1's guard).

```json experiment
{
  "id": "m8-1-race-lookahead",
  "question": "On the M6 baseline with keepEasy 0.25, do race levels (12 fresh generated tracks per generation, easy -> medium -> hard, with the v2 task kept) and lookahead (corner frame, 2 legs), alone and together, raise exam3 averaged over g125-150?",
  "hypothesis": "Race levels raise exam3, mostly on medium and hard, and exam3 rises with training instead of staying flat; lookahead alone does nothing (single-target task) and adds to race levels.",
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
      "curriculum": { "success": 0.6, "keepEasy": 0.25 },
      "parents": 10
    },
    "runs": [
      "train-585", "train-586", "train-587", "train-588", "train-589",
      "train-590", "train-591", "train-592", "train-593", "train-594",
      "train-595", "train-596", "train-597", "train-598", "train-599",
      "train-600", "train-601", "train-602", "train-603", "train-604"
    ],
    "reuse": true
  },
  "switches": [
    {
      "key": "curriculum.levels",
      "on": [
          { "arenas": [
            { "name": "generated-legs", "params": { "bands": ["easy"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["easy"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["easy"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["easy"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["easy"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["easy"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["easy"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["easy"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["easy"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["easy"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["easy"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["easy"], "episodes": 1, "legs": 3 } },
            { "name": "rock-in-line", "params": { "episodes": 8, "rocks": 2 } },
            { "name": "point-to-point", "params": { "episodes": 4, "asteroids": 80 } } ] },
          { "arenas": [
            { "name": "generated-legs", "params": { "bands": ["easy"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["easy"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["easy"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["easy"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["medium"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["medium"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["medium"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["medium"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["medium"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["medium"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["medium"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["medium"], "episodes": 1, "legs": 3 } },
            { "name": "rock-in-line", "params": { "episodes": 8, "rocks": 2 } },
            { "name": "point-to-point", "params": { "episodes": 4, "asteroids": 80 } } ] },
          { "arenas": [
            { "name": "generated-legs", "params": { "bands": ["easy"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["easy"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["medium"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["medium"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["medium"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["medium"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["hard"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["hard"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["hard"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["hard"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["hard"], "episodes": 1, "legs": 3 } },
            { "name": "generated-legs", "params": { "bands": ["hard"], "episodes": 1, "legs": 3 } },
            { "name": "rock-in-line", "params": { "episodes": 8, "rocks": 2 } },
            { "name": "point-to-point", "params": { "episodes": 4, "asteroids": 80 } } ] }
      ],
      "note": "race levels: 12 generated tracks per generation (1 episode x 3 legs each) + the v2 task at half size; L0 12 easy, L1 4 easy + 8 medium, L2 2 easy + 4 medium + 6 hard"
    },
    {
      "key": "lookahead",
      "on": { "legs": 2, "frame": "corner" },
      "note": "M6 3.1 corner arm: the turn at the next two targets relative to the approach"
    }
  ],
  "design": "factorial",
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
  "report": { "gens": [25, 50, 100, 150] }
}
```

## Decision rule

Pre-registered before any run (the M8 plan's rule; the user adopted the average over
g125–150 instead of the g150 winner alone).

- **Primary metric:** `exam3`, per run the mean over g125, g130, g135, g140, g145 and g150 (stored
  snapshots re-scored with `npm run exam3 -- --run … --gens 125..150:5`; in-run exam3 at g125 and
  g150 must match the re-score exactly). IQM over seeds 1–20, paired 95 % bootstrap CI (10,000
  resamples), `npm run iqm -- --base … --arm … --metric exam3 --gens 125..150`.
- **Win:** the CI of the IQM effect excludes 0 in the arm's favour and the effect is at least 3
  points.
- **Comparisons:** each arm against the baseline; +race +lookahead against +race (does lookahead add
  to race training?). Evo Lab's own g150 decision and factorial effects are reported next to them.
- **Vetoes** (same pairing, IQM, 95 % CI, on the g125–150 mean):
  1. `exam3Crashes` clearly higher (CI entirely above 0);
  2. `examCheckpoints` (exam v2) worse: CI entirely below 0 and the estimate at or below −0.03;
  3. `exam3Handmade` worse: CI entirely below 0 and the estimate at or below −3 (the hand-made
     tracks are never trained on; they are the generalisation check).
- **Reported alongside:**
  - the exam3 profile, medium and hard first;
  - **the exam3 curve per arm** (g5 from re-scored snapshots, then g25 … g150): does it rise?;
  - `level` per seed at g25/g50/g100/g150 (who reaches level 2, and when);
  - freezes (exam v2 checkpoints < 0.6 with few crashes) and exam3 single-exam dips (≥ 10 points);
  - ship-steps per generation and wall time per wave against the baseline;
  - exam3 at g150 alone, as Evo Lab computes it.
- **Power:** batch B detected 2.0–3.0 exam3 points at 20 seeds; the achieved power is reported.

## Runs

3 new arms × 20 seeds = 60 runs to g150 (the baseline is reused). Race arms cost about 2.5–3× the
baseline per generation (step 1's smoke run measures it): about 35–45 minutes per wave of 20; the
lookahead-only arm about 15. Estimate 1.5–2 hours, plus about 5 minutes of re-scoring
(80 runs × 7 snapshots).

## Risks

- **Seeds stall on level 1 or 2:** `level` per seed is reported; `curriculum.plateau` is the
  fallback for a follow-up.
- **Factorial with tiered levels is new in Evo Lab:** checked at `exp new`. Fallback: two
  one-at-a-time experiments (race; race + lookahead as a separate configuration compared with
  `npm run iqm`).
- **Cost above 3.5×:** fewer tracks per level (10), decided before `exp new` from the smoke run.
- **Freezes:** m7gen froze often; the averaged rule keeps one generation from deciding.

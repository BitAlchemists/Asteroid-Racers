# Experiment: m4-e4b-confirm

M4 perception, E4b. A confirmation run for the two E4 arms worth a second look:
- `parents: 10` had the best g100 numbers of any arm (exam 23,900 vs 25,500, 6 seeds at level 4),
  but its effect was within noise, so E4's g100 screen stopped it before g150.
- `curriculum.success: 0.6` got 8 of 10 seeds to level 3–4 by g150 (baseline: 5 of 10), at no exam
  cost at g150.

Both together, and each alone, against the E4 baseline, all run to g150 with no early stop.

```json experiment
{
  "id": "m4-e4b-confirm",
  "question": "Do 10 parents and a curriculum level-up at 60 % success, together, lower the race exam score at generation 150 compared with the E3b winner (lineCheck models, task v2 with curriculum, seeds 1-10), and what does each contribute?",
  "hypothesis": "Together they win: more seeds reach the full task (success 0.6) and good racers survive unlucky generations (parents 10).",
  "method": "train",
  "baseline": {
    "config": {
      "generations": 150,
      "arenas": [
        { "name": "rock-in-line", "params": { "episodes": 16, "rocks": 2 } },
        { "name": "point-to-point", "params": { "episodes": 8, "asteroids": 80 } }
      ],
      "collisions": "obstacles",
      "crashMode": "respawn",
      "scoring": { "distance": 1, "success": 1000, "time": 0, "crashes": 3000 },
      "heldOut": 6,
      "exam": { "every": 10, "randomTracks": 15 },
      "sensors": { "lineCheck": {} },
      "curriculum": {}
    },
    "runs": ["train-98", "train-99", "train-100", "train-101", "train-102", "train-103", "train-104", "train-105", "train-106", "train-107"]
  },
  "switches": [
    { "key": "parents", "on": 10, "note": "(10 + 90): the best 10 survive, 9 children each" },
    { "key": "curriculum.success", "on": 0.6, "note": "level up after 3 generations with winner success >= 60 % (default 80 %)" }
  ],
  "design": "leave-one-out",
  "seeds": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  "screen": { "gen": 150, "metric": "exam", "k": 2, "noise": "paired-se", "keep": "either" },
  "final": { "gen": 150 },
  "decision": { "metric": "exam", "gen": 150, "k": 2, "noise": "paired-se", "minWinFraction": 0.8 },
  "minEffect": { "exam": 10000 },
  "gate": { "gen": 5 },
  "report": { "gens": [50, 100, 150] }
}
```

## Hypothesis

E4 suggested two cheap gains that its g100 screen could not confirm. `success: 0.6` lets more seeds
climb to the full task; `parents: 10` keeps several good racers, so one unlucky generation cannot
erase them. Expected: the combination (`full`) beats the baseline at g150; each alone helps less.

## Baseline

The E4 baseline (E3b's winner): task v2, lineCheck, `curriculum: {}`. Stored runs are E3b's
curriculum screen runs train-98..107; the gate re-runs them to g5 and compares `stateHash`.

## Runs

Leave-one-out with two switches: baseline, `full` (both), and each switch alone (`-parents` =
success 0.6 only, `-curriculum.success` = parents 10 only); 4 arms × 10 seeds = 40 runs. The screen
is set at g150, the final generation, so no arm is stopped early (E3b's and E4's early screens
dropped arms whose effect shows late). About 15–20 minutes per run, up to 20 in parallel.

## Decision rule

`full` against the baseline at g150: the paired exam effect must be below −2 × paired-se and below
−10,000 (`minEffect`), with at least 80 % of seeds better. More exam crashes veto adoption. Each
switch's contribution (`full` vs `-X`) is reported, with curriculum levels reached per seed,
collapse count (exam checkpoints < 10 % at g150 after having been good earlier), held-out success
and `tps`.

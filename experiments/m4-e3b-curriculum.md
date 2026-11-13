# Experiment: m4-e3b-curriculum

M4 perception, E3b. On the v2 task, half of E3's seeds reached almost no training targets by g50:
selection has little to go on. A staged curriculum (M4 plan, step 7b) starts with a clear line of
sight and adds rocks as the winner gets good. Does it make better racers than training on the full
v2 task from the start?

```json experiment
{
  "id": "m4-e3b-curriculum",
  "question": "Does the staged curriculum lower the race exam score at generation 150 compared with training on the full v2 task from the start (lineCheck models, seeds 1-10)?",
  "hypothesis": "Yes: more seeds learn to race, so the exam score and its spread go down; exam crashes do not rise.",
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
      "sensors": { "lineCheck": {} }
    },
    "runs": ["train-57", "train-58", "train-59", "train-60", "train-61", "train-62", "train-63", "train-64", "train-65", "train-66"]
  },
  "switches": [
    { "key": "curriculum", "on": {}, "note": "5 levels: clear line → 1 rock → +20 scattered → 2 rocks + 40 → the v2 task; up after 3 generations ≥ 80 % success" }
  ],
  "design": "one-at-a-time",
  "seeds": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  "screen": { "gen": 50, "metric": "exam", "k": 2, "noise": "paired-se", "keep": "either" },
  "final": { "gen": 150 },
  "decision": { "metric": "exam", "gen": 150, "k": 2, "noise": "paired-se", "minWinFraction": 0.8 },
  "minEffect": { "exam": 10000 },
  "gate": { "gen": 5 },
  "report": { "gens": [50, 100, 150] }
}
```

## Hypothesis

With a clear line of sight first, every seed earns reward early and learns to fly to targets; the
rocks then come one step at a time. Expected: more seeds race well, so a lower exam score with less
spread, and no more crashes. The held-out score is always on the last level (the v2 task), so it
measures the same thing as in the baseline.

## Baseline

E3 (m4-e3-noise-floor-v2): task v2 with lineCheck, seeds 1–10, runs train-57..66. The gate re-runs
them to generation 5 with today's code and compares `stateHash`.

## Runs

10 curriculum runs (seeds 1–10) to g50 (screen), continued to g150. Started while E3's final runs
are still going (20 runs on 24 threads), so each run is slower; results are deterministic either
way. E3's g150 runs are done long before E3b reaches g150.

## Decision rule

The curriculum wins if its paired exam effect at g150 is below −2 × paired-se and below −10,000
(`minEffect`), with at least 80 % of seeds better. `minEffect` stays at E2's 10,000: E3's sd at g50
is about 41,500 (seeds 1–10), and one sd as the minimum effect would be far larger than any change
worth having; the paired-se rule already accounts for the noise. Exam crashes are reported; more crashes veto adoption. The level reached per seed is
reported: a run that never gets to the last level counts as it is (no exclusion).

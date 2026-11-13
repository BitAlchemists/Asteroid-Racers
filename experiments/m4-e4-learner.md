# Experiment: m4-e4-learner

M4 perception, E4 (DRAFT, not created in Evo Lab). Do the setup switches from step 6 (encoding v2,
Gaussian mutation, (μ + λ) selection with 10 parents, time-to-impact lineCheck) make better racers
than today's learner, each on its own?

> **TODO before approval: choose the baseline from E3b's result.**
> - If E3b adopts the curriculum: add `"curriculum": {}` to the baseline config below and set
>   `baseline.runs` to E3b's `+curriculum` screen runs (their seeds 1–10).
> - Otherwise keep the config below (E3's task v2) with E3's screen runs train-57..66.
>
> Also set `minEffect` from the chosen baseline's spread if it differs much from E3 (sd at g150
> 49,030; we keep 10,000 as in E2 and E3b unless the user decides otherwise).

```json experiment
{
  "id": "m4-e4-learner",
  "question": "Does each of encoding v2, Gaussian mutation, 10 parents and a time-to-impact lineCheck (alone) lower the race exam score at generation 150 compared with today's learner (lineCheck models, task v2, seeds 1-10)?",
  "hypothesis": "parents 10 helps most (it keeps good racers through unlucky generations, see E3's collapse); Gaussian mutation and encoding v2 help; time-to-impact helps fast models avoid rocks.",
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
    { "key": "encoding", "on": "v2", "note": "targetSin, targetCos, targetDistanceSoft, forwardSpeed, sideSpeed (about -1..1)" },
    { "key": "mutation", "on": { "kind": "gaussian", "sigma": 0.2 }, "note": "unbiased, signs can flip; rate = mutationRate 0.1" },
    { "key": "parents", "on": 10, "note": "(10 + 90): the best 10 survive, 9 children each" },
    { "key": "sensors.lineCheck.horizon", "on": 2, "note": "closeness by time to impact, 2 s horizon, range 2,500" }
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

E3 showed that today's learner loses good racers: after g100, 5 of 10 seeds collapsed into passive
hovering (see `m4-e3-noise-floor-v2.report.md` and HISTORY). The likely cause is a single parent
re-scored on freshly drawn scenarios: one draw with a crash loop makes the racer score worse than a
passive child, and the racer is gone. `parents: 10` should keep racers in the pool. The other
switches target the learner itself (input scale, sign flips) and the sensor.

## Baseline

See the TODO above: E3's config (task v2, lineCheck, today's learner) or E3 + curriculum,
depending on E3b. The gate re-runs the stored baseline runs to g5 and compares `stateHash`.

## Runs

4 switch arms + baseline, 10 seeds each, to g50 (screen), informative arms continued to g150. About
50 runs; Evo Lab re-runs the baseline arm itself (see HISTORY, Evo Lab friction).

## Decision rule

A switch wins if its paired exam effect at g150 is below −2 × paired-se and below −10,000, with at
least 80 % of seeds better. Exam crashes are reported; more crashes veto adoption.

## What to watch (from E3)

- **Passive collapse:** per seed and arm, exam checkpoints at g100 vs g150, and whether the g150
  winner reaches any training target. A switch that wins at g100 but collapses by g150 is reported
  as such. The report's g100 column matters as much as g150 here.
- **Winner path length** from the g150 snapshot traces: a passive winner flies about 450–700 units
  per 9-second episode; racers fly about 1,100–1,300.
- **Crash loops:** the number of crashes of the winner per training generation (a single draw with
  40+ crashes decides a generation).

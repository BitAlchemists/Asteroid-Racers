# Experiment: m4-e4-learner

M4 perception, E4. Do the setup switches from step 6 (encoding v2, Gaussian mutation, (μ + λ)
selection with 10 parents, time-to-impact lineCheck), the crash cap (`crashLimit: 3`, added after E3)
and a gentler curriculum level-up (`curriculum.success: 0.6`, proposed after E3b) make better racers
than the E3b winner (task v2 + curriculum), each on its own?

```json experiment
{
  "id": "m4-e4-learner",
  "question": "Does each of encoding v2, Gaussian mutation, 10 parents, a time-to-impact lineCheck, a crash cap of 3 per episode and a curriculum level-up at 60 % success (alone) lower the race exam score at generation 150 compared with the E3b winner (lineCheck models, task v2 with curriculum, seeds 1-10)?",
  "hypothesis": "parents 10 helps most (it keeps good racers through unlucky generations, see E3's collapse); Gaussian mutation and encoding v2 help; time-to-impact helps fast models avoid rocks; crashLimit 3 keeps one crash-loop draw from deciding a generation; success 0.6 gets more seeds to the full task.",
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
    { "key": "encoding", "on": "v2", "note": "targetSin, targetCos, targetDistanceSoft, forwardSpeed, sideSpeed (about -1..1)" },
    { "key": "mutation", "on": { "kind": "gaussian", "sigma": 0.2 }, "note": "unbiased, signs can flip; rate = mutationRate 0.1" },
    { "key": "parents", "on": 10, "note": "(10 + 90): the best 10 survive, 9 children each" },
    { "key": "sensors.lineCheck.horizon", "on": 2, "note": "closeness by time to impact, 2 s horizon, range 2,500" },
    { "key": "crashLimit", "on": 3, "note": "an episode ends at its 3rd crash, the rest charged like crashMode end" },
    { "key": "curriculum.success", "on": 0.6, "note": "level up after 3 generations with winner success >= 60 % (default 80 %)" }
  ],
  "design": "one-at-a-time",
  "seeds": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  "screen": { "gen": 100, "metric": "exam", "k": 2, "noise": "paired-se", "keep": "either" },
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
switches target the learner itself (input scale, sign flips) and the sensor. `crashLimit: 3`
attacks the same collapse from the other side: an episode ends at its third crash, so one
crash-loop draw costs at most 3 × 3,000 in crash cost instead of 47 × 3,000.

## Baseline

E3b's winner: task v2 with lineCheck and `curriculum: {}` (default levels, success 0.8, streak 3),
today's learner. Stored baseline runs: E3b's `+curriculum` screen runs train-98..train-107 (seeds
1–10, stateHash for g1–50). The gate re-runs them to g5 and compares `stateHash`; the code changed
since (S1 speed-ups, viewer, crashLimit) but must be bit-identical.

## Runs

6 switch arms + baseline, 10 seeds each, to g100 (screen), informative arms continued to g150. About
70 runs plus 10 gate runs; Evo Lab re-runs the baseline arm itself (see HISTORY, Evo Lab friction).
**Screen at g100, not g50:** E3b's g50 screen marked the curriculum "no clear difference" and
continued nothing, yet it won clearly at g150; E3's collapse and the curriculum's level-ups both
happen after g50.

## Decision rule

A switch wins if its paired exam effect at g150 is below −2 × paired-se and below −10,000, with at
least 80 % of seeds better. Exam crashes are reported; more crashes veto adoption.

## What to watch (from E3)

- **Passive collapse:** per seed and arm, exam checkpoints at g100 vs g150, and whether the g150
  winner reaches any training target. A switch that wins at g100 but collapses by g150 is reported
  as such. The report's g100 column matters as much as g150 here.
- **Winner path length** from the g150 snapshot traces: a passive winner flies about 450–700 units
  per 9-second episode; racers fly about 1,100–1,300.
- **Curriculum levels reached** per seed and arm (`level` metric), and when each level was reached.
- **Speed:** median `tps` per arm (the S1 code; `parents` and `crashLimit` may change it).
- **Crash loops:** the number of crashes of the winner per training generation (a single draw with
  40+ crashes decides a generation).

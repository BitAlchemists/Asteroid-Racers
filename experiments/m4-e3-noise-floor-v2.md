# Experiment: m4-e3-noise-floor-v2

M4 perception, E3. The training task changed (step 7: crash cost 3,000, 2 rocks in line,
80 scattered rocks, 16 + 8 episodes, 6 held-out), and the default sensor is now `lineCheck` (E2).
Before comparing setup switches (E4) we need the new baseline: how the race exam, crashes and
training scores vary over 10 seeds. These runs become the gate baseline for E4.

```json experiment
{
  "id": "m4-e3-noise-floor-v2",
  "question": "What are the mean and the spread over seeds 1-10 of the exam score, exam crashes and training score of lineCheck models on the task v2 setup at generations 50, 100 and 150?",
  "design": "measurement",
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
    }
  },
  "seeds": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  "screen": { "gen": 50 },
  "final": { "gen": 150 },
  "metrics": ["exam", "examCrashes", "examCheckpoints", "examFinished", "score", "success", "heldOutSuccess"],
  "report": { "gens": [50, 100, 150] }
}
```

## Hypothesis

No hypothesis: a measurement. Expected: fewer exam crashes than E2's lineCheck runs (crashes cost
6× more and training rocks are denser), with exam scores still spread widely between seeds.

## Baseline

Task v2 (M4 plan, step 7) with `lineCheck` at its defaults and today's learner: relative mutation,
1 parent + 99 children, encoding v1, hidden layers 10-8-6-4.

## Runs

10 runs (seeds 1-10) to generation 50 (screen), then all continued to 150. A check run measured
12–20 s per generation alone on the machine, so about 45–60 minutes per run; all 10 run in parallel
(20 worker slots, 24 threads).

## Decision rule

None: the report gives mean, sd, min and max per metric at generations 50, 100 and 150. E4's
`minEffect` on `exam` is set from the sd at 150 (about one sd), and on `examCrashes` likewise.

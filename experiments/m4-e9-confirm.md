# Experiment: m4-e9-confirm

M4 perception, E9: the last M4 experiment. The default setup chosen at the end of M4 (E3b's
curriculum config plus `parents: 10` and `curriculum: { success: 0.6 }`) is trained twice as long
(to g300) and measured with exam v2 (102 races). Does it keep improving, does any seed collapse,
and what are its numbers for the record?

```json experiment
{
  "id": "m4-e9-confirm",
  "question": "What are the IQM, mean and spread over seeds 1-10 of the 102-race exam score, exam checkpoints, races finished and exam crashes of the M4 default setup at generations 150 and 300, and does any seed collapse?",
  "design": "measurement",
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
      "scoring": { "distance": 1, "success": 1000, "time": 0, "crashes": 3000 },
      "heldOut": 6,
      "exam": { "every": 25, "randomTracks": 100 },
      "sensors": { "lineCheck": {} },
      "curriculum": { "success": 0.6 },
      "parents": 10
    }
  },
  "seeds": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  "screen": { "gen": 150 },
  "final": { "gen": 300 },
  "metrics": ["exam", "examCrashes", "examCheckpoints", "examFinished", "score", "success", "heldOutSuccess", "level", "tps"],
  "report": { "gens": [150, 225, 300] }
}
```

## Hypothesis

No hypothesis: a measurement. Expected: exam numbers improve or hold from g150 to g300, more seeds
reach the last curriculum level, and no seed collapses into hovering.

## Baseline

The M4 default setup (see the M4 plan, "Closing M4"). Exam v2: the 2 fixed tracks plus 100 random
tracks, every 25 generations (exam scores are about 6× those of the 17-race exam; compare only like
with like).

## Runs

10 runs (seeds 1–10) to g150, all continued to g300. With S1's speed, about 30–40 minutes of wall
time with the machine to itself.

## Decision rule

None: the report gives IQM, mean, sd, min and max per metric at g150, g225 and g300, the curriculum
level reached per seed, and the collapse count (exam checkpoints below 10 % after being above 50 %).
The best g300 model is a candidate for the game; promotion is the user's decision.

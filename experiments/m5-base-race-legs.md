# Experiment: m5-base-race-legs

M5 step 7, baseline runs: the M4 default setup (task v2 scoring, lineCheck, `parents: 10`,
curriculum success 0.6) trained on one of M5's new arenas alone. Tier 3: legs of random race tracks among their asteroids, crashes respawn at the last checkpoint.

```json experiment
{
  "id": "m5-base-race-legs",
  "question": "What success share (training and held-out), curriculum level and 102-race exam score does the M4 default setup reach at generation 150 when it trains on the race-legs arena alone, over seeds 1-5?",
  "design": "measurement",
  "method": "train",
  "baseline": {
    "config": {
      "generations": 150,
      "arenas": [
        {
          "name": "race-legs",
          "params": {
            "episodes": 8
          }
        }
      ],
      "collisions": "obstacles",
      "crashMode": "respawn",
      "scoring": {
        "distance": 1,
        "success": 1000,
        "time": 0,
        "crashes": 3000
      },
      "heldOut": 6,
      "exam": {
        "every": 25,
        "randomTracks": 100
      },
      "sensors": {
        "lineCheck": {}
      },
      "curriculum": {
        "levels": [
          {
            "race-legs": {
              "legs": 1
            }
          },
          {
            "race-legs": {
              "legs": 2
            }
          },
          {
            "race-legs": {
              "legs": 3
            }
          }
        ],
        "success": 0.6
      },
      "parents": 10
    }
  },
  "seeds": [
    1,
    2,
    3,
    4,
    5
  ],
  "final": {
    "gen": 150
  },
  "metrics": [
    "success",
    "heldOutSuccess",
    "level",
    "score",
    "exam",
    "examCheckpoints",
    "examFinished",
    "examCrashes"
  ],
  "report": {
    "gens": [
      50,
      100,
      150
    ]
  }
}
```

## Hypothesis

No hypothesis: a measurement. It shows how far the default setup gets on this arena in 150
generations, and whether the skill carries over to the race exam.

## Baseline

The M4 default setup (see the M4 plan, "Closing M4"), except for the arenas and the curriculum
levels: the default levels name rock-in-line and point-to-point, so this arena gets its own three
levels, legs per episode 1 → 2 → 3 (the arena default). The run trains on this arena only (M5 trains one arena per run; schedules
over several arenas are M6). Exam v2 (2 fixed tracks plus 100 random ones) every 25 generations.

## Runs

5 runs (seeds 1–5) to g150. Six of these plans (one per new arena) make 30 runs, run next to
m4-e9-confirm within the runner's budget.

## Decision rule

None: the report gives mean, sd, min and max per metric at g50, g100 and g150. Training does not
report crashes on the arena, so they are measured afterwards by flying the g150 winners through
fresh scenarios of the arena (recorded in HISTORY, not part of this plan).

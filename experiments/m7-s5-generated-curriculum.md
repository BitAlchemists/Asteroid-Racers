# Experiment: m7-s5-generated-curriculum

Status: EXAMPLE — not created in Evo Lab, not run. Written with M7 S5 (training access to generated
tracks and goal types) as a worked example of the syntax; a real run waits for exam v3 (M7 S4) and
the M6 plan after M7. Smoke-tested headless (see `doc/HISTORY.md`, M7 S5).

**Baseline:** the new M6 baseline adopted after batch A: M4's default setup (E9's config) +
`controller: {kind: "residual", scale: 0.5}` + `scoring.progress: 3`. No stored runs exist for it
yet, so the baseline runs with the experiment (no `reuse`).

**Switch:** `curriculum.levels`, tiered levels that ramp generated tracks easy → medium → hard and
add the M7 goal types (arena params in [`../doc/experiments.md`](../doc/experiments.md#training-on-generated-tracks-and-goals-m7-s5)):

| Level | Arenas | What it adds |
| --- | --- | --- |
| 0 | `generated-legs` easy (8 × 2 legs), `stop` (4), `gates` (4) | short legs of easy generated tracks; braking and lining up for gates in isolation |
| 1 | `generated-legs` easy + medium (8 × 3 legs, own gates directional), `laps` (2 circuits × 2 laps) | longer runs, the generator's gates and chicanes must be crossed the right way; laps |
| 2 | `generated-legs` medium (8 × 3, own gates), `generated-legs` medium (4 × 2, stop ≤ 100 at the last target) | medium only; stop at the end of a run |
| 3 | `generated-legs` hard (8 × 3, own gates), `generated-legs` medium + hard (4 × 2, stop ≤ 100), the v2 task (`rock-in-line` 16 × 2 rocks, `point-to-point` 8 × 80 rocks) | hard tracks, with the baseline's last level kept so the old skills stay trained |

The baseline's `curriculum.success: 0.6` and default streak apply to every level. `heldOut` flies the
last level.

**Not in this plan:** `scoring.par`, the reward for finishing under par. It needs par times in the
episodes (`parSpeed` in the arenas' params), so it only makes sense as a follow-up on top of this
curriculum: the same levels with `"parSpeed": 250` on the generated legs, and a switch
`{"key": "scoring.par", "on": 100}` (100 per second under par; a miss costs 1000).

```json experiment
{
  "id": "m7-s5-generated-curriculum",
  "question": "Does a curriculum of generated tracks (easy → medium → hard) with the M7 goal types (directional gates, stop, laps) raise the IQM of exam checkpoints at g150 compared with the M6 baseline's rock-adding curriculum?",
  "hypothesis": "Yes: training on race-like generated tracks transfers to the exam's races better than rocks on point-to-point lines.",
  "method": "train",
  "baseline": {
    "config": {
      "generations": 300,
      "arenas": [
        {
          "name": "rock-in-line",
          "params": {
            "episodes": 16,
            "rocks": 2
          }
        },
        {
          "name": "point-to-point",
          "params": {
            "episodes": 8,
            "asteroids": 80
          }
        }
      ],
      "collisions": "obstacles",
      "crashMode": "respawn",
      "scoring": {
        "distance": 1,
        "success": 1000,
        "time": 0,
        "crashes": 3000,
        "progress": 3
      },
      "controller": {
        "kind": "residual",
        "scale": 0.5
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
        "success": 0.6
      },
      "parents": 10
    }
  },
  "switches": [
    {
      "key": "curriculum.levels",
      "on": [
        {
          "arenas": [
            {
              "name": "generated-legs",
              "params": {
                "bands": ["easy"],
                "episodes": 8,
                "legs": 2
              }
            },
            {
              "name": "stop",
              "params": {
                "episodes": 4
              }
            },
            {
              "name": "gates",
              "params": {
                "episodes": 4
              }
            }
          ]
        },
        {
          "arenas": [
            {
              "name": "generated-legs",
              "params": {
                "bands": ["easy", "medium"],
                "episodes": 8,
                "legs": 3,
                "gates": "track"
              }
            },
            {
              "name": "laps",
              "params": {
                "episodes": 2,
                "laps": 2
              }
            }
          ]
        },
        {
          "arenas": [
            {
              "name": "generated-legs",
              "params": {
                "bands": ["medium"],
                "episodes": 8,
                "legs": 3,
                "gates": "track"
              }
            },
            {
              "name": "generated-legs",
              "params": {
                "bands": ["medium"],
                "episodes": 4,
                "legs": 2,
                "stop": 100
              }
            }
          ]
        },
        {
          "arenas": [
            {
              "name": "generated-legs",
              "params": {
                "bands": ["hard"],
                "episodes": 8,
                "legs": 3,
                "gates": "track"
              }
            },
            {
              "name": "generated-legs",
              "params": {
                "bands": ["medium", "hard"],
                "episodes": 4,
                "legs": 2,
                "stop": 100
              }
            },
            {
              "name": "rock-in-line",
              "params": {
                "episodes": 16,
                "rocks": 2
              }
            },
            {
              "name": "point-to-point",
              "params": {
                "episodes": 8,
                "asteroids": 80
              }
            }
          ]
        }
      ],
      "note": "4 tiered levels: generated legs easy (+ stop, gates) → easy/medium with directional gates (+ laps) → medium (+ stop at the end) → hard + the v2 task"
    }
  ],
  "design": "one-at-a-time",
  "seeds": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  "screen": {
    "gen": 150,
    "metric": "examCheckpoints",
    "aggregate": "iqm",
    "keep": "either"
  },
  "final": {
    "gen": 151
  },
  "decision": {
    "metric": "examCheckpoints",
    "gen": 150,
    "aggregate": "iqm",
    "ci": "bootstrap",
    "ciLevel": 0.95,
    "resamples": 10000
  },
  "minEffect": {
    "examCheckpoints": 0.03
  },
  "gate": {
    "gen": 5
  },
  "report": {
    "gens": [100, 150, 300]
  }
}
```

## Decision rule

IQM of `examCheckpoints` at g150 over seeds 1–20 (M6's rule after batch A: 20 seeds, a
pre-committed primary metric), paired bootstrap 95 % CI excluding 0 and at least +0.03. More exam
crashes (`examCrashes`) veto adoption. **Once exam v3 lands (M7 S4), the primary metric becomes
`exam3`** (add `"v3": {}` to the baseline's `exam` and change `screen`/`decision`); exam checkpoints
saturate at about 0.89 and would hide the effect. Reported alongside: `level` per seed (do the runs
reach level 3?), `heldOutSuccess`, the skill metrics and the g300 column.

## Risks

- **Slow climb:** hard generated tracks are near the floor today (S1's sanity flights: about a third
  of the checkpoints for the best models), and the level-3 success over all its arenas must reach
  0.6. If most seeds stay on level 2, a plateau rule (`curriculum.plateau`) is the next step.
- **Cost:** generated legs fly 600 frames per leg among many rocks. In the smoke run (sample 8) a
  generation flew about 1.8 × the baseline's ship-steps on level 0 and about 3 × with all levels
  mixed in up to level 3 (see the history).

# Experiment: m6-2-6-tiered-curriculum

Status: DRAFT — curriculum-v2 code is in (87c3331); not created in Evo Lab. M6, phase 2, experiment 2.6 (tiered arenas).

Levels built from M5's arenas, ordered by **M5's measured difficulty** (the `m5-base-*` baselines,
5 seeds each, signed off 2026-11-13), instead of M4's levels that only add rocks.

| Level | Arenas | Why here | Expected climb (from the M5 baselines and E3b/E4b) |
| --- | --- | --- | --- |
| 0 | `stop` + `turn-and-go` (8 + 8 episodes) | easy: every seed reaches 60 % success at g3–11 on each | ~10–15 generations (incl. the 3-generation streak) |
| 1 | `chain` + `race-legs` (6 + 8) | easy / medium: chain 60 % at g5–9; race-legs at g1–4 on its base params | ~5–10 → race task levels from about g15–25 |
| 2 | `rock-in-line` 1 rock + `point-to-point` 20 rocks | M4 curriculum level 2 | |
| 3 | `rock-in-line` 2 rocks + `point-to-point` 40 rocks | M4 curriculum level 3 | levels 2–4 took M4's curriculum about 50–100 generations (E3b, E4b: 7 of 10 seeds at level 4 by g150) |
| 4 | the v2 task (2 rocks + 80 rocks), as the baseline's last level | target task | most seeds expected here by about g70–125 |

`corridor` and `field` are left out: as gates they are too hard for today's setup (M5: 4 of 5 and
2 of 5 seeds leave their level 0, at g22–109; success 0.28 and 0.11 at g150). Seven levels (the
earlier draft) would have needed at least 7 × (climb + 3-generation streak) before the race task.

**Prerequisite: 2.1 (progress term).** The M5 race-legs baseline found a reward trap with several
targets per episode: orbiting just outside the first checkpoint beats taking it under the distance
integral. Level 1 contains `chain` and `race-legs`, so this experiment runs on 2.1's adopted scoring
(or with `scoring.progress` in its baseline).

Risk: at the observed rates some seeds reach level 4 only late, so the exam at g150 may understate
the curriculum; the report includes g300 (the baseline runs go to g300) and `level` per seed. The
baseline's `success: 0.6` and default streak apply to every level.

```json experiment
{
  "id": "m6-2-6-tiered-curriculum",
  "question": "Does a curriculum built from M5's tiered arenas raise the IQM of exam checkpoints at g150 compared with M4's rock-adding curriculum?",
  "hypothesis": "Yes: skills learned in isolation (stopping, turning, chaining) transfer to racing.",
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
        "success": 0.6
      },
      "parents": 10
    },
    "runs": [
      "train-310",
      "train-311",
      "train-312",
      "train-313",
      "train-314",
      "train-315",
      "train-316",
      "train-317",
      "train-318",
      "train-319"
    ],
    "reuse": true
  },
  "switches": [
    {
      "key": "curriculum.levels",
      "on": [
        {
          "arenas": [
            {
              "name": "stop",
              "params": {
                "episodes": 8
              }
            },
            {
              "name": "turn-and-go",
              "params": {
                "episodes": 8
              }
            }
          ]
        },
        {
          "arenas": [
            {
              "name": "chain",
              "params": {
                "episodes": 6
              }
            },
            {
              "name": "race-legs",
              "params": {
                "episodes": 8
              }
            }
          ]
        },
        {
          "arenas": [
            {
              "name": "rock-in-line",
              "params": {
                "episodes": 16,
                "rocks": 1
              }
            },
            {
              "name": "point-to-point",
              "params": {
                "episodes": 8,
                "asteroids": 20
              }
            }
          ]
        },
        {
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
                "asteroids": 40
              }
            }
          ]
        },
        {
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
          ]
        }
      ],
      "note": "5 tiered levels ordered by M5's measured difficulty: stop + turn-and-go → chain + race-legs → 1 rock + 20 scattered → 2 rocks + 40 → the v2 task; corridor and field left out (too hard as gates)"
    }
  ],
  "design": "one-at-a-time",
  "seeds": [
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10
  ],
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
    "gens": [
      100,
      150,
      300
    ]
  }
}
```

## Hypothesis

Yes: skills learned in isolation (stopping, turning, chaining) transfer to racing.

## Baseline

M4's default setup, exactly E9's config (`m4-e9-confirm`): task v2 (rock-in-line 16 episodes with 2 rocks, point-to-point 8 episodes with 80 rocks), crashes respawn, scoring distance 1 / success 1000 / crashes 3000, held-out 6, lineCheck, curriculum with success 0.6, 10 parents, the 102-race exam every 25 generations. Stored runs: E9's screen runs train-310..319 (g150) with `reuse: true` — the code binding has changed since (M6 switches, behaviour-identical), so Evo Lab uses each seed's gate check run, continued to g150, as the baseline run.

## Runs

10 runs per arm (seeds 1–10) to g150; at today's speed about 25–35 minutes of wall time with the baseline reused.

## Decision rule

Decision at g150 on the IQM of exam checkpoints (102-race exam): an arm wins if the paired bootstrap 95 % CI of its IQM effect excludes 0 in its favour and the effect is at least `minEffect` (0.03). Exam crashes and races finished are reported; clearly more crashes (CI of the crash effect above 0) veto adoption. g100 is read as well (late effects, see E3b). Screen and final: Evo Lab needs final > screen, so the screen is at g150 (every arm continues) and final at g151; the decision reads g150.

Power (budget rule; estimated from E9 at g150, 102-race exam, seeds 1–10): exam checkpoints have sd 0.071 over seeds, 0.022 without the one outlier seed (s10). For a paired comparison at 10 seeds the detectable effect (α 0.05, power 0.8) is about **0.03 of checkpoints with the IQM** (outliers trimmed) and about 0.09 with the mean. `minEffect` 0.03. Re-check with `npm run iqm -- <id> --metric examCheckpoints --gen 150` after the run; if the CI half-width exceeds 0.03, the result is underpowered and is reported as such (20 seeds would bring the mean-based figure to about 0.06).

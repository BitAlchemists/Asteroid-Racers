# Experiment: m6-2-2-costs

Status: DRAFT — not created in Evo Lab. M6, phase 2, experiment 2.2 (crash and miss costs).

Are 3,000 per crash and 1,000 per missed target the right balance? One managed one-at-a-time experiment with value switches (Evo Lab `next`, 4085e4b): the keys are already set in the baseline, so off = the baseline's value.

```json experiment
{
  "id": "m6-2-2-costs",
  "question": "Do other crash and miss costs (scoring.crashes 1000 or 6000, scoring.success 3000) change the IQM of exam checkpoints at g150 compared with M4's default (crashes 3000, success 1000)?",
  "hypothesis": "Cheaper crashes make models bolder (more checkpoints, more crashes); dearer crashes make them cautious; a higher miss cost helps reaching.",
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
      "key": "scoring.crashes",
      "levels": [
        1000,
        6000
      ],
      "labels": [
        "c1k",
        "c6k"
      ]
    },
    {
      "key": "scoring.success",
      "on": 3000
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
      150
    ]
  }
}
```

## Hypothesis

Cheaper crashes make models bolder (more checkpoints, more crashes); dearer crashes make them cautious; a higher miss cost helps reaching.

## Baseline

M4's default setup, exactly E9's config (`m4-e9-confirm`): task v2 (rock-in-line 16 episodes with 2 rocks, point-to-point 8 episodes with 80 rocks), crashes respawn, scoring distance 1 / success 1000 / crashes 3000, held-out 6, lineCheck, curriculum with success 0.6, 10 parents, the 102-race exam every 25 generations. Stored runs: E9's screen runs train-310..319 (g150) with `reuse: true` — the code binding has changed since (M6 switches, behaviour-identical), so Evo Lab uses each seed's gate check run, continued to g150, as the baseline run.

## Runs

10 runs per arm (seeds 1–10) to g150; at today's speed about 25–35 minutes of wall time with the baseline reused.

## Decision rule

Decision at g150 on the IQM of exam checkpoints (102-race exam): an arm wins if the paired bootstrap 95 % CI of its IQM effect excludes 0 in its favour and the effect is at least `minEffect` (0.03). Exam crashes and races finished are reported; clearly more crashes (CI of the crash effect above 0) veto adoption. g100 is read as well (late effects, see E3b). Screen and final: Evo Lab needs final > screen, so the screen is at g150 (every arm continues) and final at g151; the decision reads g150.

Power (budget rule; estimated from E9 at g150, 102-race exam, seeds 1–10): exam checkpoints have sd 0.071 over seeds, 0.022 without the one outlier seed (s10). For a paired comparison at 10 seeds the detectable effect (α 0.05, power 0.8) is about **0.03 of checkpoints with the IQM** (outliers trimmed) and about 0.09 with the mean. `minEffect` 0.03. Re-check with `npm run iqm -- <id> --metric examCheckpoints --gen 150` after the run; if the CI half-width exceeds 0.03, the result is underpowered and is reported as such (20 seeds would bring the mean-based figure to about 0.06).

## Switches

Arms: `crashes=c1k` (crash cost 1,000), `crashes=c6k` (6,000) and `success=3000` (miss cost 3,000; a miss is charged by `scoring.success`), each against the baseline (crashes 3,000, success 1,000). Value switches replace the earlier plan of one measurement experiment per variant compared with `npm run iqm`; that command still works for a second opinion.

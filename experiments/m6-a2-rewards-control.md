# Experiment: m6-a2-rewards-control

M6 batch A (phase 2a rewards + 3.4 control), agreed with the user 2026-11-13 ("Yes, go"). One
experiment, one switch per arm, all against M4's default setup (E9's config) exactly E9's config, so
E9's runs train-310..319 serve as the baseline (`reuse`). The skill profile of every arm's g150
winner is computed afterwards with `npm run skills` (adding `exam.skills` to the config would
change the task identity and rule out reuse). Drafts it replaces or combines:
`m6-2-1-progress-reward.md`, `m6-2-2-costs.md`, `m6-2-8-rotation-cost.md`, and 3.4 in
`doc/plans/M6-experiments.md`.

```json experiment
{
  "id": "m6-a2-rewards-control",
  "question": "Which of the progress reward (2.1), lower crash / higher miss cost (2.2), a rotation cost (2.8) and the residual controller (3.4) raises the IQM of exam checkpoints at g150 compared with M4's default setup, without more exam crashes?",
  "hypothesis": "Progress fixes the multi-target reward trap (race-legs, field skills up); rotation cost and the residual controller reduce spinning; the residual controller races best.",
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
      "key": "scoring.progress",
      "on": 3,
      "note": "2.1: per unit flown towards the target; resets at target switch"
    },
    {
      "key": "scoring.crashes",
      "on": 1000,
      "note": "2.2: crash cost 3000 -> 1000 (value switch)"
    },
    {
      "key": "scoring.success",
      "on": 3000,
      "note": "2.2: miss cost 1000 -> 3000 (value switch)"
    },
    {
      "key": "scoring.rotation",
      "levels": [
        20,
        50
      ],
      "labels": [
        "20",
        "50"
      ],
      "note": "2.8: cost per radian turned; full-rate spin for 9 s = 900 / 2250"
    },
    {
      "key": "controller",
      "on": {
        "kind": "residual",
        "scale": 0.5
      },
      "note": "3.4: scripted controller + 0.5 x network"
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

## Why these arms

- **2.1 progress (3):** the reward trap on multi-target tasks (race-legs: circling a checkpoint beats
  taking it). Watch `skillRaceLegs`, `skillField`, `skillChain`.
- **2.2 crash 1000 / miss 3000:** is the balance too cautious, or misses too cheap? Crash 6000 is
  left out (E3 showed expensive crashes push towards passivity) to keep 6 arms.
- **2.8 rotation 20 / 50:** spinning costs points; watch `spin` (≈ 1 = spin and pulse).
- **3.4 residual 0.5:** the scripted controller steers, the network corrects (the diagnostic says
  spinning is a local optimum; this starts from steering).

## Decision rule

IQM of `examCheckpoints` at g150 over seeds 1–10, paired bootstrap 95 % CI excluding 0 and at least
+0.03 (detectable effect from E9's spread ≈ 0.03). More exam crashes (`examCrashes`) veto adoption.
Reported alongside: `examFinished`, `heldOutSuccess`, `level`, `spin`, all skill metrics, and the
g100 column. Two winners that might interact get a short combined follow-up (like E4b) before both
join the baseline.  the baseline reuses E9's runs (60 new runs).

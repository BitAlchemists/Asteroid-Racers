# Experiment: m6-2-8-rotation-cost

Status: DRAFT — code is in (`scoring.rotation` and the `spin` metric, commit 3120894); not created in
Evo Lab. M6, phase 2, experiment 2.8 (rotation cost).

**Why.** M4's best models are "spin and pulse" controllers: the turn output is pinned at full rate,
so the ship spins constantly and fires thrust when it faces roughly towards the target (seen in E9's
best model, train-327). They reach targets but do not steer, which is wrong for a game opponent. The
original score's rotation term (∫ |rotation speed| dt inside `distance`, weight 1 per rad against
distances of about 500 units) is negligible.

**What.** `scoring.rotation` charges each radian turned (`EpisodeRecord.rotation`, flown frames
only). The new `spin` metric reports the winner's mean |turn output| over its training flights
(0..1; about 1 = spin and pulse) on every generation, so the effect is measured from data.

**Decision.** IQM of exam checkpoints at g150 (paired bootstrap CI; an arm is adopted if checkpoints
do not drop by more than 0.03 and spin clearly drops), crashes veto. `spin` is reported per seed at
g100 and g150. If two arms qualify, the smaller weight wins.

```json experiment
{
  "id": "m6-2-8-rotation-cost",
  "question": "Does a cost per radian turned (scoring.rotation 20 or 50) stop the 'spin and pulse' controllers (lower spin) without lowering the IQM of exam checkpoints at g150, compared with M4's default setup?",
  "hypothesis": "Spin drops from about 1 (always turning at full rate) to well below; exam checkpoints stay within 0.03 or improve; crashes do not rise.",
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
      "key": "scoring.rotation",
      "levels": [
        20,
        50
      ],
      "labels": [
        "20",
        "50"
      ],
      "note": "per radian: full-rate spinning for a 9 s episode (45 rad) costs 900 (about one missed target) or 2,250 (close to a crash)"
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

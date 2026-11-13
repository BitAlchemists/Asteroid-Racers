# Experiment: m6-2-3-time-to-target

Status: DRAFT — not created in Evo Lab. M6, phase 2, experiment 2.3 (time to target).

Does a score for how fast targets are reached make faster racers? No new code: `scoring.time` already is time to target — an episode's clock stops when its last target is reached, and a missed target is charged the full time limit (tested in arenas.test.ts). The baseline has `time: 0`.

```json experiment
{
  "id": "m6-2-3-time-to-target",
  "question": "Does a time-to-target term (scoring.time 300 per second) improve the IQM of exam checkpoints at g150, and the races finished, compared with M4's default setup?",
  "design": "measurement",
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
        "time": 300,
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
    }
  },
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
    "gen": 150
  },
  "final": {
    "gen": 151
  },
  "metrics": [
    "examCheckpoints",
    "examFinished",
    "examCrashes",
    "exam",
    "heldOutSuccess",
    "success",
    "level"
  ],
  "report": {
    "gens": [
      100,
      150
    ]
  }
}
```

## Hypothesis

Yes for speed (races finished, exam seconds), neutral or slightly worse for checkpoints if models take more risks.

## Baseline

M4's default setup, exactly E9's config (`m4-e9-confirm`): task v2 (rock-in-line 16 episodes with 2 rocks, point-to-point 8 episodes with 80 rocks), crashes respawn, scoring distance 1 / success 1000 / crashes 3000, held-out 6, lineCheck, curriculum with success 0.6, 10 parents, the 102-race exam every 25 generations. Stored runs: E9's screen runs train-310..319 (g150) with `reuse: true` — the code binding has changed since (M6 switches, behaviour-identical), so Evo Lab uses each seed's gate check run, continued to g150, as the baseline run.

## Runs

10 runs per configuration (seeds 1–10) to g150, about 25–35 minutes each.

## Decision rule

Not decided by Evo Lab (see the note above): compared with the baseline per seed with `npm run iqm -- --base train-310,...,train-319 --arm <run ids> --metric examCheckpoints --gen 150`, using the same rule as the managed experiments: IQM effect with a paired bootstrap 95 % CI excluding 0 and at least 0.03, crashes veto.

Power (budget rule; estimated from E9 at g150, 102-race exam, seeds 1–10): exam checkpoints have sd 0.071 over seeds, 0.022 without the one outlier seed (s10). For a paired comparison at 10 seeds the detectable effect (α 0.05, power 0.8) is about **0.03 of checkpoints with the IQM** (outliers trimmed) and about 0.09 with the mean. `minEffect` 0.03. Re-check with `npm run iqm -- <id> --metric examCheckpoints --gen 150` after the run; if the CI half-width exceeds 0.03, the result is underpowered and is reported as such (20 seeds would bring the mean-based figure to about 0.06).

**Why this is not a managed one-at-a-time experiment:** Evo Lab refuses a switch on a key that is present in the baseline config or in the method's default config (`scoring.*` is in both). So each variant is its own measurement experiment on the same seeds, compared with the baseline by `npm run iqm`. A feature request for value switches (off = the baseline's value) is open with Evo Lab; once available, this becomes one managed experiment with a multi-level switch.

Scale: an episode lasts at most 9 s (600 frames), so `time: 300` adds up to 2,700 per episode — between a missed target (1,000) and a crash (3,000), next to the distance term's 5,000–8,000.

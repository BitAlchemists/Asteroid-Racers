# Experiment: m4-e2-sensors

M4 perception, E2. Which obstacle sensor lets a model race better? Each of the four candidate
sensors is added on its own to today's blind model and compared with the blind baseline on the same
seeds, by the race exam score at generation 150.

```json experiment
{
  "id": "m4-e2-sensors",
  "question": "Does adding each of whiskers, sectors, nearest and lineCheck (alone) lower the race exam score at generation 150 compared with blind models?",
  "hypothesis": "Every sensor helps; lineCheck most against crash loops, whiskers or sectors most overall.",
  "method": "train",
  "baseline": {
    "config": {
      "generations": 150,
      "arenas": [
        { "name": "rock-in-line", "params": { "episodes": 8 } },
        { "name": "point-to-point", "params": { "episodes": 4, "asteroids": 20 } }
      ],
      "collisions": "obstacles",
      "crashMode": "respawn",
      "scoring": { "distance": 1, "success": 1000, "time": 0, "crashes": 500 },
      "heldOut": 2,
      "exam": { "every": 10, "randomTracks": 15 }
    },
    "runs": ["TODO: E1's final runs"]
  },
  "switches": [
    { "key": "sensors.whiskers", "on": {}, "note": "7 rays over 180°, range 600" },
    { "key": "sensors.sectors", "on": {}, "note": "8 sectors around the ship, range 600" },
    { "key": "sensors.nearest", "on": {}, "note": "3 nearest rocks: angle, distance, radius; range 800" },
    { "key": "sensors.lineCheck", "on": {}, "note": "first rock in the corridor to the target; range 1000" }
  ],
  "design": "one-at-a-time",
  "seeds": [1, 2, 3, 4, 5],
  "screen": { "gen": 50, "metric": "exam", "k": 2, "noise": "paired-se", "keep": "either" },
  "final": { "gen": 150 },
  "decision": { "metric": "exam", "gen": 150, "k": 2, "noise": "paired-se", "minWinFraction": 0.8 },
  "minEffect": { "exam": 0 },
  "gate": { "gen": 5 },
  "report": { "gens": [50, 100, 150] }
}
```

## Hypothesis

The blind models crash into any rock on the direct line (M3's crash loops). A sensor that reports
rocks ahead should let evolution find avoidance. `lineCheck` targets exactly that case; `whiskers`
and `sectors` see more of the surroundings; `nearest` is precise but jumpy.

## Baseline

E1's runs: the standard M4 baseline (blind models), seeds 1-5, to generation 150. The gate re-runs
them to generation 5 with the new code and compares the per-generation `stateHash`.

## Runs

One-at-a-time over four switches: baseline + four sensor arms, 5 seeds each, to generation 50
(screen); informative arms continue to 150.

## Decision rule

At generation 150, a sensor counts as better if its paired exam effect (sensor − blind, per seed) is
negative beyond 2 × the paired standard error and beyond `minEffect` (set from E1's spread), with at
least 4 of 5 seeds improving. Exam crashes are reported alongside. If several win, E3 continues with
the best one (lowest mean exam score); ties are broken by fewer exam crashes.

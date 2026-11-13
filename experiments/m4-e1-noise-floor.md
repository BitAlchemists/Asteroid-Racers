# Experiment: m4-e1-noise-floor

M4 perception, E1. Before comparing sensors we need to know how much the race exam score varies
between seeds for today's blind models on the M4 training setup. That spread sets the minimum
effect a sensor must beat in E2, and these runs become E2's stored baseline runs.

```json experiment
{
  "id": "m4-e1-noise-floor",
  "question": "What are the mean and the spread over seeds 1-5 of the exam score, exam crashes and training score of blind models on the standard M4 setup at generations 50, 100 and 150?",
  "design": "measurement",
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
    }
  },
  "seeds": [1, 2, 3, 4, 5],
  "screen": { "gen": 50 },
  "final": { "gen": 150 },
  "metrics": ["exam", "examCrashes", "examCheckpoints", "examFinished", "score", "success", "heldOutSuccess"],
  "report": { "gens": [50, 100, 150] }
}
```

## Hypothesis

No hypothesis: a measurement. Expected: exam scores vary a lot between seeds (crash loops make the
exam jumpy), crashes stay high because the models cannot see rocks.

## Baseline

The standard M4 baseline: blind models (no `sensors`), `rock-in-line` (8 episodes, one rock across
each line) + point-to-point with 20 asteroids (4 episodes), crashes respawn at the episode start,
race exam every 10 generations with 15 random tracks, 150 generations.

## Runs

5 runs (seeds 1-5) to generation 50 (screen), then all continued to 150. About 15-20 minutes per
run, in parallel on the machine runner.

## Decision rule

None: the report gives mean, sd, min and max per metric at generations 50, 100 and 150. E2's
`minEffect` on `exam` is set from the sd at 150 (about one sd).

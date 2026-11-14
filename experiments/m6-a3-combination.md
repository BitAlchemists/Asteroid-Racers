# Experiment: m6-a3-combination

M6 batch A follow-up (the combination check), agreed with the user 2026-11-14 ("yes" to "close M7
and start the combination check, then batch B"). First experiment judged on exam v3.

**Baseline: the new M6 baseline**, never run before: M4's default setup (E9's config) +
`controller: {kind: "residual", scale: 0.5}` + `scoring.progress: 3`, adopted by the user after
batch A. The exam adds exam v3 (`v3: {}`) and the skills profile (`skills: {}`) to exam v2 every 25
generations, so every run has exam3 and skill curves at g25, 50, …, 150. Neither changes training
(same `stateHash`; tests in M7 S4 and the skills exam). No stored runs existed for this config,
and Evo Lab refuses a plan without `baseline.runs`, so seeds 1–20 were first queued through the
lab to g5 only (train-505..524, label "M6 baseline … g5 seed runs"). With `reuse: true` the
experiment continues them (or their gate check runs) to g150 as its baseline arm. Batch B
(`m6-b-curriculum`) reuses these g150 baseline runs.

**Switch:** `scoring.rotation: 20` (batch A's 2.8, kept as an option by the user).

```json experiment
{
  "id": "m6-a3-combination",
  "question": "On the new M6 baseline (M4 default + residual controller 0.5 + progress 3), does a rotation cost of 20 per radian raise the IQM of exam3 at g150?",
  "hypothesis": "No clear effect: the residual controller already removed most spinning (spin 0.28 in batch A), so a rotation cost has little left to fix; it may cost some turning on hard tracks.",
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
      "scoring": { "distance": 1, "success": 1000, "time": 0, "crashes": 3000, "progress": 3 },
      "controller": { "kind": "residual", "scale": 0.5 },
      "heldOut": 6,
      "exam": { "every": 25, "randomTracks": 100, "skills": {}, "v3": {} },
      "sensors": { "lineCheck": {} },
      "curriculum": { "success": 0.6 },
      "parents": 10
    },
    "runs": [
      "train-505", "train-506", "train-507", "train-508", "train-509",
      "train-510", "train-511", "train-512", "train-513", "train-514",
      "train-515", "train-516", "train-517", "train-518", "train-519",
      "train-520", "train-521", "train-522", "train-523", "train-524"
    ],
    "reuse": true
  },
  "switches": [
    {
      "key": "scoring.rotation",
      "on": 20,
      "note": "2.8: cost per radian turned; a full-rate spin for 9 s costs 900"
    }
  ],
  "design": "one-at-a-time",
  "seeds": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  "screen": { "gen": 150, "metric": "exam3", "aggregate": "iqm", "keep": "either" },
  "final": { "gen": 151 },
  "decision": {
    "metric": "exam3",
    "gen": 150,
    "aggregate": "iqm",
    "ci": "bootstrap",
    "ciLevel": 0.95,
    "resamples": 10000
  },
  "minEffect": { "exam3": 3 },
  "gate": { "gen": 5 },
  "report": { "gens": [50, 100, 150] }
}
```

## Question

On the new M6 baseline, does `scoring.rotation: 20` make better racers on exam v3?

## Hypothesis

No clear effect. With the residual controller the scripted part steers and spin is already down to
0.28 (batch A), so the rotation cost has little left to fix. In batch A, on the M4 default without
the residual controller, rotation 20 scored exam3 44.0 against the baseline's 42.6 (CI spanning 0).

## Baseline

M4's default setup (E9's config: task v2, `lineCheck`, curriculum at 0.6, 10 parents, crashes
respawn, scoring distance 1 / success 1000 / crashes 3000, held-out 6) plus the residual controller
(scale 0.5) and the progress reward (3), as adopted by the user on 2026-11-14. The exam block adds
exam v3 and the skills exam to exam v2, every 25 generations. Stored runs: train-505..524, g5 only
(see above); the baseline arm is trained to g150 by this experiment.

## Runs

2 arms × 20 seeds = 40 runs to g150 (`generations: 300`, stopped at the screen; `final` g151 is
Evo Lab's "final > screen" requirement, and the decision reads g150). The machine runner's budget
is 20 parallel runs, so two waves. Estimate: batch A's residual arm took about 25–40 minutes per
wave; about 1–1.5 h in total.

## Decision rule

Pre-registered before any run of this experiment.

- **Primary metric:** `exam3` at g150 (exam v3.0, higher is better), IQM over seeds 1–20, paired
  95 % bootstrap CI (10,000 resamples).
- **Win:** the CI of the IQM effect (arm − baseline) excludes 0 in the arm's favour, and the effect
  is at least `minEffect` = 3 points.
- **Vetoes** (computed with `npm run iqm` on the same runs, paired, IQM, 95 % bootstrap CI), any
  one blocks adoption:
  1. **crashes:** `exam3Crashes` at g150 clearly higher (CI of the effect entirely above 0);
  2. **exam checkpoints must not get worse:** `examCheckpoints` (exam v2) at g150 with the CI of
     the effect entirely below 0 and the estimate at or below −0.03 (2.8's tolerance).
- Reported alongside: the exam3 profile per category (`exam3Easy` … `exam3Skills`),
  `exam3Finished`, `exam3TimeVsPar`, exam v2 (`examCheckpoints`, `examFinished`, `examCrashes`),
  `spin`, `level`, `heldOutSuccess`, the skill metrics, and exam3 at g50 and g100 (curves).
- **Power** (M7 S4 calibration: the paired sd of exam3 between arms is 7–13 points over seeds):
  20 seeds detect about 4–8 points at α 0.05 and power 0.8. `minEffect` 3 is half of the residual
  controller's gain (+6), the smallest effect we would act on; below the detectable effect, the
  binding condition is the CI. The achieved power is reported from the run (`npm run iqm --effect`).

## Descriptive question (not pre-registered as a test)

Does residual + progress beat batch A's residual-only arm on exam3? The baseline arm's exam3 at
g150 is compared with the S4 calibration re-score of batch A's `+controller` arm (train-495..504,
g150, IQM 48.8 [46, 51]), seed by seed for seeds 1–10 and as IQMs. **Caveat:** different seed
counts (20 vs 10), different runs and a config that differs in two keys; the pairing by seed is
only nominal. This is a description, not a test.

## Also checked

- **Seed 5:** batch A's residual run for seed 5 (train-499) collapsed (exam checkpoints −0.555).
  Does seed 5 collapse in this baseline, and does any other run collapse (exam3 or exam checkpoints
  far below the arm's IQM, or a fall along the exam curve)?

## Risks

- Exam v3's medium and hard bands are near the floor for today's models (S4); effects there may be
  invisible. The profile is reported per category.
- A rotation cost interacts with the residual controller's turning: the scripted part turns, and
  the network pays for corrections. That may cost turning on hard tracks.

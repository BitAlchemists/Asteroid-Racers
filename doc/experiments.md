# Experiments

How we compare model variants: as Evo Lab experiments
(evo-lab's `docs/experiments.md`). This page is the short version for this project.

## The idea

An experiment answers one question by comparing **arms** (the baseline config, plus one or more
**switches** turned on) on the **same seeds**, and decides with a rule written down before the runs.

- **Switches are config keys that are absent when off.** With every switch off, the code must
  reproduce the baseline byte for byte. Evo Lab checks this first (the **baseline gate**): it re-runs
  the stored baseline runs and compares the per-generation `stateHash`. Our switches so far:
  - `sensors`: obstacle sensors, e.g. `{ "whiskers": {} }` or
    `{ "lineCheck": { "range": 800 } }` (see `parseSensors` in `packages/server/src/ai/sensors.ts`);
    Optional sensor parameters: `horizon` (seconds) switches `whiskers`, `sectors` and `lineCheck`
    to time to impact (default range then 2,500); `nearest: { "flag": 1 }` adds a "present" input
    per slot;
  - `hidden`: hidden layer sizes, e.g. `[16, 12, 8]`;
  - `encoding`: `"v2"` replaces the four classic inputs with `targetSin`, `targetCos`,
    `targetDistanceSoft`, `forwardSpeed`, `sideSpeed` (about −1..1, no jump behind the ship);
  - `mutation`: `{ "kind": "gaussian", "sigma": 0.2 }` (optional `rate`, default `mutationRate`);
  - `parents`: models kept per generation, (μ + λ); `sample − parents` must divide by `parents`;
  - `initRange`: range of the random starting weights (default 1);
  - `crashLimit`: with `crashMode: "respawn"`, an episode ends at its N-th crash and the rest is
    charged like a `crashMode: "end"` crash (integer ≥ 1; no effect with `end`).
  - `reevaluate`: `{ "top": 5, "episodes": 24 }`: the best `top` candidates plus the previous
    parents fly about `episodes` extra fresh scenarios; winner and kept parents follow the sum of
    both rounds (gen metrics `reevalScore`, `reevalSuccess`);
  - `curriculum.keepEasy`: e.g. `0.25`: after level 0, that share of each arena's episodes comes
    from an earlier level (snapshots then record the mixed arenas).
  - Tiered levels (M6 2.6): a level may be `{ "arenas": [ { "name": "stop", "params": {...} }, ... ] }`,
    which replaces the arena list at that level (param-override levels still work, and both kinds can
    be mixed). With `keepEasy`, an arena takes its easy episodes from the earlier level's arena at the
    same index, wrapping around when that level has fewer arenas.
  - `curriculum.plateau` (M6 2.5): `{ "floor": 0.5, "patience": 10, "alpha": 0.2, "minGain": 0.02 }`
    (defaults for `{}`). Besides the fixed `success`/`streak` rule, the run also moves up when an
    exponential moving average (`alpha`) of the judged success has not beaten its best by more than
    `minGain` for `patience` generations, while at or above `floor`. The state (`ema`, `best`,
    `since`) is reset at every level-up and saved in the checkpoint and `stateHash`. To use the
    plateau rule alone, set `success: 1` and a large `streak`.
  - `curriculum.heldOutCurrent: true` (M6 2.7): the winner also flies the held-out scenarios of the
    level it flew; reported as `heldOutCurrent` / `heldOutCurrentSuccess` next to `level`. `heldOut`
    stays on the last level. On the last level both are the same flight.
  - `lookahead` (M6): `1` or `2`. Appends, per leg after the current target, `next{k+1}Present`,
    `…Sin`, `…Cos`, `…DistanceSoft` to the model's inputs (after `encoding`/`model.inputs`, before
    sensors). Leg 1 runs from the current target to the one after it, leg 2 from there to the next.
    Sin/cos are the leg's direction relative to the ship's nose, the length is squashed like
    `targetDistanceSoft` (0.5 at 500). A missing target reads 0 on all four, `Present` included.
    `{ "legs": 1 | 2, "frame": "corner" }` replaces the angle with the turn at each target:
    `next2TurnSin/Cos` is the angle of leg 1 relative to the approach direction (ship → current
    target), `next3TurnSin/Cos` the angle of leg 2 relative to leg 1 (straight on = sin 0, cos 1, the
    sign convention of `targetSin`). It does not change when the ship turns in place. A plain number
    is `{ legs: n, frame: "nose" }`.
    Training needs multi-target episodes (M5's `chain` arena); in races the bot reads the race's
    checkpoint chain (the same controller), so the exam and the game need no change.
  - `inputDelay` (M6): integer ≥ 0. The network sees the inputs of that many controller steps ago
    (4 ≈ 66 ms at the 15 ms tick): a ring buffer in the controller, reset at every episode start
    (until k steps have passed it sees the episode's first inputs). Applies to training, held-out and
    re-evaluation flights and to snapshot replays. 0 = absent.
  - `inputNoise` (M6): σ ≥ 0. Gaussian noise N(0, σ²) on every input the network sees (after the
    delay). Each scenario of each round (training, held-out, re-evaluation) has its own stream,
    seeded from (seed, round, generation, scenario index) and the same for every candidate, so
    nothing is saved for a resume. 0 = absent.
  - Robustness exam (M6): `exam: { …, "inputDelay": 4, "inputNoise": 0.05 }`. The winner then flies
    the exam twice: plain (metrics `exam*`, as without the keys) and with the delay and noise
    (`examRobust`, `examRobustCheckpoints`, `examRobustFinished`, `examRobustCrashes`). The exam's
    noise stream is fixed per race (from the race seed), so every model meets the same noise. In the
    `exam` method the keys make the exam itself the perturbed one.
  - `crossover` (M6): `{ "kind": "uniform" | "layer", "rate": 0.5 }` (rate default 0.5, in [0, 1]);
  - `optimizer` (M6, experiment 4.4): `{ "kind": "cmaes", "population": 50, "sigma": 0.3, "separable": false }`
    replaces the GA with CMA-ES. `population` defaults to 4 + ⌊3 ln n⌋ (n = number of weights; 20 for
    today's 250 weights), and `sample` is then unused. `sigma` defaults to 0.3. `separable: true` keeps
    only the diagonal of C, for large networks. It cannot be combined with `parents`, `crossover` or
    `mutation`. The reported winner, held-out, exam and snapshot are the best candidate of the
    generation;
    needs `parents` ≥ 2. Each child of parent p is, with probability `rate`, p crossed with another
    parent drawn uniformly from the rest (`uniform`: each weight from the mate with probability ½;
    `layer`: each whole layer from the mate with probability ½), then mutated as usual. All draws
    come from the mutation generator (saved in the checkpoint); children per parent stay
    (sample − parents) / parents. Rate 0 = absent.
  - `mutation.anneal` (M6): `{ "to": 0.02, "over": 100, "shape": "linear" | "geometric" }` inside a
    Gaussian `mutation`. Children flown in generation g mutate with σ at f = min(1, (g − 1) / over):
    linear σ + (to − σ)·f, geometric σ·(to/σ)^f. Gen metric `sigma`. `to` = `sigma` is the same as
    no schedule.
  - `mutation.selfAdapt` (M6): `true` inside a Gaussian `mutation`. Every model carries its own σ
    (the first random models start at `sigma`): a child first sets σ' = σ_parent · exp(τ·N(0, 1)),
    τ = 1/√(number of weights), clamped to [1e-4, 10], then mutates its weights with σ'. σ is
    stored in the model JSON (`sigma`, so in checkpoints, `stateHash` and `result.json`); the game
    ignores it. Gen metric `sigma` = the winner's σ. Not combinable with `anneal`.
- A switch key may not appear in the method's default config in `lab.config.json` (that is why the
  `model` block is not there).
- **The decision metric is `exam`** (the race exam score, lower is better), produced inside training
  runs by the `exam` config (`{ "every": 10, "randomTracks": 15 }`). Report `examCrashes` and
  `examCheckpoints` alongside.

## Workflow

1. Draft: `npm run experiment -- draft <id> [--design one-at-a-time|leave-one-out|factorial|measurement]`
   writes `experiments/<id>.md` with the standard M4 baseline config. Fill in the question,
   hypothesis, switches, baseline runs and decision rule.
2. Register: `node <evo-lab>/bin/lab.js exp new experiments/<id>.md` (copies the plan into
   `lab/experiments/<id>/`, where Evo Lab keeps its state).
3. Approve: `lab exp approve <id> --by <name>`. Editing the plan afterwards sends it back to draft.
4. Advance: `lab exp advance <id> --wait` (gate → screen runs → continuations → report). Watch it in
   the Evo Lab UI (Experiments).
5. Sign off: `lab exp close <id> --by <name> --reason "<decision>"`.
6. Record: copy `report.md` next to the plan as `experiments/<id>.report.md`, and write the result
   into `doc/HISTORY.md`.

The plans in `experiments/` are versioned in git. Evo Lab's working copies under `lab/` are not.

## Defaults we use

- 5 seeds (1 to 5), screen at generation 50, final at 150.
- Decision: `exam` at 150, paired effect beyond 2 × paired standard error, at least 4 of 5 seeds
  moving the same way, and at least the `minEffect` that the noise-floor measurement (E1)
  suggests.
- Gate: prefix mode at generation 5 (cheap, thanks to `stateHash`).

## Costs

A 150-generation run of the standard baseline takes about 15 minutes, plus about 3 s per exam
(16 exams). Runs execute in parallel on the machine runner.

## Reusing stored baseline runs (Evo Lab `next` 779ff56 and later)

Set `"baseline": {"runs": [...], "reuse": true}` in new plans. Per seed, the baseline arm then uses:

1. the stored run, if the task and the code binding are the same (continued from its checkpoint
   if it is short of `final.gen`);
2. else the gate check run of that seed, continued to `screen.gen`. This is the usual case after
   switch code was added;
3. else a fresh run.

Fallbacks are listed in the experiment's `reuse.fallbacks` and in `screening.md`. The machine runner
picks up new Evo Lab code only after it restarts while idle, so experiments approved before that
still re-run their baseline. `screen.gen` now warns only below 10.

## Robust comparison: `npm run iqm`

For decisions from E5 on, compare arms by the interquartile mean (IQM) over seeds, with paired
bootstrap 95 % CIs (Agarwal et al. 2021):

```
npm run iqm -- <experiment-id> [--metric exam] [--gen 150] [--effect 10000]
npm run iqm -- --base train-1,train-2,... --arm train-11,train-12,... [--metric ...] [--gen ...]
```

- **Experiment mode:** all runs labelled `exp:<id>/<arm>` count (check runs excluded). A
  continuation run belongs to the arm of the run it continues, and per arm and seed the newest run
  with that generation is used.
- **Lists** given with `--base`/`--arm` are paired in order (same seed at the same position).
- **Output per arm:**
  - the IQM;
  - the IQM effect (arm − baseline) with its CI, and the mean paired difference with its CI;
  - seeds better;
  - the smallest mean effect these seeds can detect (α 0.05, power 0.8);
  - with `--effect`, the seeds needed to detect that effect.
- **Determinism:** the bootstrap uses a fixed seed, so the output is the same every time.
- **Exam v2** is just config: `exam: { every: 25, randomTracks: 100 }` (102 races, about 6 s).
  Exam scores are sums over races, so a 102-race score is about 6× a 17-race one. Compare only like
  with like.

## Scoring key `progress`

`scoring.progress` is a weight ≥ 0, absent = off, and absent configs stay byte-identical.

- **What it rewards:** distance flown towards the current target. Per frame the episode record
  adds the reduction in distance (negative when flying away); a respawn or a new target restarts
  the count. The score subtracts `progress × record.progress`.
- **Scale:** per target the term telescopes to start distance − end distance, at most the leg
  length (600–1,400 units in rock-in-line). The distance term is about 5,000–8,000 unit-seconds per
  9-second episode. So `progress: 1` is worth about one missed target (1,000) per fully flown leg,
  and `progress: 3`–`5` makes it a real share of the score.

## Time to target: `scoring.time`

`scoring.time` (weight per second flown) already is a time-to-target term: an episode's clock stops
when its last target is reached, a missed target runs (or, after an episode-ending crash, is
charged) to the full time limit. An episode lasts at most 9 s, so `time: 300` adds up to 2,700 per
episode, between a miss (1,000) and a crash (3,000). It cannot be an Evo Lab switch, because
`scoring.time` is in the default config.

## Metrics and the leaderboard

Every metric in `lab.config.json` has a short label (2-5 words) and a `description` (the long
explanation, shown as a tooltip). Further display keys (Evo Lab `next` 4085e4b, contract A12):

- `unit`: shown after values and on chart axes (`share 0-1`, `s`, `count`, `ticks/s`, `ship-steps/s`);
- `headline: true`: listed first. Ours: exam checkpoints, exam races finished, held-out targets reached;
- `group`: sections on run pages and charts: Training, Held-out, Exam, Robustness exam, Curriculum, Speed;
- `sparse: true`: reported only in some generations (the exam metrics, every `exam.every` gens).
  Charts add a dashed best-so-far line, and sparse metrics are not in the default leaderboard.

The leaderboard ranks the three headline metrics (`leaderboard.metrics`; list sparse ones there
explicitly, as we do for the exam metrics). The training `score` changes its scenarios every
generation and is not a progress measure. The train method also declares
`"throughput": {"unit": "ship-steps", "metric": "shipSteps"}`, so `lab analyze` and `lab scaling`
report ship-steps/s next to gens/min.

## Value switches (switches on keys that are already set)

A switch may name a key the baseline or the method's default config already sets, as a dotted path.
Off is the baseline's value; on is `"on": value`, or one value per level
(`"levels": [...]`, `"labels": [...]`). An on value equal to the baseline's is refused. They work in
one-at-a-time, leave-one-out and factorial designs, and can be mixed with absent-key switches:

```json
"switches": [
  { "key": "scoring.crashes", "levels": [1000, 6000], "labels": ["c1k", "c6k"] },
  { "key": "scoring.success", "on": 3000 },
  { "key": "scoring.time", "on": 300 }
]
```

Used by `m6-2-2-costs` and `m6-2-3-time-to-target`. The gate still compares the switches-off
config (the baseline). The old workaround (separate configurations compared with `npm run iqm`)
still works as a second opinion. A measurement plan can ask for `"report": {"aggregate": "iqm",
"ci": "bootstrap"}` to get the IQM and a bootstrap CI per metric and generation.

## Looking at speed (Evo Lab profiling tools)

Details in evo-lab's `docs/profiling.md`.

- `lab analyze <run> --lifecycle`: queue, spawn to hello, first generation, steady s/gen, exams,
  exit. `--advice`: how many runs at once (knee against the worker budget), CPU against wall,
  runs against threads. `--sweep exp:<id>` gives medians over several runs.
- `lab hotspots <file.cpuprofile | run>`: hot functions (self and total time at file:line);
  two files give before/after; `--group-by file-pattern=<regex>` groups by subsystem.
- `lab scaling --from-run <run> --gen G --gens N`: throughput against parallel runs, resuming copies
  of the run's checkpoint. Do not run other load meanwhile.
- Profile a run when enqueuing it: `profile: "cpuprofile:gA-B"` (several ranges
  `cpuprofile:g10-20,g80-82`, `:interval=200` in microseconds) writes
  `profiles/cpuprofile-*.cpuprofile` for those generations. **This works through Evo Lab's
  `js/lablib.mjs` 0.2.0, which our own worker (`lab-train.ts`) does not use** (it is not vendored
  here), so it has no effect for us today. Whole-process alternative: `--cpu-prof
  --cpu-prof-dir=profiles` as node flags in the method `command`; `lab hotspots` reads the result.
- `lab machine reload --yes`: restart the machine runner on new Evo Lab code without stopping runs.

## Controller: `controller` (M6 3.4)

How the network's two outputs drive the ship. Absent means directly, as always.

- **`{ "kind": "residual", "scale": 0.5 }`:** the scripted steering controller
  (`scripted-controller.ts`) flies, and the network's outputs are added to its thrust and turn,
  times `scale`, then clamped to −1..1.
  - The scripted part reads the true state: the legacy four inputs plus a `lineCheck` at range 1000.
    `inputDelay` and `inputNoise` affect only the network.
  - With all network outputs at 0, the model flies exactly like the scripted controller.
- **`{ "kind": "heading", "gain": 3 }`:** output 0 is a desired heading offset in half turns from the
  nose, with the same sign as `targetAngle`. Output 1 is the throttle. Turn rate =
  clamp(gain × offset) × 5 rad/s.

The choice is stored in the model spec (`spec.controller`), so the game's bots, the exam and replays
use it. Older models load unchanged.

Cost, measured per controller step with 120 rocks nearby:

| controller | µs per step |
| --- | --- |
| direct | 0.85 |
| residual | 1.17 (the scripted policy and its corridor check) |
| heading | 0.84 |

## Arenas (M5)

`arenas` in a training config is not a switch, but the arena names are opt-in content: a config
names the arenas it trains on (`packages/server/src/ai/arenas.ts`, `tier-arenas.ts`). Defaults in
brackets; `frames` defaults to the config's `frames` (600).

| Tier | Arena | What it asks for | Params |
| --- | --- | --- | --- |
| 0 | `point-to-point`, `rock-in-line` | one target per episode (rocks on the line) | see the code |
| 1 | `stop` | brake: a target counts only below `maxSpeed` | `episodes` [8], `distance` [300, 1200], `radius` [60], `maxSpeed` [100], `frames` per episode |
| 1 | `turn-and-go` | turn around: start moving fast away from the target | `episodes` [8], `distance` [300, 1200], `radius` [50], `speed` [200, 400], `spread` [45]°, `frames` per episode |
| 1 | `chain` | 3–5 targets per episode, legs turning from the last | `episodes` [6], `targets` [3, 5], `distance` [300, 900], `turn` [0, 120]°, `radius` [50], `frames` per target |
| 2 | `corridor` | target at the end of a bent corridor of asteroid walls | `episodes` [4], `segments` [2, 3], `length` [400, 700], `bend` [40, 100]°, `width` [260], `rockRadius` [30, 45], `radius` [50], `frames` per episode |
| 2 | `field` | a chain through a dense field | `episodes` [4], `targets` [3, 5], `distance` [400, 800], `turn` [0, 90]°, `radius` [60], `density` [10] per 10⁶ units², `rockRadius` [30, 70], `margin` [500], `lane` [0], `frames` per target |
| 3 | `race-legs` | consecutive checkpoints of a race track; crashes respawn at the last one | `tracks` [["random"]], `episodes` [6], `legs` [3], `frames` per leg |

The watch page flies any of them (`watch.html?arena=<name>&params=<JSON>&seed=<run seed>&g=<gen>`),
built exactly as in a training run with that seed at that generation.

## Skills exam

`exam: { ..., "skills": {} }` (optional `episodes`, default 8) makes every exam also fly fixed
scenarios of each training arena on its own. The arenas: `stop`, `turn-and-go`, `chain`,
`corridor`, `field`, `race-legs`, rock-in-line with 1 and with 2 rocks, and point-to-point with 80
asteroids.

- **Metrics:** `skill<Arena>` (share of targets reached) and `skill<Arena>Crashes` (crashes per
  episode), in the "Skills" group, for example `skillStop` and `skillCorridorCrashes`.
- **Same scenarios for every model:** they are seeded from the exam seed only. They use the run's
  collisions, crash mode and crash limit.
- **Training is untouched:** each arena flies on its own server, so the `stateHash` and
  `result.json` are unchanged.
- **Cost:** about 0.15 s per model with 8 episodes, on top of the exam.
- **Standalone `exam` method:** the same key works there, with the M4 default physics (obstacles,
  respawn, 600 frames).
- **Profile of stored models:** `npm run skills -- --run train-310..train-319 --gen 150` prints the
  profile without retraining.

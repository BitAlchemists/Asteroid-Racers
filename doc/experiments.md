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

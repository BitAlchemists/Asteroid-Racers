# M2 — Measurement

Status: ✅ done (approved and finished 2026-11-13). Roadmap: [`../ROADMAP.md`](../ROADMAP.md)

## Goal

Measure what we actually care about: **can a model race?** Training scores only say how well a
model flies its training arena. M2 adds a **race exam**, which flies a model through real race
tracks under the game's real rules, and makes it possible to run the exam on any model:

- the bundled model;
- a finished Evo Lab run;
- any generation of a run, using snapshots saved during training.

After M2, every M5 experiment can be judged by its race exam, not only by its training score.

## Today

- The only race test so far was a one-off script before M1. It flew the bundled model and train-1's
  winner for 5 minutes on 3 layouts. Neither reached a single checkpoint.
- Training runs keep only the final winner (`result.json`, `luke.txt`). The checkpoint file holds
  the latest winner and is overwritten. So the exam cannot be run on earlier generations.
- The game has three race layouts in code (`SceneController`):
  - `demo`: scene 2 with race 2. A corridor race through four asteroid blocks, with legs of
    1,200–2,400 units. This is what players see.
  - `short`: scene 1 with race 1. Start, one checkpoint, finish, over 600 units.
  - `random`: a seeded random race (8 checkpoints, legs of 500–1,000 units) in a light asteroid
    field.
- The racing bot (`RaceTargetScript`) flies to the race portal to join the race, then chases each
  checkpoint the server announces, waiting 5 s before each one (a head start for humans).
- Held-out scores are already reported next to training scores since M1 (`heldOut`,
  `heldOutSuccess`). That roadmap item is done.

## Steps

Each step ends with `npm run check` green and its own commit.

### 1. Exam tracks

- A track registry, like the arena registry: `{ name, build(server, random) }`, which builds the
  world and the race into a server. It starts with `demo`, `short` and `random`, reusing
  `SceneController`.
- The registry is the seam for M4: a track file format later becomes one more way to fill it.

### 2. Exam runner

- One exam flight is one model on one track, in its own seeded server with the real game rules:
  - collisions `all`, respawn after 1 s at the last checkpoint touched, as in the game;
  - the real `RaceTargetScript` with no start delay;
  - the ship starts on the race portal, so it joins the race at once. The flight to the portal is
    not part of the exam.
- It ends when the ship crosses the finish (one lap) or at the time limit (default 3 minutes of
  game time).
- It records:
  - checkpoints reached, out of the total;
  - whether the ship finished, and its finish time;
  - crashes;
  - the distance left to the next checkpoint when time ran out.
- An exam is a list of flights: each track, and for `random` several seeds (default 5).
- **Exam score**, lower is better: 1,000 per checkpoint missed, plus seconds used, plus 0.01 per
  unit of distance left. Checkpoints come first, then time; the distance term separates models that
  reach nothing. The weights live in the exam config, like training scores.
- Deterministic: same model, same config, same seed gives the same result, byte for byte.

### 3. Snapshots in training runs

- The training worker saves the winner every K generations: `snapshotEvery` in the config (default
  10, and always the last generation) writes `RUN_DIR/gens/g0010.json` and so on. _(Changed during
  M2: the plan said `models/`; `gens/` is where Evo Lab looks for snapshots.)_
- The `gen` event names the snapshot file (`snapshot: "gens/g0010.json"`), so Evo Lab's generation
  index lists it. (Confirmed with the Evo Lab session.)
- Snapshots must not change `result.json` or exact resume. Resuming may rewrite the snapshot for
  the generation it restarts from; the content is identical.

### 4. `exam` method in Evo Lab

- A second method in `lab.config.json`: evaluation only, no training.
- Config:
  - `model`: what to examine. One of `"bundled"`, `{ "run": "train-2" }` (the final winner), or
    `{ "run": "train-2", "every": 10 }` (every snapshot of that run);
  - `tracks`, `randomTracks`, `timeLimitSeconds` and the exam score weights.
- Results go out as `gen` events, one per examined generation (one for a single model, many for a
  run's snapshots). The metrics are `exam` (the exam score), `examCheckpoints` (share reached),
  `examFinished` (share of flights finished) and `examCrashes`. Evo Lab can then plot the race exam
  along a run with no new UI.
- Input from another run: Evo Lab's evaluation-only runs. Enqueue with `inputRun` and `inputGens`
  (`all`, `last` or a list); the runner passes `--input-run <dir>` and `--input-gens`. The exam reads
  the source's `gens/` snapshots, or the winner in its `result.json` for runs from before snapshots.
  The input run and its result hash are part of the exam run's identity. `g` = the source generation.
  _(Resolved with the Evo Lab session.)_
- ~~Resumable per examined generation.~~ _(Changed during M2: not resumable. An exam takes about
  1.5 s per model, and a rerun gives the same result, so a checkpoint adds nothing.)_

### 5. Exam CLI

- `npm run exam -- --model <file|bundled> [--track demo] [--seed N]`: the same exam outside Evo
  Lab, printing a table. Useful for quick checks and for CI.
- CI runs a short exam (the `short` track with a low time limit) of the bundled model, so the path
  stays working.

### 6. Baseline exams

- Exam the bundled model and the winners of train-1, train-2 and train-3 with the default exam,
  through Evo Lab.
- Run one new training run with snapshots (the train-3 setup, more generations) and exam it along
  the run, to see whether training progress shows up in races at all.
- Record everything in `HISTORY.md`. Promote no model (the rule in `CLAUDE.md`).

## Acceptance

- [x] Steps 1–5 committed, `npm run check` green, CI green (run 43412565833 on `13d7240`).
- [x] Same model, config and seed give the same exam result twice, byte for byte. (Exact resume
      dropped: the exam method is not resumable; see step 4.)
- [x] Training runs write snapshots; `result.json` and exact resume are unchanged by them (tested).
- [x] An Evo Lab exam of a run's snapshots shows the exam metrics per generation (exam-5 on train-4).
- [x] Baseline table (bundled, train-1, train-2, train-3) recorded in `HISTORY.md`.

## Not in M2

- Watching a flight: the watch page is M3. The exam only produces numbers.
- New tracks, a track file format, a track picker: M4.
- Training on race tracks, or using the exam as a training score. That is an M5 experiment once we
  can measure it.
- Racing against other ships. The exam flies one model at a time, alone on the track.
- Promoting a model into the game.

## Open questions

Each has a default this plan uses until it is answered.

| Question                                         | Default in this plan                                           |
| ------------------------------------------------ | -------------------------------------------------------------- |
| Time limit per flight?                           | 3 minutes of game time (one lap of `demo` should take far less). |
| Which tracks make up the default exam?           | `demo`, `short` and 5 seeds of `random`.                       |
| How are models ranked?                           | Checkpoints reached first, then time, then distance left.      |
| Respawn at the last checkpoint, or end the flight on a crash? | Respawn, as in the game; crashes are counted.     |

## Risks

- **Every model scores zero checkpoints:** likely at first, given the earlier race test. That is a
  result, not a failure. The distance term still orders the models, and it is exactly what M4 and
  M5 need to know.
- **Evo Lab may not support evaluation-only methods well** (inputs from another run). Asking first;
  the fallback is a model file path in the config.
- **The race rules may have rough edges for bots:** spawn slots, the portal one-time ticket,
  respawning at checkpoints. The exam tests will show them, and fixes to game rules get their own
  commits.
- **Exam time:** a 3-minute flight at the training speed-up is a few seconds of wall time. Exams
  along a run (20 snapshots × 7 flights) take minutes, not hours.

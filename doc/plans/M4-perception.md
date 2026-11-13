# M4 — Perception

Status: 🟡 in progress (approved 2026-11-13; rewritten 2026-11-13 after E2, see "Changes to this
plan"). Roadmap: [`../ROADMAP.md`](../ROADMAP.md)

## Goal

**Models that see asteroids and fly around them.** Which kind of sensing works is an open question,
so M4 is built as experiments:

1. a **harness**: switchable model variants compared on matched seeds by their race-exam score, using
   Evo Lab's experiments;
2. **candidate sensors**, each a switch;
3. a **training setup that can learn from sensors**: input encoding, mutation, selection and the
   training task, reviewed and fixed where it holds learning back;
4. **experiments** that pick the sensing and the network size it needs, by a decision rule written
   down before the runs.

Done means a sensing setup that measurably cuts crashes and improves the race exam over today's
blind models, chosen by experiment, and the default for M5's content work.

## Why first

M3 showed the exam's biggest failure: **crash loops**. A rock lies on the straight line between two
checkpoints, the model flies into it, respawns at the last checkpoint and repeats it 35 to 68 times.
Without sensors nothing tells a model that a rock is there. Obstacle-heavy content (M5) would mostly
measure that blindness.

## Where we are (after E2)

Steps 1–5 are done; E1 and E2 are closed (details in `HISTORY.md`).

- **E1 noise floor:** blind models at g150: exam 66,400 ± 28,200 over 5 seeds; crashes 611 ± 108.
- **E2 sensors, one at a time:**
  - `lineCheck` (2 inputs) was clearly better at g50 and g100. At g150 it missed the decision rule
    (2 of 5 seeds), but it cut exam crashes in 4 of 5 seeds.
  - `whiskers`, `sectors` and `nearest` (7–9 inputs) showed no clear difference at g50.
- **The sensors work.** They fire where there are rocks. The best model (train-54) falls back to
  blind-model crashes (596 instead of 136) when its lineCheck inputs are zeroed.
- **The review after E2 found problems in the training setup itself.** Fixing them first makes the
  sensor and capacity questions fair:

| Area | Today | Problem |
| --- | --- | --- |
| Angle inputs | half turns, −1..1 | jump from +1 to −1 directly behind the ship |
| Velocity inputs | angle + speed | the angle is noise when the ship is slow |
| Distance inputs | ÷ 1000, no ceiling | 0–4 in the exam; typical values are small |
| Input scale | speed mostly 0.2–0.3, lineCheck mostly 0–0.4 | small inputs need large weights |
| Mutation | weight × (1 ± U(0,1)), rate 0.1 | a weight's sign almost never flips; weights drift toward 0 on average |
| Selection | 1 parent + 99 children, 12 fresh episodes per generation | a lucky child replaces a good parent; scores jump between generations |
| Crash cost | 500 per crash, against about 5,000 distance cost per episode | crashing through is cheap |
| Training rocks | 1 rock in line; 20 scattered over about 3,000 × 3,000 | the exam's random tracks are about 5× denser |
| Held-out | 2 scenarios | too few to read |
| Sensor range | whiskers and sectors 600 | dodging takes about 1 s, so 600 only covers speeds up to about 600 units/s; models reach 900–1,500 in the exam |
| Hidden layers | 10-8-6-4 | a narrow funnel for 30 inputs |
| Seeds | 5 | exam differences between seeds are bimodal (−10,600 to +65,700 at g150) |

Physics behind the numbers: there is no drag, thrust is 400 units/s², and turning is at most
5 rad/s (a half turn takes 0.63 s). Measured speeds: median 200–300, p90 470–640, maximum 900–1,500.

## Steps

Each step ends with `npm run check` green and its own commit. Steps 1–5 are done (see Acceptance).

### 1–5. Done

1. Obstacles in the model's view: the bot keeps asteroids, a spatial grid, byte-identical baseline.
2. Candidate sensors: `whiskers`, `sectors`, `nearest`, `lineCheck`, each a switch, drawn in the
   viewer; `hidden` as a switchable key.
3. `rock-in-line` arena; `crashMode: "respawn"`.
4. The race exam inside training runs (`exam` switch).
5. The harness: experiment plans in `experiments/`, `doc/experiments.md`, `stateHash` for the gate.

### 6. Training setup switches

Every item is a config key that is **absent when off**. With all of them absent, training
reproduces the stored baseline results byte for byte (existing fixtures and the Evo Lab gate).

| Key | Values | What it does |
| --- | --- | --- |
| `encoding: "v2"` | absent = today | Angles as sin and cos (no jump behind the ship). Velocity as forward and sideways speed in the ship's frame, ÷ 500. Target distance squashed: `d / (d + 500)`. Inputs then use about −1..1. Stored in the model spec, so the game feeds models correctly. |
| `mutation: { kind: "gaussian", sigma, rate }` | absent = relative | Adds N(0, σ) to a weight with probability `rate`. Unbiased, and signs can flip. Default σ 0.2. |
| `parents: μ` | absent = 1 | (μ + λ) selection: the best μ of the generation are kept, each gets (sample − μ) / μ children. |
| `initRange` | absent = 1 | Range of the random starting weights. |
| `crashLimit: N` | absent = no limit | Integer ≥ 1. With `crashMode: "respawn"`, an episode ends at its N-th crash and the rest of its time is charged at the crash distance, exactly as `crashMode: "end"` charges it. With `end` it changes nothing (every crash already ends the episode). Applies to training and held-out episodes and to their replays; the exam has its own rules. Added 2026-11-13 after E3 (see "Changes to this plan"). |
| Sensor `horizon: s` | absent = distance | `whiskers`, `sectors` and `lineCheck` report closeness by time to impact: 1 − time ÷ horizon, where time = distance ÷ closing speed. Closing speed counts as at least 100 units/s, so a resting ship still sees nearby rocks. The value is still 0 for nothing and 1 for touching; the default range becomes 2,500. |

- **`nearest` padding:** with `nearest: { flag: 1 }` every slot gets a leading "present" input, and
  an empty slot reads all 0, so "no rock" differs from "a rock far ahead" (absent = today).
- Tests cover each switch: determinism, exact resume, spec round trip, and that the game's bot feeds
  a v2 model the same inputs as the trainer.
- The viewer and the Evo Lab plugin keep working with v2 models (rebuild the plugin).

### 7. Training task v2 (config values, no new code)

The training task is ordinary config: scoring weights, arena parameters, `heldOut`. These are changed
by decision, not by a screen, because they change what is measured:

- `scoring.crashes` 500 → **3,000**, so a crash costs more than a detour around the rock.
- `rock-in-line`: `rocks` 1 → **2**; `point-to-point`: `asteroids` 20 → **80**, closer to the exam's
  density.
- Episodes 8 + 4 → **16 + 8** per generation (less luck in selection).
- `heldOut` 2 → **6**.
- **Seeds 1–10** from here on.

The numbers are working defaults, checked once with a short run (a crash costs more than a detour; a
generation takes under 15 s). If the check fails, the plan is edited and the history says why.

### 7b. Curriculum switch (added after E3's first look)

E3 at g50: half the seeds reach almost no training targets on the v2 task, so selection has little
to go on. A staged curriculum starts with a clear line of sight and adds rocks as the model gets
good.

- Config `curriculum: {}` (absent = off) with optional `levels`, `success` (default 0.8) and
  `streak` (default 3). Default levels, as overrides of the arena params:

  | Level | `rock-in-line` | `point-to-point` |
  | --- | --- | --- |
  | 0 | `rocks: 0` (clear line of sight) | `asteroids: 0` |
  | 1 | `rocks: 1` | `asteroids: 0` |
  | 2 | `rocks: 1` | `asteroids: 20` |
  | 3 | `rocks: 2` | `asteroids: 40` |
  | 4 | `rocks: 2` | `asteroids: 80` (the v2 task) |

- **Level up:** when the winner reaches ≥ `success` of the training targets in `streak` generations
  in a row, the next generation uses the next level, and the streak starts again.
- **Held-out:** always on the last level (the target task), so it measures the same thing all run.
- **Determinism:** the level and the streak are saved in the checkpoint and covered by the
  `stateHash`. Exact resume is tested.
- **Reporting:** every gen event carries `level`. Snapshots record the arenas of their generation,
  so the viewer replays the right level.

### 8. Experiments (revised)

Each experiment is approved before it runs. **Decision:** the paired exam effect (`exam`, lower is
better) at the final generation, beyond 2 × paired noise and `minEffect`, with ≥ 80 % of seeds
better. Exam crashes are always reported. A switch that wins on exam but raises crashes is flagged,
not adopted.

1. **E1 noise floor** ✅ (blind, task v1).
2. **E2 sensors** ✅ (task v1, 5 seeds): `lineCheck` better early and fewer crashes; the others not
   at today's size.
3. **E3 noise floor v2 (measurement)** ✅: the task v2 config with `lineCheck`, seeds 1–10, g150.
   - Exam mean 42,160 (sd 27,440) at g100, but 96,360 (sd 49,030) at g150.
   - 5 of 10 seeds collapsed after g100 into passive hovering (see HISTORY).
   - Its runs are the gate baseline for E3b and E4.
4. **E3b curriculum (one-at-a-time):** the E3 baseline against the same config plus
   `curriculum: {}`, seeds 1–10. E3's runs are the stored baseline (the gate re-runs them to g5).
   Screen at g50, final at g150, decision on `exam` as usual. If the curriculum wins, it becomes
   part of the baseline for E4.
5. **E4 learner (one-at-a-time):** against the E3 or E3b baseline, switches `encoding`, `mutation`, `parents`,
   `lineCheck.horizon: 2` and `crashLimit: 3`. Screen at g50, final at g150. Winners join the baseline. If two or
   more win, a confirmation run of them together follows (one arm, 10 seeds).
6. **E5 sensors again (one-at-a-time):** on the E4 setup, add `whiskers`, `sectors` (both with a
   `horizon` if E4 adopted it) and `nearest` (with `flag: 1`), one at a time. Does richer sensing
   pay off once the learner is fixed?
7. **E6 capacity (multi-level switch `hidden`):** on the E5 setup, `[16]`, `[32]`, `[16,16]` and
   `[32,32]` against 10-8-6-4. Optional arm: a pretrained start (a trained model with new inputs
   added as zero weights), if E5 adopts a new sensor.
8. **E7 confirmation:** the chosen setup trained to g300, re-examined, and watched in the viewer on
   the crash-loop tracks. Then it is a candidate for the game (your call, per `CLAUDE.md`).

Budget: about 10 runs (E3) + 50 (E4) + 30 (E5) + 50 (E6) + 10 (E7). At about 20 minutes per run
(the v2 task doubles the episodes) and 5 parallel slots, that is about 12 hours of wall time, run in
the background, one experiment at a time.

Experiments may be added or changed as results come in; each change goes into the history.

## Acceptance

- [x] Steps 1–5 committed with `npm run check` green. (CI: pending; nothing has been pushed yet.)
- [x] With no sensors, training reproduces a stored baseline result byte for byte (test, and the
      Evo Lab gate in E2).
- [x] Four sensors, deterministic, drawn in the viewer, exact replay with sensors (tests).
- [x] `rock-in-line` arena and the in-training exam metric in place (tests).
- [x] E1 and E2 run through Evo Lab experiments with plans, reports and sign-offs.
- [x] Step 6 committed: every setup switch absent = byte-identical baseline; tests per switch.
- [x] Step 7: task v2 checked and recorded.
- [ ] Step 7b: curriculum switch, tested (determinism, resume, level-ups, replay of the right level).
- [ ] E3, E3b and E4–E6 run with approved plans, reports and sign-offs; E7 done.
- [ ] A chosen setup (sensing, encoding, learner, network size) recorded in `HISTORY.md` and the
      roadmap, with its exam and crash numbers against the blind baseline.
- [ ] CI green after the user asks for a push.

## Not in M4

- Track files, new tracks, the track picker and the other arenas: M5.
- Lookahead to the next checkpoint, crossover, rate and strength schedules: M6. (A first
  curriculum moved into M4 as step 7b; M6 can still explore richer ones.)
- Changing the game's physics (thrust, turn rate, ship size) or respawn rule.
- Shipping a model into the game (decided by you after E7).

## Open questions

| Question | Default in this plan |
| --- | --- |
| Are sensors fair, given human players see the screen but have no rays? | Allowed: they read only what the client knows (the visible world). Revisit before a model ships into the game. |
| What counts as "measurably better"? | Paired exam effect beyond 2 × noise and `minEffect`, ≥ 80 % of 10 seeds, crashes not worse. |
| Should crashes be the decision metric instead of the exam score? | No: exam stays primary; crashes are reported and can veto. Their paired noise is far lower, so they are the first thing to look at. |
| Are the task v2 numbers right (crash cost 3,000, density, episodes)? | Working defaults; checked once in step 7, changed with a history note if wrong. |

## Risks

- **Byte-identical baseline** with five new switches: any switch that leaks into the default path
  breaks the gate. Caught by the fixtures and the gate before experiments run.
- **The game must feed v2 models correctly**: the encoding lives in the model spec, and a test
  compares the game bot's inputs with the trainer's.
- **Cost doubles** with the v2 task. The check run measured 12–20 s per generation (about 2.5× the
  old task), so 45–60 minutes per run. The episodes stay at 16 + 8, because the machine runs 20
  workers in parallel, not the 5 the budget assumed (see "Changes to this plan").
- **Too many changes at once:** the task (step 7) changes by decision, the learner (E4) by
  experiment. E3 re-measures the baseline, so later effects are not confused with the task change.
- **No sensor or size wins clearly.** A null result is recorded as such; `lineCheck` stays the
  default.

## Changes to this plan

- **2026-11-13, after E2** (asked by the user):
  - **Why:** E2 left the richer sensors untested in a fair setting. The user asked whether the
    model size is right and whether the inputs and training parameters are sensible. The review
    found the problems in the table above.
  - **Added:** step 6 (setup switches) and step 7 (task v2).
  - **Experiments:** E3 became a new noise floor; E4 (learner), E5 (sensors again) and E6
    (capacity) are new; confirmation became E7.
  - **Scope:** network size and part of the mutation and selection work moved here from M6. The
    old E3 capacity design (`[16, 12, 8]`, `[24, 16]`) was replaced by E6.
  - **Seeds:** 5 → 10.
- **2026-11-13, step 6:** sensor switches are numeric parameters, like the existing ones: time mode
  is `horizon: <seconds>` instead of `mode: "time"`, and nearest padding is `flag: 1` instead of
  `pad: "flag"`. That keeps Evo Lab switch values and the parser numeric; the meaning is unchanged.
- **2026-11-13, step 7:**
  - **Episodes kept at 16 + 8**, even though a run takes 45–60 minutes instead of about 20. The
    20-minute rule came from a budget that assumed 5 parallel slots. The machine has 24 threads and
    Evo Lab allows 20 workers, so total wall time stays close to the planned ~12 hours.
- **2026-11-13, after E3's first look** (agreed with the user): step 7b (curriculum switch) and
  experiment E3b added.
  - **Why:** at g50, 5 of 10 seeds reached almost no training targets on the v2 task. The user asked
    for a smoother difficulty curve: first a clear line of sight, then more rocks in the way.
  - **Scope:** this moves a first curriculum forward from M6.
- **2026-11-13, after E3 — PROPOSED, for the user to decide** (not adopted, not implemented):
  - **What E3 showed:** after g100, 5 of 10 seeds collapsed from racing into passive hovering:
    0–1 training targets, short paths, few crashes.
  - **Cause, measured on seed 7:**
    - the g127 winner (12 of 24 targets) flew g128's freshly drawn scenarios with 47 crashes in
      respawn loops: score 260,875;
    - a passive child (0 targets, 2 crashes) scored 204,469 and replaced it;
    - with one parent, the racer was gone.
    - On g129 and g130's scenarios the same racer would have scored 206,453 and 195,666, about
      the passive level. So with crash cost 3,000 and unlimited respawns, racer against passive is
      close to a coin flip each generation.
  - **Proposed:**
    1. **A crash cap** (new switch, e.g. `crashLimit: 3`): an episode ends after N crashes (the
       rest charged at the crash distance, as `crashMode: "end"` does). One crash-loop draw then
       costs at most N × 3,000 per episode instead of 47 × 3,000. Test it as a fifth switch in E4.
       **ADOPTED** (user approved 2026-11-13): implemented as the `crashLimit` switch (step 6
       table) and added to E4 as a fifth one-at-a-time switch (`crashLimit: 3`). Items 2 and 3
       are still proposals.
    2. **`parents: 10` as the likely default.** It is already an E4 switch; if it wins, it joins
       the baseline for E5 and E6.
    3. **Read the g100 column too.** Experiment reports already show it. A setup that wins at
       g100 but collapses by g150 is not adopted on its g150 number alone.

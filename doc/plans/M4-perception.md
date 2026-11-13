# M4 — Perception

Status: ✅ done 2026-11-13 (approved 2026-11-13; rewritten after E2 and after the research; closed early by agreement, the open experiments moved to M6). Roadmap: [`../ROADMAP.md`](../ROADMAP.md)

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

### 8. Measurement and learner switches (added after the research)

Rewritten 2026-11-13 from [`../research/neuroevolution-best-practices.md`](../research/neuroevolution-best-practices.md).
E4 found no clear difference for any learner switch. The research gives three reasons to distrust
that null result before testing more:
- the winner's curse: the best of 99 noisy children is usually a lucky one, and nothing re-checks it;
- an underpowered exam: 17 races per model;
- a non-standard mutation, and a Gaussian arm that was not the standard form (σ 0.2 on 10 % of the
  weights).

Every item is a switch, absent = byte-identical (fixtures, exact resume, Evo Lab gate), with tests
per switch, like step 6.

**(a) Re-evaluate the top children.** ✅ built 2026-11-13 (see HISTORY)
- Config: `reevaluate: { top: 5, episodes: 24 }`.
- After scoring a generation, the top `top` children plus the parent fly `episodes` extra fresh
  scenarios, seeded from (seed, generation, a new stream).
- The parent is replaced, and curriculum level-ups are judged, on the combined mean of both rounds.
- The checkpoint and `stateHash` stay complete. The extra scenarios are derived, so no new random
  state is needed.
- Cost: one extra round of 24 episodes with 6 ships per generation, about +10–20 % wall time.
- Source: Such et al. 2017 (top 10 re-evaluated on 30 episodes); Jin & Branke 2005.

**(b) Exam v2 for decisions: more races, robust statistics.** ✅ (2026-11-13: no exam code needed; `npm run iqm` built. A 102-race exam takes about 6 s, against 1 s for 17.)
- The exam already takes `randomTracks`. Decisions use `exam: { every: 25, randomTracks: 100 }`:
  102 races, every 25 generations and always at the last one.
- Cost, from today's numbers: 17 races take about 1.6 s with S1's speed-ups (train-250), so 102
  races take about 10 s, about 1 minute per 150-generation run (runs take about 15–20 minutes).
- Reports add the **IQM with stratified-bootstrap 95 % CIs** across seeds, paired per seed, plus a
  power check: the effect the current spread can detect with 10 seeds.
  - Evo Lab's reports do not compute IQM or bootstrap CIs (`docs/experiments.md`). A small script
    (`npm run iqm -- <experiment>`, in `packages/node`) reads the runs' gen events and prints the
    table.
  - The feature request goes to the Evo Lab session as information.
- Old 17-race exam numbers stay comparable only with each other; reports say which exam was used.
- Source: Agarwal et al. 2021 (rliable); Colas et al. 2018; Ha & Schmidhuber 2018.

**(c) Standard Gaussian mutation.** ✅ built 2026-11-13 (see HISTORY)
- No new code: `mutation: { kind: "gaussian", sigma: 0.03, rate: 1 }` already works (`rate` is
  accepted in (0, 1]).
- Step 8 only adds a test that `rate: 1` touches every weight.
- Optional annealing (`sigmaEnd`, linear over the run) is a later switch if E6 points that way.
- Source: Such et al. 2017; Salimans et al. 2017.

**(d) Network shape.** ✅ built 2026-11-13 (see HISTORY)
- `hidden: [16]` works today.
- A linear policy is `hidden: []`. The config check accepts it, and `layoutFor` with `MajorTom`
  gives a [inputs, 2] network with tanh outputs (checked by hand 2026-11-13). Step 8 adds a worker
  test: train, resume and replay with `hidden: []`.
- Source: Mania et al. 2018.

**(e) A progress term in scoring.** ✅ (2026-11-13: `scoring.progress`, see `doc/experiments.md`.)
- A new scoring weight `progress` (absent = 0 = today). Per frame it adds
  `−progress × (d(t−1) − d(t))`, the reduction of distance to the current target: potential-based
  shaping with Φ = −distance.
- It is credited only while the episode runs; a respawn does not count as progress.
- Variant to decide in implementation: weight `time` already exists. If `progress` is awkward to
  make exact, time-to-target is the fallback.
- Source: Ng et al. 1999; Togelius & Lucas 2005.

**(f) Curriculum mixing.** ✅ built 2026-11-13 (see HISTORY)
- `curriculum.keepEasy: 0.25` (absent = 0): after a level-up, about a quarter of each arena's
  episodes come from earlier levels (chosen deterministically from seed and generation).
- With `reevaluate`, level-ups are judged on the re-evaluated success.
- Source: Narvekar et al. 2020; Gomez & Miikkulainen 1997.

### 9. CMA-ES optimiser (larger build) — moved to M6 (2026-11-13, M4 closing)

- A new optimiser switch, `optimizer: { kind: "cmaes", population: 50, sigma: 0.1 }` (absent = the
  GA), on the same shared scenarios with rank-based weights.
- At about 250 weights, full CMA-ES fits; sep-CMA-ES only if we go far beyond 1,000.
- **Determinism:**
  - the mean, step size, covariance and evolution paths go into the checkpoint and the
    `stateHash`;
  - sampling uses the run's seeded generator;
  - exact kill-and-resume is tested like every switch;
  - the eigen-decomposition must be deterministic (a fixed algorithm, no library with
    platform-dependent ordering).
- The reported "winner" is the best sampled candidate. The CMA mean is examined too, as a second
  model.
- Source: Hansen 2016; Ha & Schmidhuber 2018; Heidrich-Meisner & Igel 2009; Igel 2003.

### 10. Experiments

Each experiment is approved before it runs. **Decision:**
- the paired exam effect (`exam`, lower is better) at the final generation, beyond 2 × paired noise
  and `minEffect`, with ≥ 80 % of seeds better;
- from E5 on, also the IQM's paired bootstrap CI excluding 0;
- exam crashes always reported: a switch that wins on exam but raises crashes is flagged, not
  adopted;
- the g100 column read too: a setup that wins at g100 but collapses by g150 is not adopted on its
  g150 number alone.

1. **E1 noise floor** ✅ (blind, task v1).
2. **E2 sensors** ✅ (task v1, 5 seeds): `lineCheck` better early and fewer crashes; the others not
   at today's size.
3. **E3 noise floor v2 (measurement)** ✅: the task v2 config with `lineCheck`, seeds 1–10, g150.
   - Exam mean 42,160 (sd 27,440) at g100, but 96,360 (sd 49,030) at g150.
   - 5 of 10 seeds collapsed after g100 into passive hovering (see HISTORY).
4. **E3b curriculum (one-at-a-time)** ✅ **the curriculum wins**:
   - at g150: exam 96,360 → 32,730 (paired −63,630, 2 × se 44,420, 8/10 seeds better);
   - crashes 190 → 147;
   - no seed collapses (E3: 5);
   - the g50 screen showed no clear difference, and the runs were continued to g150 by the user's
     decision;
   - `curriculum: {}` joins the baseline.
5. **E4 learner (one-at-a-time)** ✅ (closed): six switches against the curriculum baseline:
   - `encoding`, `mutation` (σ 0.2, rate 0.1), `parents: 10`, `lineCheck.horizon: 2`,
     `crashLimit: 3` and `curriculum.success: 0.6`;
   - **no clear difference for any**;
   - `horizon` and `success 0.6` looked worse at g100 but not at g150;
   - `parents: 10` was best at g100 but stopped by the screen.
6. **E4b confirmation (leave-one-out)** ✅ (closed): `parents: 10` and `curriculum.success: 0.6`,
   together and each alone, to g150.
   - No clear difference by the rule: the combination against the baseline at g150 was −14,460
     (2 × se 18,250), 5 of 10 seeds better. Under IQM: −4,693 [−33,223, +6,764].
   - The combination has the best means (exam 18,268, 88 % of checkpoints, 84 % of races finished,
     7 of 10 seeds at level 4), and the user adopted it as the default setup by judgement.
7. **E5 noise floor v3 (measurement)** — moved to M6: the E4b-decided baseline plus `reevaluate` (8a), with exam
   v2 (8b), seeds 1–10, g150.
   - It re-measures the spread between seeds with IQM and bootstrap CIs, and sets `minEffect`.
   - It answers whether re-evaluation alone stops collapses, by comparing with E3b/E4's baseline
     on the same seeds (re-examined with exam v2 from their snapshots, an exam-only run).
   - About 10 runs + 10 exam-only runs.
8. **E6 learner, done properly (one-at-a-time)** — moved to M6. On the E5 baseline:
   - standard Gaussian (8c);
   - `hidden: [16]` and `hidden: []` (8d);
   - the progress term (8e);
   - curriculum mixing (8f);
   - `parents: 10` again, if E4b did not settle it.
   - Screen at g100, final at g150; about 60 runs.
9. **E7 CMA-ES** — moved to M6. After step 9: `optimizer: cmaes` against the E6 winner setup, seeds 1–10, g150
   (a population of 50 means half the episodes per generation of the GA's 100, so also compare at
   equal episode budgets). About 20 runs.
10. **E8 sensors again (one-at-a-time)** — moved to M6. On the improved setup:
    - `whiskers`, `sectors` and `nearest` (`flag: 1`), each added to `lineCheck`;
    - capacity folded in where a sensor needs it (e.g. that sensor with `hidden: [32]`);
    - optional: a pretrained start (a trained model with the new inputs as zero weights);
    - about 40–60 runs.
11. **E9 confirmation** (the last M4 experiment): the default setup (E3b's config plus
    `parents: 10` and `curriculum: { success: 0.6 }`) trained to g300, seeds 1–10, with exam v2
    (102 races every 25 generations), and watched in the viewer on the crash-loop tracks. Then it is a candidate for the game (your call, per
    `CLAUDE.md`).

**Superseded** (2026-11-13, after the research):
- the old E5 (sensors again on the E4 setup) is now E8, moved after the learner and measurement
  fixes;
- the old E6 (capacity sweep `[16]`, `[32]`, `[16,16]`, `[32,32]`) is folded into E6 (one hidden
  layer, linear) and E8 (capacity per sensor);
- the old E7 confirmation is now E9.
- Why: with the winner's curse, a 17-race exam and a non-standard mutation, null results say little
  about sensors or capacity.

**Budget:**
- With S1's speed-ups a 150-generation run takes about 15–20 minutes with up to 20 in parallel.
  E4 (70 runs) took about 50 minutes of wall time.
- Expected wall time: E5 about 30 minutes, E6 about 1 hour, E7 about 30 minutes, E8 about 1 hour,
  E9 about 1 hour, plus implementation time for steps 8 and 9.

Experiments may be added or changed as results come in; each change goes into the history.

## Closing M4 (agreed with the user, 2026-11-13)

**The goal is met.** Models see asteroids and fly around them, measurably better than blind models:

| | Blind models (E1, g150) | Default setup (E4b combination, g150) |
| --- | --- | --- |
| Race exam score (17 races, lower is better) | 66,400 | about 18,300 |
| Exam crashes | 611 | 147 |
| Races finished | 39 % | 84 % |
| Passive collapse | – | none |

- **Proven:** `lineCheck` sensing (E2) and the staged curriculum (E3b). The curriculum's win holds
  under IQM with a paired bootstrap CI: −81,900 [−119,600, −15,200] exam points.
- **Default setup:** task v2 (`rock-in-line` 16 episodes × 2 rocks, `point-to-point` 8 episodes ×
  80 asteroids, crash cost 3,000, 6 held-out), `sensors: { lineCheck: {} }`,
  `curriculum: { success: 0.6 }`, `parents: 10`, encoding v1, hidden 10-8-6-4, relative mutation.
  `parents: 10` and `success: 0.6` were adopted by judgement (best means, no clear difference by
  the rule).
- **Power:** with 10 seeds, `npm run iqm` shows that E4/E4b could detect only about 13,000–36,000
  exam points; a 10,000-point effect needs 20–66 seeds per arm. Most "no clear difference" results
  in M4 mean "too few runs to tell", not "no effect".

**What remains in M4:**
1. Step 8 lands: (b) and (e) are on main (0506788); (a) re-evaluation, (c), (d) and (f) are being
   built.
2. E9: the default setup to g300 with exam v2, plus a viewer check.
3. The default setup and its numbers recorded in `HISTORY.md` and the roadmap, then M4 ✅.

**Moved to M6** as its experiment backlog: E5 (noise floor v3 with re-evaluation), E6 (learner
fixes: proper Gaussian, `hidden: [16]` and linear, progress term, curriculum mixing), step 9 and E7
(CMA-ES), E8 (richer sensors again with capacity). They run on M5's content and M6's switches, under
M6's experiment budget rule.

## Acceptance

- [x] Steps 1–5 committed with `npm run check` green. (CI: pending; nothing has been pushed yet.)
- [x] With no sensors, training reproduces a stored baseline result byte for byte (test, and the
      Evo Lab gate in E2).
- [x] Four sensors, deterministic, drawn in the viewer, exact replay with sensors (tests).
- [x] `rock-in-line` arena and the in-training exam metric in place (tests).
- [x] E1 and E2 run through Evo Lab experiments with plans, reports and sign-offs.
- [x] Step 6 committed: every setup switch absent = byte-identical baseline; tests per switch.
- [x] Step 7: task v2 checked and recorded.
- [x] Step 7b: curriculum switch, tested (determinism, resume, level-ups, replay of the right level).
- [x] E3, E3b and E4 run with approved plans, reports and sign-offs.
- [x] E4b signed off; the user chose the combination as the default setup.
- [ ] Step 8 landed: `reevaluate`, exam v2 with the IQM/bootstrap script ((b) ✓ 0506788), the
      Gaussian `rate: 1` test, the linear-policy worker test, the `progress` scoring term ((e) ✓
      0506788) and `curriculum.keepEasy`. Each is absent = byte-identical, with tests.
- [ ] E9 done: the default setup to g300 with exam v2, report, viewer check.
- [ ] The default setup recorded in `HISTORY.md` and the roadmap, with its exam and crash numbers
      against the blind baseline.
- Moved to M6: step 9 (CMA-ES) and E5–E8.
- [ ] CI green after the user asks for a push.

## Not in M4

- Track files, new tracks, the track picker and the other arenas: M5.
- Lookahead to the next checkpoint, crossover, rate and strength schedules: M6. (A first
  curriculum moved into M4 as step 7b; M6 can still explore richer ones.)
- Novelty search, MAP-Elites or other quality-diversity methods: later, only if hovering or other
  local optima persist after step 8 (research item 8).
- NEAT or other topology-evolving methods.
- Changing the game's physics (thrust, turn rate, ship size) or respawn rule.
- Shipping a model into the game (decided by you after E7).

## Open questions

| Question | Default in this plan |
| --- | --- |
| Are sensors fair, given human players see the screen but have no rays? | Allowed: they read only what the client knows (the visible world). Revisit before a model ships into the game. |
| What counts as "measurably better"? | Paired exam effect beyond 2 × noise and `minEffect`, ≥ 80 % of 10 seeds, crashes not worse. |
| Should crashes be the decision metric instead of the exam score? | No: exam stays primary; crashes are reported and can veto. Their paired noise is far lower, so they are the first thing to look at. |
| Are the task v2 numbers right (crash cost 3,000, density, episodes)? | Working defaults; checked once in step 7, changed with a history note if wrong. |
| Is a 102-race exam enough? | Yes for decisions (6× today's races, about 1 minute per run). The final candidate in E9 gets a larger one-off exam (e.g. 500 races, exam-only run). |
| Does Evo Lab compute IQM and bootstrap CIs? | Not today; our script does, and the request goes to the Evo Lab session. |
| How big should σ be for standard Gaussian mutation? | 0.03 with starting weights in ±1 (the research suggests 0.02–0.05 of the weight scale); annealing only if E6 points that way. |

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
- **Re-evaluation changes what "winner" means.** Training scores and level-ups follow the combined
  mean, so runs with and without `reevaluate` are only compared on the exam and held-out metrics.
- **The progress term changes the score's scale.** Training scores of runs with and without it are
  not comparable; decisions stay on the exam.
- **CMA-ES determinism:** floating-point linear algebra must give identical results across resume;
  the eigen-decomposition is our own fixed code, and kill-and-resume is tested.
- **Exam v2 breaks comparability with older exam numbers.** Reports name the exam; older runs are
  re-examined from their snapshots when a comparison is needed (exam-only runs).

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
- **2026-11-13, after E3b — PROPOSED, for the user to decide** (not adopted, not implemented):
  lower the curriculum's level-up `success` from 0.8 to about 0.6.
  - **Why:** 3 of 10 seeds (1, 6, 10) stayed on level 1 for all 150 generations, and only 4 reached
    the v2 task (at g65–g130).
  - **What is left as it is:** the streak of 3 generations stays.
  - **How to test it:** in E4 as a further one-at-a-time arm (`curriculum: { success: 0.6 }`), or as
    the new default.
- **2026-11-13, after the research** (agreed with the user: "Yes, rewrite the plan"):
  - **Why:** the user asked how such trainings are best conducted. The research
    ([`../research/neuroevolution-best-practices.md`](../research/neuroevolution-best-practices.md))
    found three reasons E4's "no clear difference" says little: the winner's curse with no
    re-evaluation, a 17-race exam, and a non-standard mutation (the E4 Gaussian arm was not the
    standard form either).
  - **Added:**
    - step 8, measurement and learner switches: `reevaluate`, exam v2 with IQM and bootstrap CIs,
      standard Gaussian, linear and one-layer networks, a `progress` scoring term and curriculum
      mixing;
    - step 9, the CMA-ES optimiser.
  - **Experiments:**
    - E5 is now a noise floor v3 with re-evaluation and exam v2;
    - E6 tests the learner switches properly;
    - E7 is CMA-ES;
    - E8 is the richer sensors (the old E5) with capacity folded in (the old E6);
    - E9 is the confirmation (the old E7).
  - **Scope:** re-evaluation and CMA-ES move into M4. Novelty search and MAP-Elites are listed as
    "later, only if hovering persists".
- **2026-11-13, after E4b:** the user chose the combination (`parents: 10` + `curriculum.success:
  0.6`) as the baseline for E5 onwards, by judgement: it has the best means, but missed the decision
  rule (5 of 10 seeds better). E5's baseline config is E3b's config plus these two keys.
- **2026-11-13, closing M4** (agreed with the user): M4 closes after step 8 and one confirmation
  run (E9). E5–E8 and step 9 (CMA-ES) move to M6 as its experiment backlog.
  - **Why:** experiments kept spawning experiments, and the milestones stalled. The user asked to
    stop that. M4's goal (models that see and avoid asteroids, clearly better than blind ones) is
    met, and the IQM power check shows that 10-seed experiments cannot settle the remaining small
    tuning questions anyway.

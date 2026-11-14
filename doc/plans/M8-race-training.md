# M8 — Race training

Status: 🟡 planned 2026-11-14, waiting for the user's approval of this plan. Roadmap:
[`../ROADMAP.md`](../ROADMAP.md). Inserted between M6's decision point 2 and the rest of M6 (the user
agreed to the direction on 2026-11-14, "ok").

## Goal

**Train on races, so that the network learns racing, not only crash avoidance.** On the adopted
baseline, exam3 sits at about 50 from g5 to g150, and the scripted controller alone scores 52.6. The
training task (rock-in-line + point-to-point) is mastered by g13–18, so curriculum tweaks on it do
nothing. M8 makes many fresh generated race legs per generation the main task, adds lookahead (the
network needs to see the next turn), makes selection robust against single-winner flukes, and checks
the generator for the traps S4 and S5 found.

Done means (each by a 20-seed pre-registered test, details under Acceptance):
- exam3 clearly rises with training (not flat from g5);
- exam3 medium and hard are well above today's 14–20;
- the M8 setup beats the scripted controller's 52.6 on exam3.

## Today

- **Baseline** (adopted after batch A, plus keepEasy at decision point 2): M4's default setup (task
  v2 = rock-in-line 16 × 2 rocks + point-to-point 8 × 80 rocks, `lineCheck`, curriculum at 0.6, 10
  parents) + `controller: residual 0.5` + `scoring.progress: 3` + `curriculum.keepEasy: 0.25`. Runs
  train-585..604 (seeds 1–20, g150, exam3 51.9); without keepEasy train-545..564 (exam3 50.4).
- **Decision point 2, decided by the user 2026-11-14:**
  - rotation 20 not adopted ("I'd rather have faster races"): **finish time matters more than fewer
    crashes**, which argues for `scoring.par` / time vs par in M8 (step 5). The residual
    controller already made the rotation cost largely obsolete (spin about 1 → 0.3; rotation 20
    only 0.35 → 0.30). `scoring.rotation` stays in the code, absent when off; not part of M8;
  - keepEasy 0.25 adopted ("Keep easy okay");
  - decisions on exam3 averaged over g125–150 instead of the g150 winner alone ("ok");
  - the budget rule (≤ 6 experiments per phase) dropped ("drop").
- **exam3 at g150** (IQM over 20 seeds): baseline 50.4; easy 74.9, **medium 14.3, hard 20.0**,
  hand-made 84.2, goal races 67.6, skills 76.3; crashes 35.6 per race. Flat over training: 50.0 at
  g5, 51.1 at g25, 50.4 at g150.
- **Batch B** (`m6-b-curriculum`): keepEasy 0.25 is the only arm with a real gain, +1.4 [+0.4,
  +3.0], below the 3-point minimum and still rising at g150 (train-585..604). m7gen (generated legs +
  goals) was worse (−3.0, vetoed), for three reasons:
  - one generated track per arena per generation, so a generation's ranking depends on one track
    (selection is noise);
  - its middle levels dropped the v2 task, so easy and hand-made got worse;
  - single g150 winners freeze (27 drops in 20 runs).
  It still showed what race training can buy: crashes 35.6 → 9.0 per race, medium +5.8 (18/20).
- **What the code gives today** (checked for this plan):
  - `generated-legs` builds **one track per scenario** (`trackLegs` in `tier-arenas.ts`: one world,
    one track, `episodes` runs of `legs` checkpoints cut from it).
  - Training builds **one scenario per arena entry per generation** (`trainingScenarios` in
    `arenas.ts`), each entry with its own seed stream `(seed, training, entry index, g)`.
  - So **several tracks per generation already work without code:** list `generated-legs` N times in
    a level (m7gen already had two entries in one level). Each entry draws a fresh track every
    generation. Several tracks in one scenario do not exist and are not needed.
  - Costs of that form: held-out flies `heldOut` scenarios per entry (6 × N, the winner only);
    `keepEasy` works per entry with k = round(0.25 × episodes), so entries with 1 episode get no
    easy share (easy material is then listed explicitly, see step 3).
  - Lookahead (`lookahead: { legs, frame: "corner" }`) and `reevaluate: { top, episodes }` are built
    and absent by default.
  - `npm run exam3` re-scores one generation per call; `npm run iqm` compares one generation.
    Neither averages a window of generations.
  - Training draws generated track seeds as 32-bit numbers; nothing stops a draw from hitting an
    exam3 seed (300001–340005). The chance is small (70 exam seeds against about 10⁵ tracks drawn
    per experiment: about 1 in 500), but not zero.
- **Generator findings not yet followed up:**
  - S5: medium tracks where every episode's first leg runs into a corridor wall at a bend;
  - S4: four exam races with a near-universal stall (`medium:310014`, `medium:310015`,
    `hard:320008`, `hard:320009`: 61–70 of 72 models stop at the same checkpoint).
- **Cost:** a wave of 20 baseline runs to g150 takes about 12–15 minutes; m7gen took about 40.
  S5 measured 1.8× the baseline's ship-steps per generation on easy generated legs and about 3×
  with all levels mixed.

## Steps

Each step that changes code ends with `npm run check` green and its own commit. Every new key is a
switch or an arena param: **absent means byte-identical** (fixtures, exact resume, Evo Lab gate).
**Exam v3.0 stays frozen**; any change to it would be exam v3.1, re-scored and agreed first.
**Never trained on:** the 7 hand-made exam tracks, the 3 goal tracks, and the exam3 generated seeds.
Generalisation is measured on them.

### 1. Tools and guards (small code, no training change)

- **Averaged decision:** `npm run exam3 -- --run … --gens 125..150:5` re-scores several snapshot
  generations in one call; `npm run iqm -- … --gens 125..150` takes, per seed, the mean over those
  generations before the IQM and the paired bootstrap. Both are tools in `packages/node` outside
  the binding, so stored runs stay reusable.
- **Exam seeds out of training:** `generatedBuilder` redraws a track seed that falls in an exam3
  seed range (a test pins that the exam's seeds are never returned). No pinned scenario hash
  changes (none hits the range), so training stays byte-identical in practice; the binding changes,
  so the next experiment's gate re-runs its baseline (about 15 minutes).
- **Multi-track smoke run** (headless, seed 1, a few generations): a level with 12
  `generated-legs` entries flies 12 different tracks per generation and new ones the next
  generation; held-out and the start check work; ship-steps per generation measured against the
  baseline.
- **Acceptance:** `--gens` matches single-generation runs averaged by hand; the guard test; the
  smoke run's track count and cost in the history.

### 2. Generator check (analysis first; a fix only behind a param)

- **Look at the traps:** S5's first-leg wall at a bend (rebuild the smoke run's medium tracks from
  its seed and generations), and S4's four stall races. Watch page and the plugin, plus a geometric
  check: does the straight line from a race point into the next corridor mouth hit the wall at a
  bend? Does the validator's grid path exist while a ship arriving at race speed can't make it?
- **Measure how common it is:** over 1,000 seeds per band, the share of tracks with such a leg
  (the scripted controller's first-leg failures as a second signal).
- **Decide** (recorded in the history, the user informed):
  - **not a flaw** (hard spots, not traps): nothing changes;
  - **a flaw:** fix it as a generator version, `generator: 2` on `generated-legs` (absent = v1, so
    pinned hashes, exam v3.0 and older configs are unchanged). M8's race levels then use v2.
    Whether exam v3.1 replaces the four stall races is the user's decision, later and separately.
- **Acceptance:** the analysis in the history with numbers; if fixed, tests (v1 unchanged, v2
  passes validation, the trap measure drops), `npm run check` green.

### 3. Experiment E1: race training × lookahead (`m8-1-race-lookahead`)

Draft: [`../../experiments/m8-1-race-lookahead.md`](../../experiments/m8-1-race-lookahead.md).

- **Baseline:** the adopted baseline, keepEasy 0.25 included. Its runs exist: train-585..604
  (seeds 1–20, g150), reused.
- **Race levels** (`curriculum.levels`, tiered, promoted by `success: 0.6` as today):

  | Level | Generated tracks per generation (1 episode × 3 legs each) | Plus |
  | --- | --- | --- |
  | 0 easy | 12 easy | the v2 task at half size (rock-in-line 8 × 2 rocks, point-to-point 4 × 80) |
  | 1 medium | 4 easy + 8 medium | the same |
  | 2 hard | 2 easy + 4 medium + 6 hard | the same |

  - 12 tracks per generation, fresh every generation, 36 leg-flights per candidate.
  - Easy material stays in: easy tracks in every level, the v2 task in every level (m7gen's
    lesson), and keepEasy on the v2 entries.
  - Estimated cost about 2.5–3× the baseline per generation (S5: 32 leg-flights ≈ 2×).
- **Lookahead:** `{ "legs": 2, "frame": "corner" }` (M6 3.1's corner arm; the nose frame only if
  the corner frame helps).
- **Design:** factorial 2 × 2, race levels × lookahead, against the keepEasy baseline. 3 new arms ×
  20 seeds = 60 runs to g150. The lookahead-only arm shows whether lookahead does anything on
  single-target episodes (expected: nothing).
- **Primary metric:** exam3, per seed the mean over g125, g130, …, g150 (re-scored snapshots, step 1);
  IQM over seeds 1–20, paired 95 % bootstrap CI, `minEffect` 3. Evo Lab's own g150 decision is
  reported next to it.
- **Reported:** exam3 profile (medium and hard first), `exam3TimeVsPar` (the user prefers faster
  races), the exam3 curve g5…g150, `level` per seed, freezes (exam v2 checkpoints < 0.6 with few
  crashes), cost per generation.
- **Time:** about 1.5–2 hours (race arms about 35–45 minutes per wave of 20).

### 4. Experiment E2: selection robustness (`m8-2-selection`)

- **On:** E1's best arm (by the rule; if none wins, race + lookahead, the agreed direction).
- **Arms** (one-at-a-time):
  - `reevaluate: { top: 5, episodes: 24 }`: the best 5 children and the parents fly fresh
    scenarios before the winner is chosen;
  - more material per generation: the race levels with 16 tracks instead of 12 (a value switch on
    `curriculum.levels`).
- **Primary metric:** as E1 (exam3, mean g125–150). **Also decided on:** freezes and single-exam
  dips per run (exam3 drop ≥ 10 at one exam, recovered at the next), counted per arm.
- **Seeds and gens:** 20 seeds, g150; baseline = E1's arm, reused.

### 5. Experiment E3: speed and goal types (`m8-3-par-goals`)

- **Only after E1 shows race training works** (exam3 rises with training in the race arm).
- **On:** the setup after E2.
- **Arms:**
  - **par first** (the user prefers faster races): `parSpeed: 250` on all generated entries and
    `scoring.par: 100` (100 per second under par; a miss costs 1,000);
  - **goals:** the race levels with goals: on levels 1 and 2, a third of the tracks with
    `gates: "track"`, two with `stop: 100`, plus the `laps` arena (2 episodes, gated).
- **Primary metric:** as E1; `exam3TimeVsPar` and `exam3Goals` reported first. Crashes stay a veto,
  but the user has said finish time matters more than fewer crashes, so a par arm that wins exam3
  with somewhat more crashes is for the user to judge.
- **Seeds and gens:** 20 seeds, g150.

### 6. Confirmation E4 (`m8-4-confirm`)

- **The M8 setup** (what E1–E3 adopted) against the adopted baseline, on **fresh seeds 21–40**, so
  picking the best arm in E1–E3 doesn't flatter the result. g150, plus a continuation to g300 for
  the curve if the user wants it.
- **Pre-registered tests** = the acceptance criteria below.
- Baseline runs for seeds 21–40 don't exist: they run with the experiment (Evo Lab needs
  `baseline.runs`, so seed runs to g5 first, as for `m6-a3-combination`).

### 7. Close

- Decision point (the user's): the M8 setup becomes the baseline for M6's phases 3.2, 3.3, 4 and 5.
- History, roadmap, this plan's acceptance; M6's plan notes the new baseline.

## Acceptance

- [ ] Steps 1 and 2 committed with `npm run check` green; absent = byte-identical.
- [ ] The generator check recorded, with the decision (fix as `generator: 2`, or no flaw).
- [ ] E1–E3 run (or skipped with a reason), each with a report and a history entry.
- [ ] E4 (seeds 21–40, 20 seeds, decision on exam3 averaged over g125–150, IQM, paired 95 %
      bootstrap CI) shows all three:
  - [ ] **exam3 rises with training:** in the M8 setup, exam3 (mean g125–150) − exam3 at g5 is at
        least 3 points, CI above 0 (paired by seed);
  - [ ] **medium and hard well above today:** `exam3Medium` and `exam3Hard` each at least 5 points
        above the baseline's, paired CI above 0;
  - [ ] **beats the scripted controller:** the 95 % CI of the M8 setup's exam3 IQM lies entirely
        above 52.6.
- [ ] Vetoes not fired in E4: `exam3Crashes` not clearly higher than the baseline; exam v2
      checkpoints not worse by 0.03 or more; `exam3Handmade` not clearly worse (the hand-made tracks
      are the generalisation check).
- [ ] The user's decision on the M8 setup recorded; M6 resumes on it.

## Not in M8

- M6 phases 3.2 (richer sensors), 3.3 (network size), 4 (the learner) and 5 (robustness and
  readiness). They resume after M8, judged on the M8 setup.
- Changing exam v3.0. A v3.1 (for example replacing the four stall races) is a separate decision.
- Training on the hand-made or exam tracks or seeds.
- Promoting a model into the game: the user's call, after real races.
- New game mechanics or physics; Evo Lab changes (requests go to the Evo Lab session).

## Risks

- **Cost:** race levels cost about 2.5–3× per generation. Mitigation: 12 tracks × 1 episode × 3
  legs and the v2 task at half size; measured in step 1's smoke run before E1. If it is above 3.5×,
  fewer tracks (10) or `heldOutEvery`.
- **Seeds stall on the medium or hard level** (success 0.6 never reached): `level` per seed is
  reported; `curriculum.plateau` is the fallback (built, never fired so far).
- **Freezes get more common** on race tasks (m7gen: 27 drops in 20 runs): the averaged rule makes
  them visible without letting one generation decide; E2 tests the cure.
- **Lookahead does nothing on its own:** expected for the lookahead-only arm; the factorial still
  shows whether it adds to race training.
- **The exam measures the training distribution:** exam3's generated bands come from the same
  generator. Hand-made, goal tracks and skills are the out-of-distribution check, and the hand-made
  veto guards it.
- **A generator fix changes the tracks training sees:** it goes in as `generator: 2`, before E1 if
  step 2 finds a flaw, so E1–E4 all use the same tracks.
- **Evo Lab friction:** a value switch on `curriculum.levels` (E2) and a factorial with tiered levels
  are new; checked at `exp new`. Fallback: separate configurations compared with `npm run iqm`.

## Open questions

Decided by the user 2026-11-14 (no longer open): rotation 20 not adopted; keepEasy 0.25 adopted;
exam3 averaged over g125–150 is the decision rule; the budget rule is dropped.

| Question | Working assumption |
| --- | --- |
| Lookahead 1 or 2 legs, corner or nose? | 2 legs, corner frame (M6's agreed 3.1 arm); nose only if corner helps. |
| "Well above" for medium and hard? | At least +5 points each over the baseline, CI above 0. |
| Fix the generator if step 2 finds a flaw? | Yes, as `generator: 2`; exam v3.0 unchanged. |

## Changes to this plan

- 2026-11-14 (same day, before approval): the user decided decision point 2 (rotation 20 not
  adopted, keepEasy adopted, averaged decision rule adopted, budget rule dropped). The open
  questions shrank to the ones above; E3 puts `scoring.par` first because the user prefers faster
  races over fewer crashes.

- 2026-11-14: created after M6's decision point 2 (combination check and batch B: no arm wins;
  exam3 flat at about 50 from g5). The user agreed to the direction ("ok"); this plan waits for
  approval before work starts.

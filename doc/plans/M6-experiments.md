# M6 — Experiments

Status: 🟡 approved 2026-11-13, switch code in progress. Roadmap: [`../ROADMAP.md`](../ROADMAP.md)

## Goal

**Racers good enough to put in front of human players.** M4 gives a model that sees rocks and a
training setup that does not collapse. M6 adds what racing needs beyond that, each as an Evo Lab
experiment against M4's final baseline:

1. **lookahead**: plan the line through the next checkpoint, not only fly at the current one;
2. **robustness**: survive the latency and noise of a real network game;
3. **search**: crossover and mutation schedules, now that μ > 1 exists;
4. **curriculum v2**: mixing levels, adaptive thresholds, M5's tiered arenas;
5. **readiness**: a check that tells the user whether a model is ready for the game.

Done means: each item tested by experiment with a written decision, a final setup recorded in
`HISTORY.md`, and a readiness report for the best model. Whether a model goes into the game is the
user's decision (`CLAUDE.md`).

## Today (expected state when M6 starts)

- **From M4:**
  - the curriculum baseline (task v2, `lineCheck`, `curriculum: {}`), plus whatever M4's remaining
    steps adopt: re-evaluation of the top children, exam v2 (about 100 races, IQM with bootstrap
    confidence intervals), Gaussian mutation, network shape, a progress term, possibly CMA-ES and
    richer sensors;
  - best racers at about 9,000–10,000 exam score (94 % of checkpoints) at g150.
- **From M5** (built after M4): a track file format, hand-made tracks `slalom`, `gauntlet` and
  `canyon`, a track picker in the game, tiered training arenas, exam v2 tracks.
- **Speed (S1):** about 13,000–20,000 ticks/s per run with up to 20 runs in parallel. A 10-seed,
  one-switch experiment to g150 takes about 20–40 minutes of wall time.
- **Gaps M6 addresses:**
  - Models only see the current target. In races they cannot set up the turn for the checkpoint
    after it.
  - Training bots get their inputs in the same frame (`delivery: "sync"`). Real network clients see
    the world with delay and jitter.
  - Search: no crossover, a fixed σ. E4 found no single change that beat the curriculum baseline.
  - The curriculum climbs on fixed levels and never revisits easier ones.

## Steps

Each step ends with `npm run check` green and its own commit. Every new key is a switch: **absent
means byte-identical results** (fixtures, exact resume, Evo Lab gate).

**Can be built before M4 ends:** steps 1–4, code only. They change nothing while absent, so they do
not disturb M4's experiments. **Must wait for M4's final baseline:** every experiment in step 7, and
step 5 (it needs M5's arenas).

### 1. Lookahead inputs

- Inputs for the target after the current one: `next2Sin`, `next2Cos`, `next2DistanceSoft`, encoded
  like v2. Optionally `next3*`.
- Config: `lookahead: 1` (or 2), appending to the spec's inputs, stored with the model.
- **Training needs multi-target episodes:** today's training arenas have one target per episode.
  Add a chained arena (`chain`, like M5's `chain` / `race-legs`: 3–5 targets in a row, random
  angles) or use M5's arenas if they exist by then. When there is no next target, inputs read 0
  with a "present" input, like `nearest.flag`.
- Exam: races already have checkpoint chains, so lookahead works there without changes.
- Tests: input values, absence = identical, the game bot feeds lookahead models the same inputs.
- ✅ **Built 2026-11-13** (63e1985): `lookahead: 1 | 2`; inputs `next{2,3}Present/Sin/Cos/DistanceSoft`
  describe the legs after the current target (see "Changes to this plan"); trained on M5's `chain`.

### 2. Latency and robustness switches

- `inputDelay: k`: the network sees the inputs of k ticks ago (a ring buffer in the controller). 66 ms
  is about k = 4 at 15 ms per tick.
- `inputNoise: σ`: Gaussian noise on each input, from its own seeded stream derived from
  (seed, generation), so runs stay deterministic and resumable.
- Optional: `actionRepeat: n` (a new action every n ticks).
- **A robustness exam variant**: the same races with delay and noise, `exam: { inputDelay,
  inputNoise }`, reported as extra metrics (`examRobust*`), so every run shows both.
- Tests: determinism, exact resume, delay 0 or noise 0 = identical to absent.
- ✅ **Built 2026-11-13** (0f16e26): `inputDelay`, `inputNoise`, `exam: { inputDelay, inputNoise }` →
  `examRobust*`. `actionRepeat` not built (optional; deferred until X2/5.1 asks for it).

### 3. Crossover (needs `parents: μ` > 1)

- `crossover: { kind: "uniform" | "layer", rate }`: a share of children combine two parents (uniform
  per weight, or whole layers), then mutate.
- Deterministic parent pairing from the mutation stream; children per parent stay
  (sample − μ) / μ.
- Tests: determinism, resume, rate 0 = identical.
- ✅ **Built 2026-11-13** (5cc0b2f): `crossover: { kind, rate }` (rate default 0.5).

### 4. Mutation schedules

- `mutation.anneal: { to, over }`: σ falls linearly or geometrically from `sigma` to `to` over
  `over` generations.
- `mutation.selfAdapt: true`: each model carries its own σ, mutated log-normally (the 1/5 rule or
  ES-style). It is stored in the model JSON but ignored by the game.
- ✅ **Built 2026-11-13** (step 4 commit): `mutation.anneal: { to, over, shape? }` and
  `mutation.selfAdapt: true` (ES-style, τ = 1/√n), not combinable; gen metric `sigma`.
- Only relevant if M4 adopts Gaussian mutation. If M4 adopts CMA-ES, this step shrinks to "CMA-ES
  step-size settings".

### 5. Curriculum v2 (after M5's arenas)

- `curriculum.mix: 0.25`: a quarter of each generation's episodes are drawn from earlier levels
  (against forgetting).
- `curriculum.success: "adaptive"`: thresholds aimed at about 50–70 % success. Level-ups are judged
  on re-evaluated scores if M4 adopts re-evaluation.
- Levels built from M5's tiered arenas (tier 1 `stop`, `turn-and-go`, `chain`; tier 2 `corridor`,
  `field`; tier 3 `race-legs`) instead of only rock counts.

### 6. Quality diversity (optional, only if needed)

- Only if hovering or other traps persist after M4's re-evaluation and progress term.
- MAP-Elites over behaviour descriptors (e.g. mean speed × crashes per episode), as a separate
  method or switch, with the archive in the checkpoint.
- A large build: planned in detail only when needed.

### 7. Experiment roadmap (five phases)

Experiments are grouped by **which part of the system they change**. Each phase ends in a
**decision point**, where the user decides what is adopted and what is dropped. The plan is then
updated before the next phase starts.

Names follow `<phase>.<number> <plain name>`, e.g. "2.1 Progress reward". The Evo Lab id is
`m6-<phase>-<number>-<name>`, e.g. `m6-2-1-progress-reward`.

**Rules for every experiment** (the budget rule):
- Each plan states the effect it can detect, from `npm run iqm`'s power estimate on the current
  baseline's spread, and the number of seeds that needs. An experiment that cannot detect a
  worthwhile effect at an affordable seed count is not run.
- At most **6 experiments per phase** before its decision point.
- **Decision on exam v2**: IQM over the seeds, paired, with a 95 % bootstrap confidence interval
  that excludes 0, plus the effect beyond `minEffect`. Crashes are always reported, and more crashes
  veto. No early screen drops an arm before g100, a lesson from E3b. Plans set `baseline.reuse: true`.
- Each experiment runs on the then-current baseline: M4's default setup (task v2, `lineCheck`,
  `curriculum: { success: 0.6 }`, `parents: 10`) plus whatever earlier decision points adopted.

#### Phase 1: Measurement

| # | Name | Question | Design | Needs |
| --- | --- | --- | --- | --- |
| 1.1 | Noise floor with re-evaluation | How much does re-checking the top children (`reevaluate`) narrow the spread between seeds and stop late collapses? | measurement against the baseline without it, 10 seeds (20 if the power estimate asks), exam v2 | built (M4 step 8a) |

**Decision point 1:** adopt `reevaluate` or not. Set `minEffect` and the seed count for phases 2–5
from 1.1's IQM spread and power.

#### Phase 2: Rewards, metrics and curriculum (the most important phase)

This is where the only clear win so far came from (the curriculum, E3b), and where E3's collapse
came from (the scoring). Two parts, in this order.

**2a. Rewards and metrics: what we optimise and what we look at**

| # | Name | Question | Design | Needs |
| --- | --- | --- | --- | --- |
| 2.0 | Headline metrics | Which metrics show progress, and do they read clearly in Evo Lab? | not an experiment: rename and describe metrics in `lab.config.json` (e.g. "Exam: races finished" first), mark exam and held-out as headline metrics, add a best-so-far view if Evo Lab supports it; else a feature request to the Evo Lab session | **built** (2026-11-13): labels for every metric, ★ on the three headline metrics, leaderboard = exam checkpoints, races finished, held-out share; missing Evo Lab features ordered |
| 2.1 | Progress reward | Does rewarding each frame's drop in distance to the target (`scoring.progress`, weights 3 and 5) make better racers and remove the pull towards hovering? | one-at-a-time, 2 arms | built (M4 step 8e) |
| 2.2 | Crash and miss costs | Are 3,000 per crash and 1,000 per missed target the right balance? | one-at-a-time over `scoring.crashes` (1,500 / 6,000) and `scoring.success` (2,000) | config only |
| 2.3 | Time to target (optional) | Does a time-based score beat the distance integral? | one-at-a-time, only if 2.1 does not settle it | **no code needed**: `scoring.time` already is time to target (the clock stops at the last target; a miss is charged the full limit; tested). It can't be a switch (key in the baseline and default config), so it runs as a separate configuration |

**2b. Curriculum: how the task gets harder**

| # | Name | Question | Design | Needs |
| --- | --- | --- | --- | --- |
| 2.4 | Mixing easy episodes | Does keeping about 25 % of episodes from earlier levels (`curriculum.keepEasy: 0.25`) prevent forgetting and help more seeds reach the full task? | one-at-a-time | built (M4 step 8f) |
| 2.5 | Level-up thresholds | Which level-up rule works best: 0.6, 0.8, or an adaptive threshold aimed at 50–70 % success? Judged on re-evaluated scores if 1.1 adopted them. | one-at-a-time, 2–3 arms | 0.6 / 0.8 are config; adaptive needs small code |
| 2.6 | Tiered arenas | Do levels built from M5's arenas (tier 1 `stop`, `turn-and-go`, `chain`; tier 2 `corridor`, `field`; tier 3 `race-legs`) beat levels that only add rocks? | one-at-a-time | M5 arenas (in progress); level definitions as config |
| 2.7 | Level-aware held-out | Should held-out scenarios follow the current level as well as the last one, so progress is visible early? | measurement / reporting change, not a selection change | small code (extra held-out metric) |

**Decision point 2:** the scoring weights, the curriculum rules and the level definitions. If more
than 6 experiments are needed, 2a and 2b each get their own decision point.

#### Phase 3: Perception and capacity: what the models see, and the network to use it

| # | Name | Question | Design | Needs |
| --- | --- | --- | --- | --- |
| 3.1 | Lookahead | Does seeing the next 1–2 targets (`lookahead: 1 \| 2`) make faster racers, trained with the `chain` arena? | one-at-a-time, 2 arms | built (M6 step 1, landed); `chain` arena (landed) |
| 3.2 | Richer sensors | Do `whiskers`, `sectors` or `nearest` (`flag: 1`) next to `lineCheck` help on the stronger setup? | one-at-a-time, 3 arms | built (M4) |
| 3.3 | Network size | Does a sensor that did not help in 3.2 pay off with more capacity (`hidden: [16]`, `[32]`), and is a linear network (`hidden: []`) enough for today's inputs? | one-at-a-time, only for the inputs where it matters | built |

**Decision point 3:** the inputs and the network size.

#### Phase 4: The learner: how evolution searches

So far every change here has shown no detectable effect, so this phase is the first to be trimmed.

| # | Name | Question | Design | Needs |
| --- | --- | --- | --- | --- |
| 4.1 | Standard Gaussian mutation | Does small Gaussian noise on all weights (`{ kind: "gaussian", sigma: 0.03, rate: 1 }`) beat today's relative mutation? | one-at-a-time | built |
| 4.2 | Crossover | Does crossover between the parents (uniform or by layer) beat mutation only? | one-at-a-time, 2 arms | M6 step 3 |
| 4.3 | Mutation schedules | Does a shrinking or self-adapting mutation size beat a fixed one? | one-at-a-time, 2 arms | M6 step 4 |
| 4.4 | CMA-ES (optional, last) | Does CMA-ES, an evolution strategy that adapts its own step sizes, beat our genetic algorithm, also at an equal number of episodes? | one-at-a-time | a larger build (`optimizer: { kind: "cmaes" }`, full state in checkpoint and `stateHash`, deterministic eigen-decomposition, exact resume) — only if 4.1–4.3 leave room |

**Decision point 4:** the learner settings, and whether CMA-ES is worth building.

#### Phase 5: Robustness and readiness for the game

| # | Name | Question | Design | Needs |
| --- | --- | --- | --- | --- |
| 5.1 | Latency and noise | How much does the best setup lose with 66 ms input delay and input noise, and does training with `inputDelay` / `inputNoise` win it back? | measurement, then one-at-a-time (delay, noise, both) | M6 step 2 |
| 5.2 | Final confirmation | How good is the final setup at g300, over at least 20 seeds? | measurement against M4's final model (E9) | none |

Then the readiness report (section 8).

#### Only if needed

| # | Name | Question | Needs |
| --- | --- | --- | --- |
| Q.1 | Quality diversity (MAP-Elites) | Does keeping a map of diverse good behaviours escape traps like hovering? | only if such traps come back after phases 1–4; a large build (step 6) |

#### Old ids → new numbers

| old | new | old | new |
| --- | --- | --- | --- |
| B1 | 1.1 | X1 | 3.1 |
| B2 (progress term) | 2.1 | X2 | 5.1 |
| B2 (keepEasy) | 2.4 | X3 | 4.2 |
| B2 (Gaussian) | 4.1 | X4 | 4.3 |
| B2 (network shape) | 3.3 | X5 | 2.4–2.6 |
| B3 | 4.4 | X6 | Q.1 |
| B4 | 3.2 | X7 | 5.2 |

### 8. Readiness for the game

For the best model of 5.2 (final confirmation), a readiness report the user can decide on:

- exam v2 and the robustness exam (IQM, confidence intervals, races finished, crashes);
- M5's hand-made tracks (`slalom`, `gauntlet`, `canyon`): finish rate and lap times;
- **racing against humans**: the user flies against the model on the watch page or in the game
  (a mode to race a model yourself, built here if M5 has not), on 3–5 tracks; lap times and
  impressions recorded;
- the bot in a real game server over the normal network path (not `sync` delivery), with several
  bots at once.

Promotion into `packages/server/src/ai/models/` happens only by hand and only if the user decides
so (`CLAUDE.md`).

## Acceptance

- [x] Steps 1–4 committed; every switch absent = byte-identical (fixtures, resume, gate); tests per
      switch.
- [ ] Step 5 committed after M5's arenas exist.
- [ ] Phases 1–5 run under the budget rule, each closed by a decision point recorded in
      `HISTORY.md` (experiments run, adopted or dropped); Q.1 only if triggered (decision recorded
      either way).
- [ ] A readiness report for the best model, and the user's decision on promotion recorded in
      `HISTORY.md`.
- [ ] `npm run check` green; nothing pushed without asking.

## Not in M6

- New game mechanics or physics (thrust, turn rate, ship size, respawn rule).
- Reinforcement learning or gradient-based training (open question in the roadmap: neuro-evolution
  only).
- Evolving sensor parameters, unless a general controller exists first: Togelius & Lucas found that
  sensor evolution hinders evolution when it starts too early.
- Multiplayer interaction training (bots racing each other, blocking): a later milestone if wanted.
- Evo Lab changes: requests go to the Evo Lab session.

## Risks

- **No multi-target training today:** lookahead is useless without chained targets in training.
  Mitigation: the `chain` arena in step 1, or M5's arenas.
- **Robustness may cost speed:** delayed or noisy inputs make the task harder. X2 measures the
  trade-off; the user decides how much delay to design for.
- **Many small effects within noise** (as in E4): exam v2 with IQM and confidence intervals, 10+
  seeds, and no early screens. A null result is recorded as one.
- **The baseline moves while M6 builds switches:** M6 experiments start only on M4's final, recorded
  baseline. Switch code built early stays off.
- **Interaction with CMA-ES:** if M4 adopts CMA-ES, crossover and σ schedules (steps 3–4) mostly do
  not apply. Those steps are then dropped or replaced, noted in "Changes to this plan".

## Open questions

| Question | Default in this plan |
| --- | --- |
| How much latency should models handle? | 66 ms (k = 4) delay plus small input noise for X2; the user may pick another figure from real game measurements. |
| Lookahead 1 or 2 targets? | Test 1 first; 2 only if 1 wins. |
| Build the "race a model yourself" mode in M5 or M6? | M6 step 8, unless M5 builds it. |
| Is MAP-Elites worth it? | Only if traps persist after M4's re-evaluation and progress term. |
| How many seeds for the final confirmation? | 20, with IQM and bootstrap confidence intervals. |
| What counts as "ready for the game"? | Exam v2 finish rate ≥ 90 % on random tracks, finishes all hand-made tracks, holds up under 5.1's latency, and the user's own races. The final call is the user's. |

## Changes to this plan

- **2026-11-13, M4 closing** (agreed with the user): M4's open experiments (E5–E8) and its CMA-ES
  step move here as backlog B1–B4, and a budget rule caps experiments (stated detectable effect, at
  most 6 before a decision point).
  - **Why:** in M4, experiments kept spawning experiments and the milestone stalled. With 10 seeds,
    effects below about 13,000–36,000 exam points cannot be detected.
- **2026-11-13, experiment roadmap rewritten and AGREED with the user** ("okay, great lets commit to
  that experiment plan"). Order: 1 Measurement → 2 Rewards & metrics + Curriculum → 3 Perception
  (incl. network size) → 4 Learner (CMA-ES optional, last) → 5 Robustness & readiness; MAP-Elites
  only if needed. The experiments are grouped into
  five phases by what they change: measurement, rewards/metrics/curriculum, perception and
  capacity, the learner, robustness and readiness. Each phase ends in a decision point.
  - **Why:** the user wanted clearer groups and names, and stressed that the curriculum (old X5)
    and finding the right scores and metrics (old B2) matter most. Phase 2 therefore covers both in
    detail, and comes before perception.
  - **Order:** the learner (phase 4) comes after perception (phase 3): the learner changes showed
    no detectable effect so far, and CMA-ES is a larger build, so it is optional and last.
  - **New items:** 2.0 headline metrics, 2.2 crash and miss costs, 2.3 time to target (optional),
    2.5 level-up thresholds, 2.7 level-aware held-out.
  - **Names:** `<phase>.<number> <plain name>`, Evo Lab ids `m6-<phase>-<number>-<name>`; the old ids
    map to the new numbers in a table.
- **2026-11-13, steps 1–4 built** (switch code only, no experiments run):
  - **Lookahead encodes legs, not ship-to-target lines.** `next2*` describe the leg from the current
    target to the next one (direction relative to the nose, length), `next3*` the leg after that.
    **Why:** while the current target is far away, the ship-to-next-target angle is almost the
    ship-to-current-target angle and carries little new information; the leg says how sharp the
    turn at the current target will be. A `Present` input per leg replaces "read 0" ambiguity.
  - **In races** the bot reads the checkpoint chain from the checkpoints it knows (their ids rise in
    race order), so the game, the exam and training use one controller.
  - **`actionRepeat` deferred** (it was optional).
  - **Self-adaptive σ is ES-style** (one global log-normal step size, τ = 1/√n, bounds [1e-4, 10]),
    not the 1/5 rule: the 1/5 rule needs success statistics per lineage, which (μ + λ) selection
    does not track.
- **2026-11-13, phase 2 preparation:**
  - 2.0 built: metric labels, headline marks and leaderboard in `lab.config.json`.
  - 2.3 needs no code: `scoring.time` is time to target.
  - Drafts written for 1.1 and 2.1–2.7 (`experiments/m6-*.md`): baseline = E9's config with
    `reuse: true`, decision on the IQM of exam checkpoints at g150 with a paired bootstrap CI,
    `minEffect` 0.03.
  - 2.2 and 2.3 are separate configurations compared with `npm run iqm`, because Evo Lab refuses
    switches on keys already in the baseline or default config.
  - 2.5–2.7 wait for the curriculum-v2 code.

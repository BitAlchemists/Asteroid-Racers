# M6 — Experiments

Status: ⬜ planned (written 2026-11-13, waiting for approval). Roadmap: [`../ROADMAP.md`](../ROADMAP.md)

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

### 2. Latency and robustness switches

- `inputDelay: k`: the network sees the inputs of k ticks ago (a ring buffer in the controller). 66 ms
  is about k = 4 at 15 ms per tick.
- `inputNoise: σ`: Gaussian noise on each input, from its own seeded stream derived from
  (seed, generation), so runs stay deterministic and resumable.
- Optional: `actionRepeat: n` (a new action every n ticks).
- **A robustness exam variant**: the same races with delay and noise, `exam: { inputDelay,
  inputNoise }`, reported as extra metrics (`examRobust*`), so every run shows both.
- Tests: determinism, exact resume, delay 0 or noise 0 = identical to absent.

### 3. Crossover (needs `parents: μ` > 1)

- `crossover: { kind: "uniform" | "layer", rate }`: a share of children combine two parents (uniform
  per weight, or whole layers), then mutate.
- Deterministic parent pairing from the mutation stream; children per parent stay
  (sample − μ) / μ.
- Tests: determinism, resume, rate 0 = identical.

### 4. Mutation schedules

- `mutation.anneal: { to, over }`: σ falls linearly or geometrically from `sigma` to `to` over
  `over` generations.
- `mutation.selfAdapt: true`: each model carries its own σ, mutated log-normally (the 1/5 rule or
  ES-style). It is stored in the model JSON but ignored by the game.
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

### 7. Experiments

Each is approved before it runs. **Decision on exam v2** (IQM over 10 seeds, paired, bootstrap
confidence intervals, effect beyond `minEffect`). Crashes and the robustness exam are always
reported, and more crashes veto. No early screen drops an arm before g100, a lesson from E3b. With
Evo Lab's `baseline.reuse`, stored baseline runs serve as the baseline arm.

| # | Question | Design | Cost (S1 speed) |
| --- | --- | --- | --- |
| X1 | Does lookahead (1, then 2) make faster racers on the exam? | one-at-a-time, on M4's baseline plus the chained arena; the chained arena alone is the baseline | 2–3 arms × 10 seeds to g150, about 1 h |
| X2 | Robustness: how much do M4's best models lose with 66 ms delay and input noise? Does training with `inputDelay` / `inputNoise` recover it? | measurement, then one-at-a-time (delay, noise, both) | about 1 h |
| X3 | Crossover against mutation only (with μ = 10) | one-at-a-time, uniform and layer | about 1 h |
| X4 | σ annealing and self-adaptive σ against fixed σ | one-at-a-time | about 1 h |
| X5 | Curriculum v2: mixing, adaptive thresholds, tiered arenas | one-at-a-time, then the winners together | 3–4 arms, about 1.5 h |
| X6 | (optional) MAP-Elites against the GA | only if traps persist | large |
| X7 | Confirmation: the combined setup to g300, ≥ 20 seeds | measurement against M4's final model | about 2 h |

### 7b. Backlog moved from M4 (2026-11-13)

M4 closed on its proven setup; its open experiments move here. Each runs on the then-current
baseline, under the budget rule below.

| # | Question | Design | Notes |
| --- | --- | --- | --- |
| B1 | Noise floor v3: how much does re-evaluation of the top children (`reevaluate`) change the spread and stop late collapses? | measurement, seeds 1–10 (or 20), exam v2 | sets `minEffect` from IQM and power |
| B2 | Learner fixes, done properly: standard Gaussian (`{kind: "gaussian", sigma: 0.03, rate: 1}`), `hidden: [16]` and linear (`hidden: []`), the `progress` scoring term, `curriculum.keepEasy` | one-at-a-time on B1's baseline, no screen before g100 | switches built in M4 step 8 |
| B3 | CMA-ES against the GA (also at equal episode budgets) | one-at-a-time | needs M4's step 9 build: `optimizer: { kind: "cmaes", population, sigma }`; mean, step size, covariance and evolution paths in the checkpoint and `stateHash`; sampling from the run's seeded generator; a deterministic eigen-decomposition (fixed algorithm); exact kill-and-resume test |
| B4 | Richer sensors again (`whiskers`, `sectors`, `nearest` with `flag: 1`) next to `lineCheck`, with capacity where a sensor needs it (e.g. `hidden: [32]`); optional pretrained start | one-at-a-time | E2's null result came from a weaker setup |

**Budget rule** (all M6 experiments, X1–X7 and B1–B4):
- Each experiment plan states the effect it can detect, from `npm run iqm`'s power estimate on the
  current baseline's spread, and the number of seeds that needs.
- At most **6 experiments** run before a decision point, where the user decides what is adopted
  and what is dropped. Then the plan is updated before more experiments start.
- An experiment that cannot detect the effect worth having at an affordable seed count is not run.

### 8. Readiness for the game

For the best X7 model, a readiness report the user can decide on:

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

- [ ] Steps 1–4 committed; every switch absent = byte-identical (fixtures, resume, gate); tests per
      switch.
- [ ] Step 5 committed after M5's arenas exist.
- [ ] X1–X5 run with approved plans, reports and sign-offs; X7 done; X6 only if triggered (decision
      recorded either way).
- [ ] The M4 backlog (B1–B4) run or dropped by a recorded decision, under the budget rule.
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
| What counts as "ready for the game"? | Exam v2 finish rate ≥ 90 % on random tracks, finishes all hand-made tracks, holds up under X2's latency, and the user's own races. The final call is the user's. |

## Changes to this plan

- **2026-11-13, M4 closing** (agreed with the user): M4's open experiments (E5–E8) and its CMA-ES
  step move here as backlog B1–B4, and a budget rule caps experiments (stated detectable effect, at
  most 6 before a decision point).
  - **Why:** in M4, experiments kept spawning experiments and the milestone stalled. With 10 seeds,
    effects below about 13,000–36,000 exam points cannot be detected.

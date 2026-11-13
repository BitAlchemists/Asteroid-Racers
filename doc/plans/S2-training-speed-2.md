# S2 — Training speed, round 2

Status: ✅ done 2026-11-13 (approved by the user 2026-11-13: "go ahead and do the optimizations").
Roadmap: [`../ROADMAP.md`](../ROADMAP.md). Based on
[`../research/training-performance.md`](../research/training-performance.md).

A side track. It changes no results, only how fast we get them.

## Goal

- **Training:** at least **1.4×** training ship-steps per second per run.
- **Exams:** about **1.6×** faster.
- **Bit-identical:** the same `stateHash` at every generation and the same `result.json`, proven by
  the fixtures, the resume tests and Evo Lab's gate.

## Today

From the research document, measured on today's default setup (task v2, lineCheck, curriculum,
parents 10), 10 runs in parallel:

- training runs at about 375,000–424,000 ship-steps/s per run;
- CPU, self time:
  - `lineCheck` → `ObstacleGrid.near`: 24 %;
  - messages between bot and server inside the process: about 25 % inclusive;
  - network forward: 14 %;
  - collisions: 4–7 %;
- the exam spends 39 % of its time in collision checks without a grid;
- the `tps` metric counts held-out frames with 1 ship like training frames with 100 ships, so it
  overstates held-out work.

## Steps

Each step is one commit with `npm run check` green. No step may change a result.

0. **Measure properly:** add `shipSteps` and `shipStepsPerSec` (ship-steps of training and held-out
   flights) to every `gen` event, next to `ticks` and `tps`, which stay for comparison. Declare
   them and `level` in `lab.config.json`. Record the Evo Lab bench baseline before step 1.
1. **Training fast path for bots.** In training only, bots read their ship and set thrust and turn
   directly, without message objects, envelopes or own-ship broadcasts. The game's bots and real
   races keep the full message path.
2. **Faster `lineCheck` query:** visit only the grid cells along the corridor to the target. The
   candidate set and order stay the same (a comparison test against the old query).
3. **Collision grid for passive entities in the game server** (exam, races, training). Same pairs,
   same order.
4. **Batched network forward** for all candidates per tick, with each network's operation order
   unchanged. Skipped if the measured gain is under 3 % of a run.
5. **Fewer allocations** in the hot path that steps 1–4 leave.
6. **Optional switch `heldOutEvery: N`** (absent = every generation = today).

## Acceptance

- [x] `shipSteps` and `shipStepsPerSec` on every gen event; `result.json` unchanged.
- [x] Steps 1–5 landed, each with `npm run check` green (fixtures, resume tests). Step 4 measured
      and skipped (see the history below).
- [x] Evo Lab gate: baseline (main before step 1) against candidate (main after S2), class
      bit-identical.
- [x] Paired A/B speed (alternating, same load, load noted) at 1 and 10 parallel runs, plus exam speed.
- [x] CPU profile before and after, in `HISTORY.md`.

## Plan history

- **Step 2 changed (2026-11-13):** the corridor-cell query was 1.5–3.5× slower than the old query in
  a micro-benchmark, because the corridor's bounding square already holds few cells. Instead,
  `nearUnsorted` returns the same candidates without sorting or allocating. `lineCheck` breaks ties
  in `along` by the smaller id, which is the rock the id-sorted scan picked.
- **Step 4 skipped (2026-11-13):** `Math.tanh` is about 65 % of a forward pass and must stay for
  bit-identity. Batching across networks shares no weights, so it saves only call overhead: about
  5 % per pass, about 1 % of a run, under the 3 % bar. The cheap part, hoisting the lookups out of
  the loops, went into step 5.
- **Step 6 design (2026-11-13):** held-out flights draw spawn points from the server's generator, so
  skipping them would shift training. With the switch set, held-out flights use their own generator,
  derived from the seed and g. Training is then exactly the run with `heldOut: 0`, for any N.
  Absent = today, byte for byte.

## Not in S2

Threads inside a run, WebAssembly, GPU, a prebuilt bundle (see the research document for why).

## Risks

- **Bit-identity:** the fast path must keep the exact order of physics, input and collision steps.
  The fixtures and the gate catch any drift; a step that breaks it is redone or dropped.
- **Training and game diverge:** the fast path lives behind the training director only. The game
  and the exam keep the message path, so races behave as before.
- **Parallel work on the same files** (curriculum v2, scoring, CMA-ES, lookahead): rebase often;
  the A/B compares main just before S2's merge with main after it.

# S1 — Training speed

Status: ✅ done 2026-11-13 (written and approved the same day; step 5 not done, it is optional). Roadmap: [`../ROADMAP.md`](../ROADMAP.md)

A side track next to M4. It changes no results, only how fast we get them.

## Goal

**More training per hour, with byte-identical results.** M4's remaining experiments (E4–E7) are
about 140 runs of 45–60 minutes. Each 2× speed-up halves that wait or lets us afford more seeds and
generations.

Done means: training measurably faster (target **≥ 2×** ticks per second per run), proven by Evo Lab's
gate as **bit-identical** (same `stateHash` at every generation), and a speed figure on every
generation so we keep seeing it.

## Today

- **Speed** (Evo Lab `analyze`, E3 runs train-57 and train-64, 10 runs in parallel):
  - 21 s per generation; the exam adds 4–7 s every 10 generations.
  - Ticks per generation (estimated): about 14,400 for the 100 candidates (24 episodes of up to 600
    frames) plus about 7,200 for the winner's 12 held-out episodes.
  - That is **about 1,000 game ticks/s per run** (15× real time), **about 70,000 ship-steps/s per
    run**, and **about 14 µs CPU per ship-step**. CPU÷wall is 1.06: one core per run.
  - The worker does not report ticks, so these are estimates.
- **How a training tick runs:**
  - one `GameServer` per run, ticked by `ManualGameLoop`;
  - 100 bots, each an `AIGameClient` with a `LocalConnection` (`delivery: "sync"`, not encoded, but
    still the full message path: envelopes, entity updates, the client's world copy);
  - each bot computes its inputs and sensors, runs the network and sends a `movePlayer` message;
  - collisions check every ship against every passive entity (100 ships × about 110 rocks each tick
    in task v2).
- **Evo Lab's profiling harness** (`docs/profiling.md` in the evo-lab repo):
  - `analyze`: per-generation wall time, CPU and concurrency;
  - `node --cpu-prof` with `hotspots`: hot functions before and after a change;
  - `bench` and `gate`: a workload run as normal runs, a baseline against a candidate. Correctness is
    judged by `stateHash` (bit-identical, else same quality), speed by repeated runs at 1 and N
    parallel runs, with about 15 % session noise.

## Steps

Each step ends with `npm run check` green and its own commit. **No step may change a result:** the
byte-identity fixtures, the exact-resume tests and the Evo Lab gate must all pass.

### 1. Measure properly

- The `gen` event gets two more metrics: `ticks` (game ticks simulated in the generation, training
  and held-out) and `tps` (ticks per wall second). They are timing data, so they stay out of
  `result.json` and `stateHash`.
- A bench workload `experiments/bench/train-v2.json`: the task v2 config with lineCheck, from a
  stored run's checkpoint (e.g. train-64 g50) to g55, seeds 1–5 for quality; speed at concurrency 1
  and 10, 3 repeats.
- Record the **baseline** with today's code (`bench --role baseline`). This needs the machine to
  itself, so it runs after E3 has finished.

### 2. Find the hotspots

- `node --cpu-prof` on a short training run (a few generations of the bench workload), then
  Evo Lab's `hotspots` report. This can run while E3 is running, since it only needs relative
  numbers.
- Write the top 5–10 functions with their share of CPU into the history.

### 3. Optimise (ordered by what the profile shows)

Likely candidates, to be confirmed or dropped by step 2:

- **The bot message path:** bots in training could read their ship directly instead of through
  messages and a world copy, if the inputs come out bit-identical.
- **Allocations per frame:** `Vector2` objects in physics, sensors and inputs; the network's output
  arrays.
- **Collisions:** an obstacle grid for passive entities (the bots' sensors already use one), so
  each ship checks only nearby rocks.
- **The network:** reuse buffers and keep the order of floating-point operations unchanged.
- **Held-out episodes:** they fly one ship through 12 episodes, which costs as many ticks as 12
  training episodes for 100 ships. One option is to fly them alongside the next generation's
  candidates; only if the results stay identical.

Every change is kept only if the fixtures and resume tests still pass. Floating-point operations
keep their exact order (no reassociation, no fused shortcuts).

### 4. Prove it

- `bench --role candidate` with the same workload, then `gate`: required class **bit-identical**
  and a speed-up beyond the noise.
- Check the lab binding (`lab.config.json`) still covers the changed files, and rebuild the plugin.

### 5. Parallel throughput (optional)

- Evo Lab's `scaling`: throughput against the number of parallel runs (1, 4, 8, 12, 16, 20), to
  pick the worker budget for M4's experiments. Today all 10 E3 runs share 12 cores at 21 s/gen,
  against 12–20 s/gen alone.

## Acceptance

- [x] `ticks` and `tps` on every `gen` event; `result.json` unchanged (fixtures).
- [x] A bench workload and a stored baseline record (quality run only, see the changes below).
- [x] A hotspot report before and after, summarised in `HISTORY.md`.
- [x] Gate: bit-identical, speed-up ≥ 2× ticks/s per run at concurrency 10 (or the measured
      speed-up recorded if it falls short, with the reason). Gate class bit-identical; speed measured
      as a paired A/B at concurrency 1 and 4 instead (about 4×), see the changes below.
- [x] `npm run check` green; nothing pushed without asking.

## Not in S1

- Changing what training does (episodes, population, scoring): that is M4's experiments.
- Worker threads or several processes per run. Evo Lab already runs runs in parallel; one core per
  run keeps the measurements simple.
- GPU or WebAssembly.
- Evo Lab changes: friction or bugs go to the Evo Lab session.

## Risks

- **Bit-identity is strict:** a "harmless" change such as reordering a sum or skipping an unused
  message can shift one float and change every later generation. The fixtures and the gate catch
  this, and the change is reverted or redone.
- **Measurement noise** of about 15 % between sessions: repeats are interleaved, and only a gain
  well beyond the noise counts.
- **Competing for the machine with M4:** baseline and candidate speed runs need the machine to
  themselves. They are scheduled between M4 experiments, never during one.
- **The bot path is shared with the game:** optimisations for training must not change how bots
  behave in real races. Training-only shortcuts sit behind the training director.

## Open questions

| Question | Default in this plan |
| --- | --- |
| Is ≥ 2× realistic? | Unknown until the profile; 14 µs per ship-step suggests large overheads. If the profile shows little to gain, S1 stops after step 2 with a note. |
| Run S1 now or after M4? | Now, in the gaps: profiling while E3 runs, bench between experiments. E4 waits for S1 only if S1 is close to done. |

## Changes to this plan

- 2026-11-13, step 1: the bench workload runs from train-64's g50 checkpoint to **g56** (not g55),
  so five steady generations remain after the first one (which includes start-up). Its quality
  check is **one run with seed 8**, not seeds 1–5: a from-checkpoint workload continues the source
  run, which fixes its seed (Evo Lab's bench, contract A10). Correctness is judged on the
  `stateHash` of every generation, so `minSeeds` is 1.
- 2026-11-13, step 1: the measured ticks per generation are about **101,500**, not the estimated
  21,600 (episodes run up to their own time limits and the held-out episodes are flown by one
  ship), so `tps` is about 5× the plan's "1,000 ticks/s" estimate. The per-ship-step cost is
  therefore lower than estimated; the relative speed-up is what counts.
- 2026-11-13, steps 1 and 4 (user's change of instructions, relayed by the parent session): S1
  must not block other work, and E3b held all 20 runner slots. So:
  - the bench speed steps use concurrency **1 and 4** (not 10), and the queued baseline speed run
    (train-108) was stopped; the stored baseline record holds the quality run only (train-87);
  - correctness went through Evo Lab: candidate quality run train-109 on the merged code, gated
    against the baseline record: **bit-identical**;
  - speed was measured as a **paired A/B outside the runner** (the commit before the merge against
    the merge, same workload to g54, A and B alternating, 3 repeats at concurrency 1 and 4, machine
    load logged before every step), not with the bench's speed steps.

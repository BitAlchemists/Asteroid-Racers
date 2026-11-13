# Training performance: a full-stack analysis

2026-11-13. This covers the whole stack: the Evo Lab runner, the worker process, the training
generation, the race exam and the machine. It was measured after S1 (bit-identical speed-ups,
about 4×), on today's default setup:

- task v2 with `lineCheck`, `curriculum: { success: 0.6 }`, `parents: 10`;
- 24 episodes per generation;
- 6 held-out scenarios per arena;
- `snapshotEvery: 1`;
- exam v2 every 25 generations.

Machine: AMD Ryzen 9 9900X, 12 cores and 24 threads; Evo Lab budget 20 workers.

**Measured or estimated.** Every number is marked *measured* or *estimate*. Unless stated
otherwise, "measured" means one of:

- Evo Lab data: `events.jsonl`, `manifest.json`, `samples.jsonl`, `lifecycle.jsonl`, or
  `profile.js analyze` / `scaling`;
- a `node --cpu-prof` profile;
- a temporary timing script that runs the same code path. Those scripts were deleted afterwards.

**Machine load during measurement.** Most measurements ran while 10–20 other training runs were
busy (E9 and M5's baselines). That inflates absolute times compared with an idle machine. Shares
and ratios are robust.

## Summary: where a run's wall time goes

Typical run: E9, 150 generations, 10 runs in parallel. Its median wall time is **769 s** (*measured*,
from manifests and events, train-310..319).

| Part | Time | Share | Source |
| --- | --- | --- | --- |
| Queue wait (slot free) | 0.16 s | 0.02 % | manifest `queuedAt` → `worker.startedAt` |
| Process start to `hello`: node start, tsx transpile, module load | 0.40 s | 0.05 % | manifest → events |
| Generations: training flights | about 92 % of each generation | **about 86 %** | timing script (phase table below) |
| Generations: held-out flights (one ship, 144 episodes) | about 5 % of each generation | **about 5 %** | timing script |
| Generations: GC | about 4 % of each generation | (inside the two rows above) | `PerformanceObserver('gc')` |
| Exams: exam v2, 102 races, 6 times | 44 s | **5.7 %** | gen events `phases.exam` |
| Snapshot and checkpoint writes, every generation | 3.4 ms per generation, 0.5 s per run | 0.07 % | timing script |
| `done` → process exit | 0.02 s | 0.003 % | events → manifest |

**Time spent outside steady generations is about 6 %, and it is almost all the exam.**

- **Set-up, teardown and restart cost nothing that matters.** Start-up is 0.4 s and exit 0.02 s.
- **Continuing from a checkpoint** costs the same 0.4 s process start. Its first generation is
  an ordinary generation: 4.2 s, *measured* on train-110/113/116.
- **Analyze's "start-up 3.5 s" is misleading.** It is the whole first generation: `hello` is
  emitted after module load, so `hello` → first `gen` is pure training work.

## 1. Run lifecycle timeline

*Measured.* Medians over train-310..319, and over the continuation runs train-110/113/116.

```
queued ──0.16 s──▶ worker spawned ──0.40 s──▶ hello ──3.5 s──▶ gen 1 ──4.8 s/gen × 149──▶ gen 150 ──0.004 s──▶ done ──0.02 s──▶ exit
                                                    (exam v2 at 25, 50, …, 150: about 6.5 s each, 12.8 s worst)
continuation: spawn ──0.36 s──▶ hello (resume from ckpt) ──4.2 s──▶ gen 51 …
```

**Scheduling.** When a run waits for a slot, it starts **0.04 s** (median; p90 0.05 s, max 0.29 s)
after the previous run exits. *Measured* on 97 queued runs.

**Experiment phase transitions:**
- gate check → screen runs: 2–3 s;
- screen → continuation runs: 1 s.

*Measured* on E4 and E4b manifests.

**Start-up in detail** (*measured*, three repeats each, near-idle):

| Variant | Spawn to `hello` |
| --- | --- |
| bare `node -e 0` | 0.13 s |
| `scripts/lab-train.mjs` (tsx) | 0.49–0.51 s |
| prebuilt esbuild bundle of `lab-train.ts` (335 kB) | 0.15–0.17 s |

- tsx keeps a transpile cache (`%TEMP%\tsx-tommi`). The remaining 0.35 s is module loading and
  tsx's hooks.
- A prebuilt bundle would save **0.35 s per run start, 0.05 % of a run**. It is not worth the build
  step for speed alone.

**Restarts.** Resume reads `ckpt.json` (61 kB with 10 parents) and re-creates the server. Nothing
else is measurable.

## 2. Inside a generation: phase breakdown

*Measured* with a temporary script that runs the same `registerAITrainingService` code path from
train-312's g150 checkpoint (level 4, 10 parents), 6 generations (g151–156). The training flights
are timed per arena by wrapping `TrainingDirector.flyWithPaths`. GC comes from
`PerformanceObserver('gc')`, and the I/O replays lab-train's snapshot and checkpoint writes.
12–20 other runs were busy.

| Phase | ms per generation | Game frames per generation | Ships per frame | Ship-steps/s |
| --- | --- | --- | --- | --- |
| Training: `rock-in-line`, 16 episodes | 2,577 | 9,658 | 100 | 375,000 |
| Training: `point-to-point`, 8 episodes | 1,144 | 4,850 | 100 | 424,000 |
| Held-out: 6 scenarios × 2 arenas, 144 episodes, winner only | 187 | 56,558 | 1 | 302,000 |
| Snapshot write (20 kB JSON) | 1.6 | | | |
| Checkpoint write (61 kB JSON) | 1.7 | | | |
| GC (included above) | 151 (328 collections) | | | |
| **Generation wall time (median)** | **3,803** | | | |
| Exam v1, 17 races (separate, every N generations) | 938 | about 78,000 | 1 | |
| Exam v2, 102 races | 5,970 | 467,936 | 1 | 95,000 frames/s |

**Finding: the `ticks` and `tps` metrics mislead.**
- About 78 % of the `ticks` a generation reports are held-out frames with **one** ship: 56,558 of
  about 72,000. The training frames, each with 100 ships, are only about 20 %.
- So `tps` (16,000 median) mostly measures held-out speed. The work that dominates is about
  14,500 frames × 100 ships.
- Better metrics:
  - `shipSteps` and `shipStepsPerSec`;
  - training and held-out ticks reported separately.

## 3. CPU profile

*Measured* with `node --cpu-prof` at a 200 µs interval on the timing script above: 8 generations,
38.4 s sampled. Self time is grouped by subsystem from each function's source file. The second
profile file (tsx's loader thread) is 99 % idle and is left out.

| Subsystem | Self time |
| --- | --- |
| Sensors and obstacle grid (`lineCheck` → `ObstacleGrid.near`) | **24.3 %** |
| Network forward (`MajorTom.activate`) | **14.1 %** |
| Training script and episodes (`AIDirector.preUpdate` with inlined bot steps, `ArenaScript.step`, scoring) | 13.6 % |
| Bot client and messages (connection, envelopes, protobuf `create`, client-proxy) | 12.9 % |
| Server proxy (bot → server `movePlayer`) | 7.9 % |
| Physics and vectors (`simulateTranslation`, `Vector2`, `Movable`/`Entity` constructors, `clone`) | 7.5 % |
| Controller and inputs (`model-spec` input functions, `relativeAngle`) | 5.1 % |
| Collisions (`detectCollisions`) | 4.4 % |
| GC | 3.7 % |
| Game server tick (`tick`, `broadcastUpdates` self) | 3.5 % |
| Node internals (timers, promises, I/O) | 1.3 % |
| Logging, VM, other | 1.4 % |

**Inclusive views that matter:**

- **`lineCheck` sensor: 23.4 %.** `firstOnLine` → `near` alone is 19.6 %. The corridor query asks
  the grid for every rock within a circle of radius length ÷ 2 + ship radius around the midpoint
  of the line to the target, up to 1,000 units long. That circle covers many cells.
- **Bot ↔ server messaging in the same process:**

  | Path | Inclusive time |
  | --- | --- |
  | `LocalConnection.send`/`deliver` | 15.9 % |
  | bot → server `movePlayer` | 10.7 % |
  | server → bot `client-proxy.send` | 10.6 % |
  | `broadcastUpdates` (own ship to every bot every tick) | 13.2 % |

  These overlap. Together they come to **about 25 %**. That still includes envelope objects,
  protobuf `create` (4.4 %), `createEntityEnvelope` (3.8 %) and `Movable.clone` (3.5 %), even
  though S1 removed the byte encoding.
- **Network forward: 14.1 %.**
- **Collisions: 7.0 %.**

**Top 30 functions by self time:**

| # | Self | Total | Function | Subsystem |
| --- | --- | --- | --- | --- |
| 1 | 17.5 % | 19.6 % | `near` (obstacle-grid.ts) | sensors |
| 2 | 14.1 % | 14.1 % | `activate` (network.ts) | network |
| 3 | 11.3 % | 65.9 % | `preUpdate` (directors.ts; bot steps inlined) | script |
| 4 | 5.6 % | 8.6 % | anonymous (server-proxy.ts) | messages |
| 5 | 4.4 % | 7.0 % | `detectCollisions` | collisions |
| 6 | 3.9 % | 23.4 % | `firstOnLine` (sensors.ts) | sensors |
| 7 | 3.9 % | 5.3 % | input functions (model-spec.ts) | inputs |
| 8 | 3.7 % | 3.7 % | garbage collector | GC |
| 9 | 2.7 % | 5.3 % | anonymous (client-proxy.ts) | messages |
| 10 | 2.1 % | 2.1 % | anonymous (protobuf create.js) | messages |
| 11 | 2.1 % | 15.8 % | `emitMessage` (connection.ts) | messages |
| 12 | 2.1 % | 2.1 % | anonymous (obstacle-grid.ts) | sensors |
| 13 | 2.0 % | 5.0 % | `create` (protobuf create.js) | messages |
| 14 | 1.8 % | 13.2 % | `broadcastUpdates` | server tick |
| 15 | 1.5 % | 3.3 % | `step` (arena-script.ts) | script |
| 16 | 1.4 % | 1.4 % | `simulateTranslation` | physics |
| 17 | 1.4 % | 93.0 % | `tick` (game-server.ts) | server tick |
| 18 | 1.2 % | 1.2 % | `Entity` constructor | physics |
| 19 | 1.2 % | 2.4 % | `Movable` constructor | physics |
| 20 | 1.1 % | 10.7 % | `movePlayer` (server-proxy.ts) | messages |
| 21 | 1.1 % | 6.5 % | `send` (server-proxy.ts) | messages |
| 22 | 1.1 % | 3.5 % | `clone` (movable.ts) | physics |
| 23 | 1.0 % | 1.0 % | `relativeAngle` | inputs |
| 24 | 0.8 % | 0.8 % | `isMessage` (protobuf) | messages |
| 25 | 0.8 % | 24.3 % | `readSensors` | sensors |
| 26 | 0.7 % | 0.8 % | `rotated` (vector2.ts) | physics |
| 27 | 0.7 % | 2.8 % | `createEnvelope` | messages |
| 28 | 0.6 % | 0.6 % | `distanceTo` (vector2.ts) | physics |
| 29 | 0.6 % | 0.6 % | `unsafeIsSet` (protobuf) | messages |
| 30 | 0.5 % | 9.6 % | anonymous (local-connection.ts) | messages |

**Exam phase** (*measured*, `--cpu-prof` on a 102-race exam of train-312's g150 winner, 5.4 s
sampled):

| Part | Share |
| --- | --- |
| `detectCollisions` | **38.6 %** |
| `broadcastUpdates` | 21.1 % self, 28.7 % inclusive |
| network | 3.7 % |
| sensors | 5.0 % |
| GC | 3.8 % |

Why: the exam runs a normal game server. It checks the ship against every rock of the random
track, about 800 per track, with no grid, and it broadcasts entity updates.

## 4. Scaling: throughput against parallel runs

*Measured* with Evo Lab's `profile.js scaling` on a quiet machine: no other runs, 22:23–22:31.
- **Job:** resume train-312 from its g150 checkpoint for 3 generations (to g153), each copy in its
  own temp dir, through the normal worker command (`scripts/lab-train.mjs`).
- **Settings:** priority normal, 2 interleaved repeats per N.
- **What a job includes:** besides the 3 generations, the process start and the exam v2 at the
  last generation (lab-train always examines the last generation, about 6 s). So `s/gen` here is
  per-job time ÷ 3, not a steady-generation time. The *relative* scaling is the point.

| Parallel runs | Jobs/min (range) | Speed-up | Efficiency | Marginal gain per added run | Job wall | CPU÷wall | Peak memory per run |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2.49 (2.36–2.63) | 1.00 | 1.00 | – | 23.5 s | 0.99 | 235 MiB |
| 2 | 4.56 (4.48–4.64) | 1.83 | 0.92 | 0.83 | 24.2 s | 0.97 | 222 MiB |
| 4 | 8.61 (8.42–8.80) | 3.45 | 0.86 | 0.81 | 26.3 s | 0.93 | 230 MiB |
| 8 | 16.53 (16.20–16.86) | 6.63 | 0.83 | 0.79 | 27.4 s | 0.94 | 227 MiB |
| 12 | 23.65 (22.65–24.66) | 9.49 | 0.79 | 0.71 | 28.8 s | 0.92 | 230 MiB |
| 16 | 29.32 (28.30–30.34) | 11.76 | 0.73 | 0.57 | 30.0 s | 0.91 | 232 MiB |
| **20** | **35.51 (33.79–37.24)** | **14.24** | 0.71 | 0.62 | 31.6 s | 0.87 | 232 MiB |
| 24 | 36.53 (31.44–41.63) | 14.65 | 0.61 | 0.10 | 38.2 s | 0.79 | 229 MiB |

**Reading:**
- **Up to 12 runs (the physical cores):** each added run brings 0.7–0.8 of a run, and per-run speed
  drops about 23 %. Shared caches and memory bandwidth (*estimate*), since CPU÷wall stays above 0.9.
- **From 12 to 20 runs (SMT threads):** about +50 % more throughput, at 1.35× slower runs.
- **At 24 runs:** almost nothing more (+3 %) with high variance, because the OS, Evo Lab and the UI
  need the rest.
- **Knee at 20** (Evo Lab's report): **today's budget of 20 is right.**
- **Memory:** about 230 MiB per run, about 4.6 GB at 20 runs. Not a limit.
- **Threads inside a run** cannot add machine throughput while 20 runs fill the machine. They only
  help when fewer runs than cores are active, e.g. a single long confirmation run, or the tail of an
  experiment phase.
- **More cores or a bigger machine** (*estimate*): throughput is about 0.8 run per physical core
  plus about 50 % from SMT. A 24-core / 48-thread machine of the same generation would give about
  2× today's throughput. A many-core server CPU at lower clocks gains less per core.

## 5. Runner and Evo Lab overhead

*Measured.*

- **Scheduling:** 0.04 s from a slot freeing to the next worker spawning; queued → starting →
  running in about 0.3 s; experiment phase transitions in 1–3 s. Negligible.
- **CPU of Evo Lab's own processes** (`Get-Process`):

  | Process | CPU | Share of one core | Share of 24 threads |
  | --- | --- | --- | --- |
  | runner | 106.6 CPU s over about 21 min | about 8 % | 0.35 % |
  | server, with UI tabs open | 348.7 CPU s over about 57 min | about 10 % | 0.4 % |

- **Sampling:** `samples.jsonl` every 15 s per run, a few hundred bytes. Not measurable.
- **Run I/O:**
  - events: about 1 kB per generation;
  - snapshots: 20 kB per generation, 3.2 MB per 150-generation run;
  - checkpoints: 61 kB, rewritten every generation (`--every` 1).

  Writing them costs 3.4 ms per generation: 0.07 %. Disk use is the larger cost: 10 runs × 3.2 MB
  per experiment arm.
- **Slot utilisation during experiments** (*measured*, slot-seconds busy ÷ 20 × wall time):

  | Experiment | Utilisation |
  | --- | --- |
  | E4 | 86 % |
  | E4b | 94 % |
  | E3b (20 runs on a budget of 20, continued by hand) | 61 % |

  The loss is the straggler tail: continuation runs start only after the slowest screen run
  finishes. That is a property of the screen/continue design, not runner latency.
- **Verdict: the runner performs well.** Its overhead is below 1 % of the machine, and it starts
  runs within tens of milliseconds.

## 6. Options, ranked

The speed-ups are for one run's generation (training + held-out) unless stated otherwise.
"Bit-identical" means results stay byte-identical, which the fixtures and the Evo Lab gate check.

| Rank | Change | Evidence | Expected gain | Cost | Determinism risk |
| --- | --- | --- | --- | --- | --- |
| 1 | **A training fast path for bots.** In training only, bots read their own ship and write thrust and turn directly, with no envelopes, protobuf `create`, own-ship broadcast or `movePlayer` messages. The game keeps the message path. | Messaging is about 25 % inclusive (§3) | **about 1.3×** (*estimate*: removing 20–25 % of CPU) | medium | low to medium. Same physics order is required; S1 did similar changes bit-identically |
| 2 | **`lineCheck` corridor query by grid traversal.** Walk the grid cells along the line (DDA), widened by the ship radius, instead of a circle of radius length ÷ 2. | `near` 17.5 % self, `firstOnLine` 23.4 % inclusive | **about 1.15×** (*estimate*: two thirds of `near`'s time) | low | low, if the candidate set and order (sorted by id) stay the same; a comparison test against the old query |
| 3 | **A collision grid in the game server** (exam and game) | exam: `detectCollisions` 38.6 %; training: 7 % | exam **about 1.6×**; a run 2–4 % | low | low (same pairs, same order) |
| 4 | **Batched network forward**: all 100 networks per tick, weights in structure-of-arrays layout | micro-benchmark below: −30 % per forward pass | about 4 % (30 % of 14 %) | medium (bots must step in lockstep) | none if each network's sum order is kept |
| 5 | **Fewer allocations**: `Movable.clone`, envelopes, vectors per tick | GC 3.7 %, constructors and clones about 4 % | 3–5 % (mostly folded into rank 1) | low | none |
| 6 | **Held-out every N generations** instead of every generation | 5 % of a generation | up to 5 % | config | none for training |
| 7 | **Checkpoint every 10 generations, snapshots every 5** | 0.07 % | negligible speed; saves disk | config | none |
| 8 | **Prebuilt JS bundle instead of tsx** | 0.35 s per start | 0.05 % | low | none |
| 9 | **`worker_threads` inside a run**: split the 100 candidates over K threads. In `collisions: "obstacles"` ships don't interact. | see §4 | per run up to about K× when runs < cores; **none** for machine throughput when slots ≥ cores | high | medium to high. The server random stream and entity ids depend on how many ships are in one world, so this needs a new `stateHashRepr` and new baselines, or a proof that per-ship results are independent |
| 10 | **GPU** | numbers below | none at our size | very high | high |
| 11 | **More cores or a bigger machine** | §4 | see §4 | money | none |

**Network forward micro-benchmark** (*measured* on a loaded machine; absolute ns are inflated, the
ratios hold):

| Layout | Weights | Today, ns per forward | Batched structure-of-arrays, ns | `tanh` share |
| --- | --- | --- | --- | --- |
| 6-10-8-6-4-2 (today) | 250 | 1,104 | 779 (−29 %) | 38 % |
| 6-16-2 | 146 | 704 | 523 (−26 %) | 36 % |
| 6-32-32-2 | 1,346 | 4,197 | 3,685 (−12 %) | 23 % |
| 30-10-8-6-4-2 (four sensors) | 490 | 1,746 | 1,322 (−24 %) | 27 % |

- **Batching by network only:** each candidate has its own weights, so "one matrix multiply"
  becomes a batched matrix-vector product. JavaScript has no SIMD, so the gain comes only from loop
  overhead.
- **`tanh`** is 23–38 % of a forward pass. A faster approximation would change results, so it
  would not be bit-identical.

**WebAssembly with SIMD (*estimate*).** WASM SIMD (f64x2) could speed up the forward pass about
2×, and the sensor geometry somewhat.
- That touches about 14 + 24 % of CPU, so at best about 1.2× after ranks 1–2. It adds a toolchain.
- Bit-identity is possible only with the same operation order and no fused multiply-add. WASM has
  no fused multiply-add for f64 by default.
- Only worth it after ranks 1–3.

**GPU (*estimate*, with numbers).**
- **The network is tiny.** One tick's forward passes are 100 networks × 250 weights = 25,000
  multiply-adds, about 50 kFLOP. The CPU does that in about 35 µs (14 % of about 0.26 ms per
  frame). A GPU kernel launch plus host↔device copies costs about 5–20 µs. The work is far too
  small to fill even a fraction of a GPU's thousands of lanes.
- **The rest is serial and branchy.** Every tick depends on the previous one, and the rest of a
  tick is physics, collisions, sensors and script logic: about 86 % of CPU, all branchy code over a
  grid.
- **What a GPU would need:** the *whole* simulation batched on the device across thousands of
  candidates or environments, the way Isaac Gym or Brax do it. That means rewriting physics,
  collisions, sensors, scenarios, scoring and determinism in a GPU language.
- **Verdict:** only worth it if populations grow to tens of thousands. Not for 100 candidates with
  250 weights.

## Tooling gaps: order from Evo Lab

Where Evo Lab's harness covered a question, it was used:

- `analyze`: per-generation wall time, CPU and concurrency;
- `scaling` and `scaling-report`: the §4 sweep;
- the manifests, `samples.jsonl` and `lifecycle.jsonl`.

The rest needed project scripts. Each gap below is phrased as a concrete feature request.

1. **A run lifecycle timeline** (`analyze --lifecycle` or a run page panel).
   - *Why:* the data exists, split across `manifest.history`, `worker.startedAt`, `events` and
     `exit`, but nothing shows queue → spawn → `hello` → first gen → steady → exit. Analyze calls
     the whole first generation "start-up" (3.5 s here), which hides that the real start-up is
     0.4 s.
   - *Example:* `queued 0.16 s · spawn→hello 0.40 s · first gen 3.5 s · steady 4.8 s/gen × 149 ·
     exams 44 s (5.7 %) · exit 0.02 s · outside steady: 5.8 %`, per run and as a median per
     experiment.
2. **Node phase helper and Node `cpuprofile` support** (the lablib equivalent for Node).
   - *Why:* Python workers get `lab.phase()`. Node workers time phases by hand, so we only report
     `simulate` and `exam`; the training/held-out/I/O split above needed a monkey-patched script.
   - *Ask:*
     - a tiny `lablib.mjs` with `phase(name)` and `gen()` that adds `cpuSec`/`rssMiB`;
     - a `profile: "cpuprofile:g10-20"` switch for Node workers (inspector `Profiler.start/stop`
       around those generations, written to `RUN_DIR/profiles/`), like `cprofile:g10-20` for
       Python;
     - `hotspots` reading `.cpuprofile` directly. Today S1's
       `experiments/bench/cpuprofile-to-labprof.mjs` converts, and the grouping above was a
       one-off Python script.
   - *Example:* the top-30 table and the subsystem grouping in §3, from a
     `--group-by file-pattern=...` option.
3. **Scaling from a checkpoint workload.**
   - *Why:* `scaling` takes any command, so we wrote a wrapper that copies a run's
     `ckpt.json`/`config.json` into a temp dir per `RUN_INDEX` and resumes for 3 generations.
   - *Ask:* `scaling --from-run train-312 --gen 150 --gens 3` that builds those jobs from a kept
     checkpoint, using the method's own command.
   - *Example:* the §4 table without any project script.
4. **Throughput units for the work, not ticks.**
   - *Why:* our `tps` mixes 100-ship training ticks with 1-ship held-out ticks, so it overstates
     speed about 5×. A project fix (emitting `shipSteps`) is on us.
   - *Ask:* analyze and scaling could take a declared "work" metric per method (in
     `lab.config.json`) and report throughput in it, e.g. ship-steps/s, instead of gens/min only.
5. **Slot utilisation and straggler report per experiment.**
   - *Why:* E4 used 86 % of slot time and E3b 61 %. Computing that needed a manifest script.
   - *Ask:* "slot-seconds busy ÷ budget × wall", plus the idle tail at each phase end, on the
     experiment page and in `screening.md`.
   - *Example:* `E4: wall 3,000 s, utilisation 86 %, tail idle 14 % (screen: last run ended 410 s
     after the median)`.
6. **Parallelism advice (threads, GPU).**
   - *Why:* nothing in the harness answers "would threads or a GPU help this method?". A small
     report would:
     - combine `scaling` (the knee) with the profile's split between serial simulation and the
       batchable network;
     - compare the current budget with the core count;
     - give per-run versus machine throughput guidance, e.g. "threads inside a run only help
       when runs < cores".
   - This is a nice-to-have; the reasoning in §6 stands without it.
7. **Runner's own CPU in the machine view.**
   - *Why:* the runner's and server's CPU share (here under 1 % of the machine) took
     `Get-Process`.
   - *Ask:* a line in `lab status` or the Performance page: `runner 0.35 %, server 0.4 % of
     machine`.

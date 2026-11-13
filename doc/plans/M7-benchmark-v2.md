# M7 — Benchmark v2

Status: 🟡 approved by the user 2026-11-14 ("I want it all built"). Roadmap:
[`../ROADMAP.md`](../ROADMAP.md). Inserted between M6's batch A and the rest of M6.

## Goal

**A measuring instrument that looks like the races we want the AI to win.** Today's exam (v2: `demo`,
`short` and 100 random tracks) is saturated: the M4 default reaches 89 % of checkpoints, and batch A's
real differences showed up only in the skills scenarios. M7 builds harder and more varied tracks and
goals, an exam v3 with a primary score that doesn't saturate, and the same variety for training.

Done means:
- exam v3 runs inside training runs and on stored models;
- its pre-registered primary score separates batch A's arms better than exam v2 did;
- M6 continues on it: the combination check first, then batch B.

## Today

- **Tracks:**
  - code tracks `demo`, `short`, `random` (random chains of 8 checkpoints, legs 500–1,000, a light
    asteroid field);
  - hand-made `slalom`, `gauntlet`, `canyon` (track file format `asteroid-racers/track/v1`,
    `packages/server/src/track-file.ts`).
- **Race rules** (`race-controller.ts`): touch checkpoints in order, then the finish. No direction, no
  speed limit at the finish, no laps, no par times.
- **Exam v2** (`exam.ts`): score = 1,000 per missed checkpoint + seconds + 0.01 × distance left;
  metrics are checkpoints, finished and crashes. `exam.skills` adds per-arena skill metrics (fixed
  held-out scenarios of the M5 arenas).
- **Training arenas:** legacy, point-to-point, rock-in-line, and the M5 tiers `stop`, `turn-and-go`,
  `chain`, `corridor`, `field`, `race-legs`; a curriculum with param or tiered levels.

## Steps

Each step ends with `npm run check` green and its own commit. **Absent = byte-identical:** training,
exam v2, the existing tracks and the game's default race rules stay exactly as today (fixtures and
fingerprint tests). Everything is deterministic from seeds. Builders check game modes through tests
and data, not by watching.

### S1. Procedural track generator

- **Elements:** a new module (`packages/server/src/track-generator.ts`) builds race tracks from:
  - corridors (asteroid walls) with bends and hairpins;
  - gates of two rocks;
  - rock fields across the racing line;
  - long straights into tight turns;
  - asteroid belts to cross;
  - chicanes.
- **Difficulty:** a `difficulty: "easy" | "medium" | "hard"` parameter (or a number 0–1) sets leg
  lengths, turn angles, gate widths, rock density and corridor width. It is seeded by `(seed, band)`.
- **Registered as a track:** `generated` in `TRACKS` (params via the track name or options, e.g.
  `generated:hard`).
- **Registered as an arena:** `generated-legs` in the tier arenas, so training can fly generated
  track legs.
- **Validation:** no race point inside a rock; corridors without holes; every leg flyable. The check
  is geometric, e.g. that a ship-wide path exists along the generator's centre line.
- **Acceptance:**
  - the same seed and band give the same track;
  - fingerprint tests;
  - the bands differ measurably in rock count and turn angle;
  - the scripted controller and the best M6 model fly samples from each band, and their success is
    ordered easy > medium > hard.

### S2. Goal types (race controller, game modes, training)

- **Stop at the finish:** the finish counts only below a speed limit (`finish.maxSpeed`).
- **Directional gates:** a checkpoint counts only when crossed in its direction (`checkpoint.heading`
  plus a gate width), not just touched.
- **Time trials:** each track has a `par` time per leg or per race. The race reports the finish time
  and the time relative to par.
- **Laps:** `laps: N` runs the checkpoint chain N times; the finish counts after the last lap.
- **In the game:** optional race modes, selectable in the track picker or the track file. The
  defaults keep today's rules for players.
- **In training:** episode specs and arenas support the same goals: `stop` already has `maxSpeed`;
  add directional targets, par time and lap chains.
- **Acceptance:**
  - race-controller unit tests per goal;
  - the default rules are unchanged (fingerprints);
  - training episodes with each goal are deterministic and replay exactly.

### S3. Hand-made tracks (7 more, 10 in total)

- **Each built around one challenge,** in the track file format:
  - `hairpins`;
  - `gate-row` (directional gates);
  - `straight-to-turn` (long straight into a tight turn);
  - `dense-belt`;
  - `chicane`;
  - `circuit` (a lap track, 3 laps);
  - `pit-stop` (stop at the finish).
- **Format v2:** the file format is extended (`asteroid-racers/track/v2`, v1 still loads) with:
  - `heading` and `width` per gate checkpoint;
  - `laps`;
  - `finish.maxSpeed`;
  - `par`.
- **Fixed rocks,** so every seed gives the same world.
- **Acceptance:**
  - validation tests per file;
  - the scripted controller and the best model flown on each, with results in the history.

### S4. Exam v3

- **Categories** (all fixed, seeded only from the exam seed):
  1. generated tracks, about 10 per difficulty band (easy, medium, hard);
  2. the 10 hand-made tracks;
  3. goal races: stop-at-finish, directional-gate and lap races drawn from the generator, about 5
     each;
  4. the skills scenarios (`exam.skills`, 8 per arena).
- **Primary score `exam3`** (higher is better, 0–100, pre-registered):
  - Per race r:
    - **progress:** p_r = checkpoints reached ÷ checkpoints, counting a lap race's checkpoints over
      all laps;
    - **time factor:** t_r = min(1, par_r ÷ time_r) if finished, else 0;
    - **goal met:** g_r = 1 if the race's goal is met (finished; stopped below the limit; all gates
      crossed in direction), else 0;
    - **race value:** v_r = 0.6·p_r + 0.2·g_r + 0.2·t_r.
  - Per category c: V_c = mean of v_r over its races. For skills: mean success over the arenas,
    minus 0.05 per crash per episode, clamped at 0.
  - **exam3** = 100 × weighted mean of V_c with weights:
    - easy 0.10, medium 0.20, hard 0.25;
    - hand-made 0.20;
    - goal races 0.15;
    - skills 0.10.

    Hard and goal races weigh most, so the score keeps room to grow.
  - **Crashes** stay a separate veto metric (`exam3Crashes`, per race), not hidden in the score.
  - The weights and formula are frozen once S4 lands. A change means a new score name (`exam3b`),
    so comparisons stay valid.
- **Profile metrics:**
  - `exam3Easy`, `exam3Medium`, `exam3Hard`, `exam3Handmade`, `exam3Goals`, `exam3Skills`;
  - `exam3Finished`, `exam3Crashes`, `exam3TimeVsPar`;
  - group "Exam v3" in `lab.config.json` with descriptions; `exam3` is a headline metric.
- **Config:** `exam: { ..., v3: {} }` (absent = exam v2 only, unchanged). Exam v2 keeps running next
  to it for continuity.
- **Tool:** `npm run exam3 -- --run <id> --gen <g>` re-scores stored models.
- **Re-scoring:** E9's baseline (train-310..319 at g150) and batch A's arms (train-445..504 at g150).
- **Acceptance:**
  - deterministic;
  - training unchanged with exam v3 on (same `stateHash`);
  - the re-score table in the history;
  - **calibration check:** batch A's arms re-scored on `exam3` show the residual controller's
    difference more clearly than exam v2 checkpoints did, i.e. a narrower CI relative to the effect.
    If not, the weights are revised once, before freezing, and the revision is recorded.

### S5. Training access

- `generated-legs` and the goal types as training arenas and curriculum levels (tiered levels can
  name them).
- The goal types in episode specs for training (directional targets, par-time scoring, lap chains,
  stop-finish).
- **Acceptance:**
  - a curriculum run with generated levels is deterministic, resumes exactly and replays (the plugin
    shows the levels);
  - a short check run trains on each goal type.

### Order and file ownership (parallel builders)

| Step | Builder can start | Owns |
| --- | --- | --- |
| S1 generator | now | new `packages/server/src/track-generator.ts` (+ tests); registration in `tracks.ts`; a `generated-legs` arena in `tier-arenas.ts` |
| S2 goal types | now | `race-controller.ts`, `arena-script.ts` (goal checks), game race modes (`packages/client`, `packages/web` picker), `arenas.ts` EpisodeSpec fields |
| S3 hand-made tracks | now; coordinates with S2 on format fields | `packages/server/src/tracks/*.json`, `track-file.ts` (format v2) |
| S4 exam v3 | after S1–S3 | `exam.ts` (v3 additions), new `exam3` module and tool, `lab.config.json` metrics, `lab-train.ts` exam wiring |
| S5 training access | after S1 + S2 | `tier-arenas.ts` / `arenas.ts` curriculum integration, `lab-train.ts` validation |

- **S2 and S3** agree on the format v2 fields first: S2 owns the schema in `track-file.ts`'s types, S3
  adds the files.
- **S1 and S5** both touch `tier-arenas.ts`: S5 rebases on S1.

## Acceptance

- [ ] S1–S5 committed, each with `npm run check` green; absent = byte-identical (fixtures,
      fingerprints).
- [ ] Exam v3 with the pre-registered `exam3` score, profile metrics and tool; E9's baseline and
      batch A re-scored.
- [ ] The calibration check passed, or the one-time revision recorded.
- [ ] The game offers the new race modes and the 10 hand-made tracks; default rules unchanged.
- [ ] M6's combination check and batch B planned on exam v3.

## Not in M7

- New sensors or learning methods (M6).
- Promoting a model into the game (the user decides after M6's readiness report).
- Moving obstacles, multiplayer balance.

## Risks

- **A score that's gamed or badly weighted:** pre-registration and the calibration check against
  batch A guard against it. Revising the weights after seeing results is allowed once, before
  freezing.
- **Generated tracks that are unfair** (unflyable legs): geometric validation, plus the scripted
  controller as a sanity check per band.
- **Game rule changes leaking into training or exam v2:** fingerprint tests on the default rules and
  existing tracks.
- **Exam cost:** about 30 generated + 10 hand-made + 15 goal races + skills. Estimated 2–3× exam v2's
  time, still a few seconds per exam after S2's speed-ups. Measured in S4.
- **Parallel builders on shared files:** the ownership table, worktrees, rebase, keep both on doc
  conflicts.

## Open questions

| Question | Default |
| --- | --- |
| Par times: hand-set or computed? | Computed from the scripted controller's clean time × 1.2 per track, then frozen in the files. |
| Do the goal types become the game's default rules? | No; optional modes. The user decides later. |
| How many races per exam v3 category? | 10 per difficulty band, the 10 hand-made, 5 per goal type, 8 per skill. |
| exam3 weights | As above, frozen after the calibration check. |

## Changes to this plan

- 2026-11-14: created with the user's approval, after batch A showed exam v2 is saturated.

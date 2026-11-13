# M5 — Content

Status: ✅ done 2026-11-13. Liked by the user on 2026-11-13, then moved behind M4 (perception), so
that models can see obstacles before they train on obstacle-heavy content. The game side (steps
1–3) started early with the user's OK while M4 continued; the training side (steps 4, 5, 7) was
built after M4 closed.
Roadmap: [`../ROADMAP.md`](../ROADMAP.md)

## Goal

Give training and the exam the content they lack:

- **training arenas** in tiers that ask for one skill at a time, up to race-like flying among
  asteroids;
- **race tracks** as data files: a few hand-designed ones, a track picker in the game, and a
  broader race exam.

M6 then runs the experiments (curriculum, network size, mutation) on this content. Obstacle
sensing comes first, in M4 (perception).

## Today

- Two arenas: `legacy` (16 targets around the origin, the original course) and `point-to-point`
  (random targets, optional asteroids anywhere).
- Three tracks, built in code (`SceneController`): `demo` (corridors), `short` (600 units) and
  `random` (seeded random race in a light field). The game always runs `demo`.
- The race exam is `demo` + `short` + 5 random tracks. Its scores swing on **crash loops**, a
  finding from M3: a rock on the straight line between two checkpoints. The model flies into it,
  respawns at the last checkpoint and repeats, because nothing in its inputs senses asteroids.
  With only 5 random tracks, one trap moves the exam score a lot.
- Best racer so far: train-4 g110 (exam 3,579, finishes 6 of 7), partly by luck (only one trap).

## Steps

**Phase 1 (game side, now):** steps 1–3. **Phase 2 (after M4):** steps 4, 5 and 7; step 6 moved
to M4. See "Changes to this plan".

Each step ends with `npm run check` green and its own commit.

### 1. Track file format

- A JSON format for a track: name, description, author, the race (portal position and heading,
  checkpoints with position and radius, finish), asteroids (position, radius), arrows (position,
  heading). Version field from the start (`asteroid-racers/track/v1`).
- Track files live in `packages/server/src/tracks/*.json`, are bundled (so the browser has them),
  and join the existing track registry next to the code tracks.
- Validation with clear errors: checkpoints not inside asteroids, portal clear, at least one
  checkpoint.
- `demo`, `short` and `random` stay in code and are not touched: M4's experiments compare runs on
  the exam, which flies them. Instead, a test writes `short` and `demo` in the file format (with
  seeded asteroid belts) and checks that they build the same worlds as the code versions, so the
  format covers what exists.
- ~~A small export helper (`npm run track -- export <name>`)~~ dropped: the code tracks' asteroids
  are random per seed, so an export would freeze one seed. New tracks are written by hand.

### 2. Three new hand-designed tracks

Each one tests something specific. Designed in JSON and checked in the watch page.

- **`slalom`**: alternating checkpoints left and right of a straight line. Tight turns, no
  asteroids on the direct legs.
- **`gauntlet`**: long legs with single rocks placed on or next to the direct line. Exactly the
  crash-loop situation, on purpose.
- **`canyon`**: a winding corridor between asteroid walls, with arrows, like `demo` but with turns
  in both directions and a longer lap.

### 3. Track picker in the game

- The game's start page gets a track choice for singleplayer (and `?track=` in the URL).
- The Node server takes `TRACK=<name>` for multiplayer.
- The watch page lists every track, not only the exam's.

### 4. Training arenas in tiers

New arenas, each with params for difficulty. All deterministic per seed, like the existing ones.

| Tier | Arena | What it asks for |
| --- | --- | --- |
| 1 | `stop` | Reach a target and be slower than `maxSpeed` inside it (braking). |
| 1 | `turn-and-go` | Start moving fast away from the target and turn around. |
| 1 | `chain` | Several targets in one episode, like legs of a race (planning the next turn). |
| 2 | `corridor` | Reach a target at the end of a bent corridor of asteroid walls. |
| 2 | `field` | A chain of targets through a dense asteroid field. |
| 3 | `race-legs` | Legs of the real race tracks (from the track registry) as episodes, with crashes respawning at the last target, as in a race. |

- `point-to-point` stays as tier 0. `legacy` stays for comparison.
- The arena registry gets a `tier` and a short description, so the plugin and the watch page can
  show what an arena is for.

### 5. Watching arenas

- The watch page gets an arena mode: pick an arena, its params and a seed, and fly a model through
  its episodes. This is how new arenas get checked by eye while designing them.

### 6. Race exam v2 (moved to M4, step 8)

- The default exam becomes: `demo`, `short`, `slalom`, `gauntlet`, `canyon`, plus **15** random
  tracks (instead of 5), so one trap weighs less.
- The exam config carries a version. Exams with the old config stay comparable with each other.
  The plugin and `npm run exam` default to v2.
- Re-exam the bundled model, train-2 and train-4 g110 with v2.

### 7. Baseline runs

- One training run per tier-1 and tier-2 arena (point-to-point setup otherwise, 150 generations),
  examined with exam v2 along the run.
- Train with the obstacle sensing chosen in M4, so tier-2 arenas are learnable in principle.
- Record everything in `HISTORY.md`, with the viewer's view of what the models do.

## Acceptance

Phase 1 (game side):

- [x] Steps 1–3 committed, `npm run check` green.
- [x] Track files: `demo` and `short` in the file format build the same worlds as from code (test);
      invalid files fail with clear errors (tests); `demo`, `short` and `random` unchanged (test).
- [x] Three new tracks, flown by the bundled model and a trained model in the watch page (checked by
      eye). They are not in the exam or in training.
- [x] The game can race every track (singleplayer picker, `TRACK=` on the server).

Phase 2 (after M4):

- [x] Steps 4, 5 and 7 committed, `npm run check` green. CI not checked: nothing was pushed.
- [x] Six new arenas, deterministic per seed, exact replay (tests); each checked by eye in the
      watch page (`stop` only as far as its page loads: it has no obstacles to check).
- [ ] ~~Exam v2 in place; the bundled model, train-2 and train-4 g110 re-examined.~~ Moved to M4.
- [x] Baseline runs recorded in `HISTORY.md` (Evo Lab measurements `m5-base-<arena>`, 5 seeds
      each, reports in `experiments/`).

### Baseline results (M4 default setup per arena, 5 seeds, g150; each arena with its own 3-level curriculum)

| Arena | Difficulty | Level-ups (per seed) | Training success g150 | Held-out g150 | 102-race exam checkpoints |
| --- | --- | --- | --- | --- | --- |
| `stop` | easy | all 5 reach level 2 by g11–23 | 1.00 | 1.00 | 0.70 (sd 0.09) |
| `turn-and-go` | easy | all 5 reach level 2 by g13–19 | 1.00 | 0.98 | 0.67 (sd 0.08) |
| `chain` | easy | all 5 reach level 2 by g11–16 | 1.00 | 1.00 | 0.63 (sd 0.19) |
| `race-legs` | medium | level 1 by g4–9 (all), level 2 for 3 of 5 (g12–32) | 0.20 (sd 0.45) | 0.15 | 0.38 (sd 0.35) |
| `corridor` | hard | level 1 for 4 of 5 (g41–109) | 0.28 (sd 0.29) | 0.07 | 0.43 (sd 0.42) |
| `field` | hardest | level 1 for 2 of 5 (g22, g88) | 0.11 (sd 0.16) | 0.08 | 0.60 (sd 0.17) |

Training on one easy arena alone gives weaker racers (exam v2: 0.63–0.70 of checkpoints) than M4's
default setup (0.87 at g150 in m4-e9-confirm, same exam): single arenas are building blocks for a
curriculum (M6 2.6), not replacements.

## Not in M5

- New sensors: M4 settles which obstacle sensing models get; M5 uses it.
- Curriculum training (arena schedules within one run): M6. M5 trains one arena per run.
- **Moving obstacles.** The game has none, so training on them would not help racing. Dropped from
  the roadmap's tier 3.
- A track editor UI. Tracks are written as JSON and checked in the watch page.
- Changing game rules (e.g. respawn facing the next checkpoint, which would break crash loops). That
  changes the game for players too; see the open questions.

## Open questions

| Question | Default in this plan |
| --- | --- |
| Change the respawn rule (e.g. face the next checkpoint) to break crash loops? | Not in M5: it is a game-design change for players; decide separately. |
| Who designs the tracks? | I draft them in JSON; you check them in the watch page. |
| How many random tracks in exam v2? | 15 (about 3 s per model instead of 1.5 s). |
| Should `demo` stay the game's default track? | Yes; the picker offers the others. |

## Risks

- **Hand-designed tracks may be unfair or broken** (a checkpoint behind a wall, a corridor narrower
  than a ship). Validation catches the obvious; the watch page catches the rest.
- **Tier-2 arenas may still be too hard** with M4's sensing. Their baselines show it; M6 can follow
  up with capacity or curriculum experiments.
- **Exam v2 breaks comparisons** with M2/M3 numbers. Mitigated by versioning the exam and re-examining
  the reference models.
- **Scope:** six arenas, three tracks and a picker is a lot. If it runs long, tier 3
  (`race-legs`) moves to M6.

## Changes to this plan

- **2026-11-13, game side started early** (approved by the user while M4 continues):
  - **Exam v2 moved into M4** (step 8): M4 owns the race exam now, so step 6 is no longer part of
    M5.
  - **Training waits:** M4 already has a staged curriculum (step 7b), so the tiered training
    arenas (steps 4–5) and the baseline runs (step 7) wait until M4 is done and its sensing is
    chosen.
  - **This phase** covers the track file format, the three hand-designed tracks (`slalom`,
    `gauntlet`, `canyon`) and the track picker in the game (steps 1–3).
  - **Frozen yardstick:** M4 compares runs on the exam (`demo`, `short`, random tracks). So the
    code tracks stay as they are, the new tracks do not enter the exam or training, and step 1's
    "load `demo` and `short` from files" became a test that the file format can express them.
- **2026-11-13, phase 2 (training side) built** (approved by the user after M4 closed):
  - **Respawn rule for `race-legs`:** an episode is several consecutive legs, so a crash must
    respawn at the last checkpoint reached, not at the episode start. Episodes get an optional
    `respawn: "last-target"` (and targets an optional respawn `orientation`); absent, nothing
    changes. Not a game-rule change: the race already respawns there.
  - **Episodes with obstacles get their own cells:** `corridor` and `field` place each episode's
    walls or field in its own grid cell, since a scenario's obstacles are shared by all its
    episodes.
  - **`race-legs` defaults to the `random` track**, so the exam's fixed tracks stay out of training
    unless a config names them.
  - **Tier and description** are on the arena registry and shown in the watch page's track list
    and status line. The Evo Lab plugin does not show them yet.
  - **Step 7 setup:** the user asked for the current default setup (task v2 scoring, lineCheck,
    `curriculum: { success: 0.6 }`, `parents: 10`) as Evo Lab measurements with 5 seeds instead of
    one run per arena. The default curriculum levels name rock-in-line and point-to-point, so each
    arena gets its own three levels (easier → its defaults). `race-legs` was measured too (30 runs
    in total, within the cap the user set).

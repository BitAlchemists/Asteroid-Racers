# M4 — Content

Status: ⬜ not started. This plan needs the user's OK before work begins. Roadmap: [`../ROADMAP.md`](../ROADMAP.md)

## Goal

Give training and the exam the content they lack:

- **training arenas** in tiers that ask for one skill at a time, up to race-like flying among
  asteroids;
- **race tracks** as data files: a few hand-designed ones, a track picker in the game, and a
  broader race exam.

M5 then runs the experiments (curriculum, sensors, network size) on this content.

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

Each step ends with `npm run check` green and its own commit.

### 1. Track file format

- A JSON format for a track: name, description, author, the race (portal position and heading,
  checkpoints with position and radius, finish), asteroids (position, radius), arrows (position,
  heading). Version field from the start (`asteroid-racers/track/v1`).
- Track files live in `packages/server/src/tracks/*.json`, are bundled (so the browser has them),
  and join the existing track registry next to the code tracks.
- Validation with clear errors: checkpoints not inside asteroids, portal clear, at least one
  checkpoint.
- `demo` and `short` are exported to files and loaded from there, so the format covers what exists.
  A test checks that the file version builds the same world as the code version.
- A small export helper (`npm run track -- export <name>`) writes any registry track to a file, as
  a starting point for new tracks.

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
| 2 | `rock-in-line` | One or more rocks on the direct line to the target (avoidance). |
| 2 | `corridor` | Reach a target at the end of a bent corridor of asteroid walls. |
| 2 | `field` | A chain of targets through a dense asteroid field. |
| 3 | `race-legs` | Legs of the real race tracks (from the track registry) as episodes, with crashes respawning at the last target, as in a race. |

- `point-to-point` stays as tier 0. `legacy` stays for comparison.
- The arena registry gets a `tier` and a short description, so the plugin and the watch page can
  show what an arena is for.

### 5. Watching arenas

- The watch page gets an arena mode: pick an arena, its params and a seed, and fly a model through
  its episodes. This is how new arenas get checked by eye while designing them.

### 6. Race exam v2

- The default exam becomes: `demo`, `short`, `slalom`, `gauntlet`, `canyon`, plus **15** random
  tracks (instead of 5), so one trap weighs less.
- The exam config carries a version. Exams with the old config stay comparable with each other.
  The plugin and `npm run exam` default to v2.
- Re-exam the bundled model, train-2 and train-4 g110 with v2.

### 7. Baseline runs

- One training run per tier-1 and tier-2 arena (point-to-point setup otherwise, 150 generations),
  examined with exam v2 along the run.
- Expected: tier-1 arenas are learnable with today's inputs; tier-2 arenas show the missing
  obstacle sensing as a ceiling. That is the measurement M5's sensor experiments start from.
- Record everything in `HISTORY.md`, with the viewer's view of what the models do.

## Acceptance

- [ ] Steps 1–6 committed, `npm run check` green, CI green.
- [ ] Track files: `demo` and `short` from files build the same worlds as from code (test);
      invalid files fail with clear errors (tests).
- [ ] Three new tracks, flown by the bundled model and train-4 g110 in the watch page (checked by
      eye).
- [ ] The game can race every track (singleplayer picker, `TRACK=` on the server).
- [ ] Seven new arenas, deterministic per seed, exact replay (tests); each checked by eye in the
      watch page.
- [ ] Exam v2 in place; the bundled model, train-2 and train-4 g110 re-examined.
- [ ] Baseline runs recorded in `HISTORY.md`.

## Not in M4

- **Obstacle sensors** ("whiskers") or any new model inputs: M5. M4 measures the gap; M5 closes it.
- Curriculum training (arena schedules within one run): M5. M4 trains one arena per run.
- **Moving obstacles.** The game has none, so training on them would not help racing. Dropped from
  the roadmap's tier 3.
- A track editor UI. Tracks are written as JSON and checked in the watch page.
- Changing game rules (e.g. respawn facing the next checkpoint, which would break crash loops). That
  changes the game for players too; see the open questions.

## Open questions

| Question | Default in this plan |
| --- | --- |
| Should obstacle sensors come before the tier-2 arenas (swap with M5)? | No: build content first; tier-2 baselines then show how much sensors are needed. |
| Change the respawn rule (e.g. face the next checkpoint) to break crash loops? | Not in M4: it is a game-design change for players; decide separately. |
| Who designs the tracks? | I draft them in JSON; you check them in the watch page. |
| How many random tracks in exam v2? | 15 (about 3 s per model instead of 1.5 s). |
| Should `demo` stay the game's default track? | Yes; the picker offers the others. |

## Risks

- **Hand-designed tracks may be unfair or broken** (a checkpoint behind a wall, a corridor narrower
  than a ship). Validation catches the obvious; the watch page catches the rest.
- **Tier-2 arenas may be unlearnable** with today's inputs, so their runs show nothing but failure.
  That is the expected result and the input to M5, not a reason to stop.
- **Exam v2 breaks comparisons** with M2/M3 numbers. Mitigated by versioning the exam and re-examining
  the reference models.
- **Scope:** seven arenas, three tracks and a picker is a lot. If it runs long, tier 3
  (`race-legs`) moves to M5.

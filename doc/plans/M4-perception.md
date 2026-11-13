# M4 — Perception

Status: ⬜ not started. This plan needs the user's OK before work begins. Roadmap: [`../ROADMAP.md`](../ROADMAP.md)

## Goal

**Models that see asteroids and fly around them.** Which kind of sensing works is an open question,
so M4 is built as experiments:

1. a **harness**: switchable model variants compared on matched seeds by their race-exam score, using
   Evo Lab's experiments;
2. **candidate sensors**, each a switch;
3. **experiments** that pick the sensing (and the network size it needs) by a decision rule written
   down before the runs.

Done means a sensing setup that measurably cuts crashes and improves the race exam over today's
blind models, chosen by experiment, and the default for M5's content work.

## Why first

M3 showed the exam's biggest failure: **crash loops**. A rock lies on the straight line between two
checkpoints, the model flies into it, respawns at the last checkpoint and repeats it 35 to 68 times.
Today's inputs are target angle, target distance, velocity angle and speed, so nothing tells a model
that a rock is there. Obstacle-heavy content (M5's `gauntlet`, `corridor`, `field`) would mostly
measure that blindness.

## Today

- Model inputs come from a registry (`INPUTS` in `model-spec.ts`); a model's JSON lists the inputs it
  uses. Adding an input is one registry entry, but inputs see only the ship and the current target.
- The bot keeps a copy of the world from server messages, but **drops asteroids** (it "doesn't care"
  about them). Collisions run on the server.
- Arenas: `legacy`, `point-to-point` (asteroids anywhere, optional). No arena forces avoidance.
- The race exam is a separate Evo Lab method, so a training run has no race metric of its own.
- Evo Lab experiments (from its `docs/experiments.md`):
  - **switches:** a new idea is a config key. Off means absent from the config, and with every
    switch off the code must reproduce the baseline byte for byte. A **baseline gate** re-runs stored
    baseline runs first and blocks the experiment on any difference.
  - **designs:** matched seeds per arm; one-at-a-time, leave-one-out or factorial (up to 6
    switches), or a pure measurement over seeds.
  - **decision:** a screen generation, continuation of the informative arms, and a decision rule
    (paired effect per seed beyond k × noise). Then a report and an explicit sign-off.
  - A switch key may not appear in the method's default config in `lab.config.json`.

## Steps

Each step ends with `npm run check` green and its own commit.

### 1. Obstacles in the model's view

- The bot keeps asteroids in its world copy. Sensors read what the client knows, as a player sees
  the screen; they never read the server's state.
- A spatial grid of obstacles on the client, so a sensor query costs about the same with 20 or 500
  asteroids.
- Input functions get the obstacles in their context (`InputContext.obstacles`).
- Byte-identical baseline: with no sensors configured, training results do not change (test against
  a stored result).

### 2. Candidate sensors (each a switch)

All angles relative to the ship's nose, distances scaled to 0..1 by a range, deterministic.
Parameters (count, range) are part of the switch value.

| Sensor | Inputs | Idea |
| --- | --- | --- |
| `whiskers` | N rays (e.g. 7 over ±90°), 1 − distance / range to the first obstacle hit | Classic ray sensors; cheap; can miss small rocks between rays. |
| `sectors` | N sectors around the ship, nearest obstacle edge per sector | Like whiskers, but covers whole areas. |
| `nearest` | the k nearest obstacles: angle, distance, radius | Precise, but which rock is "nearest" jumps around. |
| `lineCheck` | the first obstacle on the path to the target: distance along it, sideways offset | Aimed directly at crash loops. |

- Config: `sensors: { whiskers: { count: 7, spread: 180, range: 600 } }` and so on, absent by default.
  The worker appends the sensors' inputs to the model spec, so model files record them and the
  game's bots feed them correctly.
- `hidden` for capacity experiments becomes a switchable top-level key (`hidden`, absent = the
  model's default), because Evo Lab rejects switches on keys in the method's default config. The
  `model` block leaves the defaults in `lab.config.json`; the worker keeps the same defaults.
- The replay viewer draws a model's sensors (rays, sectors, the nearest rocks), so we can see what a
  model sees.

### 3. An arena that demands avoidance

- `rock-in-line` (moved here from the content milestone): each episode puts one or more rocks on or
  near the direct line to the target, with params for count, size and offset. Optional extra
  scattered asteroids.
- Crashes respawn at the episode start (`crashMode: "respawn"`), like the game, so crash loops show
  up in training as they do in races.

### 4. Race metrics inside training runs

- Optional `exam` in the training config (`exam: { every: 10, randomTracks: 15 }`): every N
  generations, and always at the last one, the winner flies the race exam. The `gen` event gets
  `exam`, `examCheckpoints`, `examFinished` and `examCrashes`. This makes experiment decisions about
  racing possible.
- The exam does not touch training state, so `result.json` and exact resume stay unchanged (tested).
  Cost: about 3 s per exam with 15 random tracks.

### 5. The harness: experiment plans

- Experiments live in `lab/experiments/<id>/plan.md` (Evo Lab's format), created through its API or
  the `lab` CLI. A short guide in `doc/experiments.md` covers how we write them: baseline config,
  switches, seeds, screen and final generations, decision rule.
- A small helper (`npm run experiment -- draft <id>`) writes a plan skeleton with our usual baseline
  config, so starting a new comparison takes minutes.
- Fresh baseline runs with the M4 code (needed for the gate), seeds 1 to 5.

### 6. Experiments

Each is approved before it runs. The decision metric is `exam` (lower is better) at the final
generation, with crash counts reported alongside.

1. **E1 noise floor (measurement):** the baseline config over seeds 1 to 5, exam every 10
   generations. How much do exam scores vary between seeds? This sets `minEffect` for the others.
2. **E2 sensor comparison (one-at-a-time):** `whiskers`, `sectors`, `nearest` and `lineCheck`, each
   against the blind baseline, on `rock-in-line` + point-to-point with asteroids. Screen at 50,
   final at 150. Decision: a sensor wins if its paired exam effect beats k × noise and `minEffect`,
   and it lowers exam crashes.
3. **E3 capacity (one-at-a-time):** the E2 winner with bigger hidden layers (e.g. `[16, 12, 8]`,
   `[24, 16]`) against the E2 winner as is.
4. **E4 confirmation:** the chosen setup trained longer (300 generations), re-examined, and watched
   in the viewer on the crash-loop tracks. Then it is a candidate for the game (your call, per
   `CLAUDE.md`).

Experiments may be added or changed as results come in; each change goes into the history.

## Acceptance

- [ ] Steps 1–5 committed, `npm run check` green, CI green.
- [ ] With no sensors, training reproduces a stored baseline result byte for byte (test and Evo Lab
      gate).
- [ ] Four sensors, deterministic, drawn in the viewer, exact replay with sensors (tests).
- [ ] `rock-in-line` arena and the in-training exam metric in place (tests).
- [ ] E1–E3 run through Evo Lab experiments with approved plans, reports and sign-offs; E4 done.
- [ ] A chosen sensing setup recorded in `HISTORY.md` and the roadmap, with its exam and crash
      numbers against the blind baseline.

## Not in M4

- Track files, new tracks, the track picker and the other arenas: M5.
- Lookahead to the next checkpoint, curriculum, mutation strategy: M6.
- Changing the game's respawn rule.
- Shipping a model into the game (decided by you after E4).

## Open questions

| Question | Default in this plan |
| --- | --- |
| Are sensors fair, given human players see the screen but have no rays? | Allowed: they read only what the client knows (the visible world). Revisit before a model ships into the game. |
| What counts as "measurably better"? | Paired exam effect beyond 2 × noise and E1's `minEffect`, and fewer exam crashes, on 5 seeds. |
| How many seeds per arm? | 5 (Evo Lab recommends 3 to 5). |
| Budget: E2 is 5 arms × 5 seeds × 150 generations: 25 runs of about 11 minutes, 4–5 CPU-hours. | Fine on the machine runner in the background (about an hour of wall time with parallel slots). |

## Risks

- **Byte-identical baseline** is strict: any change in the bot's message handling (now keeping
  asteroids) could shift a floating-point step. Caught by the test and the gate; fixed before
  anything else runs.
- **Speed:** sensors add work per bot and frame (100 bots × rays × nearby rocks). The spatial grid
  keeps it local; generation time is measured with and without sensors.
- **No sensor wins clearly**, e.g. because the network is too small to use the new inputs, or
  training is too short. E3 covers capacity; longer runs are a follow-up. A null result is recorded
  as such.
- **Exam noise** may hide real effects (crash loops make it jumpy). 15 random tracks and 5 seeds
  should help; E1 measures how much.

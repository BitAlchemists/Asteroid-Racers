# M1 — Training foundations

Status: 🟡 in progress (approved 2026-11-13). Roadmap: [`../ROADMAP.md`](../ROADMAP.md)

## Goal

Make the trainer generic, so that courses, network inputs and scoring are chosen in the Evo Lab
config, without code changes. Keep runs deterministic and exactly resumable.

M1 adds no new behaviour for the bots and does not try to make them better. It builds what M2–M5
need.

## Today

- `TrainingDirector` (`packages/server/src/ai/directors.ts`) runs one hard-coded course: the flux
  compensator, 16 targets within ~1,000 units, no obstacles. The course is the same every generation.
- `RespawnTargetTrainingScript` (`ai/scripts.ts`) teleports the ship back to the spawn point for each
  target. `GameServer.teleportPlayerTo` zeroes the velocity but does not send the owner an update.
  The bot's first frame therefore still sees the stale random spawn position, which causes the small
  score wobble within a run.
- The inputs (`targetInputs` in `ai/target-vehicle-controller.ts`), the layout (4-10-8-6-4-2) and the
  output mapping (thrust 0..1, turn ±5 rad/s) are fixed in code. A brain file does not say which of
  them it was trained with.
- Training bots are ghosts (`canCollide: false`): they cannot hit asteroids at all.
- The score is a single evaluator, `QuadraticSumOfDistanceToTargets`.

## Steps

Each step ends with `npm run check` green and its own commit.

### 1. Teleport fix

- `teleportPlayerTo(client, position, orientation, velocity = zero)`.
- Send the owner an immediate own-ship update, so the bot's next frame sees the new position.
- Test: after a teleport, the bot's first input frame sees the teleported position. Two runs of the
  same course give the same score without wobble.
- This changes training results. train-1 numbers stay comparable only in rough terms; the baseline in
  step 7 replaces them.

### 2. Collision groups

- A movable gets a collision mode: `all` (default, as today), `obstacles` (asteroids yes, other ships
  no) or `none` (today's ghosts).
- In training, ships stop respawning on their own after a crash (`autoRespawn: false`). The arena
  decides what a crash means: `end` the episode, or `respawn` at the episode start with a penalty.
- Test: two `obstacles` ships pass through each other but crash on an asteroid.

### 3. Scenario and Arena

```ts
interface Episode {
  start: { position: Vector2; orientation: number; velocity?: Vector2 };
  targets: { position: Vector2; radius: number; maxSpeed?: number }[];
  timeLimitFrames: number;
}
interface Scenario {
  obstacles: { position: Vector2; radius: number; velocity?: Vector2 }[];
  episodes: Episode[];
}
interface Arena {
  name: string;
  generate(random: SeededRandom, params: Record<string, unknown>): Scenario;
}
```

- An `ArenaScript` replaces the training scripts. It places the obstacles, plays the episodes one
  after another and records what happened in each (targets reached, frames used, crashes, distances).
- The scenario RNG is derived from `(seed, generation)` rather than taken from a shared generator. A
  resumed run then regenerates exactly the same scenarios.
- `heldOut`: a fixed number of scenarios from a separate seed stream. They are scored on the winner
  after each generation, never used for selection, and reported as their own metric.
- First arenas:
  - `legacy`: the flux-compensator course, the same every generation, as today.
  - `point-to-point`: a random start and one target at a random distance and angle, with ranges set
    by params.

### 4. Scoring library

- A scorer takes the episode records and returns one number (lower is better, as today).
- Terms: `distance` (today's quadratic sum), `success` (targets missed), `time` (frames used),
  `crashes`. Each has a weight in the config.
- `legacy` scoring = distance only, which reproduces today's evaluator.

### 5. Brain spec

- A brain JSON stores `spec: { inputs: string[], layout: number[], outputs: string }`.
- An input registry maps names to functions, starting with the four inputs we have today:
  `targetAngle`, `targetDistance`, `velocityAngle`, `speed`. Adding an input in M5 then means adding
  one registry entry.
- Brains without a spec load with the legacy spec (and `bias_output: 0`, as they do now).
- The bot client builds its inputs from the spec, so the game and the trainer cannot disagree.

### 6. Config and Evo Lab

- New config keys for the `train` method, all with defaults that give the legacy behaviour:

  ```json
  {
    "brain": { "inputs": ["targetAngle", "targetDistance", "velocityAngle", "speed"], "layout": [10, 8, 6, 4] },
    "arenas": [{ "name": "legacy", "params": {} }],
    "scoring": { "distance": 1, "success": 0, "time": 0, "crashes": 0 },
    "collisions": "none",
    "heldOut": 0
  }
  ```

- New metrics: `heldOut` (when on), `success` (share of targets reached).
- The checkpoint format goes to `v2`. It saves the brain spec; nothing else is needed, because the
  scenario RNG is derived.
- Update the `lab.config.json` binding if files move.

### 7. Baseline runs

- Run 1: `legacy` arena with default config, 200 generations, seed 2026 through Evo Lab. It should
  match train-1 within noise (the teleport fix will shift it somewhat; we record by how much).
- Run 2: `point-to-point` from config alone, to prove the path works end to end. A short run is
  enough.
- Record both in `HISTORY.md`.

## Acceptance

- [x] Steps 1–6 committed, `npm run check` green. CI is still open: it runs only after a push.
- [x] Exact-resume tests pass for both arenas, including kill-and-resume.
- [x] Same seed gives the same result twice, byte for byte.
- [x] Legacy baseline recorded and compared with train-1 (train-2). It did **not** match within
      noise: it is clearly better; see `HISTORY.md`.
- [x] A point-to-point run works from config alone (train-3).
- [x] The bundled brain still plays in the game (legacy spec loads; the racing-bot tests use it).

## Not in M1

- New sensors (whiskers, lookahead): M5. M1 only makes them a one-entry change.
- The race exam and snapshots: M2.
- Any UI (watch page, Evo Lab renderer): M3.
- Tiered arena content beyond `legacy` and `point-to-point`: M4.
- Swapping the bundled brain.

## Risks

- **Result drift from the teleport fix:** expected. The new baseline becomes the reference.
- **Speed:** the `obstacles` collision mode adds collision checks to training. Measure generation
  time before and after; ghosts stay available.
- **Scope creep into M4:** keep only the two arenas named above.

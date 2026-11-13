# M3 — Visibility

Status: ⬜ not started. This plan needs the user's OK before work begins. Roadmap: [`../ROADMAP.md`](../ROADMAP.md)

## Goal

**Watch any model fly**, where we look at the numbers:

- in Evo Lab: any generation of a training run (its arena episodes) and any exam (its race flights);
- in the game: a watch page for the bundled model or a model file, on any track.

What M3 should let us answer by looking: why every model stalls about 500 units from a checkpoint
on two random exam tracks, how train-4 g110 gets through the `demo` corridors, and what the training
arenas actually ask of a model.

## Approach: replay by re-simulation

Everything since M1 is seeded and deterministic, and the game server already runs in the browser
(singleplayer). So nothing needs to be recorded: a model plus a scenario plus a seed reproduces a
flight exactly. The viewer re-simulates the flight in the page and draws it with the game's PixiJS
renderer. One **replay viewer** serves both Evo Lab and the game.

## Today

- Snapshots `gens/gNNNN.json` hold `{format, g, score, model}` for every 10th generation of
  training runs (since M2). Exam runs write no snapshots.
- `@ar/client` has the PixiJS view (`PixiGameView`: ships, asteroids, checkpoints, arrows,
  explosions, a follow camera, radar) behind a `GameView` interface, driven by `GameClient`.
- Evo Lab renderer plugins (answers from the Evo Lab session, contract in its `ui/plugin.js`):
  - an ES module declared in `lab.config.json` under `ui`, with `render(el, data, ctx)` (required,
    called many times, returns a cleanup function), `thumb(el, data, ctx)` and optional `panels`;
  - `data` is our snapshot as written. `ctx` carries the run id, method, `g`, the run's `config`,
    metrics, size and mode, and `api.url()` / `api.fetchJson()` for files;
  - it runs in the page with no sandbox, so a bundled PixiJS app with its own loop and controls is
    fine. It must clean up completely (loop, timers, listeners, Pixi app) and take keyboard input
    only while it has focus;
  - Evo Lab serves whatever is on disk in the declared folders (a Vite output folder works). The
    plugin is not part of the run binding;
  - **thumbnails must be static pictures**: there are 12 in a filmstrip, so no simulations in
    `thumb`;
  - exam runs: the run manifest carries `inputRun`, so the plugin can fetch the source model itself.

## Steps

Each step ends with `npm run check` green and its own commit.

### 1. Replay core (headless, in `@ar/server`)

- `Replay`: built from a model plus either
  - a **training scenario**: run config + generation, giving the arena scenarios exactly as the
    trainer made them (`scenariosFor(g)`), flown by the one model; or
  - an **exam flight**: track + flight seed + time limit, exactly as `examFlight` flies it.
- API: `step(frames)`, `restart()`, `seekTo(frame)` (re-simulates from the start; fast, because the
  simulation runs far faster than real time), the current world state for drawing, and an event
  list (episode start/end, target reached, checkpoint, crash, finish).
- **Exactness test:** replaying the winner of a training generation reproduces that generation's
  recorded best score to the last digit. Replaying an exam flight reproduces the exam's flight
  result. This is the guarantee that what we watch is what was measured.

### 2. Snapshots the plugin can draw without simulating

- Training snapshots gain a `trace`: the winner's path in each episode, every 10th frame (about
  500 points for the default arenas), plus the episode outcomes. To get it, the arena script
  records a sparse path for every candidate during the generation and keeps only the winner's.
  `result.json` and exact resume stay unchanged (tested).
- Exam runs write one small snapshot per examined generation:
  `{format: "asteroid-racers/exam-snapshot/v1", sourceRun, g, flights}`. Each flight has its
  track, seed, outcome and a sparse path. The `gen` event names it.
- Thumbnails are then a plain drawing of these paths.

### 3. Replay viewer (in `@ar/client`)

- A component that mounts into any element: a PixiJS canvas showing the replay with the game's own
  shapes, plus:
  - camera: follow the ship, or the whole scenario;
  - the ship's trail, and the current target highlighted;
  - a HUD: episode or flight i of n, time, targets or checkpoints reached, crashes;
  - controls: play/pause, speed (¼× to 16×), restart, previous/next episode or flight, a time
    slider (seek).
- Keyboard shortcuts only while the viewer has focus. `destroy()` stops everything; tested by
  mounting and destroying repeatedly with no leaked loops.

### 4. Evo Lab renderer plugin

- A small entry (`packages/lab-plugin`) built by Vite into `dist/lab-plugin/` as an ES module with
  code-split chunks. `npm run build` builds it as well. Declared in `lab.config.json`:
  `"ui": {"apiVersion": 1, "renderer": "dist/lab-plugin/render.js", "static": ["dist/lab-plugin"]}`.
- `thumb`: draws the snapshot's paths and targets as a static picture (training: the episodes;
  exam: the flights), coloured by outcome.
- `render`:
  - **training runs**: the model from the snapshot, the scenarios from `ctx.config` and `ctx.g`, in
    the replay viewer. Episode picker, starting with the first failed episode.
  - **exam runs**: the exam snapshot gives the source run and flights. The model comes from the
    source run's snapshot (`/api/runs/<source>/gens/<g>`). Flight picker, starting with the worst
    flight.
  - **start page leader card** (`size: "large"`): plays automatically, muted controls.
- A runs-without-snapshots fallback (train-1 to train-3): a short note and the metrics, no viewer.

### 5. Watch page in the game

- `watch.html` in `@ar/web`: pick the model (bundled, or a dropped/opened file: network JSON,
  `luke.txt`, snapshot or `result.json`, the same loader rules as `npm run exam`), a track, and a
  seed. It flies the exam flight in the replay viewer.
- Linked from the start page next to singleplayer and multiplayer.

### 6. Look, and write down what we see

- Use the viewer on the open questions from M2 (the two random tracks where every model stalls,
  train-4 g110 on `demo`, train-4 g80 vs g110) and record the findings in `HISTORY.md`. They feed
  the M4 and M5 plans.

## Acceptance

- [ ] Steps 1–5 committed, `npm run check` green, CI green.
- [ ] A replayed training winner reproduces the run's recorded best score exactly; a replayed exam
      flight reproduces the exam's flight result exactly (tests).
- [ ] Snapshots with traces leave `result.json` and exact resume unchanged (tests).
- [ ] In Evo Lab, a new training run's generations and an exam's flights can be watched, the
      filmstrip shows path thumbnails, and leaving the page leaks nothing (checked in the browser).
- [ ] The watch page flies the bundled model and a snapshot file on every track (checked in the
      browser).
- [ ] Findings from step 6 recorded in `HISTORY.md`.

## Not in M3

- Live frames from running workers (Evo Lab's observers): replay covers what we need, since a
  snapshot every 10 generations can be watched as soon as it is written.
- Several ships in one view (racing models against each other) and spectating the live
  multiplayer game.
- New tracks, a track editor or a track file format: M4.
- Recording videos or GIFs.
- Any change to how models are trained or scored.

## Open questions

| Question                                                            | Default in this plan                                  |
| ------------------------------------------------------------------- | ----------------------------------------------------- |
| Commit the built plugin, or build it locally?                       | Build locally (`npm run build`), not committed.       |
| Which episode or flight to show first?                              | The first failed one (that's what you want to see).   |
| Should the leader card on Evo Lab's start page animate?             | Yes, autoplay at 2×, muted controls.                  |

## Risks

- **Replay not exactly what was measured.** A training generation flies 100 ships at once; the
  replay flies one. Ships don't interact in `none` and `obstacles` modes, and the spawn randomness
  is overwritten by the teleport, so the result should be identical. The exactness test checks it.
  If it fails, that is a determinism bug worth finding.
- **Older runs** (train-1 to train-4) have no traces, and train-1 to train-3 have no snapshots. The
  viewer still works for train-4's snapshots (model + config); thumbnails need traces, so those
  runs show a plain fallback. A new training run gives the full experience.
- **Plugin reload in Evo Lab v1** re-imports only the entry module. A single entry file that loads
  its chunks keeps that predictable; during development, a full page reload is the safe way.
- **Bundle and memory:** many Pixi apps on one page (compare view) could be heavy. Only `render` in
  detail and large views creates a Pixi app; thumbnails are plain canvas or SVG.

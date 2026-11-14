# D1 — Showcase and phone play (side track of "D1 — Deploy and showcase")

Status: ✅ done (2026-11-14). Written from the user's request for the online version at
asteroid-racers.cypherpunk.agency; the deploy part (Dockerfile, CI, `/health`) is the deploy agent's.
Roadmap: [`../ROADMAP.md`](../ROADMAP.md)

## Goal

The user's words: "please prepare a version that also works on the phone and that can present our
latest accepted model through all relevant challenges so that i can review it. of course regular
play should be possible, with racing against one of these models."

So: the game works on a phone, a showcase page flies the latest accepted model (and comparison
models) through every challenge with live and headless results, and players can race against any
showcase model. **No model is promoted into the game** (`packages/server/src/ai/models/` stays
as it is): the showcase is the user's review tool for that decision.

## Today

- Keyboard-only controls, a desktop HUD (pilot panel, 5-line chat across the bottom).
- The watch page (M3) flies the bundled model or a dropped file on one track, the race exam or a
  training arena; there is no list of challenges and no results table.
- Bots always fly the bundled model (or `db/`'s trained model on the Node server).
- The adopted setup after M6 batch A is the M4 default + `controller: residual 0.5` +
  `scoring.progress: 3`. No run of that exact combination exists yet (the combination check moved
  after M7); batch A has one arm for each switch (`m6-a2-rewards-control`).

## Steps

1. **Model choice.** Pick the best model of the residual and progress arms of
   `m6-a2-rewards-control` at g150 by exam v2 checkpoints, then exam crashes, then the skills
   profile (`npm run skills`). Copy it, a runner-up, the bundled default and train-327 g300 (best M4
   model) with their specs into `packages/server/src/showcase/models/`, with a manifest (run,
   generation, setup, exam and skills numbers). Test: the residual controller is in the loaded spec
   and changes the flight (the game, the watch page and the exam all go through
   `TargetVehicleController`).
2. **Challenges and headless results** (`packages/server/src/showcase/`): every registered track
   except `random` (so M7's new tracks join by themselves), the nine skill arenas of the skills exam
   (fixed scenarios, 8 episodes), and exam v2 (102 races). One function flies a model through a
   challenge and returns checkpoints/targets, finished, time and crashes; `npm run showcase` prints
   the table for all models.
3. **Showcase page** (`showcase.html`): pick a model, watch the challenges in the existing replay
   viewer one after another (auto-advance) or from the list, live result per challenge, and a summary
   table computed in a Web Worker from the same simulation. Linked from the start page.
4. **Opponent choice.** `?opponent=<id>` on singleplayer (the in-page server's bots use that model)
   and on multiplayer (passed on the WebSocket URL; on the shared server the bots switch to the
   model chosen by the latest player who joined with a choice, announced in the chat; back to the
   server default when the last player leaves). A selector on the start page. Default unchanged.
5. **Phone support.** Touch controls (a floating stick on the left half sets the heading, the right
   half thrusts), a compact HUD on touch devices, viewport meta without zoom, no scrolling while
   playing, portrait and landscape; start page, race-mode box, watch and showcase pages usable on a
   phone. Unit tests for the input mapping. Desktop unchanged (touch UI only on coarse pointers or
   `?touch`).
6. **Docs:** roadmap D1 entry, history.

## Acceptance criteria

- [x] `npm run check` green; no change to `packages/server/src/ai/models/`.
- [x] The manifest names the chosen model with its run, generation, setup and numbers; the headless
      exam v2 of each showcase model matches its training-run exam numbers.
- [x] A residual showcase model flies with the residual controller in the game and the showcase
      (test).
- [x] The showcase page lists every track, the nine skill arenas and exam v2, plays them in order,
      shows a live result per challenge and a summary table; works in the mobile viewport.
- [x] Singleplayer and multiplayer accept `?opponent=`; the start page offers it; no choice = the
      bundled model as before.
- [x] On a phone viewport the game can be flown with touch (stick + thrust), the HUD fits, the page
      does not scroll or zoom; tests for the input mapping.
- [x] Same origin only (no CDNs or external fonts).

## Out of scope

- Promoting any model into the game (the user decides after real races).
- Training runs.
- Per-race model choice through the game protocol (would need a protobuf message).

## Risks

- Shared files with M7 and the deploy agent (start page, `host.ts`): small edits, rebase often.
- Exam results depend on the race code; if M7 changes exam v2 behaviour, the headless numbers move
  (the test that compares them is the alarm).

## Changes

- 2026-11-14: the user added "the server should allow multiplayer play". The opponent switch on a
  shared server now waits until no human is racing (it used to switch at once, restarting the bots
  mid-race); the start page got a "Join multiplayer" button and the player name; the deploy agent's
  CSP findings (PixiJS eval, inline styles) are fixed in the client.

## Result

Done 2026-11-14; see the history entry "D1 showcase and phone play".

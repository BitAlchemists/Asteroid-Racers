# Track file format

Track files live in `packages/server/src/tracks/<name>.json` and are registered in
`packages/server/src/tracks.ts`. The loader and validator is `packages/server/src/track-file.ts`
(`parseTrackFile`, `trackFromFile`); its types are the reference. Two formats load:

- `asteroid-racers/track/v1`: race points, asteroids, belts, arrows; today's race rules.
- `asteroid-racers/track/v2` (M7): v1 plus the **goal fields** below. The v2 fields are allowed
  only in v2 files (a v1 file with one is rejected as an unknown key), so every v1 file loads and
  plays exactly as before.

## Common fields (v1 and v2)

```jsonc
{
  "format": "asteroid-racers/track/v2",
  "name": "pit-stop",                 // lower case, digits, dashes; equals the file name
  "description": "…",
  "author": "…",                      // optional
  "race": {
    "start": { "x": 0, "y": 0, "heading": 0 },            // the portal (heading optional)
    "checkpoints": [{ "x": 0, "y": -600, "radius": 80 }], // at least one; radius default 100
    "finish": { "x": 0, "y": -1200 }
  },
  "asteroids": [[x, y, radius]],      // fixed rocks
  "belts": [{ "x": 0, "y": 0, "width": 100, "height": 100, "count": 10, "density": 1 }],
  "arrows": [[x, y, heading]]         // decoration
}
```

`heading` is in degrees on screen, clockwise: 0 = up (−y), 90 = right, 180 = down, 270 = left. Left
out, a point faces the next point of the race (the finish faces along the last leg). Every race point
(and the world spawn at (0, 0)) must be clear of asteroids and belts.

## Goal fields (v2 only)

| Field | Where | Meaning |
| --- | --- | --- |
| `width` | a checkpoint | **Directional gate** of this width (> 0). The gate is the line through (x, y) across the checkpoint's heading (its `heading`, or by default facing the next point), `width` long. It counts only when the ship's centre crosses that line **in the heading's direction**, within `width / 2` of (x, y). Crossing it backwards, or touching the circle without crossing, doesn't count. Without `radius`, the checkpoint is drawn with radius `width / 2`; the validator checks a circle of radius `max(radius, width / 2)` for rocks. The loader adds an arrow (decoration) on each gate pointing the way to cross. |
| `maxSpeed` | `race.finish` | **Stop at the finish:** the finish counts only while the ship is inside it at most this fast (units/s, > 0). Too fast, nothing happens: the racer can turn back and try again. |
| `laps` | `race` | **Laps** (integer ≥ 1, default 1). A lap is all checkpoints and then the finish; lap 2 starts again at the first checkpoint after the portal. The finish ends the race only after the last lap, and only there does `finish.maxSpeed` apply. Progress counts over all laps: a race has `laps × (checkpoints + 1)` targets. |
| `par` | `race` | **Par time** of the whole race (all laps) in seconds (> 0). The race reports the finish time and the time relative to par. |

Example (a 2-lap circuit with two gates, stop at the finish, par 45 s):

```json
{
  "format": "asteroid-racers/track/v2",
  "name": "example",
  "description": "Two gates, two laps, stop at the finish",
  "race": {
    "start": { "x": 0, "y": 0, "heading": 0 },
    "checkpoints": [
      { "x": 0, "y": -800, "heading": 90, "width": 240 },
      { "x": 800, "y": -800, "heading": 180, "width": 240 },
      { "x": 800, "y": 0 }
    ],
    "finish": { "x": 300, "y": 200, "maxSpeed": 120 },
    "laps": 2,
    "par": 45
  }
}
```

## The same goals elsewhere

- **Race controller** (`race-controller.ts`): `RaceRules` (`laps`, `finishMaxSpeed`, `par`,
  `timeTrial`, `gates`) plus per-checkpoint gates; a file's goal fields become these rules. Without
  rules the race is today's: touch the checkpoints in order, no stop, one lap.
- **Exam:** flights fly a track under its rules; `FlightResult` gains `goalMet`, `par` and
  `timeVsPar` on tracks with goals.
- **Game** (start page and `singleplayer.html`): optional modes that override the file, see
  `doc/experiments.md` → "Goal types (M7 S2)".
- **Training episodes** (`arenas.ts`): `TargetSpec.maxSpeed`, `TargetSpec.gate`,
  `EpisodeSpec.laps`, `EpisodeSpec.parFrames`.

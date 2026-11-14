import { TRACKS, type Track } from "@ar/server";

/**
 * Race tracks and skill tracks (the user's request of 2026-11-14): race tracks are real races and
 * are what the multiplayer server rotates through; skill tracks train one skill each and are for
 * practice in singleplayer. Singleplayer can pick any of them.
 *
 * This module is browser-safe (the start page imports it as `@ar/node/track-categories`). It lives
 * in `@ar/node`, not `@ar/server`, on purpose: `lab.config.json`'s training binding covers every
 * file in `packages/server/src`, and a new file there would change the binding hash.
 */
export type TrackCategory = "race" | "skill";

export interface TrackEntry {
  /** The registry name (`TRACKS` in `@ar/server`). */
  readonly name: string;
  /** One line for players (the registry's description is the long, technical one). */
  readonly blurb: string;
}

export const RACE_TRACKS: readonly TrackEntry[] = [
  { name: "demo", blurb: "The classic: a corridor race through four asteroid blocks." },
  { name: "canyon", blurb: "A long winding corridor between asteroid walls, turns both ways." },
  { name: "gauntlet", blurb: "Six long legs with rocks on the racing line, and one gate." },
  { name: "circuit", blurb: "A closed loop in a rounded triangle: 3 laps." },
  { name: "random", blurb: "A new random race of 8 checkpoints through a light asteroid field." },
  { name: "generated:easy", blurb: "A freshly generated easy track: 6 legs." },
  { name: "generated:medium", blurb: "A freshly generated medium track: 8 legs." },
  { name: "generated:hard", blurb: "A freshly generated hard track: 10 legs." },
];

export const SKILL_TRACKS: readonly TrackEntry[] = [
  { name: "short", blurb: "Warm-up: one checkpoint, then the finish." },
  { name: "slalom", blurb: "Tight turns left and right of a line of rocks." },
  { name: "hairpins", blurb: "Four 180° hairpins in a narrow corridor." },
  { name: "straight-to-turn", blurb: "Build speed on long straights, then brake for the corner." },
  { name: "chicane", blurb: "Quick S bends in a narrow corridor." },
  { name: "dense-belt", blurb: "Weave through a belt with gaps barely wider than a ship." },
  { name: "gate-row", blurb: "Seven directional gates: cross each one along its arrow." },
  { name: "pit-stop", blurb: "Race into a pit lane and stop in the finish before the wall." },
];

/**
 * Registered tracks that are in neither group, with the reason. Empty today: a track added to the
 * registry must be put in a group or listed here (a test checks this).
 */
export const EXCLUDED_TRACKS: Readonly<Record<string, string>> = {};

/** The multiplayer rotation: the race tracks in this order. */
export const RACE_ROTATION: readonly string[] = RACE_TRACKS.map((t) => t.name);

export function trackCategory(name: string): TrackCategory | undefined {
  if (RACE_TRACKS.some((t) => t.name === name)) return "race";
  if (SKILL_TRACKS.some((t) => t.name === name)) return "skill";
  return undefined;
}

/** The player-facing line for a track: its blurb, or the registry description. */
export function trackBlurb(name: string): string {
  const entry = [...RACE_TRACKS, ...SKILL_TRACKS].find((t) => t.name === name);
  return entry?.blurb ?? TRACKS[name]?.description ?? "";
}

// --- the multiplayer lobby, as `GET /lobby` reports it (track-lobby.ts) --------------------------

export interface TrackInfo {
  name: string;
  blurb: string;
}

/** What `GET /lobby` answers (and the multiplayer page shows). */
export type LobbyStatus =
  | { fixed: true; current: TrackInfo }
  | {
      fixed: false;
      current: TrackInfo;
      next: TrackInfo & { by: "vote" | "rotation" };
      /** Votes per race track (only tracks with votes). */
      votes: Record<string, number>;
      /** The round on the current track is over; the switch waits for the humans' races to end. */
      waiting: boolean;
      /** Seconds until the round ends at the latest (0 once it is over). */
      roundLeftS: number;
      /** The tracks in the rotation, in order. */
      tracks: TrackInfo[];
      players: number;
    };

/** The registry track of an entry (throws for a name the registry doesn't know). */
export function registryTrack(name: string): Track {
  const track = TRACKS[name];
  if (!track) throw new Error(`unknown track ${JSON.stringify(name)}`);
  return track;
}

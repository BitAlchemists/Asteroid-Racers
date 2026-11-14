import { createArrow } from "./scene-controller";
import type { RaceRules } from "./race-controller";
import type { Track } from "./tracks";

/**
 * Game race modes (M7): optional rules on top of any track, chosen on the start page and passed in
 * the singleplayer URL. Absent parameters keep the track's own rules (today's rules for every v1 and
 * code track).
 * - `laps=N`: N laps;
 * - `stop=V`: stop at the finish, at most V units/s;
 * - `gates`: every checkpoint between the portal and the finish is a directional gate;
 * - `par=S`: par time S seconds (a time trial);
 * - `timetrial`: report finish times.
 */
export const RACE_MODE_PARAMS = ["laps", "stop", "gates", "par", "timetrial"] as const;

/** Reads the race-mode parameters (e.g. a page's URLSearchParams); invalid values are errors. */
export function parseRaceModes(params: { get(name: string): string | null }): RaceRules {
  const rules: RaceRules = {};
  const num = (name: string, check: (n: number) => boolean, what: string): number | undefined => {
    const raw = params.get(name);
    if (raw === null) return undefined;
    const n = Number(raw);
    if (raw.trim() === "" || !check(n))
      throw new Error(`race mode ${name} must be ${what}, got ${JSON.stringify(raw)}`);
    return n;
  };
  const laps = num("laps", (n) => Number.isInteger(n) && n >= 1, "an integer ≥ 1");
  if (laps !== undefined) rules.laps = laps;
  const stop = num("stop", (n) => n > 0, "a speed > 0");
  if (stop !== undefined) rules.finishMaxSpeed = stop;
  const par = num("par", (n) => n > 0, "seconds > 0");
  if (par !== undefined) rules.par = par;
  if (params.get("gates") !== null) rules.gates = true;
  if (params.get("timetrial") !== null) rules.timeTrial = true;
  return rules;
}

/** The URL query for race modes (the inverse of {@link parseRaceModes}), e.g. "laps=3&gates". */
export function raceModesQuery(rules: RaceRules): string {
  const parts: string[] = [];
  if (rules.laps !== undefined) parts.push(`laps=${rules.laps}`);
  if (rules.finishMaxSpeed !== undefined) parts.push(`stop=${rules.finishMaxSpeed}`);
  if (rules.gates) parts.push("gates");
  if (rules.par !== undefined) parts.push(`par=${rules.par}`);
  if (rules.timeTrial) parts.push("timetrial");
  return parts.join("&");
}

/**
 * `track` with `overrides` on top of its own rules. Checkpoints that become gates through
 * `overrides.gates` get an arrow (decoration) pointing the way to cross them, added after the track.
 * With no overrides, the track itself is returned.
 */
export function withRaceRules(track: Track, overrides: RaceRules): Track {
  if (Object.keys(overrides).length === 0) return track;
  return {
    name: track.name,
    description: track.description,
    build(world, race, random) {
      track.build(world, race, random);
      const before = race.checkpoints.map((_, i) => race.gateWidth(i));
      race.setRules({ ...race.rules, ...overrides });
      race.checkpoints.forEach((c, i) => {
        if (before[i] !== undefined || race.gateWidth(i) === undefined) return;
        const arrow = createArrow(c.position.x, c.position.y, c.orientation);
        arrow.radius = Math.min(100, c.radius * 0.8);
        world.addEntity(arrow);
      });
    },
  };
}

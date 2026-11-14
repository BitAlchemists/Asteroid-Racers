import { World } from "@ar/shared";
import {
  describeRules,
  RaceController,
  raceModesQuery,
  seededRandom,
  TRACKS,
  type IGameServer,
  type RaceRules,
} from "@ar/server";

// The start page's track picker: it sets `?track=` on the singleplayer and watch links and
// remembers the choice for the next visit. The race-mode controls (M7) add optional rules to the
// singleplayer link (`?laps=&stop=&gates&timetrial`, see race-modes.ts); left alone, the track's own
// rules apply.

const KEY = "asteroid-racers.track";
const MODES_KEY = "asteroid-racers.race-modes";
/** The finish speed limit of the "stop at the finish" mode. */
const STOP_SPEED = 100;
const laps = document.getElementById("mode-laps") as HTMLInputElement;
const stop = document.getElementById("mode-stop") as HTMLInputElement;
const gates = document.getElementById("mode-gates") as HTMLInputElement;
const timeTrial = document.getElementById("mode-timetrial") as HTMLInputElement;
const trackRules = document.getElementById("track-rules")!;
const select = document.getElementById("track") as HTMLSelectElement;
const description = document.getElementById("track-description")!;
const singleplayer = document.getElementById("singleplayer") as HTMLAnchorElement;
const watch = document.getElementById("watch") as HTMLAnchorElement;

for (const track of Object.values(TRACKS)) {
  const option = document.createElement("option");
  option.value = track.name;
  option.textContent = track.name;
  select.append(option);
}

let saved: string | null = null;
try {
  saved = localStorage.getItem(KEY);
} catch {
  // storage blocked: start with the default
}
select.value = saved && saved in TRACKS ? saved : "demo";
try {
  const modes = JSON.parse(localStorage.getItem(MODES_KEY) ?? "{}") as Record<string, unknown>;
  laps.value = typeof modes.laps === "string" ? modes.laps : "";
  stop.checked = modes.stop === true;
  gates.checked = modes.gates === true;
  timeTrial.checked = modes.timeTrial === true;
} catch {
  // storage blocked or bad: no modes
}

/** The track's own rules (a v2 file's goal fields), built once into a throwaway race. */
function ownRules(name: string): string {
  const race = new RaceController({} as IGameServer);
  TRACKS[name]!.build(new World(), race, seededRandom(1));
  return describeRules(race.rules, race.gateCount);
}

function modes(): RaceRules {
  const rules: RaceRules = {};
  const n = Number(laps.value);
  if (laps.value !== "" && Number.isInteger(n) && n >= 1) rules.laps = n;
  if (stop.checked) rules.finishMaxSpeed = STOP_SPEED;
  if (gates.checked) rules.gates = true;
  if (timeTrial.checked) rules.timeTrial = true;
  return rules;
}

function update(): void {
  const track = TRACKS[select.value]!;
  description.textContent = track.description;
  trackRules.textContent = `Track rules: ${ownRules(track.name)}.`;
  const query = raceModesQuery(modes());
  singleplayer.href = `singleplayer.html?track=${encodeURIComponent(track.name)}${query ? `&${query}` : ""}`;
  watch.href = select.value === "demo" ? "watch.html" : `watch.html?track=${encodeURIComponent(track.name)}`;
  try {
    localStorage.setItem(KEY, track.name);
    localStorage.setItem(
      MODES_KEY,
      JSON.stringify({
        laps: laps.value,
        stop: stop.checked,
        gates: gates.checked,
        timeTrial: timeTrial.checked,
      }),
    );
  } catch {
    // not remembered
  }
}
select.addEventListener("change", update);
for (const input of [laps, stop, gates, timeTrial]) input.addEventListener("input", update);
update();

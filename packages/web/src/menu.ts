import { World } from "@ar/shared";
import {
  describeRules,
  RaceController,
  raceModesQuery,
  seededRandom,
  SHOWCASE_MODELS,
  showcaseModelInfo,
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
  singleplayer.href = `singleplayer.html?track=${encodeURIComponent(track.name)}${query ? `&${query}` : ""}${opponentQuery("&")}`;
  updateOpponent();
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
// D1: the player name (the HUD keeps the same key), the opponent model, a join button.
const NAME_KEY = "asteroid-racers.username";
const OPPONENT_KEY = "asteroid-racers.opponent";
const nameInput = document.getElementById("player-name") as HTMLInputElement;
const opponentSelect = document.getElementById("opponent") as HTMLSelectElement;
const opponentNote = document.getElementById("opponent-note")!;
for (const info of SHOWCASE_MODELS) {
  const option = document.createElement("option");
  option.value = info.id;
  option.textContent = info.label;
  opponentSelect.append(option);
}
try {
  nameInput.value = localStorage.getItem(NAME_KEY) ?? "";
  const savedOpponent = localStorage.getItem(OPPONENT_KEY);
  if (savedOpponent && showcaseModelInfo(savedOpponent)) opponentSelect.value = savedOpponent;
} catch {
  // storage blocked
}
nameInput.addEventListener("input", () => {
  try {
    localStorage.setItem(NAME_KEY, nameInput.value.trim());
  } catch {
    // not remembered
  }
});

/** `?opponent=` for the game links, empty for the default (so default play is unchanged). */
function opponentQuery(separator: "?" | "&"): string {
  const id = opponentSelect.value;
  return id && id !== "default" ? `${separator}opponent=${encodeURIComponent(id)}` : "";
}

function updateOpponent(): void {
  const info = showcaseModelInfo(opponentSelect.value);
  opponentNote.textContent = info
    ? `${info.role}. In multiplayer the bots are shared: the latest choice wins, from the next race on.`
    : "";
  const multiplayer = `multiplayer.html${opponentQuery("?")}`;
  for (const id of ["multiplayer", "multiplayer-link"])
    (document.getElementById(id) as HTMLAnchorElement).href = multiplayer;
  (document.getElementById("singleplayer-button") as HTMLAnchorElement).href = singleplayer.href;
  const showcase = document.getElementById("showcase") as HTMLAnchorElement;
  showcase.href =
    opponentSelect.value === "default"
      ? "showcase.html"
      : `showcase.html?model=${encodeURIComponent(opponentSelect.value)}`;
  try {
    localStorage.setItem(OPPONENT_KEY, opponentSelect.value);
  } catch {
    // not remembered
  }
}
opponentSelect.addEventListener("change", update);

select.addEventListener("change", update);
for (const input of [laps, stop, gates, timeTrial]) input.addEventListener("input", update);
update();

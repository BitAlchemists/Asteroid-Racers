import { TRACKS } from "@ar/server";

// The start page's track picker: it sets `?track=` on the singleplayer and watch links and
// remembers the choice for the next visit.

const KEY = "asteroid-racers.track";
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

function update(): void {
  const track = TRACKS[select.value]!;
  description.textContent = track.description;
  singleplayer.href = `singleplayer.html?track=${encodeURIComponent(track.name)}`;
  watch.href = select.value === "demo" ? "watch.html" : `watch.html?track=${encodeURIComponent(track.name)}`;
  try {
    localStorage.setItem(KEY, track.name);
  } catch {
    // not remembered
  }
}
select.addEventListener("change", update);
update();

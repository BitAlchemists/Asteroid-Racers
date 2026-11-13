import { mountReplayViewer, type ReplayViewer } from "@ar/client";
import {
  arenaByName,
  arenaReplaySource,
  ARENAS,
  bundledModels,
  DEFAULT_EXAM,
  DEFAULT_MODEL_NAME,
  examFlights,
  examReplaySource,
  modelFromJson,
  TRACKS,
  type ArenaParams,
  type CrashMode,
  type MajorTom,
  type ReplaySource,
} from "@ar/server";

// Watch a model fly the race exam (the same flights `npm run exam` and evo-lab's exam method use),
// one track of the registry, or a training arena's scenario: the bundled model or a model file
// (network JSON, luke.txt, evo-lab snapshot or result.json).
// URL parameters: ?track=<name>&seed=<exam or track seed>&time=<seconds>&flight=<index>, or
// ?arena=<name>&params=<JSON>&seed=<run seed>&g=<generation>&crash=<respawn|end>&flight=<episode>.
// An arena scenario is built exactly as in a training run with that seed at that generation
// (arena index 0, collisions with obstacles, the run's default `frames` of 600).

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const modelSelect = $<HTMLSelectElement>("model");
const trackSelect = $<HTMLSelectElement>("track");
const fileInput = $<HTMLInputElement>("file");
const seedInput = $<HTMLInputElement>("seed");
const timeInput = $<HTMLInputElement>("time");
const generationInput = $<HTMLInputElement>("generation");
const paramsInput = $<HTMLInputElement>("params");
const crashSelect = $<HTMLSelectElement>("crash");
const status = $<HTMLSpanElement>("status");
const host = $<HTMLDivElement>("viewer");
const params = new URLSearchParams(location.search);
if (params.has("seed")) seedInput.value = params.get("seed")!;
if (params.has("time")) timeInput.value = params.get("time")!;
if (params.has("g")) generationInput.value = params.get("g")!;
if (params.has("params")) paramsInput.value = params.get("params")!;
if (params.get("crash") === "end") crashSelect.value = "end";

const ARENA_PREFIX = "arena:";
for (const track of Object.values(TRACKS)) {
  const option = document.createElement("option");
  option.value = track.name;
  option.textContent = track.name;
  option.title = track.description;
  $("tracks").append(option);
}
for (const arena of Object.values(ARENAS)) {
  const option = document.createElement("option");
  option.value = ARENA_PREFIX + arena.name;
  option.textContent = arena.tier === undefined ? arena.name : `${arena.name} (tier ${arena.tier})`;
  option.title = arena.description;
  $("arenas").append(option);
}
if (params.get("arena") && params.get("arena")! in ARENAS)
  trackSelect.value = ARENA_PREFIX + params.get("arena")!;
else if (params.get("track") && params.get("track")! in TRACKS) trackSelect.value = params.get("track")!;

let model: MajorTom = bundledModels().load(DEFAULT_MODEL_NAME)![0]!;
let viewer: ReplayViewer | undefined;
let segment = Number(params.get("flight") ?? 0) || 0;
/** Counts show() calls, so a slower earlier mount doesn't leave a second viewer behind. */
let shown = 0;

const arenaName = () =>
  trackSelect.value.startsWith(ARENA_PREFIX) ? trackSelect.value.slice(ARENA_PREFIX.length) : undefined;

/** The params field as an object, or an error message. */
function arenaParams(): ArenaParams | string {
  try {
    const value = JSON.parse(paramsInput.value || "{}") as unknown;
    if (typeof value !== "object" || value === null || Array.isArray(value))
      return "params must be a JSON object";
    return value as ArenaParams;
  } catch {
    return "params is not valid JSON";
  }
}

function showMode(arena: boolean): void {
  for (const el of document.querySelectorAll<HTMLElement>(".arena-only")) el.hidden = !arena;
  for (const el of document.querySelectorAll<HTMLElement>(".race-only")) el.hidden = arena;
}

/** What to watch now, and the URL that leads back to it; a string is an error to show. */
function currentSource(seed: number, url: URL): { source: ReplaySource; label: string } | string {
  for (const key of ["track", "arena", "params", "g", "crash"]) url.searchParams.delete(key);
  const arena = arenaName();
  showMode(arena !== undefined);
  if (arena !== undefined) {
    const p = arenaParams();
    paramsInput.classList.toggle("invalid", typeof p === "string");
    if (typeof p === "string") return p;
    const g = Math.max(1, Math.trunc(Number(generationInput.value) || 1));
    const crashMode = crashSelect.value as CrashMode;
    url.searchParams.set("arena", arena);
    if (Object.keys(p).length > 0) url.searchParams.set("params", JSON.stringify(p));
    url.searchParams.set("g", String(g));
    if (crashMode !== "respawn") url.searchParams.set("crash", crashMode);
    try {
      const source = arenaReplaySource({
        model,
        arenas: [{ name: arena, params: p }],
        frames: 600,
        collisions: "obstacles",
        crashMode,
        seed,
        g,
      });
      return { source, label: arenaByName(arena).description };
    } catch (error) {
      paramsInput.classList.add("invalid");
      return String(error instanceof Error ? error.message : error);
    }
  }
  const time = Math.max(5, Number(timeInput.value) || DEFAULT_EXAM.timeLimitSeconds);
  if (trackSelect.value) url.searchParams.set("track", trackSelect.value);
  const flights = trackSelect.value
    ? [{ track: trackSelect.value, seed }]
    : examFlights({ ...DEFAULT_EXAM, seed });
  return { source: examReplaySource(model, flights, time), label: "" };
}

async function show(): Promise<void> {
  const call = ++shown;
  if (viewer) segment = viewer.controller.segment;
  viewer?.destroy();
  viewer = undefined;
  const seed = Math.max(0, Math.trunc(Number(seedInput.value) || 0));
  const url = new URL(location.href);
  const current = currentSource(seed, url);
  history.replaceState(null, "", url);
  if (typeof current === "string") {
    status.textContent = current;
    return;
  }
  status.textContent =
    `${model.name} (generation ${model.generation})` + (current.label ? ` · ${current.label}` : "");
  const mounted = await mountReplayViewer(host, current.source, {
    segment: Math.min(segment, current.source.segments.length - 1),
    title: model.name,
  });
  if (call !== shown) {
    mounted.destroy();
    return;
  }
  viewer = mounted;
  host.querySelector<HTMLElement>(".ar-replay")?.focus();
}

modelSelect.addEventListener("change", () => {
  if (modelSelect.value === "file") fileInput.click();
  else {
    model = bundledModels().load(DEFAULT_MODEL_NAME)![0]!;
    void show();
  }
});
fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    model = modelFromJson(JSON.parse(await file.text()) as unknown, file.name);
    model.name = `${model.name} (${file.name})`;
    const option = modelSelect.querySelector<HTMLOptionElement>('option[value="file"]')!;
    option.textContent = file.name;
    modelSelect.value = "file";
    void show();
  } catch (error) {
    status.textContent = String(error instanceof Error ? error.message : error);
  }
});
for (const input of [seedInput, timeInput, generationInput, paramsInput, crashSelect])
  input.addEventListener("change", () => void show());
trackSelect.addEventListener("change", () => {
  viewer?.destroy();
  viewer = undefined;
  segment = 0;
  void show();
});
$<HTMLFormElement>("form").addEventListener("submit", (e) => e.preventDefault());

// Drop a model file anywhere on the page.
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files[0];
  if (!file) return;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  fileInput.files = transfer.files;
  fileInput.dispatchEvent(new Event("change"));
});

await show();

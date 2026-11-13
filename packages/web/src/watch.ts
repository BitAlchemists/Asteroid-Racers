import { mountReplayViewer, type ReplayViewer } from "@ar/client";
import {
  bundledModels,
  DEFAULT_EXAM,
  DEFAULT_MODEL_NAME,
  examFlights,
  examReplaySource,
  modelFromJson,
  type MajorTom,
} from "@ar/server";

// Watch a model fly the race exam (the same flights `npm run exam` and evo-lab's exam method use):
// the bundled model or a model file (network JSON, luke.txt, evo-lab snapshot or result.json).
// URL parameters: ?seed=<exam seed>&time=<seconds>&flight=<index>.

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const modelSelect = $<HTMLSelectElement>("model");
const fileInput = $<HTMLInputElement>("file");
const seedInput = $<HTMLInputElement>("seed");
const timeInput = $<HTMLInputElement>("time");
const status = $<HTMLSpanElement>("status");
const host = $<HTMLDivElement>("viewer");
const params = new URLSearchParams(location.search);
if (params.has("seed")) seedInput.value = params.get("seed")!;
if (params.has("time")) timeInput.value = params.get("time")!;

let model: MajorTom = bundledModels().load(DEFAULT_MODEL_NAME)![0]!;
let viewer: ReplayViewer | undefined;
let segment = Number(params.get("flight") ?? 0) || 0;

async function show(): Promise<void> {
  if (viewer) segment = viewer.controller.segment;
  viewer?.destroy();
  const seed = Math.max(0, Math.trunc(Number(seedInput.value) || 0));
  const time = Math.max(5, Number(timeInput.value) || DEFAULT_EXAM.timeLimitSeconds);
  const flights = examFlights({ ...DEFAULT_EXAM, seed });
  status.textContent = `${model.name} (generation ${model.generation})`;
  viewer = await mountReplayViewer(host, examReplaySource(model, flights, time), {
    segment,
    title: model.name,
  });
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
for (const input of [seedInput, timeInput]) input.addEventListener("change", () => void show());
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

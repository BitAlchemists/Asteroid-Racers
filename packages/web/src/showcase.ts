import { mountReplayViewer, type ReplayViewer } from "@ar/client";
import {
  ACCEPTED_MODEL,
  formatResult,
  loadShowcaseModel,
  mergeResults,
  replayResult,
  SHOWCASE_MODELS,
  showcaseChallenges,
  showcaseModelInfo,
  type Challenge,
  type ChallengeResult,
  type MajorTom,
} from "@ar/server";
import type { WorkerMessage, WorkerRequest } from "./showcase-worker";

// The model showcase (D1): pick a showcase model and watch it fly every challenge (each game track,
// the skills exam's arenas, exam v2) in the replay viewer, one after another or picked from the
// list. Each challenge shows the watched result live and the headless result from a Web Worker
// (the same simulation, run without drawing); a summary table compares all showcase models.
// URL: ?model=<id>&challenge=<id>.

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const modelSelect = $<HTMLSelectElement>("model");
const autoplay = $<HTMLInputElement>("autoplay");
const status = $<HTMLSpanElement>("status");
const host = $<HTMLDivElement>("viewer");
const rows = $<HTMLTableSectionElement>("challenges");
const params = new URLSearchParams(location.search);

const challenges = showcaseChallenges();
/** Played in order by "play all": the tracks and skills (exam v2's 102 races only when picked). */
const sequence = challenges.filter((c) => c.kind !== "exam");

for (const info of SHOWCASE_MODELS) {
  const option = document.createElement("option");
  option.value = info.id;
  option.textContent = info.label;
  modelSelect.append(option);
}
modelSelect.value = showcaseModelInfo(params.get("model") ?? "") ? params.get("model")! : ACCEPTED_MODEL;

let model: MajorTom = loadShowcaseModel(modelSelect.value)!;
let viewer: ReplayViewer | undefined;
let current = Math.max(
  0,
  challenges.findIndex((c) => c.id === params.get("challenge")),
);
let speed = 1;
let shown = 0;
/** Watched results of the current model: finished races or runs per challenge and segment. */
let watched = new Map<string, Map<number, ChallengeResult>>();
/** Headless results: model → challenge → result. */
const headless = new Map<string, Map<string, ChallengeResult>>();
let finishedAt: number | undefined;

// --- the challenge list ----------------------------------------------------------------------

const cells = new Map<
  string,
  { row: HTMLTableRowElement; live: HTMLTableCellElement; full: HTMLTableCellElement }
>();
for (const [i, challenge] of challenges.entries()) {
  const row = rows.insertRow();
  const name = row.insertCell();
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = challenge.label;
  button.title = challenge.description;
  button.addEventListener("click", () => void show(i));
  name.append(button);
  const kind = document.createElement("small");
  kind.textContent = ` ${challenge.kind}`;
  name.append(kind);
  cells.set(challenge.id, { row, live: row.insertCell(), full: row.insertCell() });
}

function short(r: ChallengeResult | undefined, c: Challenge, flying = false): string {
  if (!r) return "–";
  if (flying) return `flying… ${r.reached}/${r.total} · ${r.crashes} cr.`;
  if (c.kind === "track")
    return `${r.reached}/${r.total}${r.completed ? ` ✓ ${r.seconds.toFixed(1)} s` : " ✗"} · ${r.crashes} cr.`;
  const pct = r.total ? Math.round((100 * r.reached) / r.total) : 0;
  return c.kind === "skill"
    ? `${pct} % · ${r.crashes} cr.`
    : `${pct} % cp · ${r.completed}/${r.runs} fin. · ${r.crashes} cr.`;
}

function watchedResult(c: Challenge): ChallengeResult | undefined {
  const parts = watched.get(c.id);
  if (!parts || parts.size === 0) return undefined;
  return [...parts.values()].reduce(mergeResults);
}

function refreshList(): void {
  for (const [i, c] of challenges.entries()) {
    const cell = cells.get(c.id)!;
    cell.row.classList.toggle("current", i === current);
    const live = watchedResult(c);
    const text = short(live, c, i === current && viewer?.controller.replay?.done === false);
    if (cell.live.textContent !== text) cell.live.textContent = text;
    cell.live.title = live ? formatResult(live, c.kind) : "";
    const full = headless.get(modelSelect.value)?.get(c.id);
    const fullText = short(full, c);
    if (cell.full.textContent !== fullText) cell.full.textContent = fullText;
    cell.full.title = full ? formatResult(full, c.kind) : "";
  }
}

function about(): void {
  const info = showcaseModelInfo(modelSelect.value)!;
  const exam = info.exam
    ? ` Training exam v2: ${(100 * info.exam.checkpoints).toFixed(1)} % of checkpoints, ` +
      `${(100 * info.exam.finished).toFixed(1)} % of races finished, ${info.exam.crashes} crashes.`
    : "";
  $("about").textContent = `${info.role}. Setup: ${info.setup}.${exam}`;
  const race = $<HTMLAnchorElement>("race");
  race.href =
    info.id === "default" ? "singleplayer.html" : `singleplayer.html?opponent=${encodeURIComponent(info.id)}`;
}

// --- watching ----------------------------------------------------------------------------------

async function show(index: number): Promise<void> {
  const call = ++shown;
  if (viewer) speed = viewer.controller.speed;
  viewer?.destroy();
  viewer = undefined;
  finishedAt = undefined;
  current = Math.max(0, Math.min(challenges.length - 1, index));
  const challenge = challenges[current]!;
  const url = new URL(location.href);
  url.searchParams.set("model", modelSelect.value);
  url.searchParams.set("challenge", challenge.id);
  history.replaceState(null, "", url);
  status.textContent = `${current + 1}/${challenges.length} · ${challenge.description}`;
  refreshList();
  const mounted = await mountReplayViewer(host, challenge.source(model), {
    title: `${modelSelect.value} · ${challenge.label}`,
    speed,
    inputs: false,
  });
  if (call !== shown) {
    mounted.destroy();
    return;
  }
  viewer = mounted;
  cells.get(challenge.id)?.row.scrollIntoView({ block: "nearest" });
}

/** Records what the viewer shows and moves on when a challenge is done (with "play all"). */
function poll(): void {
  const v = viewer;
  const replay = v?.controller.replay;
  if (!v || !replay) return;
  const challenge = challenges[current]!;
  const segment = challenge.kind === "skill" ? 0 : v.controller.segment;
  let parts = watched.get(challenge.id);
  if (!parts) watched.set(challenge.id, (parts = new Map()));
  parts.set(segment, replayResult(challenge.id, replay));
  refreshList();
  if (!replay.done || !autoplay.checked || !v.controller.playing) {
    finishedAt = undefined;
    return;
  }
  finishedAt ??= performance.now();
  if (performance.now() - finishedAt < 1500) return;
  finishedAt = undefined;
  if (challenge.kind !== "skill" && v.controller.segment < challenge.segments - 1) {
    void v.controller.next();
    return;
  }
  const next = sequence.indexOf(challenge) + 1;
  if (next > 0 && next < sequence.length) void show(challenges.indexOf(sequence[next]!));
}
setInterval(poll, 250);

modelSelect.addEventListener("change", () => {
  model = loadShowcaseModel(modelSelect.value)!;
  watched = new Map();
  about();
  void show(current);
});
$<HTMLFormElement>("form").addEventListener("submit", (e) => e.preventDefault());

// --- headless results --------------------------------------------------------------------------

const summary = $<HTMLTableElement>("summary");
function drawSummary(): void {
  summary.replaceChildren();
  const head = summary.createTHead().insertRow();
  head.insertCell().textContent = "Challenge";
  for (const info of SHOWCASE_MODELS) {
    const th = document.createElement("th");
    th.textContent = info.id;
    th.title = info.label;
    head.append(th);
  }
  const body = summary.createTBody();
  for (const c of challenges) {
    const row = body.insertRow();
    row.insertCell().textContent = c.label;
    for (const info of SHOWCASE_MODELS) {
      const r = headless.get(info.id)?.get(c.id);
      const cell = row.insertCell();
      cell.textContent = short(r, c);
      cell.title = r ? formatResult(r, c.kind) : "";
    }
  }
}
drawSummary();

const worker = new Worker(new URL("./showcase-worker.ts", import.meta.url), { type: "module" });
worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const m = event.data;
  const summaryStatus = $("summary-status");
  if (m.type === "result") {
    let byChallenge = headless.get(m.model);
    if (!byChallenge) headless.set(m.model, (byChallenge = new Map()));
    byChallenge.set(m.result.id, m.result);
    summaryStatus.textContent = `Computing… ${m.model}: ${m.result.id} done`;
    drawSummary();
    refreshList();
  } else if (m.type === "progress")
    summaryStatus.textContent = `Computing… ${m.model}: ${m.challenge} ${m.done}/${m.of}`;
  else if (m.type === "done")
    summaryStatus.textContent =
      "Every model through every challenge, simulated in the background: tracks seed 1, 180 s; " +
      "skills: the skills exam's 8 episodes; exam v2: 102 races. cr. = crashes.";
  else summaryStatus.textContent = `Headless run failed: ${m.message}`;
};
worker.postMessage({ first: modelSelect.value } satisfies WorkerRequest);

about();
await show(current);

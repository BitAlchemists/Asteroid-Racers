/**
 * evo-lab renderer plugin (UI plugin contract v1, see evo-lab's ui/plugin.js) for Asteroid Racers.
 *
 * - Training runs: a snapshot (gens/gNNNN.json, model-snapshot/v1) holds the winner and a trace of
 *   its flights. `thumb` draws the trace; `render` re-simulates the generation's episodes with that
 *   model in the replay viewer (exactly what was measured: same config, seed and generation).
 * - Exam runs: a snapshot (exam-snapshot/v1) names the source run and holds each flight's trace.
 *   `render` fetches the model from the source run and replays the exam flights.
 */
import { mountReplayViewer, type ReplayViewer } from "@ar/client";
import {
  arenaReplaySource,
  bundledModels,
  DEFAULT_MODEL_NAME,
  examFlights,
  examReplaySource,
  examPerception,
  modelFromJson,
  parseArenas,
  parseExamConfig,
  type ArenaTrace,
  type CollisionMode,
  type CrashMode,
  type FlightTrace,
  type MajorTom,
  type ReplaySource,
} from "@ar/server";
import { Level, setLogLevel } from "@ar/shared";
import { curriculumLevel, levelLabel, type CurriculumLevel } from "./level";

setLogLevel("", Level.WARNING);

export const apiVersion = 1;

interface PluginContext {
  run: string;
  method: string;
  g: number;
  label?: string;
  kind?: "snapshot" | "specimen" | "frame";
  mode?: "filmstrip" | "detail" | "compare" | "live";
  size?: "thumb" | "large";
  width?: number;
  height?: number;
  theme?: "light" | "dark";
  config?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  api: { url(path: string): string; fetchJson(path: string): Promise<unknown> };
}

interface TrainSnapshot {
  format?: string;
  g?: number;
  score?: number;
  model?: unknown;
  trace?: ArenaTrace[];
  /** With a curriculum: the arenas (at this generation's level) the generation flew. */
  arenas?: unknown;
}

interface ExamSnapshot {
  format: "asteroid-racers/exam-snapshot/v1";
  sourceRun: string;
  g: number;
  score: number;
  flights: FlightTrace[];
}

const isExam = (data: unknown): data is ExamSnapshot =>
  typeof data === "object" &&
  data !== null &&
  (data as { format?: string }).format === "asteroid-racers/exam-snapshot/v1";

// --- thumbnails: static drawings of the traces ---------------------------------------------------

const GREEN = "#3c3";
const RED = "#e44";
const PATH = "rgba(140, 200, 255, 0.9)";

interface Drawing {
  /** [x, y, radius, colour] */
  circles: [number, number, number, string][];
  paths: number[][];
  /** Grey dots (obstacles). */
  dots: [number, number, number][];
}

function drawingOfTrain(trace: ArenaTrace[]): Drawing[] {
  return trace.map((arena) => ({
    circles: arena.episodes.flatMap((e) =>
      e.targets.map(([x, y, r], i): [number, number, number, string] => [
        x,
        y,
        r,
        i < e.reached ? GREEN : RED,
      ]),
    ),
    paths: arena.episodes.map((e) => e.path),
    dots: arena.obstacles,
  }));
}

function drawingOfExam(flights: FlightTrace[]): Drawing[] {
  return flights.map((f) => ({
    circles: f.checkpoints
      .slice(1) // checkpoint 0 is the portal
      .map(([x, y, r], i): [number, number, number, string] => [x, y, r, i < f.reached ? GREEN : RED]),
    paths: [f.path],
    dots: [],
  }));
}

/** Draws each drawing into its own cell of a grid, every cell fitted to its own bounds. */
function paint(canvas: HTMLCanvasElement, drawings: Drawing[]): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  const cols = Math.ceil(Math.sqrt(drawings.length));
  const rows = Math.ceil(drawings.length / cols);
  const cw = width / cols;
  const ch = height / rows;
  drawings.forEach((d, i) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const grow = (x: number, y: number, r = 0) => {
      minX = Math.min(minX, x - r);
      maxX = Math.max(maxX, x + r);
      minY = Math.min(minY, y - r);
      maxY = Math.max(maxY, y + r);
    };
    for (const [x, y, r] of d.circles) grow(x, y, r);
    for (const path of d.paths) for (let k = 0; k < path.length; k += 2) grow(path[k]!, path[k + 1]!);
    if (!Number.isFinite(minX)) return;
    const pad = 4;
    const scale = Math.min(
      (cw - 2 * pad) / Math.max(1, maxX - minX),
      (ch - 2 * pad) / Math.max(1, maxY - minY),
    );
    const ox = (i % cols) * cw + pad + (cw - 2 * pad - (maxX - minX) * scale) / 2;
    const oy = Math.floor(i / cols) * ch + pad + (ch - 2 * pad - (maxY - minY) * scale) / 2;
    const X = (x: number) => ox + (x - minX) * scale;
    const Y = (y: number) => oy + (y - minY) * scale;
    ctx.fillStyle = "rgba(120,120,120,0.6)";
    for (const [x, y, r] of d.dots) {
      if (x < minX || x > maxX || y < minY || y > maxY) continue;
      ctx.beginPath();
      ctx.arc(X(x), Y(y), Math.max(0.5, r * scale), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = PATH;
    for (const path of d.paths) {
      ctx.beginPath();
      for (let k = 0; k < path.length; k += 2) {
        if (k === 0) ctx.moveTo(X(path[k]!), Y(path[k + 1]!));
        else ctx.lineTo(X(path[k]!), Y(path[k + 1]!));
      }
      ctx.stroke();
    }
    for (const [x, y, r, color] of d.circles) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(X(x), Y(y), Math.max(2, r * scale), 0, Math.PI * 2);
      ctx.stroke();
    }
  });
}

function drawingsOf(data: unknown): Drawing[] | undefined {
  if (isExam(data)) return drawingOfExam(data.flights);
  const trace = (data as TrainSnapshot | undefined)?.trace;
  return Array.isArray(trace) ? drawingOfTrain(trace) : undefined;
}

/** The curriculum level of a training snapshot (or gen event), when the run has one. */
function levelOf(data: unknown, ctx: PluginContext): CurriculumLevel | undefined {
  if (isExam(data)) return undefined;
  return curriculumLevel(ctx.config, (data as TrainSnapshot | undefined)?.arenas, ctx.metrics);
}

/** A small "L2/5" badge in the top-left corner of a thumbnail. */
function badge(canvas: HTMLCanvasElement, text: string): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const px = Math.max(9, Math.round(canvas.height / 9));
  ctx.font = `600 ${px}px system-ui,sans-serif`;
  const pad = Math.round(px * 0.3);
  const w = ctx.measureText(text).width + 2 * pad;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(pad, pad, w, px + 2 * pad);
  ctx.fillStyle = "#fe6";
  ctx.textBaseline = "top";
  ctx.fillText(text, 2 * pad, 2 * pad);
}

function message(el: HTMLElement, text: string): void {
  const div = document.createElement("div");
  div.style.cssText = "padding:8px;font:12px system-ui,sans-serif;opacity:.75;text-align:center";
  div.textContent = text;
  el.append(div);
}

export function thumb(el: HTMLElement, data: unknown, ctx: PluginContext): void {
  const drawings = drawingsOf(data);
  const level = levelOf(data, ctx);
  if (!drawings) {
    const score = (data as TrainSnapshot | undefined)?.score ?? ctx.metrics?.score;
    const text = typeof score === "number" ? `score ${Math.round(score)}` : `g ${ctx.g}`;
    message(el, level ? `${text} · ${levelLabel(level)}` : text);
    return;
  }
  const canvas = document.createElement("canvas");
  // evo-lab may pass 0 for thumbnails: fall back to the element's size, then to 120 × 90.
  const width = (ctx.width ?? 0) > 0 ? ctx.width! : el.clientWidth || 120;
  const height = (ctx.height ?? 0) > 0 ? ctx.height! : el.clientHeight || Math.round(width * 0.75);
  canvas.width = Math.round(width * devicePixelRatio);
  canvas.height = Math.round(height * devicePixelRatio);
  canvas.style.cssText = "display:block;width:100%;height:100%";
  el.append(canvas);
  paint(canvas, drawings);
  if (level) badge(canvas, `L${level.index + 1}/${level.count}`);
}

// --- full view: the replay viewer ------------------------------------------------------------

/** The run's seed from its manifest (scenario seeds derive from it). */
async function runSeed(ctx: PluginContext): Promise<number> {
  const manifest = (await ctx.api.fetchJson(`/api/runs/${ctx.run}`)) as {
    run?: { seed?: number };
    seed?: number;
  };
  const seed = manifest.run?.seed ?? manifest.seed;
  if (typeof seed !== "number") throw new Error(`run ${ctx.run} has no seed in its manifest`);
  return seed;
}

/** The model an exam examined: the source run's snapshot for g, or its result.json winner. */
async function sourceModel(ctx: PluginContext, snapshot: ExamSnapshot): Promise<MajorTom> {
  if (snapshot.sourceRun === "bundled") return bundledModels().load(DEFAULT_MODEL_NAME)![0]!;
  const tries = [
    `/api/runs/${snapshot.sourceRun}/gens/${snapshot.g}`,
    `/api/runs/${snapshot.sourceRun}/result`,
  ];
  for (const path of tries) {
    try {
      const json = (await ctx.api.fetchJson(path)) as Record<string, unknown>;
      // evo-lab may wrap a file in an envelope; look for the model at the top or one level down.
      for (const candidate of [json, json.snapshot, json.result, json.data, json.file]) {
        try {
          if (candidate) return modelFromJson(candidate, path);
        } catch {
          // not here
        }
      }
    } catch {
      // try the next source
    }
  }
  throw new Error(`no model for g ${snapshot.g} in run ${snapshot.sourceRun}`);
}

async function sourceFor(
  data: unknown,
  ctx: PluginContext,
): Promise<{ source: ReplaySource; first: number; title: string }> {
  const config = ctx.config ?? {};
  if (isExam(data)) {
    const model = await sourceModel(ctx, data);
    const { model: _bundled, ...examConfig } = config;
    const exam = parseExamConfig(examConfig);
    const first = Math.max(
      0,
      data.flights.findIndex((f) => !f.finished),
    );
    return {
      source: examReplaySource(model, examFlights(exam), exam.timeLimitSeconds, 0.015, examPerception(exam)),
      first,
      title: `${data.sourceRun} · g${data.g}`,
    };
  }
  const snapshot = data as TrainSnapshot;
  if (!snapshot?.model)
    throw new Error("this generation has no snapshot (snapshots are saved every snapshotEvery generations)");
  const model = modelFromJson(snapshot.model, "the snapshot");
  const seed = await runSeed(ctx);
  // Configs from before the rename say `brain`; the replay does not need the model section.
  const episodes = (snapshot.trace ?? []).flatMap((a) => a.episodes);
  const firstFailed = episodes.findIndex((e) => e.reached < e.targets.length);
  const level = levelOf(data, ctx);
  return {
    source: arenaReplaySource({
      model,
      arenas: parseArenas(snapshot.arenas ?? config.arenas),
      frames: typeof config.frames === "number" ? config.frames : 600,
      collisions: (config.collisions as CollisionMode | undefined) ?? "none",
      crashMode: (config.crashMode as CrashMode | undefined) ?? "end",
      ...(typeof config.crashLimit === "number" ? { crashLimit: config.crashLimit } : {}),
      ...(typeof config.inputDelay === "number" ? { inputDelay: config.inputDelay } : {}),
      ...(typeof config.inputNoise === "number" ? { inputNoise: config.inputNoise } : {}),
      seed,
      g: ctx.g,
    }),
    first: Math.max(0, firstFailed),
    title: `${ctx.run} · g${ctx.g}${level ? ` · ${levelLabel(level)}` : ""}`,
  };
}

export function render(el: HTMLElement, data: unknown, ctx: PluginContext): () => void {
  if (ctx.size === "thumb" || ctx.mode === "filmstrip") {
    thumb(el, data, ctx);
    return () => {};
  }
  const host = document.createElement("div");
  const width = ctx.width && ctx.width > 0 ? ctx.width : el.clientWidth || 640;
  const height = ctx.height && ctx.height > 0 ? ctx.height : Math.round(width * 0.6);
  host.style.cssText = `position:relative;width:100%;height:${Math.max(240, Math.min(height, 720))}px`;
  el.append(host);
  let viewer: ReplayViewer | undefined;
  let closed = false;
  void (async () => {
    try {
      const { source, first, title } = await sourceFor(data, ctx);
      if (closed) return;
      viewer = await mountReplayViewer(host, source, {
        segment: first,
        title,
        compact: ctx.mode === "compare",
        camera: "overview",
      });
      if (closed) viewer.destroy();
    } catch (error) {
      if (!closed) message(host, error instanceof Error ? error.message : String(error));
    }
  })();
  return () => {
    closed = true;
    viewer?.destroy();
    host.remove();
  };
}

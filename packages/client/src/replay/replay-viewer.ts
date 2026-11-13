import type { ReplayInputs, ReplaySource } from "@ar/server";
import { Application } from "pixi.js";
import { ReplayController, SPEEDS } from "./replay-controller";
import { ReplayView, type CameraMode } from "./replay-view";

export interface ReplayViewerOptions {
  /** Start playing right away (default true). */
  autoplay?: boolean;
  /** Initial speed (default 1). */
  speed?: number;
  /** Segment to open first (default 0). */
  segment?: number;
  /** Hide the controls bar (thumbnails, leader cards). The HUD line stays. */
  compact?: boolean;
  camera?: CameraMode;
  /** Shown in the HUD before the segment label, e.g. "train-4 · g110". */
  title?: string;
  /** Show the model inputs panel (default: on, off when compact). */
  inputs?: boolean;
}

export interface ReplayViewer {
  readonly controller: ReplayController;
  /** Stops the loop and listeners, destroys the canvas and the replay. Safe to call twice. */
  destroy(): void;
}

const CSS = `
.ar-replay{position:relative;width:100%;height:100%;min-height:200px;background:#000;color:#cfe;font:12px/1.4 system-ui,sans-serif;overflow:hidden;outline:none}
.ar-replay:focus-visible{box-shadow:inset 0 0 0 2px #4af}
.ar-replay canvas{position:absolute;inset:0;width:100%!important;height:100%!important;display:block}
.ar-replay .ar-hud{position:absolute;left:8px;top:6px;right:8px;pointer-events:none;text-shadow:0 0 3px #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ar-replay .ar-hud .ar-goal{color:#fe6}
.ar-replay .ar-bar{position:absolute;left:0;right:0;bottom:0;display:flex;gap:6px;align-items:center;padding:6px 8px;background:rgba(0,0,0,.65);flex-wrap:wrap}
.ar-replay button,.ar-replay select{background:#123;color:#cfe;border:1px solid #345;border-radius:4px;padding:2px 8px;font:inherit;cursor:pointer;min-height:24px}
.ar-replay button:hover{background:#234}
.ar-replay input[type=range]{flex:1;min-width:80px}
.ar-replay .ar-seg{max-width:220px}
.ar-replay .ar-inputs{position:absolute;right:8px;top:44px;max-height:calc(100% - 96px);overflow:auto;padding:4px 6px;background:rgba(0,0,0,.6);border:1px solid #234;border-radius:4px;font:10px/1.25 ui-monospace,Consolas,monospace;text-shadow:none}
.ar-replay.ar-compact .ar-inputs{top:40px;max-height:calc(100% - 48px)}
.ar-replay .ar-inputs h4{margin:2px 0;font:inherit;color:#8ab;font-weight:600}
.ar-replay .ar-in{display:grid;grid-template-columns:auto 64px 38px;gap:5px;align-items:center;white-space:nowrap}
.ar-replay .ar-in-bar{position:relative;height:7px;background:#123;border-radius:2px}
.ar-replay .ar-in-bar::before{content:"";position:absolute;left:50%;top:-1px;bottom:-1px;width:1px;background:#567}
.ar-replay .ar-in.ar-unipolar .ar-in-bar::before{left:0}
.ar-replay .ar-in-fill{position:absolute;top:0;bottom:0;background:#4af;border-radius:2px}
.ar-replay .ar-in-val{text-align:right;color:#9bc}
.ar-replay .ar-in.ar-clip .ar-in-fill{background:#f84}
.ar-replay .ar-in.ar-clip .ar-in-val{color:#f84}
`;

function ensureStyle(doc: Document): void {
  if (doc.getElementById("ar-replay-style")) return;
  const style = doc.createElement("style");
  style.id = "ar-replay-style";
  style.textContent = CSS;
  doc.head.append(style);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] {
  const e = Object.assign(document.createElement(tag), props);
  parent?.append(e);
  return e;
}

/**
 * Mounts a replay viewer into `parent`: a PixiJS canvas with a HUD line and (unless compact) a
 * controls bar. Keyboard shortcuts work only while the viewer has focus: space play/pause, ← →
 * previous/next segment, + − speed, c camera, s sensors, t all targets, i inputs, r restart, mouse
 * wheel zoom.
 */
export async function mountReplayViewer(
  parent: HTMLElement,
  source: ReplaySource,
  options: ReplayViewerOptions = {},
): Promise<ReplayViewer> {
  ensureStyle(parent.ownerDocument);
  const root = el("div", { className: "ar-replay", tabIndex: 0 }, parent);
  const hud = el("div", { className: "ar-hud" }, root);
  const controller = new ReplayController(source, {
    autoplay: options.autoplay ?? true,
    speed: options.speed ?? 1,
  });
  const cleanups: (() => void)[] = [];
  let destroyed = false;
  /** Set once the canvas exists (closures above read them before that). */
  const ui: { app?: Application; view?: ReplayView } = {};

  const viewer: ReplayViewer = {
    controller,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const cleanup of cleanups.splice(0)) cleanup();
      controller.dispose();
      ui.view?.destroy();
      ui.app?.destroy(true, { children: true });
      root.remove();
    },
  };

  const listen = <T extends Event>(
    target: EventTarget,
    type: string,
    handler: (e: T) => void,
    opts?: AddEventListenerOptions,
  ) => {
    target.addEventListener(type, handler as EventListener, opts);
    cleanups.push(() => target.removeEventListener(type, handler as EventListener, opts));
  };

  // --- controls ---
  let play: HTMLButtonElement | undefined;
  let segmentSelect: HTMLSelectElement | undefined;
  let speedSelect: HTMLSelectElement | undefined;
  let slider: HTMLInputElement | undefined;
  let cameraButton: HTMLButtonElement | undefined;
  let sensorsButton: HTMLButtonElement | undefined;
  let targetsButton: HTMLButtonElement | undefined;
  let inputsButton: HTMLButtonElement | undefined;
  let sliding = false;
  const inputsPanel = new InputsPanel(root);
  inputsPanel.visible = options.inputs ?? !options.compact;
  if (options.compact) root.classList.add("ar-compact");
  if (!options.compact) {
    const bar = el("div", { className: "ar-bar" }, root);
    const button = (text: string, title: string, onClick: () => void) => {
      const b = el("button", { textContent: text, title, type: "button" }, bar);
      listen(b, "click", () => {
        onClick();
        root.focus();
      });
      return b;
    };
    button("⏮", "Previous (←)", () => void controller.previous());
    play = button("⏸", "Play/pause (space)", () => controller.toggle());
    button("⏭", "Next (→)", () => void controller.next());
    button("↺", "Restart (r)", () => void controller.restart());
    segmentSelect = el("select", { className: "ar-seg", title: "Episode or flight" }, bar);
    source.segments.forEach((label, i) =>
      el("option", { value: String(i), textContent: label }, segmentSelect),
    );
    listen(segmentSelect, "change", () => void controller.open(Number(segmentSelect!.value)));
    speedSelect = el("select", { title: "Speed (+ −)" }, bar);
    for (const s of SPEEDS) el("option", { value: String(s), textContent: `${s}×` }, speedSelect);
    listen(speedSelect, "change", () => controller.setSpeed(Number(speedSelect!.value)));
    cameraButton = button("", "Camera (c)", () => toggleCamera());
    sensorsButton = button("Sensors", "Show sensors (s)", () => toggleSensors());
    targetsButton = button("All targets", "Show the other episodes' targets too (t)", () => toggleTargets());
    inputsButton = button("Inputs", "Show the model's inputs and outputs (i)", () => toggleInputs());
    slider = el("input", { type: "range", min: "0", value: "0", title: "Time" }, bar);
    listen(slider, "input", () => (sliding = true));
    listen(slider, "change", () => {
      sliding = false;
      void controller.seek(Number(slider!.value));
    });
  }

  const toggleCamera = () => {
    if (ui.view) ui.view.camera = ui.view.camera === "follow" ? "overview" : "follow";
  };
  const toggleSensors = () => {
    if (ui.view) ui.view.showSensors = !ui.view.showSensors;
  };
  const toggleTargets = () => {
    if (ui.view) ui.view.showAllTargets = !ui.view.showAllTargets;
  };
  const toggleInputs = () => {
    inputsPanel.visible = !inputsPanel.visible;
  };

  listen<KeyboardEvent>(root, "keydown", (e) => {
    const actions: Record<string, () => void> = {
      " ": () => controller.toggle(),
      ArrowLeft: () => void controller.previous(),
      ArrowRight: () => void controller.next(),
      "+": () => controller.faster(),
      "=": () => controller.faster(),
      "-": () => controller.slower(),
      c: () => toggleCamera(),
      r: () => void controller.restart(),
      s: () => toggleSensors(),
      t: () => toggleTargets(),
      i: () => toggleInputs(),
    };
    const action = actions[e.key];
    if (!action || (e.target as HTMLElement).tagName === "SELECT") return;
    e.preventDefault();
    action();
  });
  listen<WheelEvent>(
    root,
    "wheel",
    (e) => {
      if (!ui.view || ui.view.camera !== "follow") return;
      e.preventDefault();
      ui.view.zoom = Math.min(4, Math.max(0.05, ui.view.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    },
    { passive: false },
  );

  controller.onChange = () => ui.view?.resetTrail();

  const updateHud = () => {
    const replay = controller.replay;
    if (!replay) {
      hud.textContent = "Loading…";
      return;
    }
    const s = replay.status();
    const label = source.segments[controller.segment] ?? "";
    const what = s.kind === "episode" ? "targets" : "checkpoints";
    hud.textContent =
      `${options.title ? `${options.title} · ` : ""}${label} · ${s.seconds.toFixed(1)} s · ` +
      `${what} ${s.reached}/${s.total} · crashes ${s.crashes}${s.done ? " · done" : ""}` +
      `${controller.speed !== 1 ? ` · ${controller.speed}×` : ""}`;
    const goal = el("div", { className: "ar-goal" }, hud);
    goal.textContent =
      s.done && s.reached >= s.total
        ? `goal reached: all ${s.total} ${what}`
        : s.kind === "episode"
          ? `goal: fly from the white cross to the yellow target without crashing · ${s.reached} of ${s.total} reached`
          : `goal: race through the checkpoints in order, next one yellow · ${s.reached} of ${s.total} reached`;
    if (play) play.textContent = controller.playing && !replay.done ? "⏸" : "▶";
    if (segmentSelect && document.activeElement !== segmentSelect)
      segmentSelect.value = String(controller.segment);
    if (speedSelect && document.activeElement !== speedSelect) speedSelect.value = String(controller.speed);
    if (cameraButton && ui.view)
      cameraButton.textContent = ui.view.camera === "follow" ? "Follow" : "Overview";
    if (sensorsButton && ui.view) sensorsButton.style.opacity = ui.view.showSensors ? "1" : "0.5";
    if (targetsButton && ui.view) targetsButton.style.opacity = ui.view.showAllTargets ? "1" : "0.5";
    if (inputsButton) inputsButton.style.opacity = inputsPanel.visible ? "1" : "0.5";
    inputsPanel.update(replay.inputs?.());
    if (slider && !sliding) {
      slider.max = String(controller.segmentLength);
      slider.value = String(controller.segmentFrame);
    }
  };
  hud.textContent = "Loading…";

  // --- canvas ---
  const pixi = new Application();
  await pixi.init({ background: "#000000", resizeTo: root, antialias: true, autoStart: false });
  if (destroyed) {
    pixi.destroy(true, { children: true });
    return viewer;
  }
  ui.app = pixi;
  root.prepend(pixi.canvas);
  const view = new ReplayView(pixi);
  ui.view = view;
  view.camera = options.camera ?? "follow";
  pixi.ticker.add((ticker) => {
    const dt = Math.min(0.1, ticker.deltaMS / 1000);
    controller.update(dt);
    view.render(controller.replay, dt);
    updateHud();
  });
  pixi.start();
  await controller.open(options.segment ?? 0);
  return viewer;
}

/** Fill of a bar for `value` over `min..max` (as CSS left/width in %), clipped; `clipped` if outside. */
export function barFill(
  value: number,
  min: number,
  max: number,
): { left: number; width: number; clipped: boolean } {
  const clipped = !(value >= min && value <= max); // NaN counts as clipped
  const v = Number.isNaN(value) ? 0 : Math.min(max, Math.max(min, value));
  const zero = Math.min(max, Math.max(min, 0));
  const at = (x: number) => ((x - min) / (max - min)) * 100;
  return { left: at(Math.min(v, zero)), width: Math.abs(at(v) - at(zero)), clipped };
}

interface InputRow {
  row: HTMLDivElement;
  fill: HTMLDivElement;
  value: HTMLSpanElement;
  min: number;
  max: number;
}

/**
 * The model inputs panel: one row per input neuron (name, a bar over −1..1, the value; values
 * outside are clipped and marked) and the two outputs (thrust 0..1, turn −1..1). Rows are built
 * when the input names change; every frame only updates bars and numbers.
 */
class InputsPanel {
  private readonly el: HTMLDivElement;
  private names: readonly string[] | undefined;
  private inputs: InputRow[] = [];
  private outputs: InputRow[] = [];
  private empty: HTMLDivElement | undefined;

  constructor(root: HTMLElement) {
    this.el = el("div", { className: "ar-inputs" }, root);
  }

  get visible(): boolean {
    return !this.el.hidden;
  }
  set visible(on: boolean) {
    this.el.hidden = !on;
  }

  private row(parent: HTMLElement, name: string, min: number, max: number, title?: string): InputRow {
    const row = el("div", { className: min === 0 ? "ar-in ar-unipolar" : "ar-in" }, parent);
    el("span", { textContent: name, title: title ?? name }, row);
    const bar = el("div", { className: "ar-in-bar" }, row);
    const fill = el("div", { className: "ar-in-fill" }, bar);
    const value = el("span", { className: "ar-in-val" }, row);
    return { row, fill, value, min, max };
  }

  private build(names: readonly string[]): void {
    this.el.replaceChildren();
    this.empty = undefined;
    this.names = names;
    el("h4", { textContent: `inputs (${names.length})` }, this.el);
    this.inputs = names.map((name) => this.row(this.el, name, -1, 1));
    el("h4", { textContent: "outputs" }, this.el);
    this.outputs = [
      this.row(this.el, "thrust", 0, 1, "thrust 0..1 (tanh output mapped from −1..1)"),
      this.row(this.el, "turn", -1, 1, "turn rate −1..1 (× 5 rad/s)"),
    ];
  }

  private static show(r: InputRow, v: number): void {
    const { left, width, clipped } = barFill(v, r.min, r.max);
    r.fill.style.left = `${left}%`;
    r.fill.style.width = `${width}%`;
    r.row.classList.toggle("ar-clip", clipped);
    const text = Number.isFinite(v) ? v.toFixed(2) : String(v);
    if (r.value.textContent !== text) r.value.textContent = text;
  }

  update(inputs: ReplayInputs | undefined): void {
    if (this.el.hidden) return;
    if (!inputs) {
      if (!this.empty) {
        this.el.replaceChildren();
        this.names = undefined;
        this.empty = el("div", { textContent: "inputs: not available yet" }, this.el);
      }
      return;
    }
    if (inputs.names !== this.names) this.build(inputs.names);
    for (let i = 0; i < this.inputs.length; i++) InputsPanel.show(this.inputs[i]!, inputs.values[i] ?? NaN);
    const [thrust, turn] = [inputs.outputs[0] ?? NaN, inputs.outputs[1] ?? NaN];
    InputsPanel.show(this.outputs[0]!, (thrust + 1) / 2);
    InputsPanel.show(this.outputs[1]!, turn);
  }
}

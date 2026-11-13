import type { ReplaySource } from "@ar/server";
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
.ar-replay .hud{position:absolute;left:8px;top:6px;right:8px;pointer-events:none;text-shadow:0 0 3px #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ar-replay .bar{position:absolute;left:0;right:0;bottom:0;display:flex;gap:6px;align-items:center;padding:6px 8px;background:rgba(0,0,0,.65);flex-wrap:wrap}
.ar-replay button,.ar-replay select{background:#123;color:#cfe;border:1px solid #345;border-radius:4px;padding:2px 8px;font:inherit;cursor:pointer;min-height:24px}
.ar-replay button:hover{background:#234}
.ar-replay input[type=range]{flex:1;min-width:80px}
.ar-replay .seg{max-width:220px}
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
 * previous/next segment, + − speed, c camera, r restart, mouse wheel zoom.
 */
export async function mountReplayViewer(
  parent: HTMLElement,
  source: ReplaySource,
  options: ReplayViewerOptions = {},
): Promise<ReplayViewer> {
  ensureStyle(parent.ownerDocument);
  const root = el("div", { className: "ar-replay", tabIndex: 0 }, parent);
  const hud = el("div", { className: "hud" }, root);
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
  let sliding = false;
  if (!options.compact) {
    const bar = el("div", { className: "bar" }, root);
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
    segmentSelect = el("select", { className: "seg", title: "Episode or flight" }, bar);
    source.segments.forEach((label, i) =>
      el("option", { value: String(i), textContent: label }, segmentSelect),
    );
    listen(segmentSelect, "change", () => void controller.open(Number(segmentSelect!.value)));
    speedSelect = el("select", { title: "Speed (+ −)" }, bar);
    for (const s of SPEEDS) el("option", { value: String(s), textContent: `${s}×` }, speedSelect);
    listen(speedSelect, "change", () => controller.setSpeed(Number(speedSelect!.value)));
    cameraButton = button("", "Camera (c)", () => toggleCamera());
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
    if (play) play.textContent = controller.playing && !replay.done ? "⏸" : "▶";
    if (segmentSelect && document.activeElement !== segmentSelect)
      segmentSelect.value = String(controller.segment);
    if (speedSelect && document.activeElement !== speedSelect) speedSelect.value = String(controller.speed);
    if (cameraButton && ui.view)
      cameraButton.textContent = ui.view.camera === "follow" ? "Follow" : "Overview";
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

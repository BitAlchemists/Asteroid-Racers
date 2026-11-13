import { EntityType, Movable, type Entity } from "@ar/shared";
import type { Replay } from "@ar/server";
import { Container, Graphics, type Application } from "pixi.js";
import { Color } from "../render/colors";
import { StarField } from "../render/scenery";
import { createArrows, createFinishCircle, drawAsteroid, drawSpaceship } from "../render/shapes";

export type CameraMode = "follow" | "overview";

/** Seeded per entity, so an asteroid keeps its shape when its node is rebuilt. */
function shapeRandom(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Node {
  root: Container;
  body: Container;
  /** For checkpoints: the ring, redrawn when its colour changes. */
  ring?: Graphics;
  color?: number;
}

const TRAIL_POINTS = 1500;
/** A jump longer than this between two frames is a teleport (episode start, respawn): the trail breaks. */
const TELEPORT_DISTANCE = 300;

/**
 * Draws a replay's world (`replay.server.world`) with the game's shapes: asteroids, checkpoints
 * (the current target yellow; in races, cleared ones green), the race portal, arrows, the finish
 * and the ship with its trail. The camera follows the ship or frames the whole scenario.
 */
export class ReplayView {
  readonly world = new Container();
  private readonly stars = new StarField(4000, 4000);
  private readonly nodes = new Map<number, Node>();
  private readonly trail = new Graphics();
  /** What the model's obstacle sensors see, redrawn every frame above the trail. */
  private readonly sensorLayer = new Graphics();
  /** A screen-size dot on the ship, so it stays visible when the camera is far out. */
  private readonly shipMarker = new Graphics();
  /** The goal: a dashed line from the ship to its target, the target's fill, the start marker. */
  private readonly goalLayer = new Graphics();
  /** World scale the checkpoint rings were last drawn for (their line width stays ~2 px on screen). */
  private ringScale = 0;
  private readonly trailPoints: number[] = [];
  private lastShip: { x: number; y: number } | undefined;
  /** The replay the nodes were built for: entity ids restart in every replay's world. */
  private shown: Replay | undefined;
  zoom = 0.6;
  camera: CameraMode = "follow";
  /** Draw the model's obstacle sensors (when it has any). */
  showSensors = true;
  /**
   * Draw the targets of the other episodes too. In a training arena all episodes' targets exist at
   * once; only the current one matters, so the others are hidden by default.
   */
  showAllTargets = false;

  constructor(private readonly app: Application) {
    this.stars.alpha = 0.6;
    app.stage.addChild(this.stars, this.world);
    this.world.addChild(this.goalLayer, this.trail, this.sensorLayer);
  }

  /** Forget the trail (new segment, seek). */
  resetTrail(): void {
    this.trailPoints.length = 0;
    this.lastShip = undefined;
    this.trail.clear();
  }

  render(replay: Replay | undefined, dt: number): void {
    this.stars.update(dt);
    if (!replay) return;
    if (replay !== this.shown) {
      for (const node of this.nodes.values()) node.root.destroy({ children: true });
      this.nodes.clear();
      this.shown = replay;
    }
    const entities = replay.server.world.entities;
    for (const [id, node] of this.nodes) {
      if (!entities.has(id)) {
        node.root.destroy({ children: true });
        this.nodes.delete(id);
      }
    }
    const scale = this.world.scale.x || 1;
    const rescale = Math.abs(Math.log(scale / (this.ringScale || 1))) > 0.15;
    if (rescale) this.ringScale = scale;
    const race = replay.server.raceController;
    const status = replay.status();
    const finished = status.done && status.reached >= status.total;
    const target = finished ? undefined : replay.target;
    // After the finish every race checkpoint counts as cleared.
    const targetIndex =
      race && finished
        ? race.checkpoints.length
        : target && race
          ? race.checkpoints.indexOf(target as never)
          : -1;
    for (const entity of entities.values()) {
      let node = this.nodes.get(entity.id);
      if (!node) {
        node = this.createNode(entity);
        this.nodes.set(entity.id, node);
        this.world.addChildAt(node.root, entity.type === EntityType.SHIP ? this.world.children.length : 0);
      }
      node.root.position.set(entity.position.x, entity.position.y);
      node.body.rotation = entity.orientation;
      if (node.ring) {
        let color: number = Color.Gray;
        if (entity === target) color = Color.Yellow;
        else if (race) {
          const index = race.checkpoints.indexOf(entity as never);
          color = index >= 0 && index < targetIndex ? Color.Green : Color.Red;
        }
        if (color !== node.color || rescale) {
          node.color = color;
          node.ring.clear();
          node.ring.circle(0, 0, entity.radius).stroke({ color, width: Math.max(1, 2 / this.ringScale) });
          node.ring.alpha = race || entity === target ? 1 : 0.35;
        }
        node.root.visible = Boolean(race) || entity === target || this.showAllTargets;
      }
      if (entity instanceof Movable && entity.type === EntityType.SHIP)
        node.body.alpha = entity.canMove ? 1 : 0.35;
    }
    this.updateTrail(replay.ship);
    this.updateCamera(replay);
    this.updateGoal(replay, target);
    this.updateSensors(replay);
    const ship = replay.ship;
    this.shipMarker.clear();
    if (ship && this.world.scale.x < 0.4) {
      this.shipMarker
        .circle(ship.position.x, ship.position.y, 6 / this.world.scale.x)
        .stroke({ color: Color.LightGreen, width: 2 / this.world.scale.x });
    }
    this.world.addChild(this.shipMarker); // keep it on top
  }

  private createNode(entity: Entity): Node {
    const root = new Container();
    const body = new Container();
    root.addChild(body);
    const node: Node = { root, body };
    switch (entity.type) {
      case EntityType.SHIP:
        body.addChild(drawSpaceship(new Graphics(), entity.radius));
        break;
      case EntityType.ASTEROID:
        body.addChild(drawAsteroid(new Graphics(), entity.radius, shapeRandom(entity.id)));
        break;
      case EntityType.CHECKPOINT:
        node.ring = new Graphics();
        body.addChild(node.ring);
        break;
      case EntityType.LAUNCH_PLATFORM:
        body.addChild(new Graphics().circle(0, 0, entity.radius).fill({ color: 0x00ff00, alpha: 0.2 }));
        break;
      case EntityType.FINISH:
        body.addChild(createFinishCircle(entity.radius));
        break;
      case EntityType.ARROWS:
        body.addChild(createArrows(entity.radius));
        break;
      default:
        break;
    }
    return node;
  }

  private updateTrail(ship: Movable | undefined): void {
    if (!ship) return;
    const { x, y } = ship.position;
    const last = this.lastShip;
    if (last && Math.hypot(x - last.x, y - last.y) > TELEPORT_DISTANCE) this.trailPoints.push(NaN, NaN);
    if (!last || Math.hypot(x - last.x, y - last.y) > 4) {
      this.trailPoints.push(x, y);
      this.lastShip = { x, y };
      if (this.trailPoints.length > TRAIL_POINTS * 2)
        this.trailPoints.splice(0, this.trailPoints.length - TRAIL_POINTS * 2);
      this.trail.clear();
      let drawing = false;
      for (let i = 0; i < this.trailPoints.length; i += 2) {
        const px = this.trailPoints[i]!;
        const py = this.trailPoints[i + 1]!;
        if (Number.isNaN(px)) {
          drawing = false;
          continue;
        }
        if (drawing) this.trail.lineTo(px, py);
        else this.trail.moveTo(px, py);
        drawing = true;
      }
      this.trail.stroke({ color: Color.LightBlue, width: 2 / this.world.scale.x, alpha: 0.6 });
    }
  }

  /**
   * Makes the goal obvious: the current target filled yellow with a thick ring, a dashed yellow line
   * from the ship to it, and a white cross where the episode starts (and a crash respawns). Sizes
   * stay constant on screen.
   */
  private updateGoal(replay: Replay, target: Entity | undefined): void {
    const g = this.goalLayer;
    g.clear();
    const px = 1 / (this.world.scale.x || 1);
    const start = replay.start;
    if (start) {
      const r = 9 * px;
      g.moveTo(start.x - r, start.y - r)
        .lineTo(start.x + r, start.y + r)
        .moveTo(start.x - r, start.y + r)
        .lineTo(start.x + r, start.y - r)
        .stroke({ color: Color.White, width: 2 * px, alpha: 0.8 });
    }
    if (!target) return;
    const { x: tx, y: ty } = target.position;
    g.circle(tx, ty, target.radius).fill({ color: Color.Yellow, alpha: 0.18 });
    g.circle(tx, ty, target.radius + 3 * px).stroke({ color: Color.Yellow, width: 3 * px, alpha: 0.95 });
    const ship = replay.ship;
    if (!ship) return;
    const { x: sx, y: sy } = ship.position;
    const dx = tx - sx;
    const dy = ty - sy;
    const length = Math.hypot(dx, dy) - target.radius;
    if (length <= 0) return;
    const ux = dx / Math.hypot(dx, dy);
    const uy = dy / Math.hypot(dx, dy);
    const dash = 12 * px;
    for (let t = 0; t < length; t += 2 * dash) {
      const e = Math.min(length, t + dash);
      g.moveTo(sx + ux * t, sy + uy * t).lineTo(sx + ux * e, sy + uy * e);
    }
    g.stroke({ color: Color.Yellow, width: 1.5 * px, alpha: 0.55 });
  }

  /**
   * Unlit sensor segments faint grey, lit ones (an obstacle found there) orange-red, picked rocks
   * as an orange-red outline (yellow is the target). Line widths stay constant on screen.
   */
  private updateSensors(replay: Replay): void {
    const g = this.sensorLayer;
    g.clear();
    if (!this.showSensors || !replay.sensors) return;
    const primitives = replay.sensors();
    if (primitives.length === 0) return;
    const px = 1 / (this.world.scale.x || 1);
    for (const p of primitives) {
      if (p.kind !== "segment" || p.lit) continue;
      g.moveTo(p.x1, p.y1).lineTo(p.x2, p.y2);
    }
    g.stroke({ color: Color.LightGray, width: 1.5 * px, alpha: 0.25 });
    for (const p of primitives) {
      if (p.kind !== "segment" || !p.lit) continue;
      g.moveTo(p.x1, p.y1).lineTo(p.x2, p.y2);
    }
    g.stroke({ color: Color.OrangeRed, width: 2 * px, alpha: 0.9 });
    for (const p of primitives) {
      if (p.kind !== "rock") continue;
      g.circle(p.x, p.y, p.r + 4 * px);
    }
    g.stroke({ color: Color.OrangeRed, width: 2 * px, alpha: 0.9 });
    this.world.addChild(g); // above the trail and the entities added since
  }

  private updateCamera(replay: Replay): void {
    const { width, height } = this.app.screen;
    const ship = replay.ship;
    let cx = ship?.position.x ?? 0;
    let cy = ship?.position.y ?? 0;
    let scale = this.zoom;
    if (this.camera === "overview") {
      let minX = cx;
      let maxX = cx;
      let minY = cy;
      let maxY = cy;
      for (const entity of replay.server.world.entities.values()) {
        if (entity.type !== EntityType.CHECKPOINT && entity.type !== EntityType.FINISH) continue;
        minX = Math.min(minX, entity.position.x - entity.radius);
        maxX = Math.max(maxX, entity.position.x + entity.radius);
        minY = Math.min(minY, entity.position.y - entity.radius);
        maxY = Math.max(maxY, entity.position.y + entity.radius);
      }
      cx = (minX + maxX) / 2;
      cy = (minY + maxY) / 2;
      scale = Math.min(width / (maxX - minX + 200), height / (maxY - minY + 200), 2);
    }
    this.world.scale.set(scale);
    this.world.position.set(width / 2 - cx * scale, height / 2 - cy * scale);
    this.stars.position.set(width / 2 - cx * scale * 0.1, height / 2 - cy * scale * 0.1);
  }

  destroy(): void {
    this.nodes.clear();
  }
}

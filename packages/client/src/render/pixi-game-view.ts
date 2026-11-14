import { CheckpointState, EntityType } from "@ar/shared";
import { Container, Graphics, Text, type Application } from "pixi.js";
import type { GameView, RadarTarget } from "../game/contracts";
import {
  CheckpointController,
  PlayerController,
  RacePortalController,
  type EntityController,
} from "../game/controllers";
import { Color } from "./colors";
import { Explosion, ThrustEmitter } from "./effects";
import { createPlanet, createSampleStation, Satellite, StarField, type Animated } from "./scenery";
import { createArrows, createFinishCircle, drawAsteroid, drawCircleOutline, drawSpaceship } from "./shapes";

const RADAR_RADIUS = 50;
const LABEL_STYLE = { fill: Color.LightBlue, fontFamily: "Arial, sans-serif", fontSize: 12 } as const;

/** A world layer that scrolls with the camera, scaled by its parallax factor. */
class ParallaxLayer extends Container {
  constructor(readonly factor: number) {
    super();
  }

  follow(cameraX: number, cameraY: number, screenWidth: number, screenHeight: number, zoom = 1): void {
    if (this.scale.x !== zoom) this.scale.set(zoom);
    this.position.set(
      screenWidth / 2 - cameraX * this.factor * zoom,
      screenHeight / 2 - cameraY * this.factor * zoom,
    );
  }
}

/** Display objects of one entity. `body` turns with the entity; `root` only moves. */
interface EntityNode {
  root: Container;
  body: Container;
  redraw?: () => void;
  /** Click handler (race portal while the player can leave the race). */
  onTap?: (() => void) | undefined;
}

export interface PixiGameViewOptions {
  /** Draw collision circles around everything (Dart's `debugCollisions`). */
  debugCollisions?: boolean;
  /** Star field, planets and satellite (Dart's `renderBackground`). */
  renderBackground?: boolean;
}

/**
 * PixiJS implementation of {@link GameView}: parallax layers (stars 0.1, planets 0.3, world 1.0,
 * player 1.0), a camera locked to the local ship, entity sprites, effects and the radar.
 */
export class PixiGameView implements GameView {
  private readonly nodes = new Map<EntityController, EntityNode>();
  private readonly dirty = new Set<EntityController>();
  private readonly animations = new Set<Animated & { finished?: boolean }>();
  private readonly layers: ParallaxLayer[] = [];
  private entitiesLayer: ParallaxLayer | undefined;
  private playerLayer: ParallaxLayer | undefined;
  private player: PlayerController | undefined;
  private thrust: ThrustEmitter | undefined;
  private readonly radar = new Container();
  private readonly radarRing = new Graphics();
  private readonly radarBlips = new Graphics();
  private readonly radarLabels = new Map<EntityController, Text>();
  private readonly options: Required<PixiGameViewOptions>;
  /** Scale of the world on screen (1 = one unit per pixel). Phones zoom out to see further. */
  zoom = 1;

  constructor(
    private readonly app: Application,
    options: PixiGameViewOptions = {},
  ) {
    this.options = { debugCollisions: false, renderBackground: true, ...options };
    this.radar.addChild(this.radarRing, this.radarBlips);
    this.app.stage.addChild(this.radar);
  }

  buildScene(): void {
    this.clearScene();
    const stage = this.app.stage;

    if (this.options.renderBackground) {
      const stars = new ParallaxLayer(0.1);
      const starField = new StarField(2000, 2000);
      stars.addChild(starField);
      this.animations.add(starField);

      const planets = new ParallaxLayer(0.3);
      const earth = createPlanet(400, Color.DarkBlue, Color.Green);
      earth.x = -700;
      const moon = createPlanet(50, Color.LightGray, Color.DarkGray);
      moon.position.set(-300, -300);
      const satellite = new Satellite();
      satellite.position.set(270, 150);
      satellite.rotation = 0.5;
      planets.addChild(earth, moon, satellite);
      this.animations.add(satellite);

      this.layers.push(stars, planets);
    }

    this.entitiesLayer = new ParallaxLayer(1);
    const station = createSampleStation();
    station.position.set(-1500, -50);
    this.entitiesLayer.addChild(station);

    this.playerLayer = new ParallaxLayer(1);
    this.thrust = new ThrustEmitter();
    this.playerLayer.addChild(this.thrust);
    this.animations.add(this.thrust);

    this.layers.push(this.entitiesLayer, this.playerLayer);
    for (const layer of this.layers) stage.addChild(layer);
    stage.addChild(this.radar); // keep the radar on top
  }

  clearScene(): void {
    for (const layer of this.layers) layer.destroy({ children: true });
    this.layers.length = 0;
    this.entitiesLayer = this.playerLayer = this.thrust = undefined;
    this.nodes.clear();
    this.dirty.clear();
    this.animations.clear();
    for (const label of this.radarLabels.values()) label.destroy();
    this.radarLabels.clear();
    this.radarBlips.clear();
  }

  addEntity(controller: EntityController): void {
    const layer =
      controller instanceof PlayerController && controller.isLocalPlayer
        ? this.playerLayer
        : this.entitiesLayer;
    if (!layer) return;
    const node = this.createNode(controller);
    if (this.options.debugCollisions)
      node.root.addChild(drawCircleOutline(new Graphics(), controller.entity.radius));
    this.nodes.set(controller, node);
    layer.addChild(node.root);
    this.sync(controller, node);
  }

  removeEntity(controller: EntityController): void {
    const node = this.nodes.get(controller);
    node?.root.destroy({ children: true });
    this.nodes.delete(controller);
    this.dirty.delete(controller);
    this.radarLabels.get(controller)?.destroy();
    this.radarLabels.delete(controller);
  }

  markDirty(controller: EntityController): void {
    this.dirty.add(controller);
  }

  setLocalPlayer(controller: PlayerController | undefined): void {
    this.player = controller;
  }

  explode(controller: EntityController): void {
    const node = this.nodes.get(controller);
    if (!node) return;
    const explosion = new Explosion(controller.entity.radius);
    node.root.addChild(explosion);
    this.animations.add(explosion);
  }

  setRacePortalLeaveable(controller: RacePortalController, onLeave: (() => void) | undefined): void {
    const node = this.nodes.get(controller);
    if (!node) return;
    node.onTap = onLeave;
    node.body.eventMode = onLeave ? "static" : "passive";
    node.body.cursor = onLeave ? "pointer" : "default";
    node.redraw?.();
  }

  render(dt: number, radarTargets: readonly RadarTarget[]): void {
    for (const controller of this.dirty) {
      const node = this.nodes.get(controller);
      if (node) this.sync(controller, node);
    }
    this.dirty.clear();

    const { width, height } = this.app.screen;
    const player = this.player?.entity;
    if (player) {
      const camera = this.nodes.get(this.player!)?.root.position ?? player.position;
      for (const layer of this.layers) layer.follow(camera.x, camera.y, width, height, this.zoom);

      if (this.thrust) {
        this.thrust.emitting = this.player!.accelerationFactor !== 0 && player.canMove;
        this.thrust.originX = player.position.x;
        this.thrust.originY = player.position.y;
        this.thrust.orientation = player.orientation;
      }
    }

    for (const animation of this.animations) {
      animation.update(dt);
      if (animation.finished) this.animations.delete(animation);
    }

    this.drawRadar(radarTargets, width, height);
  }

  // --- entity nodes ----------------------------------------------------------------------

  private createNode(controller: EntityController): EntityNode {
    const entity = controller.entity;
    const root = new Container();
    const body = new Container();
    root.addChild(body);
    const node: EntityNode = { root, body };

    if (controller instanceof PlayerController) {
      body.addChild(drawSpaceship(new Graphics(), entity.radius));
      if (entity.displayName) {
        const name = new Text({ text: entity.displayName, style: LABEL_STYLE });
        name.anchor.set(0.5, 0);
        name.y = entity.radius;
        root.addChild(name); // outside `body`, so the name doesn't spin with the ship
      }
    } else if (controller instanceof CheckpointController) {
      const ring = new Graphics();
      body.addChild(ring);
      node.redraw = () => {
        ring.clear();
        drawCircleOutline(ring, entity.radius, checkpointColor(controller.entity.state));
      };
    } else if (controller instanceof RacePortalController) {
      const pad = new Graphics();
      const slots = new Graphics();
      for (const slot of controller.entity.positions) {
        slots.circle(slot.position.x, slot.position.y, slot.radius).fill(Color.Gray);
      }
      body.addChild(pad, slots);
      let hovered = false;
      body.on("pointerover", () => {
        hovered = true;
        node.redraw?.();
      });
      body.on("pointerout", () => {
        hovered = false;
        node.redraw?.();
      });
      body.on("pointertap", () => node.onTap?.());
      node.redraw = () => {
        pad.clear();
        const alpha = controller.showLeaveButton && hovered ? 0.5 : 0.25;
        pad.circle(0, 0, entity.radius).fill({ color: 0x00ff00, alpha });
      };
    } else {
      switch (entity.type) {
        case EntityType.ASTEROID:
          body.addChild(drawAsteroid(new Graphics(), entity.radius));
          break;
        case EntityType.FINISH:
          body.addChild(createFinishCircle(entity.radius));
          break;
        case EntityType.ARROWS:
          body.addChild(createArrows(entity.radius));
          break;
        default:
          break; // e.g. the invisible spawn marker
      }
    }
    return node;
  }

  private sync(controller: EntityController, node: EntityNode): void {
    const entity = controller.entity;
    node.root.position.set(entity.position.x, entity.position.y);
    node.body.rotation = entity.orientation;
    node.redraw?.();
  }

  // --- radar -------------------------------------------------------------------------------

  private drawRadar(targets: readonly RadarTarget[], width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2;
    this.radarRing.clear();
    this.radarBlips.clear();
    const player = this.player?.entity;
    if (!player || this.layers.length === 0) {
      for (const label of this.radarLabels.values()) label.visible = false;
      return;
    }
    this.radarRing.circle(cx, cy, RADAR_RADIUS).stroke({ color: Color.Navy, width: 1 });

    const seen = new Set<EntityController>();
    for (const { controller, color } of targets) {
      const offset = controller.entity.position.minus(player.position);
      const distance = offset.length;
      const direction = offset.normalized().scale(RADAR_RADIUS);
      const x = cx + direction.x;
      const y = cy + direction.y;
      this.radarBlips
        .circle(x, y, 2)
        .stroke({ color: color === "player" ? Color.Green : Color.Yellow, width: 1 });

      let label = this.radarLabels.get(controller);
      if (!label) {
        label = new Text({ text: "", style: LABEL_STYLE });
        label.anchor.set(0.5, 0);
        this.radar.addChild(label);
        this.radarLabels.set(controller, label);
      }
      const name = controller.entity.displayName ? `${controller.entity.displayName}\n` : "";
      label.text = `${name}Distance: ${formatDistance(distance)}`;
      label.position.set(x, y + 2);
      label.visible = true;
      seen.add(controller);
    }
    for (const [controller, label] of this.radarLabels) {
      if (!seen.has(controller)) label.visible = false;
    }
  }
}

function checkpointColor(state: CheckpointState): number {
  switch (state) {
    case CheckpointState.CLEARED:
      return Color.Green;
    case CheckpointState.CURRENT:
      return Color.Yellow;
    case CheckpointState.FUTURE:
      return Color.Red;
    default:
      return Color.White;
  }
}

/** Four significant digits, like Dart's toStringAsPrecision(4) (but never in exponent form). */
function formatDistance(distance: number): string {
  return distance >= 10000 ? Math.round(distance).toString() : distance.toPrecision(4);
}

import { Container, FillGradient, Graphics } from "pixi.js";
import { Color, randomColor } from "./colors";
import { drawCobweb } from "./shapes";

/** Something that animates every frame. */
export interface Animated {
  update(dt: number): void;
}

/** Sea-coloured disc with random continents. */
export function createPlanet(
  radius: number,
  baseColor: number,
  landColor: number,
  fragments = 10,
): Container {
  const planet = new Container();
  const surface = new Graphics().rect(-radius, -radius, radius * 2, radius * 2).fill(baseColor);
  for (let i = 0; i < fragments; i++) {
    const x = radius - Math.floor(Math.random() * radius * 2);
    const y = radius - Math.floor(Math.random() * radius * 2);
    drawCobweb(surface, radius * 0.6, radius * 0.2, 7, { x, y }).fill(landColor);
  }
  const mask = new Graphics().circle(0, 0, radius).fill(Color.White);
  surface.mask = mask;
  planet.addChild(surface, mask);
  planet.cacheAsTexture(true);
  return planet;
}

export function createRandomPlanet(radius = 100): Container {
  return createPlanet(radius, randomColor(128, 256), randomColor(256, 512));
}

export function createSun(radius = 100): Container {
  const gradient = new FillGradient({
    type: "radial",
    center: { x: 0.5, y: 0.5 },
    innerRadius: 0,
    outerCenter: { x: 0.5, y: 0.5 },
    outerRadius: 0.5,
    colorStops: [
      { offset: 0, color: Color.White },
      { offset: 0.3, color: Color.Yellow },
      { offset: 0.7, color: Color.Orange },
      { offset: 1, color: Color.OrangeRed },
    ],
    textureSpace: "local",
  });
  const sun = new Container();
  sun.addChild(new Graphics().circle(0, 0, radius).fill(gradient));
  sun.cacheAsTexture(true);
  return sun;
}

/** A satellite whose solar sails slowly flip over (cosine-eased, 10 s per half turn). */
export class Satellite extends Container implements Animated {
  private static readonly FLIP_SECONDS = 10;
  private readonly sails: { sprite: Graphics; from: number; t: number; front: boolean }[] = [];

  constructor() {
    super();
    const center = new Graphics().rect(-15, -20, 30, 40).fill(Color.Gray);

    const left = Satellite.makeSail(15);
    left.scale.x = -1;
    const right = Satellite.makeSail(15);

    this.addChild(left, center, right);
    this.sails.push(
      { sprite: left, from: -1, t: 0, front: false },
      { sprite: right, from: 1, t: 0, front: true },
    );
  }

  update(dt: number): void {
    for (const sail of this.sails) {
      sail.t += dt / Satellite.FLIP_SECONDS;
      if (sail.t >= 1) {
        // Half turn done: the sail passed behind/in front of the body.
        sail.from = -sail.from;
        sail.t -= 1;
        this.setChildIndex(sail.sprite, sail.front ? 0 : this.children.length - 1);
        sail.front = !sail.front;
      }
      const eased = 0.5 - 0.5 * Math.cos(sail.t * Math.PI);
      sail.sprite.scale.x = sail.from + (-sail.from - sail.from) * eased;
    }
  }

  private static makeSail(xOffset: number): Graphics {
    const g = new Graphics();
    const connector = 5;
    const sailWidth = 80;
    const sailHeight = 20;
    const half = sailHeight / 2;

    g.rect(xOffset, -connector / 2, connector, connector).stroke({ color: Color.Gray, width: 1 });
    const x = xOffset + connector;
    g.rect(x, -half, sailWidth, sailHeight).fill(Color.DarkBlue).stroke({ color: Color.White, width: 1 });

    const segments = 3;
    const subsegments = 4;
    const step = sailWidth / (segments * subsegments);
    for (let i = 1; i < segments * subsegments; i++) {
      const sx = x + step * i;
      g.moveTo(sx, -half)
        .lineTo(sx, half)
        .stroke({ color: Color.White, width: i % subsegments === 0 ? 1 : 0.5 });
    }
    for (let i = 1; i < subsegments; i++) {
      const sy = -half + (sailHeight / subsegments) * i;
      g.moveTo(x, sy)
        .lineTo(x + sailWidth, sy)
        .stroke({ color: Color.White, width: 0.5 });
    }
    return g;
  }
}

/** Static star dots plus a star that "twinkles" (a growing/shrinking cross) every 10 s. */
export class StarField extends Container implements Animated {
  private static readonly STARS_PER_AREA = 50 / 1_000_000;
  private static readonly PAUSE = 10;
  private static readonly BLINK_IN = 0.3;
  private static readonly BLINK_OUT = 0.3;

  private readonly stars: { x: number; y: number }[] = [];
  private readonly blink = new Graphics();
  private phase: "rest" | "in" | "out" = "rest";
  private time = 0;
  private blinkScale = 0.1;

  constructor(width = 2000, height = 2000) {
    super();
    const dots = new Graphics();
    const count = Math.trunc(StarField.STARS_PER_AREA * width * height);
    for (let i = 0; i < count; i++) {
      const star = { x: Math.random() * width - width / 2, y: Math.random() * height - height / 2 };
      this.stars.push(star);
      dots.rect(star.x, star.y, 1, 1);
    }
    dots.stroke({ color: Color.White, width: 1 });
    this.addChild(dots);

    this.blink
      .moveTo(-10, 0)
      .lineTo(10, 0)
      .moveTo(0, -10)
      .lineTo(0, 10)
      .stroke({ color: Color.White, width: 1 });

    const sun = createSun();
    sun.position.set(400, -230);
    this.addChild(sun);
  }

  update(dt: number): void {
    switch (this.phase) {
      case "rest":
        this.time += dt;
        if (this.time >= StarField.PAUSE && this.stars.length > 0) {
          const star = this.stars[Math.floor(Math.random() * this.stars.length)]!;
          this.blink.position.set(star.x, star.y);
          this.blinkScale = 0.1;
          this.addChild(this.blink);
          this.phase = "in";
        }
        break;
      case "in":
        this.blinkScale += dt / StarField.BLINK_IN;
        if (this.blinkScale >= 1) {
          this.blinkScale = 1;
          this.phase = "out";
        }
        break;
      case "out":
        this.blinkScale -= dt / StarField.BLINK_OUT;
        if (this.blinkScale <= 0.1) {
          this.blink.removeFromParent();
          this.time = 0;
          this.phase = "rest";
        }
        break;
    }
    this.blink.scale.set(this.blinkScale);
  }
}

// --- space station -------------------------------------------------------------------

interface ModuleConfig {
  xBlocks: number;
  yBlocks: number;
  top: number[];
  bottom: number[];
  left: number[];
  right: number[];
}

const MODULES = {
  SMALL_NODE: { xBlocks: 1, yBlocks: 1, top: [0], bottom: [0], left: [0], right: [0] },
  MEDIUM_NODE_HORIZONTAL: {
    xBlocks: 9,
    yBlocks: 1,
    top: [1, 3, 5, 7],
    bottom: [1, 3, 5, 7],
    left: [0],
    right: [0],
  },
  MEDIUM_CONTAINER_VERTICAL: { xBlocks: 1, yBlocks: 6, top: [0], bottom: [0], left: [], right: [] },
  SMALL_CONTAINER_VERTICAL: { xBlocks: 1, yBlocks: 3, top: [0], bottom: [0], left: [], right: [] },
  LARGE_CONTAINER_VERTICAL: { xBlocks: 3, yBlocks: 6, top: [0, 2], bottom: [0, 2], left: [], right: [] },
} satisfies Record<string, ModuleConfig>;

const BLOCK = 40;
const INSET = BLOCK / 8;
const CONNECTOR = BLOCK / 2;

function drawModule(
  g: Graphics,
  config: ModuleConfig,
  xPos: number,
  yPos: number,
  stroke: number,
  fill: number,
) {
  const outerW = BLOCK * config.xBlocks;
  const outerH = BLOCK * config.yBlocks;
  const x = xPos * BLOCK;
  const y = yPos * BLOCK;
  const style = { color: stroke, width: 1, join: "round" as const };

  g.rect(x + INSET, y + INSET, outerW - 2 * INSET, outerH - 2 * INSET)
    .fill(fill)
    .stroke(style);

  const horizontal = (cx: number, cy: number) =>
    g
      .rect(cx - (BLOCK - CONNECTOR) / 2, cy - INSET / 2, BLOCK - CONNECTOR, INSET)
      .fill(fill)
      .stroke(style);
  const vertical = (cx: number, cy: number) =>
    g
      .rect(cx - INSET / 2, cy - (BLOCK - CONNECTOR) / 2, INSET, BLOCK - CONNECTOR)
      .fill(fill)
      .stroke(style);

  // The Dart builder used the *top* connector list for the bottom edge as well; kept for the same look.
  for (const i of config.top) horizontal(x + BLOCK * (i + 0.5), y + INSET / 2);
  for (const i of config.top) horizontal(x + BLOCK * (i + 0.5), y + outerH - INSET / 2);
  for (const i of config.left) vertical(x + INSET / 2, y + BLOCK * (i + 0.5));
  for (const i of config.right) vertical(x + outerW - INSET / 2, y + BLOCK * (i + 0.5));
}

/** The decorative space station west of the spawn. */
export function createSampleStation(): Container {
  const center = [Color.LightGray, Color.NavajoWhite] as const;
  const top = [Color.LightSteelBlue, Color.DarkSlateBlue] as const;
  const bottom = [Color.LightGoldenrodYellow, Color.DarkOrange] as const;
  const modules: [ModuleConfig, number, number, readonly [number, number]][] = [
    [MODULES.MEDIUM_NODE_HORIZONTAL, 0, 0, center],
    [MODULES.SMALL_NODE, 9, 0, center],
    [MODULES.MEDIUM_NODE_HORIZONTAL, 10, 0, center],
    [MODULES.MEDIUM_CONTAINER_VERTICAL, 1, 1, bottom],
    [MODULES.MEDIUM_CONTAINER_VERTICAL, 5, -6, top],
    [MODULES.SMALL_CONTAINER_VERTICAL, 3, -3, top],
    [MODULES.SMALL_CONTAINER_VERTICAL, 15, 1, bottom],
    [MODULES.SMALL_CONTAINER_VERTICAL, 17, 1, bottom],
    [MODULES.SMALL_CONTAINER_VERTICAL, 17, -3, top],
    [MODULES.LARGE_CONTAINER_VERTICAL, 11, -6, top],
  ];
  const station = new Container();
  for (const [config, x, y, [stroke, fill]] of modules) {
    const g = new Graphics();
    drawModule(g, config, x, y, stroke, fill);
    station.addChild(g);
  }
  station.cacheAsTexture(true);
  return station;
}

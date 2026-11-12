import { Vector2 } from "@ar/shared";
import { Container, FillGradient, Graphics } from "pixi.js";
import { Color, randomColor, type Random } from "./colors";

/*
 * Ports of the Dart RenderHelper drawing routines. Coordinates are identical: y points down,
 * a ship's nose points along +y, rotation is in radians (clockwise on screen).
 */

/**
 *          /\
 *         |  |
 *         |  |
 *    ||___/  \__||
 *   <  ____  ___  >
 *    ||   /  \  ||
 */
export function drawSpaceship(g: Graphics, radius: number): Graphics {
  const height = radius * 1.5;
  const width = radius;
  const platformWidth = width / 4;
  const boosterWidth = width / 4;
  const pitWidth = (width - 2 * platformWidth - boosterWidth) / 2;
  const pitHeight = height / 8;

  const leftCorner = new Vector2(-width / 2, -height / 3);
  const tip = new Vector2(0, (height / 3) * 2);
  const rightCorner = new Vector2(width / 2, -height / 3);
  const leftCornerToTip = tip.minus(leftCorner).normalized();

  const leftP1 = leftCorner.plus(new Vector2(platformWidth, 0));
  const leftP2 = leftP1.plus(new Vector2(pitWidth, 0));
  const leftPitP1 = leftP1.plus(leftCornerToTip.times(pitHeight));
  const leftPitP2 = leftP2.plus(leftCornerToTip.times(pitHeight));
  const mirror = (v: Vector2) => new Vector2(-v.x, v.y);

  const hull = [
    tip,
    leftCorner,
    leftP1,
    leftPitP1,
    leftPitP2,
    leftP2,
    mirror(leftP2),
    mirror(leftPitP2),
    mirror(leftPitP1),
    mirror(leftP1),
    rightCorner,
  ];
  g.poly(hull.flatMap((p) => [p.x, p.y]))
    .fill(Color.DarkGreen)
    .stroke({ color: Color.LightGreen, width: 1 });

  const innerLength = radius / 3;
  const innerTip = new Vector2(0, innerLength);
  const innerLeft = innerTip.plus(leftCornerToTip.times(-innerLength));
  const cockpit = [innerTip, innerLeft, mirror(innerLeft)];
  g.poly(cockpit.flatMap((p) => [p.x, p.y]))
    .fill(Color.Black)
    .stroke({ color: Color.LightGreen, width: 1 });
  return g;
}

/** Irregular polygon between two radii: asteroids, explosions, planet continents. */
export function drawCobweb(
  g: Graphics,
  outerRadius: number,
  innerRadius: number,
  vertices: number,
  { x = 0, y = 0, random = Math.random }: { x?: number; y?: number; random?: Random } = {},
): Graphics {
  const points: number[] = [];
  for (let i = 0; i < vertices; i++) {
    const angle = (i / vertices) * Math.PI * 2;
    const r = random() * (outerRadius - innerRadius) + innerRadius;
    points.push(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
  }
  return g.poly(points);
}

export function drawAsteroid(g: Graphics, radius: number, random: Random = Math.random): Graphics {
  const vertices = Math.max(3, Math.min(Math.trunc(radius), 30));
  return drawCobweb(g, radius, radius * 0.75, vertices, { random })
    .fill(Color.AsteroidFill)
    .stroke({ color: randomColor(80, 512, random), width: 1 });
}

export function drawExplosion(g: Graphics, radius: number): Graphics {
  const gradient = new FillGradient({
    type: "radial",
    center: { x: 0.5, y: 0.5 },
    innerRadius: 0,
    outerCenter: { x: 0.5, y: 0.5 },
    outerRadius: 0.5,
    colorStops: [
      { offset: 0, color: Color.White },
      { offset: 0.3, color: Color.Red },
      { offset: 0.5, color: Color.Brown },
      { offset: 0.7, color: Color.Black },
      { offset: 1, color: Color.Black },
    ],
    textureSpace: "local",
  });
  return drawCobweb(g, radius, radius * 0.1, 30)
    .fill(gradient)
    .stroke({ color: Color.Red, width: 1 });
}

export function drawCircleOutline(g: Graphics, radius: number, color: number = Color.White): Graphics {
  return g.circle(0, 0, radius).stroke({ color, width: 1 });
}

/** Black/white checkerboard clipped to a circle. */
export function createFinishCircle(radius = 100): Container {
  const finish = new Container();
  const board = new Graphics();
  const side = radius / 5;
  let white = false;
  for (let x = -radius; x < radius; x += side) {
    white = !white;
    for (let y = -radius; y < radius; y += side) {
      white = !white;
      board.rect(x, y, side, side).fill(white ? Color.Black : Color.White);
    }
  }
  const mask = new Graphics().circle(0, 0, radius).fill(Color.White);
  board.mask = mask;
  finish.addChild(board, mask);
  finish.alpha = 0.8;
  return finish;
}

/**
 * Three chevrons pointing along +y (the direction of travel for the arrow's orientation), with
 * rounded corners.
 */
export function createArrows(radius = 100, count = 3): Container {
  const container = new Container();
  const g = new Graphics();
  container.addChild(g);

  const width = radius;
  const height = radius;
  const thickness = 10;
  const t = thickness / Math.SQRT2 / 2;
  const corner = thickness / 2;
  const upRight = new Vector2(t, t);
  const downLeft = new Vector2(-t, -t);
  const downRight = new Vector2(t, -t);
  const upLeft = new Vector2(-t, t);

  for (let i = 0; i < count; i++) {
    const space = height - width / 2;
    const offset = new Vector2(0, (space / (count - 1)) * i - space / 2);

    const tip = new Vector2(0, (width / 2 / 3) * 2).add(offset);
    const tipInnerControl = tip.plus(downRight).add(downLeft);
    const tipOuterControl = tip.plus(upLeft).add(upRight);
    const tipOuterRight = tip.plus(upRight);
    const tipOuterLeft = tip.plus(upLeft);
    const tipInnerRight = tipInnerControl.plus(downRight);
    const tipInnerLeft = tipInnerControl.plus(downLeft);

    const rightWing = new Vector2(width / 2, -width / 2 / 3).add(offset);
    const rightWingA = rightWing.plus(upRight);
    const rightWingAB = rightWing.plus(upRight).add(downRight);
    const rightWingB = rightWing.plus(downRight);
    const rightWingBC = rightWing.plus(downRight).add(downLeft);
    const rightWingC = rightWing.plus(downLeft);

    const leftWing = new Vector2(-width / 2, -width / 2 / 3).add(offset);
    const leftWingA = leftWing.plus(downRight);
    const leftWingAB = leftWing.plus(downRight).add(downLeft);
    const leftWingB = leftWing.plus(downLeft);
    const leftWingBC = leftWing.plus(downLeft).add(upLeft);
    const leftWingC = leftWing.plus(upLeft);

    g.moveTo(tipOuterRight.x, tipOuterRight.y)
      .lineTo(rightWingA.x, rightWingA.y)
      .arcTo(rightWingAB.x, rightWingAB.y, rightWingB.x, rightWingB.y, corner)
      .arcTo(rightWingBC.x, rightWingBC.y, rightWingC.x, rightWingC.y, corner)
      .lineTo(tipInnerRight.x, tipInnerRight.y)
      .arcTo(tipInnerControl.x, tipInnerControl.y, tipInnerLeft.x, tipInnerLeft.y, corner)
      .lineTo(leftWingA.x, leftWingA.y)
      .arcTo(leftWingAB.x, leftWingAB.y, leftWingB.x, leftWingB.y, corner)
      .arcTo(leftWingBC.x, leftWingBC.y, leftWingC.x, leftWingC.y, corner)
      .lineTo(tipOuterLeft.x, tipOuterLeft.y)
      .arcTo(tipOuterControl.x, tipOuterControl.y, tipOuterRight.x, tipOuterRight.y, corner)
      .closePath()
      .fill(Color.LightBlue)
      .stroke({ color: Color.Blue, width: 1 });
  }
  return container;
}

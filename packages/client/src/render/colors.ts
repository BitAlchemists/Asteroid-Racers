/** The StageXL named colours the Dart client used (RGB; alpha is passed separately in Pixi). */
export const Color = {
  Black: 0x000000,
  White: 0xffffff,
  Red: 0xff0000,
  Green: 0x008000,
  Blue: 0x0000ff,
  Yellow: 0xffff00,
  Gray: 0x808080,
  LightGray: 0xd3d3d3,
  DarkGray: 0xa9a9a9,
  LightGreen: 0x90ee90,
  DarkGreen: 0x006400,
  DarkBlue: 0x00008b,
  Navy: 0x000080,
  LightBlue: 0xadd8e6,
  Orange: 0xffa500,
  OrangeRed: 0xff4500,
  Brown: 0xa52a2a,
  NavajoWhite: 0xffdead,
  LightSteelBlue: 0xb0c4de,
  DarkSlateBlue: 0x483d8b,
  LightGoldenrodYellow: 0xfafad2,
  DarkOrange: 0xff8c00,
  AsteroidFill: 0x333333,
} as const;

export type Random = () => number;

function randomInt(random: Random, max: number): number {
  return Math.floor(random() * max);
}

/**
 * A random colour whose r+g+b "volume" lies in [minVolume, maxVolume) — keeps asteroid outlines
 * and planets from being too dark or too bright. Port of RenderHelper.randColor.
 */
export function randomColor(minVolume: number, maxVolume: number, random: Random = Math.random): number {
  let amount = randomInt(random, maxVolume - minVolume) + minVolume;
  const r = randomInt(random, Math.min(amount, 256));
  amount -= r;
  const g = randomInt(random, Math.min(amount, 256));
  amount -= g;
  const b = Math.min(amount, 255);
  return (r << 16) + (g << 8) + b;
}

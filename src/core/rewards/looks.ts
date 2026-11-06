/**
 * How each garage item is drawn (amendment 11, FR-090, FR-093). Plain shapes in tank coordinates: x to the right,
 * y up from the tank base, the tank's center line at x 0. Phaser draws them on the child's tank in battle
 * (src/game/TankView.ts) and SVG draws them in the garage preview (src/app/TankPreview.tsx), so both look the same.
 *
 * The antenna stands at x -20 and its flag spans x -19 to 3 and y 49 to 64; the hat sits on the dome, whose top is
 * at y 28. Every tank color stays blue or blue-green, far from the red enemy (FR-077).
 */
import type { ColorId, FlagId, HatId, TrailId } from './items';

export type Point = [number, number];

/** `alpha` (0 to 1, default 1) lets a highlight blend into the body (amendment 14). */
export type Shape =
  | { type: 'poly'; points: Point[]; fill: number; stroke?: number; alpha?: number }
  | { type: 'circle'; x: number; y: number; r: number; fill: number; stroke?: number; alpha?: number }
  | { type: 'line'; from: Point; to: Point; width: number; color: number };

export interface TrailStyle {
  /** One color per parallel line; the plain trail has one. */
  line: number[];
  dots: 'none' | 'sparkles' | 'bubbles';
}

/** Antenna position (matches TankView): its foot and its top. */
export const ANTENNA_X = -20;
export const ANTENNA_FOOT = 20;
export const ANTENNA_TOP = 64;
const FX = ANTENNA_X + 1;
const FW = 22;
const FH = 15;
const FY = ANTENNA_TOP - FH;
/** Top of the dome, where a hat sits. */
export const DOME_TOP = 28;

const COLORS: Record<ColorId, number> = {
  blue: 0x2f7be8,
  sky: 0x4fb3f0,
  teal: 0x1f9aa8,
  turquoise: 0x2ec4c4,
  navyStripes: 0x24418f,
};

export function tankColor(id: ColorId): number {
  return COLORS[id];
}

/** Dark blue with stripes draws light stripes across the hull. */
export function colorStripes(id: ColorId): boolean {
  return id === 'navyStripes';
}

/** Stripe color on the hull for `colorStripes`. */
export const STRIPE_COLOR = 0xdfe8ff;

function rect(x: number, y: number, w: number, h: number, fill: number, stroke?: number): Shape {
  const s: Shape = { type: 'poly', points: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill };
  if (stroke !== undefined) s.stroke = stroke;
  return s;
}

function star(cx: number, cy: number, outer: number, inner: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    out.push([round(cx + r * Math.cos(a)), round(cy + r * Math.sin(a))]);
  }
  return out;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

const OUTLINE = 0x1b1f27;

export function flagShapes(id: FlagId): Shape[] {
  const cx = FX + FW / 2;
  const cy = FY + FH / 2;
  switch (id) {
    case 'star':
      return [rect(FX, FY, FW, FH, 0xffd23f, OUTLINE), { type: 'poly', points: star(cx, cy, 6, 2.6), fill: 0x1d3f8f }];
    case 'rocket':
      return [
        rect(FX, FY, FW, FH, 0xdff3ff, OUTLINE),
        // Flame, body and nose pointing right, and two fins.
        { type: 'poly', points: [[FX + 2, cy], [FX + 6, cy + 3], [FX + 6, cy - 3]], fill: 0xff9f1c },
        { type: 'poly', points: [[FX + 6, cy - 3], [FX + 15, cy - 3], [FX + 20, cy], [FX + 15, cy + 3], [FX + 6, cy + 3]], fill: 0xe63946 },
        { type: 'poly', points: [[FX + 7, cy + 3], [FX + 10, cy + 3], [FX + 7, cy + 6]], fill: 0x1d3f8f },
        { type: 'poly', points: [[FX + 7, cy - 3], [FX + 10, cy - 3], [FX + 7, cy - 6]], fill: 0x1d3f8f },
        { type: 'circle', x: FX + 13, y: cy, r: 1.5, fill: 0xffffff },
      ];
    case 'dragon':
      return [
        rect(FX, FY, FW, FH, 0x58c470, OUTLINE),
        // A row of spikes along the top and an eye.
        { type: 'poly', points: [[FX, FY + FH], [FX + 4, FY + FH - 6], [FX + 8, FY + FH], [FX + 12, FY + FH - 6], [FX + 16, FY + FH], [FX + 20, FY + FH - 6], [FX + 22, FY + FH]], fill: 0x1f6b35 },
        { type: 'circle', x: FX + 15, y: cy - 2, r: 2.6, fill: 0xffe14d, stroke: OUTLINE },
        { type: 'poly', points: [[FX + 3, FY + 2], [FX + 10, FY + 4], [FX + 3, FY + 6]], fill: 0xff7043 },
      ];
    case 'football':
      return [
        rect(FX, FY, FW, FH, 0x3fae5a, OUTLINE),
        { type: 'circle', x: cx, y: cy, r: 5.5, fill: 0xffffff, stroke: OUTLINE },
        { type: 'poly', points: [[cx, cy + 2.4], [cx + 2.3, cy + 0.7], [cx + 1.4, cy - 2], [cx - 1.4, cy - 2], [cx - 2.3, cy + 0.7]], fill: 0x1b1f27 },
      ];
    case 'lightning':
      return [
        rect(FX, FY, FW, FH, 0x1d3f8f, OUTLINE),
        { type: 'poly', points: [[cx + 2, FY + FH - 1], [cx - 4, cy - 0.5], [cx, cy - 0.5], [cx - 2, FY + 1], [cx + 4, cy + 1], [cx, cy + 1]], fill: 0xffd23f },
      ];
  }
}

export function hatShapes(id: HatId): Shape[] {
  const y = DOME_TOP - 3;
  switch (id) {
    case 'none':
      return [];
    case 'crown':
      return [
        { type: 'poly', points: [[-11, y], [11, y], [11, y + 10], [6, y + 6], [0, y + 14], [-6, y + 6], [-11, y + 10]], fill: 0xffc83d, stroke: 0x8a5a00 },
        { type: 'circle', x: 0, y: y + 4, r: 2, fill: 0xe63946 },
        { type: 'circle', x: -7, y: y + 3, r: 1.5, fill: 0x2f7be8 },
        { type: 'circle', x: 7, y: y + 3, r: 1.5, fill: 0x2f7be8 },
      ];
    case 'helmet':
      return [
        { type: 'poly', points: dome(0, y, 12, 11), fill: 0x5b6b3a, stroke: 0x2b331b },
        { type: 'line', from: [-15, y], to: [15, y], width: 3, color: 0x2b331b },
        { type: 'circle', x: 0, y: y + 6, r: 2, fill: 0xffd23f },
      ];
  }
}

/** The upper half of an ellipse from left to right, its base at y. */
function dome(cx: number, y: number, rx: number, ry: number): Point[] {
  const out: Point[] = [];
  for (let a = 0; a <= 180; a += 20) {
    const rad = (a * Math.PI) / 180;
    out.push([round(cx - rx * Math.cos(rad)), round(y + ry * Math.sin(rad))]);
  }
  return out;
}

const TRAILS: Record<TrailId, TrailStyle> = {
  plain: { line: [0xfff3c4], dots: 'none' },
  sparkles: { line: [0xfff3c4], dots: 'sparkles' },
  rainbow: { line: [0xe53935, 0xff9f1c, 0xffd23f, 0x3fae5a, 0x2f7be8, 0x8e44ad], dots: 'none' },
  bubbles: { line: [0xbfe8ff], dots: 'bubbles' },
};

export function trailStyle(id: TrailId): TrailStyle {
  const t = TRAILS[id];
  return { line: [...t.line], dots: t.dots };
}

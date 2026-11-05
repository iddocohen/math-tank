/**
 * Pointer line styles (amendment 21, FR-144 to FR-146, data-model.md "Pointer curves"). Screen coordinates (y grows
 * downward). "Gebogen" bends each pointer line sideways between its tank and the ruler: the curve starts at the tank's
 * center, bows out as one arc or an S shape by a seeded 8% to 20% of the ruler width, and comes back to run straight
 * down to the tank's own number on the ruler line. "Gebogen und verschlungen" lets curves cross and gives each one a
 * color. Fairness (FR-145): curves end at numberToX of their number, stay inside the battlefield, reach the ruler band
 * only as a vertical tail (so they cross no label), never pass behind another tank's body, and in "Gebogen" never
 * cross each other. When no seeded bow fits, smaller bows are tried, and a straight line is the last resort.
 * Pure: the result depends only on the input.
 */
import type { Point, Settings, TankState } from '../types';
import { createRng, deriveSeed } from '../rng';
import { DEFAULT_LAYOUT, numberToX } from '../numberline/mapping';
import { RULER_TOP } from './layout';
import { AXIS_Y } from './rulerText';
import { toScreenY } from './geometry';

export type LineStyle = Settings['lineStyle'];

/** The style drawn: "Gebogen und verschlungen" needs 2 or more enemies at once; with 1 it is drawn as "Gebogen". */
export function effectiveLineStyle(settings: Pick<Settings, 'lineStyle' | 'enemiesAtOnce'>): LineStyle {
  return settings.lineStyle === 'tangled' && settings.enemiesAtOnce < 2 ? 'curved' : settings.lineStyle;
}

/** Okabe-Ito orange, sky blue, bluish green and reddish purple: told apart with every common color vision deficiency. */
export const LINE_COLORS: readonly number[] = [0xe69f00, 0x56b4e9, 0x009e73, 0xcc79a7];

/** Below this screen y every curve runs straight down to its end on the ruler line. */
export const TAIL_TOP = RULER_TOP - 8;
/** A tank's body as a box around its base: half its width and its height, in world units. */
export const BODY_BOX = { halfWidth: 32, height: 42 } as const;
/** Curves keep at least this distance from other tanks' bodies and from the battlefield's sides. */
export const CURVE_MARGIN = 6;
const SIDE_MARGIN = 8;
/** Height of the tank's center above its base (round.ts TANK_HEIGHT / 2). */
const CENTER_ABOVE_BASE = 12;
const SAMPLES = 48;
const RULER_WIDTH = DEFAULT_LAYOUT.right - DEFAULT_LAYOUT.left;
const MIN_BOW = 0.08;
const MAX_BOW = 0.2;
const MIN_TANGLED_BOW = 0.12;
/** Bows below 8% tried, in order, before a straight line, when no 8% bow fits the rules. */
const FALLBACK_BOWS = [0.06, 0.04, 0.02];

export type CurveShape = 'straight' | 'arc' | 's';

export interface PointerCurve {
  tankId: string;
  number: number;
  /** From the tank's center to the tip on the ruler line (AXIS_Y). */
  points: Point[];
  /** The largest sideways distance from the end x, in world units. */
  bow: number;
  shape: CurveShape;
  /** 'tangled' only: one of LINE_COLORS, by order from left to right; null otherwise. */
  color: number | null;
}

export interface PointerCurvesInput {
  style: 'curved' | 'tangled';
  seed: number;
  range: { min: number; max: number };
  /** The tanks that get a line. */
  tanks: readonly TankState[];
  /** Other tanks the curves must not pass behind (the child's tank). */
  others: readonly TankState[];
  worldHeight: number;
}

/** The S shape sin(pi u)^2 cos(pi u) peaks at 2 / (3 sqrt 3); dividing by it makes its largest value 1. */
const S_PEAK = 2 / (3 * Math.sqrt(3));

function offset(shape: CurveShape, u: number): number {
  const s = Math.sin(Math.PI * u);
  if (shape === 'arc') return s * s;
  if (shape === 's') return (s * s * Math.cos(Math.PI * u)) / S_PEAK;
  return 0;
}

/** The curve's points: the bowed part from the tank's center down to TAIL_TOP, then straight down to AXIS_Y. */
function curvePoints(x: number, top: number, shape: CurveShape, bow: number): Point[] {
  const bottom = Math.max(top, TAIL_TOP);
  const points: Point[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const u = i / SAMPLES;
    points.push({ x: x + bow * offset(shape, u), y: top + (bottom - top) * u });
  }
  points[SAMPLES] = { x, y: bottom };
  points.push({ x, y: AXIS_Y });
  return points;
}

function behind(p: Point, t: TankState, worldHeight: number): boolean {
  const ground = toScreenY(t.y, worldHeight);
  return Math.abs(p.x - t.x) <= BODY_BOX.halfWidth + CURVE_MARGIN && p.y <= ground + CURVE_MARGIN && p.y >= ground - BODY_BOX.height - CURVE_MARGIN;
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const o = (p: Point, q: Point, r: Point) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

function polylinesCross(p: Point[], q: Point[]): boolean {
  for (let i = 1; i < p.length; i++) {
    for (let j = 1; j < q.length; j++) if (segmentsCross(p[i - 1]!, p[i]!, q[j - 1]!, q[j]!)) return true;
  }
  return false;
}

/** One curve per tank, in the order of `tanks`; see the module comment for the rules. */
export function pointerCurves({ style, seed, range, tanks, others, worldHeight }: PointerCurvesInput): PointerCurve[] {
  const sorted = [...tanks].sort((a, b) => a.position - b.position);
  const avoid = [...tanks, ...others];
  const placed: PointerCurve[] = [];
  for (const tank of sorted) {
    const x = numberToX(tank.position, range.min, range.max);
    const top = toScreenY(tank.y + CENTER_ABOVE_BASE, worldHeight);
    const rng = createRng(deriveSeed(seed, 11, tank.position));
    const shape0: CurveShape = rng.next() < 0.5 ? 'arc' : 's';
    let side0 = rng.next() < 0.5 ? 1 : -1;
    const low = style === 'tangled' ? MIN_TANGLED_BOW : MIN_BOW;
    const frac0 = low + rng.next() * (MAX_BOW - low);
    if (style === 'tangled') {
      // Toward the nearest other tank with a line, so lines may tangle.
      const near = sorted.filter((t) => t !== tank).sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
      if (near) side0 = near.x > x ? 1 : -1;
    }
    // In "Gebogen" a curve also keeps clear of the straight lines of the tanks still to come, so their straight last
    // resort never crosses it.
    const later = style === 'tangled' ? [] : sorted.slice(sorted.indexOf(tank) + 1).map((t) => curvePoints(numberToX(t.position, range.min, range.max), toScreenY(t.y + CENTER_ABOVE_BASE, worldHeight), 'straight', 0));
    const fits = (points: Point[]): boolean =>
      points.every((p) => p.x >= SIDE_MARGIN && p.x <= DEFAULT_LAYOUT.worldWidth - SIDE_MARGIN) &&
      points.every((p) => avoid.every((t) => t === tank || !behind(p, t, worldHeight))) &&
      (style === 'tangled' || (placed.every((c) => !polylinesCross(c.points, points)) && later.every((line) => !polylinesCross(line, points))));
    const fracs = [frac0, (frac0 + MIN_BOW) / 2, MIN_BOW, ...FALLBACK_BOWS];
    let chosen: { shape: CurveShape; points: Point[]; bow: number } | null = null;
    search: for (const frac of fracs) {
      for (const shape of [shape0, shape0 === 'arc' ? 's' : 'arc'] as const) {
        for (const side of [side0, -side0]) {
          const bow = side * frac * RULER_WIDTH;
          const points = curvePoints(x, top, shape, bow);
          if (fits(points)) {
            chosen = { shape, points, bow: frac * RULER_WIDTH };
            break search;
          }
        }
      }
    }
    chosen ??= { shape: 'straight', points: curvePoints(x, top, 'straight', 0), bow: 0 };
    placed.push({ tankId: tank.id, number: tank.position, points: chosen.points, bow: chosen.bow, shape: chosen.shape, color: null });
  }
  if (style === 'tangled') placed.forEach((c, i) => (c.color = LINE_COLORS[i % LINE_COLORS.length]!));
  return tanks.map((t) => placed.find((c) => c.tankId === t.id)!);
}

/** The length of a polyline. */
export function curveLength(points: readonly Point[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) sum += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  return sum;
}

/** The point at `fraction` (0 to 1) of the polyline's length: the help step 1 highlight moves along it (FR-146). */
export function pointAlong(points: readonly Point[], fraction: number): Point {
  let left = Math.min(1, Math.max(0, fraction)) * curveLength(points);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= len && len > 0) return { x: a.x + ((b.x - a.x) * left) / len, y: a.y + ((b.y - a.y) * left) / len };
    left -= len;
  }
  return { ...points[points.length - 1]! };
}

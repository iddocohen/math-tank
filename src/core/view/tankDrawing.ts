/**
 * The tank drawing (amendment 14, FR-109, FR-110): plain shapes in tank coordinates (x to the right, y up from the tank
 * base, the center line at x 0), drawn by Phaser in battle (src/game/TankView.ts) and by SVG in the garage preview
 * (src/app/TankPreview.tsx), so both show the same tank.
 *
 * The child's tank has a rounded body with a dome; the enemy and the decoys an angular body with a trapezoid turret
 * base (amendment 05, FR-077). Each body has a highlight on top and a shadow band below, from tankShades. The wheels
 * carry spokes that turn with `wheelAngle`; four spokes per wheel, so the picture repeats after a quarter turn.
 * The turret is drawn separately, in turret coordinates (x along the barrel from the pivot, y across it), because it
 * turns. The antenna and the dome top keep the anchor points of amendment 11 (src/core/rewards/looks.ts).
 */
import type { Look } from '../rewards/items';
import { ANTENNA_FOOT, ANTENNA_TOP, ANTENNA_X, colorStripes, DOME_TOP, flagShapes, hatShapes, STRIPE_COLOR, tankColor, type Point, type Shape } from '../rewards/looks';
import { tankShades } from './shade';

export const TANK_ANCHORS = Object.freeze({
  antennaX: ANTENNA_X,
  antennaFoot: ANTENNA_FOOT,
  antennaTop: ANTENNA_TOP,
  domeTop: DOME_TOP,
  /** Height of the turret pivot above the base; matches the muzzle height in core/battle/round.ts. */
  turretPivot: 28,
});

export type TankAnchors = typeof TANK_ANCHORS;

/** Barrel length from the pivot to the muzzle. */
export const MUZZLE_LENGTH = 38;
/** Barrel thickness. */
export const BARREL_THICKNESS = 8;

const ANTENNA_COLOR = 0x2b2f36;
const TRACK_ROUNDED = 0x3a3f47;
const TRACK_ANGULAR = 0x2a2d33;
const WHEEL_ROUNDED = 0x6b717c;
const WHEEL_ANGULAR = 0x55595f;
const SPOKE = 0x2b2f36;

function r2(n: number): number {
  const v = Math.round(n * 100) / 100;
  return v === 0 ? 0 : v;
}

function poly(points: Point[], fill: number, stroke?: number, alpha?: number): Shape {
  const s: Shape = { type: 'poly', points: points.map(([x, y]) => [r2(x), r2(y)] as Point), fill };
  if (stroke !== undefined) s.stroke = stroke;
  if (alpha !== undefined) s.alpha = alpha;
  return s;
}

/** A rectangle with rounded corners as a polygon, from (x0, y0) to (x1, y1). */
function roundedRect(x0: number, y0: number, x1: number, y1: number, r: number): Point[] {
  const out: Point[] = [];
  const corners: Array<[number, number, number]> = [
    [x1 - r, y0 + r, -90],
    [x1 - r, y1 - r, 0],
    [x0 + r, y1 - r, 90],
    [x0 + r, y0 + r, 180],
  ];
  for (const [cx, cy, start] of corners) {
    for (let a = start; a <= start + 90; a += 30) {
      const rad = (a * Math.PI) / 180;
      out.push([cx + r * Math.cos(rad), cy + r * Math.sin(rad)]);
    }
  }
  return out;
}

function regular(cx: number, cy: number, r: number, n: number, turn = 0): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = turn + (i * 2 * Math.PI) / n;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

/** Two crossing spokes (four arms) at the wheel angle. */
function spokes(cx: number, cy: number, r: number, angle: number): Shape[] {
  const out: Shape[] = [];
  for (const base of [0, Math.PI / 2]) {
    // Fold the angle into a quarter turn, so the drawing repeats exactly after a quarter turn.
    const a = base + (((angle % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2));
    const dx = r * Math.cos(a);
    const dy = r * Math.sin(a);
    out.push({ type: 'line', from: [r2(cx - dx), r2(cy - dy)], to: [r2(cx + dx), r2(cy + dy)], width: 1.2, color: SPOKE });
  }
  return out;
}

/**
 * The body without the turret: tracks, wheels with spokes, hull with highlight and shadow, and the dome (rounded) or
 * the trapezoid turret base (angular). `stripes` adds the light stripes of "Dunkelblau mit Streifen".
 */
export function tankBodyShapes(body: 'rounded' | 'angular', color: number, wheelAngle = 0, stripes = false): Shape[] {
  const s = tankShades(color);
  const out: Shape[] = [];
  if (body === 'rounded') {
    out.push(poly(roundedRect(-30, 0, 30, 10, 5), TRACK_ROUNDED));
    for (const x of [-23, -11.5, 0, 11.5, 23]) {
      out.push({ type: 'circle', x, y: 5, r: 3.6, fill: WHEEL_ROUNDED });
      out.push(...spokes(x, 5, 3, wheelAngle));
    }
    out.push(poly(roundedRect(-26, 8, 26, 18, 4), s.base, s.outline));
    out.push(poly(roundedRect(-26, 8, 26, 11.5, 1.5), s.shadow));
    out.push(poly(roundedRect(-23, 14.5, 23, 17, 1.2), s.highlight));
    if (stripes) {
      for (const x of [-20, -8, 4, 16]) out.push({ type: 'line', from: [x, 9], to: [x + 6, 17], width: 2, color: STRIPE_COLOR });
    }
    out.push({ type: 'circle', x: 0, y: 18, r: 10, fill: s.base, stroke: s.outline });
    out.push({ type: 'circle', x: -3, y: 22, r: 4, fill: s.highlight, alpha: 0.9 });
    return out;
  }
  out.push(poly([[-32, 10], [32, 10], [27, 0], [-27, 0]], TRACK_ANGULAR));
  for (const x of [-22, -11, 0, 11, 22]) {
    out.push(poly(regular(x, 5, 3.6, 8, Math.PI / 8), WHEEL_ANGULAR));
    out.push(...spokes(x, 5, 3, wheelAngle));
  }
  out.push(poly([[-30, 10], [30, 10], [23, 19], [-23, 19]], s.base, s.outline));
  out.push(poly([[-30, 10], [30, 10], [27.4, 13.3], [-27.4, 13.3]], s.shadow));
  out.push(poly([[-25, 16.5], [25, 16.5], [23, 19], [-23, 19]], s.highlight));
  if (stripes) {
    for (const x of [-20, -8, 4, 16]) out.push({ type: 'line', from: [x, 11], to: [x + 6, 18], width: 2, color: STRIPE_COLOR });
  }
  out.push(poly([[-13, 19], [13, 19], [8, 28], [-8, 28]], s.base, s.outline));
  out.push(poly([[-9.1, 26], [9.1, 26], [8, 28], [-8, 28]], s.highlight));
  return out;
}

/** The barrel in turret coordinates: from the pivot (x 0) to the muzzle (x MUZZLE_LENGTH). */
export function turretShapes(color: number): Shape[] {
  const s = tankShades(color);
  const h = BARREL_THICKNESS / 2;
  return [
    poly(roundedRect(0, -h, MUZZLE_LENGTH, h, 2.5), s.base, s.outline),
    poly([[2, 1.2], [MUZZLE_LENGTH - 7, 1.2], [MUZZLE_LENGTH - 7, 3], [2, 3]], s.highlight),
    poly([[MUZZLE_LENGTH - 6, -h], [MUZZLE_LENGTH, -h], [MUZZLE_LENGTH, h], [MUZZLE_LENGTH - 6, h]], s.shadow, s.outline),
  ];
}

export interface PlayerTankShapes {
  body: Shape[];
  turret: Shape[];
  antenna: Shape[];
  flag: Shape[];
  hat: Shape[];
  anchors: TankAnchors;
}

/** Every part of the child's tank with a garage look (amendment 11 and 14). */
export function playerTankShapes(look: Look, wheelAngle = 0): PlayerTankShapes {
  const color = tankColor(look.color);
  return {
    body: tankBodyShapes('rounded', color, wheelAngle, colorStripes(look.color)),
    turret: turretShapes(color),
    antenna: antennaShapes(),
    flag: flagShapes(look.flag),
    hat: hatShapes(look.hat),
    anchors: { ...TANK_ANCHORS },
  };
}

/** The antenna from its foot to its top, at its x. */
export function antennaShapes(): Shape[] {
  return [{ type: 'line', from: [ANTENNA_X, ANTENNA_FOOT], to: [ANTENNA_X, ANTENNA_TOP], width: 3, color: ANTENNA_COLOR }];
}

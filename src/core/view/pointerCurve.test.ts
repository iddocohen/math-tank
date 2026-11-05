import { describe, expect, it } from 'vitest';
import { BODY_BOX, CURVE_MARGIN, curveLength, LINE_COLORS, pointAlong, pointerCurves, TAIL_TOP, type PointerCurve } from './pointerCurve';
import { AXIS_Y } from './rulerText';
import { RULER_TOP } from './layout';
import { defaultSettings } from '../settings/defaults';
import type { Point, Settings, TankState } from '../types';
import { createRng, deriveSeed } from '../rng';
import { generateTerrain } from '../physics/terrain';
import { makeTank, WORLD_HEIGHT, WORLD_WIDTH } from '../battle/round';
import { DEFAULT_LAYOUT, numberToX } from '../numberline/mapping';
import { minTankGap } from '../math/gaps';
import { toScreenY } from './geometry';

const RULER_WIDTH = DEFAULT_LAYOUT.right - DEFAULT_LAYOUT.left;

interface Scene {
  tanks: TankState[];
  player: TankState;
  settings: Settings;
}

/** A battlefield from the seed: terrain, the child's tank at one end and `count` tanks apart by minTankGap. */
function scene(seed: number, min: number, max: number, count: number): Scene {
  const settings: Settings = { ...defaultSettings(), range: { preset: 'custom', min, max } };
  const terrain = generateTerrain(deriveSeed(seed, 0), WORLD_WIDTH, WORLD_HEIGHT);
  const rng = createRng(seed);
  const side = rng.next() < 0.5 ? min : max;
  const gap = minTankGap(min, max);
  const placed: number[] = [];
  for (let tries = 0; placed.length < count && tries < 500; tries++) {
    const n = rng.int(min, max);
    if (Math.abs(n - side) >= gap && placed.every((p) => Math.abs(p - n) >= gap)) placed.push(n);
  }
  const tanks = placed.map((n, i) => makeTank(`t${i}`, i === 0 ? 'enemy' : 'decoy', n, settings, terrain));
  return { tanks, player: makeTank('player', 'player', side, settings, terrain), settings };
}

function curvesFor(sc: Scene, style: 'curved' | 'tangled', seed: number): PointerCurve[] {
  return pointerCurves({ style, seed, range: sc.settings.range, tanks: sc.tanks, others: [sc.player], worldHeight: WORLD_HEIGHT });
}

function cross(a: Point, b: Point, c: Point, d: Point): boolean {
  const o = (p: Point, q: Point, r: Point) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

function crosses(p: Point[], q: Point[]): boolean {
  for (let i = 1; i < p.length; i++) for (let j = 1; j < q.length; j++) if (cross(p[i - 1]!, p[i]!, q[j - 1]!, q[j]!)) return true;
  return false;
}

function insideBox(p: Point, t: TankState): boolean {
  const ground = toScreenY(t.y, WORLD_HEIGHT);
  return Math.abs(p.x - t.x) <= BODY_BOX.halfWidth + CURVE_MARGIN && p.y <= ground + CURVE_MARGIN && p.y >= ground - BODY_BOX.height - CURVE_MARGIN;
}

const RANGES: Array<[number, number]> = [
  [0, 100],
  [0, 20],
  [550, 780],
  [0, 1000],
];

describe('pointerCurves fairness (amendment 21, FR-144, FR-145)', () => {
  for (const style of ['curved', 'tangled'] as const) {
    it(`${style}: ends, bounds, label avoidance, other tanks, crossings and colors over 300 seeds`, () => {
      let total = 0;
      let wide = 0;
      for (let seed = 1; seed <= 300; seed++) {
        const [min, max] = RANGES[seed % RANGES.length]!;
        const sc = scene(seed, min, max, 1 + (seed % 4));
        const curves = curvesFor(sc, style, seed);
        expect(curves).toHaveLength(sc.tanks.length);
        const ends = new Set<number>();
        for (const c of curves) {
          const tank = sc.tanks.find((t) => t.id === c.tankId)!;
          const endX = numberToX(tank.position, min, max);
          const last = c.points.at(-1)!;
          expect(Math.abs(last.x - endX), `seed ${seed} end`).toBeLessThanOrEqual(0.5);
          expect(last.y).toBe(AXIS_Y);
          ends.add(Math.round(last.x));
          const centerY = toScreenY(tank.y + 12, WORLD_HEIGHT);
          expect(Math.abs(c.points[0]!.x - tank.x)).toBeLessThanOrEqual(0.5);
          for (const p of c.points) {
            expect(p.x, `seed ${seed} x`).toBeGreaterThanOrEqual(8);
            expect(p.x).toBeLessThanOrEqual(WORLD_WIDTH - 8);
            expect(p.y).toBeGreaterThanOrEqual(centerY - 0.5);
            expect(p.y).toBeLessThanOrEqual(AXIS_Y);
            // Inside the ruler band the line runs straight down to its own end: it crosses no label and no other end.
            if (p.y > TAIL_TOP) expect(Math.abs(p.x - endX), `seed ${seed} tail`).toBeLessThanOrEqual(0.5);
            for (const other of [...sc.tanks.filter((t) => t !== tank), sc.player]) expect(insideBox(p, other), `seed ${seed} behind ${other.id}`).toBe(false);
          }
          expect(c.bow).toBeLessThanOrEqual(0.2 * RULER_WIDTH + 0.5);
          total++;
          if (c.bow >= 0.08 * RULER_WIDTH - 0.5) wide++;
          if (style === 'curved') expect(c.color).toBeNull();
        }
        expect(ends.size).toBe(curves.length);
        if (style === 'curved') {
          for (let i = 0; i < curves.length; i++) for (let j = i + 1; j < curves.length; j++) expect(crosses(curves[i]!.points, curves[j]!.points), `seed ${seed} cross`).toBe(false);
        } else {
          const colors = curves.map((c) => c.color);
          expect(new Set(colors).size).toBe(curves.length);
          for (const color of colors) expect(LINE_COLORS).toContain(color);
        }
        // The same input gives the same curves.
        expect(curvesFor(sc, style, seed)).toEqual(curves);
      }
      expect(wide / total, `${wide} of ${total} curves bow at least 8%`).toBeGreaterThanOrEqual(0.95);
    });
  }

  it('the ruler band top is above the axis, so the vertical tail reaches the ruler from above', () => {
    expect(TAIL_TOP).toBeLessThan(RULER_TOP);
    expect(TAIL_TOP).toBeLessThan(AXIS_Y);
  });

  it('tangled lines cross in some scenes', () => {
    let crossed = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const curves = curvesFor(scene(seed, 0, 100, 3), 'tangled', seed);
      if (curves.some((a, i) => curves.slice(i + 1).some((b) => crosses(a.points, b.points)))) crossed++;
    }
    expect(crossed).toBeGreaterThan(10);
  });
});

describe('pointAlong and curveLength (FR-146)', () => {
  it('walks a polyline by its length', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 3, y: 4 },
      { x: 3, y: 10 },
    ];
    expect(curveLength(pts)).toBe(11);
    expect(pointAlong(pts, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAlong(pts, 1)).toEqual({ x: 3, y: 10 });
    const mid = pointAlong(pts, 5 / 11);
    expect(mid.x).toBeCloseTo(3);
    expect(mid.y).toBeCloseTo(4);
  });
});

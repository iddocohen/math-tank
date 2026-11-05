import { describe, expect, it } from 'vitest';
import {
  aimAngleFromPointer,
  dottedTrail,
  edgeMarker,
  launchAngle,
  pathDuration,
  pathPointAt,
  terrainPolygon,
  toScreenY,
} from './geometry';
import { STEP } from '../physics/ballistics';

describe('toScreenY', () => {
  it('flips physics y (up from the bottom) to screen y (down from the top)', () => {
    expect(toScreenY(0, 900)).toBe(900);
    expect(toScreenY(900, 900)).toBe(0);
    expect(toScreenY(250, 900)).toBe(650);
  });
});

describe('terrainPolygon', () => {
  const heights = Float32Array.from({ length: 101 }, (_, x) => 100 + x);

  it('closes the surface along the bottom of the world', () => {
    const pts = terrainPolygon(heights, 900, 10);
    expect(pts[0]).toEqual({ x: 0, y: 900 });
    expect(pts[pts.length - 1]).toEqual({ x: 100, y: 900 });
  });

  it('samples every step columns and always includes the last column, in screen y', () => {
    const pts = terrainPolygon(heights, 900, 30);
    const surface = pts.slice(1, -1);
    expect(surface.map((p) => p.x)).toEqual([0, 30, 60, 90, 100]);
    expect(surface[0]).toEqual({ x: 0, y: 800 });
    expect(surface[4]).toEqual({ x: 100, y: 700 });
  });
});

describe('pathPointAt', () => {
  const path = [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
    { x: 20, y: 0 },
  ];

  it('starts at the first point and ends at the last', () => {
    expect(pathPointAt(path, 0, 1)).toEqual({ point: { x: 0, y: 0 }, index: 0, done: false });
    const end = pathPointAt(path, 10_000, 1);
    expect(end.point).toEqual({ x: 20, y: 0 });
    expect(end.done).toBe(true);
  });

  it('interpolates between samples using the physics step at the given speed', () => {
    // One sample per STEP seconds; halfway between sample 0 and 1 at speed 1.
    const half = (STEP * 1000) / 2;
    const r = pathPointAt(path, half, 1);
    expect(r.point.x).toBeCloseTo(5);
    expect(r.point.y).toBeCloseTo(5);
    expect(r.index).toBe(0);
    // Double speed reaches sample 1 in the same time.
    expect(pathPointAt(path, half, 2).point.x).toBeCloseTo(10);
  });

  it('handles a path with one point', () => {
    expect(pathPointAt([{ x: 3, y: 4 }], 0, 1)).toEqual({ point: { x: 3, y: 4 }, index: 0, done: true });
  });

  it('reports done at exactly pathDuration despite floating-point rounding', () => {
    for (const n of [2, 17, 249, 1000]) {
      for (const speed of [1, 1.5, 1.6, 2.3]) {
        const long = Array.from({ length: n }, (_, i) => ({ x: i, y: 0 }));
        expect(pathPointAt(long, pathDuration(long, speed), speed).done).toBe(true);
      }
    }
  });

  it('pathDuration matches the time at which pathPointAt reports done', () => {
    const ms = pathDuration(path, 1.5);
    expect(pathPointAt(path, ms - 1, 1.5).done).toBe(false);
    expect(pathPointAt(path, ms, 1.5).done).toBe(true);
  });
});

describe('aimAngleFromPointer', () => {
  const muzzle = { x: 100, y: 100 };

  it('follows the physics convention: 0 right, 90 up, 180 left', () => {
    expect(aimAngleFromPointer(muzzle, { x: 200, y: 100 })).toBeCloseTo(0);
    expect(aimAngleFromPointer(muzzle, { x: 100, y: 200 })).toBeCloseTo(90);
    expect(aimAngleFromPointer(muzzle, { x: 0, y: 100 })).toBeCloseTo(180);
    expect(aimAngleFromPointer(muzzle, { x: 200, y: 200 })).toBeCloseTo(45);
  });

  it('clamps a pointer below the muzzle to the nearest horizontal side', () => {
    expect(aimAngleFromPointer(muzzle, { x: 200, y: 50 })).toBe(0);
    expect(aimAngleFromPointer(muzzle, { x: 0, y: 50 })).toBe(180);
  });

  it('returns null when the pointer is on the muzzle', () => {
    expect(aimAngleFromPointer(muzzle, { x: 100, y: 100 })).toBeNull();
  });
});

describe('dottedTrail', () => {
  it('places dots at an even spacing along the path, starting at the first point', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const dots = dottedTrail(path, 25);
    expect(dots.map((d) => d.x)).toEqual([0, 25, 50, 75, 100]);
  });

  it('returns nothing for an empty path', () => {
    expect(dottedTrail([], 10)).toEqual([]);
  });
});

describe('edgeMarker', () => {
  it('marks the side edge where an out-of-bounds shell left the battlefield', () => {
    expect(edgeMarker({ outOfBounds: true, impact: { x: 1600, y: 500 } }, 1600)).toEqual({ x: 1600, y: 500, side: 'right' });
    expect(edgeMarker({ outOfBounds: true, impact: { x: 0, y: 300 } }, 1600)).toEqual({ x: 0, y: 300, side: 'left' });
  });

  it('returns null for a shell that landed inside', () => {
    expect(edgeMarker({ outOfBounds: false, impact: { x: 800, y: 300 } }, 1600)).toBeNull();
  });
});

describe('launchAngle', () => {
  it('reads the cannon angle from the first segment of a path', () => {
    expect(launchAngle([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBeCloseTo(45);
    expect(launchAngle([{ x: 0, y: 0 }, { x: -1, y: 1 }])).toBeCloseTo(135);
  });

  it('returns null for a path shorter than two points', () => {
    expect(launchAngle([{ x: 0, y: 0 }])).toBeNull();
  });
});

/**
 * Heightmap terrain (research R5, FR-001, FR-005, FR-007).
 *
 * Coordinates: world units, x grows to the right, y grows upward from the bottom of the world (y = 0).
 * The renderer flips y. A heightmap holds one surface height per column x = 0 .. worldWidth - 1.
 * Heightmaps are never changed in place; carveCrater returns a new one.
 */
import { createRng } from '../rng';
import type { Heightmap } from '../types';

/**
 * Terrain never drops below this height, also under craters. In the 900-unit world the floor line is at
 * screen y 700, above the ruler band that starts at 720 (core/view/layout.ts, tasks.md T184).
 */
export const FLOOR = 200;

const SMOOTH_RADIUS = 12;
const SMOOTH_PASSES = 2;

export function generateTerrain(seed: number, worldWidth: number, worldHeight: number): Heightmap {
  const rng = createRng(seed);
  const width = Math.max(1, Math.floor(worldWidth));
  // Hills start above the floor, so valleys and craters stay above the ruler band.
  const base = FLOOR + worldHeight * (0.22 + rng.next() * 0.06);
  const waveCount = rng.int(3, 4);
  const waves = Array.from({ length: waveCount }, (_, i) => ({
    // Lower waves are wide and tall, later ones narrower and smaller.
    cycles: 0.5 + i * 1.2 + rng.next() * 1.5,
    amplitude: (worldHeight * (0.08 + rng.next() * 0.05)) / (i + 1),
    phase: rng.next() * Math.PI * 2,
  }));

  let heights = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    let h = base;
    for (const w of waves) h += w.amplitude * Math.sin((x / width) * w.cycles * Math.PI * 2 + w.phase);
    heights[x] = h;
  }
  for (let pass = 0; pass < SMOOTH_PASSES; pass++) heights = boxSmooth(heights, SMOOTH_RADIUS);

  const min = FLOOR + worldHeight * 0.05;
  const max = worldHeight * 0.75;
  for (let x = 0; x < width; x++) heights[x] = Math.min(max, Math.max(min, heights[x] as number));
  return heights;
}

function boxSmooth(src: Heightmap, radius: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(src.length);
  const last = src.length - 1;
  for (let x = 0; x <= last; x++) {
    let sum = 0;
    let n = 0;
    for (let k = Math.max(0, x - radius); k <= Math.min(last, x + radius); k++) {
      sum += src[k] as number;
      n++;
    }
    out[x] = sum / n;
  }
  return out;
}

/** Removes the part of the terrain inside the circle and returns a new heightmap; never below `floor`. */
export function carveCrater(t: Heightmap, cx: number, cy: number, radius: number, floor: number): Heightmap {
  const out = new Float32Array(t);
  const from = Math.max(0, Math.ceil(cx - radius));
  const to = Math.min(t.length - 1, Math.floor(cx + radius));
  for (let x = from; x <= to; x++) {
    const dx = x - cx;
    if (Math.abs(dx) >= radius) continue;
    const bottom = cy - Math.sqrt(radius * radius - dx * dx);
    const h = out[x] as number;
    if (h > bottom) out[x] = Math.max(floor, bottom);
  }
  return out;
}

/** Surface height at x, linearly interpolated between columns; x is clamped to the world. */
export function surfaceY(t: Heightmap, x: number): number {
  const last = t.length - 1;
  if (last < 0) return 0;
  if (x <= 0) return t[0] as number;
  if (x >= last) return t[last] as number;
  const i = Math.floor(x);
  const f = x - i;
  const a = t[i] as number;
  const b = t[i + 1] as number;
  return a + (b - a) * f;
}

/** The y at which a tank at x rests: its base sits on the surface (FR-007). */
export function settleY(t: Heightmap, x: number): number {
  return surfaceY(t, x);
}

/**
 * Seeded details of the ground (amendment 14, FR-107, FR-108): scorch marks at crater edges, pebbles, grass tufts and
 * two layers of distant hills. Pure; src/game/TerrainView.ts draws them. Pebbles, tufts and distant hills come from
 * the terrain seed, so they change only with a new landscape.
 */
import type { Heightmap } from '../types';
import { createRng, deriveSeed } from '../rng';

/** Columns on each side of a lowered column that are scorched too, so the crater rim shows the mark. */
export const SCORCH_BORDER = 6;

/**
 * Marks (1) every column where `next` is lower than `prev`, plus SCORCH_BORDER columns on each side, on top of the
 * earlier `marks`. A new landscape (`prev` null) starts with no marks. Returns a new array.
 */
export function scorchMarks(prev: Heightmap | null, next: Heightmap, marks: Uint8Array | null): Uint8Array {
  const out = new Uint8Array(next.length);
  if (prev === null || marks === null || prev.length !== next.length) return out;
  out.set(marks);
  for (let x = 0; x < next.length; x++) {
    if ((next[x] as number) < (prev[x] as number) - 0.5) {
      const from = Math.max(0, x - SCORCH_BORDER);
      const to = Math.min(next.length - 1, x + SCORCH_BORDER);
      for (let i = from; i <= to; i++) out[i] = 1;
    }
  }
  return out;
}

export interface Pebble {
  x: number;
  /** Depth below the surface, in world units. */
  depth: number;
  rx: number;
  ry: number;
  color: number;
}

const PEBBLE_COLORS = [0x8a7a68, 0x6f6252, 0x9c8f7d, 0x5e5346];

export function pebbles(seed: number, width: number): Pebble[] {
  const rng = createRng(deriveSeed(seed, 0x9e66));
  const n = rng.int(8, 16);
  const out: Pebble[] = [];
  for (let i = 0; i < n; i++) {
    const rx = 4 + rng.next() * 6;
    out.push({ x: rng.next() * width, depth: 22 + rng.next() * 110, rx, ry: rx * (0.55 + rng.next() * 0.25), color: rng.pick(PEBBLE_COLORS) });
  }
  return out;
}

export interface Tuft {
  x: number;
  height: number;
  /** Lean of the blades, -1 (left) to 1 (right). */
  lean: number;
}

const TUFT_SPACING = 14;

export function tufts(seed: number, width: number): Tuft[] {
  const rng = createRng(deriveSeed(seed, 0x7f7f));
  const out: Tuft[] = [];
  for (let x = rng.next() * TUFT_SPACING; x < width; x += TUFT_SPACING * (0.7 + rng.next() * 0.6)) {
    out.push({ x, height: 6 + rng.next() * 8, lean: rng.next() * 2 - 1 });
  }
  return out;
}

export interface HillLayer {
  /** Screen points of the top edge, left to right. */
  points: Array<[number, number]>;
  color: number;
}

/** Two layers of soft distant hills, the far one higher and lighter. y is screen y (down). */
export function distantHills(seed: number, width: number, worldHeight: number): [HillLayer, HillLayer] {
  const layer = (salt: number, base: number, amp: number, color: number): HillLayer => {
    const rng = createRng(deriveSeed(seed, salt));
    const waves = [0, 1, 2].map((k) => ({ len: 260 + rng.next() * 420 / (k + 1), phase: rng.next() * Math.PI * 2, a: amp / (k + 1) }));
    const points: Array<[number, number]> = [];
    for (let x = 0; x <= width; x += 20) {
      const y = base - waves.reduce((s, w) => s + w.a * Math.sin((x / w.len) * Math.PI * 2 + w.phase), 0);
      points.push([Math.min(x, width), Math.round(Math.min(640, Math.max(300, y)) * 10) / 10]);
    }
    return { points, color };
  };
  const scale = worldHeight / 900;
  return [layer(0xfa7, 420 * scale, 40, 0xb7cfe0), layer(0x7ea7, 500 * scale, 45, 0x93b49a)];
}

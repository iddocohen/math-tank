import { describe, expect, it } from 'vitest';
import { tankStyle, YOU_MARKER_MS } from './tankStyle';

function rgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

/** Hue in degrees, 0 to 360. */
function hue(hex: number): number {
  const [r, g, b] = rgb(hex).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

function luminance(hex: number): number {
  const [r, g, b] = rgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe('tankStyle (amendment 05, FR-077, FR-078)', () => {
  const player = tankStyle('player');
  const enemy = tankStyle('enemy');

  it('the child tank and the enemy differ by color, body shape and flag, not by color alone', () => {
    expect(player.color).not.toBe(enemy.color);
    expect(player.body).toBe('rounded');
    expect(enemy.body).toBe('angular');
    expect(player.flag).toBe('yellowStar');
    expect(enemy.flag).toBe('black');
  });

  it('the child tank is blue and the enemy red', () => {
    const p = hue(player.color);
    const e = hue(enemy.color);
    expect(p).toBeGreaterThanOrEqual(190);
    expect(p).toBeLessThanOrEqual(240);
    expect(e < 20 || e > 340).toBe(true);
  });

  it('a decoy looks exactly like the enemy (amendment 10, FR-077)', () => {
    expect(tankStyle('decoy')).toEqual(enemy);
  });

  it('the enemy body is darker than the child tank', () => {
    expect(luminance(enemy.color)).toBeLessThan(luminance(player.color));
  });

  it('every health bar has the color of its tank', () => {
    for (const kind of ['player', 'enemy'] as const) {
      expect(tankStyle(kind).barColor).toBe(tankStyle(kind).color);
    }
  });

  it('the "Du" arrow shows for 3 seconds', () => {
    expect(YOU_MARKER_MS).toBe(3000);
  });
});

import { describe, expect, it } from 'vitest';
import { BLAST_RADIUS, CHARGED_BLAST_RADIUS, damageAt, MAX_DAMAGE } from './damage';

const impact = { x: 500, y: 300 };

describe('damageAt', () => {
  it('gives the maximum for a direct hit', () => {
    expect(damageAt(impact, { x: 515, y: 310 }, BLAST_RADIUS, true)).toBe(MAX_DAMAGE);
    expect(damageAt(impact, impact, BLAST_RADIUS, false)).toBe(MAX_DAMAGE);
  });

  it('decreases strictly with distance inside the blast radius', () => {
    for (const radius of [BLAST_RADIUS, CHARGED_BLAST_RADIUS]) {
      let previous = Infinity;
      for (let d = 0; d < radius; d += radius / 20) {
        const dmg = damageAt(impact, { x: impact.x + d, y: impact.y }, radius, false);
        expect(dmg).toBeLessThan(previous);
        expect(dmg).toBeGreaterThan(0);
        previous = dmg;
      }
    }
  });

  it('is 0 at and outside the blast radius', () => {
    expect(damageAt(impact, { x: impact.x + BLAST_RADIUS, y: impact.y }, BLAST_RADIUS, false)).toBe(0);
    expect(damageAt(impact, { x: impact.x, y: impact.y + BLAST_RADIUS * 3 }, BLAST_RADIUS, false)).toBe(0);
  });

  it('has a charged blast radius larger than the normal one', () => {
    expect(CHARGED_BLAST_RADIUS).toBeGreaterThan(BLAST_RADIUS);
    const tank = { x: impact.x + BLAST_RADIUS + 5, y: impact.y };
    expect(damageAt(impact, tank, BLAST_RADIUS, false)).toBe(0);
    expect(damageAt(impact, tank, CHARGED_BLAST_RADIUS, false)).toBeGreaterThan(0);
  });
});

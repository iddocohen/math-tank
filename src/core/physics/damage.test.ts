import { describe, expect, it } from 'vitest';
import * as damage from './damage';
import { BLAST_RADIUS, damageAt, MAX_DAMAGE } from './damage';

const impact = { x: 500, y: 300 };

describe('damageAt', () => {
  it('gives the maximum for a direct hit', () => {
    expect(damageAt(impact, { x: 515, y: 310 }, BLAST_RADIUS, true)).toBe(MAX_DAMAGE);
    expect(damageAt(impact, impact, BLAST_RADIUS, false)).toBe(MAX_DAMAGE);
  });

  it('decreases strictly with distance inside the blast radius', () => {
    let previous = Infinity;
    for (let d = 0; d < BLAST_RADIUS; d += BLAST_RADIUS / 20) {
      const dmg = damageAt(impact, { x: impact.x + d, y: impact.y }, BLAST_RADIUS, false);
      expect(dmg).toBeLessThan(previous);
      expect(dmg).toBeGreaterThan(0);
      previous = dmg;
    }
  });

  it('is 0 at and outside the blast radius', () => {
    expect(damageAt(impact, { x: impact.x + BLAST_RADIUS, y: impact.y }, BLAST_RADIUS, false)).toBe(0);
    expect(damageAt(impact, { x: impact.x, y: impact.y + BLAST_RADIUS * 3 }, BLAST_RADIUS, false)).toBe(0);
  });

  it('has no charged blast radius any more (FR-011 removed)', () => {
    expect('CHARGED_BLAST_RADIUS' in damage).toBe(false);
  });
});

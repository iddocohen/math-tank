/** Amendment 14 (T287, FR-113): screen shake and particle amounts, with and without reduced motion. */
import { describe, expect, it } from 'vitest';
import { motionProfile, particleCount } from './motion';

describe('motionProfile', () => {
  it('shakes 2 to 3 CSS pixels for less than 200 ms with all particles', () => {
    const p = motionProfile(false);
    expect(p.shake).toBe(true);
    expect(p.shakeCssPx).toBe(2.5);
    expect(p.shakeCssPx).toBeGreaterThanOrEqual(2);
    expect(p.shakeCssPx).toBeLessThanOrEqual(3);
    expect(p.shakeMs).toBe(150);
    expect(p.shakeMs).toBeLessThan(200);
    expect(p.particleFactor).toBe(1);
  });

  it('does not shake and throws at most 40 % of the particles with reduced motion', () => {
    const p = motionProfile(true);
    expect(p.shake).toBe(false);
    expect(p.particleFactor).toBeLessThanOrEqual(0.4);
    expect(p.particleFactor).toBeGreaterThan(0);
  });
});

describe('particleCount', () => {
  it('scales and rounds, and keeps at least one particle', () => {
    expect(particleCount(28, motionProfile(false))).toBe(28);
    expect(particleCount(28, motionProfile(true))).toBeLessThanOrEqual(Math.round(28 * 0.4));
    expect(particleCount(1, motionProfile(true))).toBe(1);
    expect(particleCount(0, motionProfile(true))).toBe(0);
  });
});

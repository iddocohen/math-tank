import { describe, expect, it } from 'vitest';
import { applyImpact, createRound, WORLD_HEIGHT, WORLD_WIDTH } from '../battle/round';
import { BLAST_RADIUS } from '../physics/damage';
import { carveCrater, FLOOR, generateTerrain } from '../physics/terrain';
import { createRng } from '../rng';
import { defaultSettings } from '../settings/defaults';
import type { Heightmap, BattleState } from '../types';
import { toScreenY } from './geometry';
import { GROUND_ABOVE_RULER_MARGIN, RULER_BOTTOM, RULER_TOP } from './layout';

/** Lowest allowed screen y for the ground and for a tank's bottom. */
const LIMIT = RULER_TOP - GROUND_ABOVE_RULER_MARGIN;

function expectAboveRuler(t: Heightmap, label: string): void {
  let lowest = Infinity;
  for (const h of t) lowest = Math.min(lowest, h);
  expect(lowest, `${label}: lowest height`).toBeGreaterThanOrEqual(FLOOR);
  expect(toScreenY(lowest, WORLD_HEIGHT), `${label}: lowest surface screen y`).toBeLessThanOrEqual(LIMIT);
}

function expectTanksAboveRuler(s: BattleState, label: string): void {
  for (const tank of [s.player, s.enemy]) {
    expect(toScreenY(tank.y, WORLD_HEIGHT), `${label}: ${tank.id} bottom`).toBeLessThanOrEqual(LIMIT);
  }
}

describe('ruler band below the battlefield (T184, FR-015, FR-058)', () => {
  it('the ruler band lies inside the world, below the floor line with the margin', () => {
    expect(RULER_TOP).toBeLessThan(RULER_BOTTOM);
    expect(RULER_BOTTOM).toBeLessThanOrEqual(WORLD_HEIGHT);
    expect(toScreenY(FLOOR, WORLD_HEIGHT)).toBeLessThanOrEqual(LIMIT);
  });

  it('generated ground stays above the ruler for many seeds', () => {
    for (let seed = 0; seed < 300; seed++) expectAboveRuler(generateTerrain(seed, WORLD_WIDTH, WORLD_HEIGHT), `seed ${seed}`);
  });

  it('craters anywhere, also repeated at one spot, never dig the ground into the ruler band', () => {
    for (let seed = 0; seed < 40; seed++) {
      const rng = createRng(seed + 1000);
      let t = generateTerrain(seed, WORLD_WIDTH, WORLD_HEIGHT);
      for (let i = 0; i < 60; i++) {
        const x = rng.next() * WORLD_WIDTH;
        t = carveCrater(t, x, rng.next() * WORLD_HEIGHT, BLAST_RADIUS * (0.5 + rng.next() * 3), FLOOR);
      }
      // Twenty more craters at one spot, each at the current surface.
      const spot = 200 + rng.next() * 1200;
      for (let i = 0; i < 20; i++) t = carveCrater(t, spot, t[Math.round(spot)]!, BLAST_RADIUS, FLOOR);
      expectAboveRuler(t, `seed ${seed}`);
    }
  });

  it('tanks stay above the ruler after repeated hits at their positions', () => {
    const settings = defaultSettings();
    const rules = { enemyDamageFactor: 0, noDamage: true, exactHit: false, range: settings.range };
    for (let seed = 0; seed < 40; seed++) {
      let s = createRound(settings, seed, seed % 2 === 0 ? 'left' : 'right');
      expectTanksAboveRuler(s, `seed ${seed} start`);
      for (let i = 0; i < 15; i++) {
        for (const tank of [s.player, s.enemy]) {
          s = applyImpact(s, { point: { x: tank.x, y: tank.y }, hitTargetId: null, outOfBounds: false, shooter: 'enemy' }, BLAST_RADIUS, rules);
        }
      }
      expectAboveRuler(s.terrain, `seed ${seed} after hits`);
      expectTanksAboveRuler(s, `seed ${seed} after hits`);
    }
  });
});

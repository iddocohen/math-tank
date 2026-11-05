import { describe, expect, it } from 'vitest';
import { HIDDEN_SHELL_SPREAD, hiddenShellEntryX, hiddenShellPath } from './hiddenShell';
import { WORLD_HEIGHT, WORLD_WIDTH } from './round';
import { generateTerrain, surfaceY } from '../physics/terrain';

const terrain = generateTerrain(7, WORLD_WIDTH, WORLD_HEIGHT);

describe('hidden enemy shell (T215, FR-010)', () => {
  it('the entry x comes from the round seed, the shot index and the child tank only', () => {
    const a = hiddenShellEntryX(42, 0, 300);
    expect(hiddenShellEntryX(42, 0, 300)).toBe(a);
    expect(Math.abs(a - 300)).toBeLessThanOrEqual(HIDDEN_SHELL_SPREAD);
    const xs = new Set([0, 1, 2, 3, 4, 5].map((i) => hiddenShellEntryX(42, i, 300)));
    expect(xs.size).toBeGreaterThan(1);
    // Clamped to the world.
    expect(hiddenShellEntryX(42, 0, 0)).toBeGreaterThanOrEqual(0);
    expect(hiddenShellEntryX(42, 0, WORLD_WIDTH)).toBeLessThanOrEqual(WORLD_WIDTH);
  });

  it('enters at the top edge and falls onto the impact without passing below the ground', () => {
    for (let i = 0; i < 20; i++) {
      const impactX = 100 + i * 70;
      const impact = { x: impactX, y: surfaceY(terrain, impactX) };
      const path = hiddenShellPath({ impact, entryX: hiddenShellEntryX(9, i, impactX + 40), terrain, worldHeight: WORLD_HEIGHT });
      expect(path[0]!.y).toBe(WORLD_HEIGHT);
      expect(path.at(-1)).toEqual(impact);
      expect(path.length).toBeGreaterThan(10);
      for (const p of path.slice(0, -1)) expect(p.y).toBeGreaterThanOrEqual(surfaceY(terrain, p.x) - 1e-6);
      // Falling: y never goes up.
      for (let k = 1; k < path.length; k++) expect(path[k]!.y).toBeLessThanOrEqual(path[k - 1]!.y);
    }
  });

  it('drops straight down onto the impact when a hill would block the slanted path', () => {
    // A tall wall between the entry and the impact.
    const wall = new Float32Array(WORLD_WIDTH + 1).fill(100);
    for (let x = 480; x <= 520; x++) wall[x] = 850;
    const impact = { x: 600, y: 100 };
    const path = hiddenShellPath({ impact, entryX: 400, terrain: wall, worldHeight: WORLD_HEIGHT });
    expect(path[0]).toEqual({ x: 600, y: WORLD_HEIGHT });
    expect(path.every((p) => p.x === 600)).toBe(true);
  });
});

/**
 * The enemy's shell in comparison turns (FR-043a, amendment 07). The enemy looks the same as its decoys, so a path
 * from its cannon would show which tank is the enemy. Its shell enters from the top edge of the world, at an x taken
 * from the round seed, the enemy's shot index and the child's tank only, and falls onto the impact the enemy's
 * draw chose. In every other turn the enemy fires from its own tank.
 */
import { createRng, deriveSeed } from '../rng';
import type { Heightmap, Point } from '../types';
import { GRAVITY, STEP } from '../physics/ballistics';
import { surfaceY } from '../physics/terrain';
import { WORLD_WIDTH } from './round';

/** The shell enters at most this far left or right of the child's tank. */
export const TOP_SHELL_SPREAD = 160;

/** Where the shell enters the top edge; nothing about the enemy goes in. */
export function topShellEntryX(roundSeed: number, shotIndex: number, playerX: number, worldWidth = WORLD_WIDTH): number {
  const offset = createRng(deriveSeed(roundSeed, 5, shotIndex)).int(-TOP_SHELL_SPREAD, TOP_SHELL_SPREAD);
  return Math.min(worldWidth, Math.max(0, playerX + offset));
}

export interface TopShellInput {
  impact: Point;
  entryX: number;
  terrain: Heightmap;
  worldHeight: number;
}

/**
 * A falling path from (entryX, worldHeight) to the impact, one point per physics step, under gravity. When the
 * slanted path would pass below the ground, the shell falls straight down onto the impact instead.
 */
export function topShellPath({ impact, entryX, terrain, worldHeight }: TopShellInput): Point[] {
  const slanted = fall(entryX, impact, worldHeight);
  const clear = slanted.slice(0, -1).every((p) => p.y >= surfaceY(terrain, p.x));
  return clear ? slanted : fall(impact.x, impact, worldHeight);
}

function fall(x0: number, impact: Point, top: number): Point[] {
  const drop = Math.max(0, top - impact.y);
  const duration = Math.sqrt((2 * drop) / GRAVITY);
  const steps = Math.max(1, Math.ceil(duration / STEP));
  const path: Point[] = [];
  for (let i = 0; i < steps; i++) {
    const f = i / steps;
    // Constant sideways speed, free fall downward.
    path.push({ x: x0 + (impact.x - x0) * f, y: top - drop * f * f });
  }
  path.push({ x: impact.x, y: impact.y });
  return path;
}

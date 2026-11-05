/** Explosion damage of enemy shells (FR-006). The player's shell follows the number rule in battle/round.ts (FR-066). */
import type { Point } from '../types';

/** Damage of a direct hit; tanks have 100 health. */
export const MAX_DAMAGE = 40;
/** Blast radius of a normal shell, in world units. */
export const BLAST_RADIUS = 60;

/** 0..MAX_DAMAGE: the maximum for a direct hit, otherwise falling linearly to 0 at the blast radius. */
export function damageAt(impact: Point, tank: Point, blastRadius: number, directHit: boolean): number {
  if (directHit) return MAX_DAMAGE;
  const d = Math.hypot(tank.x - impact.x, tank.y - impact.y);
  if (d >= blastRadius) return 0;
  return MAX_DAMAGE * (1 - d / blastRadius);
}

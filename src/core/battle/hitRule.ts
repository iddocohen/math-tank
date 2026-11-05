/**
 * The hit rule (amendment 06, FR-006, FR-066, data-model.md "Hit rule"). The pointer line is the target: only the
 * enemy's exact number destroys it. A shell whose landing point is on the enemy tank's body (within half the tank's
 * drawn width of its center, measured along the battlefield) but not at its number is a near miss: the tank shakes.
 * An enemy shell that hits the child's tank costs one of LIVES hearts.
 */
import { DEFAULT_LAYOUT, numberToX, type Layout } from '../numberline/mapping';
import { TANK_WIDTH } from '../math/gaps';
import type { Point, TankState } from '../types';

export type ShotKind = 'hit' | 'near' | 'miss';

/** The child's hearts at the start of a round (FR-080). */
export const LIVES = 3;

/** Half the tank width along the battlefield, in world units. */
const HALF_BODY = TANK_WIDTH / 2;
/** Absorbs floating-point rounding at the exact edge of the body. */
const EPSILON = 1e-9;

/** Half the tank width converted to numbers for the range (about 2 in 0 to 100, about 21 in 0 to 1000). */
export function bodyHalfWidth(min: number, max: number, layout: Layout = DEFAULT_LAYOUT): number {
  return (HALF_BODY / (layout.right - layout.left)) * (max - min);
}

/** 'hit' at the exact number, 'near' when the landing x is on the tank body, otherwise 'miss'. */
export function shotKind(fired: number, target: number, range: { min: number; max: number }, layout: Layout = DEFAULT_LAYOUT): ShotKind {
  if (fired === target) return 'hit';
  const dx = Math.abs(numberToX(fired, range.min, range.max, layout) - numberToX(target, range.min, range.max, layout));
  return dx <= HALF_BODY + EPSILON ? 'near' : 'miss';
}

/**
 * An enemy shell hits the child's tank when it entered the tank's hit circle (`hitTargetId`) or landed on the
 * tank's body: within half the tank width of its x. A shell next to the tank does nothing.
 */
export function enemyHitsPlayer(impact: Point, hitTargetId: string | null, player: TankState): boolean {
  if (hitTargetId !== null) return hitTargetId === player.id;
  return Math.abs(impact.x - player.x) <= HALF_BODY + EPSILON;
}

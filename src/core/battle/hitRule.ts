/**
 * The player's hit rule (amendment 04, FR-066, FR-071, FR-074, data-model.md "Hit rule").
 * What the child sees decides the hit: a shell whose landing point is on the enemy tank's body
 * (within half the tank's drawn width of its center, measured along the battlefield) is a hit.
 * The exact number is a Volltreffer (bullseye) with double damage.
 */
import { DEFAULT_LAYOUT, numberToX, type Layout } from '../numberline/mapping';
import { TANK_WIDTH } from '../math/gaps';
import { MAX_DAMAGE } from '../physics/damage';

export type ShotKind = 'bullseye' | 'body' | 'miss';

/** Half the tank width along the battlefield, in world units. */
const HALF_BODY = TANK_WIDTH / 2;
/** Absorbs floating-point rounding at the exact edge of the body. */
const EPSILON = 1e-9;

/** Half the tank width converted to numbers for the range (about 2 in 0 to 100, about 21 in 0 to 1000). */
export function bodyHalfWidth(min: number, max: number, layout: Layout = DEFAULT_LAYOUT): number {
  return (HALF_BODY / (layout.right - layout.left)) * (max - min);
}

/** 'bullseye' at the exact number, 'body' when the landing x is on the tank body, otherwise 'miss'. */
export function shotKind(fired: number, target: number, range: { min: number; max: number }, layout: Layout = DEFAULT_LAYOUT): ShotKind {
  if (fired === target) return 'bullseye';
  const dx = Math.abs(numberToX(fired, range.min, range.max, layout) - numberToX(target, range.min, range.max, layout));
  return dx <= HALF_BODY + EPSILON ? 'body' : 'miss';
}

/** Damage to the enemy: a bullseye twice MAX_DAMAGE, a body hit MAX_DAMAGE (none with "Genau treffen"), a miss none. */
export function enemyDamage(kind: ShotKind, exactHit: boolean): number {
  if (kind === 'bullseye') return 2 * MAX_DAMAGE;
  if (kind === 'body') return exactHit ? 0 : MAX_DAMAGE;
  return 0;
}

/**
 * How each tank looks (amendment 05, FR-077, FR-078). The child's tank and the enemy differ by color, body shape
 * and flag, so they can be told apart without color. Decoys look exactly like the enemy. Each health bar has the
 * color of its tank. Pure, so the rules are tested without Phaser.
 */
import type { TankState } from '../types';

export interface TankStyle {
  /** Body and turret color (0xRRGGBB). */
  color: number;
  body: 'rounded' | 'angular';
  flag: 'yellowStar' | 'black';
  /** Health bar fill color above the tank. */
  barColor: number;
}

/** The "Du" arrow points at the child's tank this long at the start of every round. */
export const YOU_MARKER_MS = 3000;

const PLAYER: TankStyle = { color: 0x2f7be8, body: 'rounded', flag: 'yellowStar', barColor: 0x2f7be8 };
const ENEMY: TankStyle = { color: 0xb3261e, body: 'angular', flag: 'black', barColor: 0xb3261e };

export function tankStyle(kind: TankState['kind']): TankStyle {
  return kind === 'player' ? { ...PLAYER } : { ...ENEMY };
}

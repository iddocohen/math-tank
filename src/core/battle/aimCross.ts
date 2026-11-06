/**
 * "Zielkreuz" (amendment 19, FR-134, FR-135): whether the battle view draws the yellow aiming cross, its guide line,
 * the point on the ruler and the typed-number label. Pure; the view calls it on every state update with the round's
 * settings snapshot and `RoundState.rulerLevel`, so an adaptive level change shows or hides the cross at once.
 */
import type { AimCross } from '../settings/schema';
import type { RulerLevel } from '../types';

export function aimCrossShown(aimCross: AimCross, rulerLevel: RulerLevel): boolean {
  if (aimCross.mode === 'always') return true;
  if (aimCross.mode === 'never') return false;
  return rulerLevel <= aimCross.level;
}

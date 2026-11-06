/**
 * How long a hit's feedback stays (T233, FR-004, FR-066): the hit text in the overlay and the hit's landing mark on the
 * ruler both leave HIT_FEEDBACK_MS after the hit, or at once when a later challenge starts. Both follow the hit with
 * these helpers, so they use the same rule.
 */
import type { Challenge, LastShot, RoundState } from '../types';

export const HIT_FEEDBACK_MS = 2000;

/**
 * A hit and the challenge it belongs to: the one shown after it. The controller passes the shot phase first, so the
 * challenge is undefined until a state after 'playerShot' is seen.
 */
export interface HitOwner {
  readonly shot: LastShot;
  readonly challenge: Challenge | null | undefined;
}

/**
 * Follows the latest hit from state to state: null when the last shot was no hit, a new owner for a new hit, and the
 * challenge filled in once the shot phase is over. Returns `prev` when nothing changed.
 */
export function followHit(prev: HitOwner | null, s: RoundState): HitOwner | null {
  const shot = s.lastShot?.hit ? s.lastShot : null;
  if (!shot) return null;
  const owner: HitOwner = prev?.shot === shot ? prev : { shot, challenge: undefined };
  return owner.challenge === undefined && s.phase !== 'playerShot' ? { shot, challenge: s.challenge } : owner;
}

/** A later challenge has started since the hit: its feedback goes at once. */
export function hitOutdated(owner: HitOwner, s: RoundState): boolean {
  return owner.challenge !== undefined && owner.challenge !== s.challenge;
}

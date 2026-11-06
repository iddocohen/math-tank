/**
 * Screen shake and particle amounts (amendment 14, FR-113). When the operating system asks for reduced motion the
 * screen does not shake and explosions throw at most 40 % of the particles. Pure; the game reads the media query.
 */

export interface MotionProfile {
  shake: boolean;
  /** Shake size in CSS pixels (2 to 3). */
  shakeCssPx: number;
  /** Shake length, under 200 ms. */
  shakeMs: number;
  /** Share of the usual particles an explosion throws. */
  particleFactor: number;
}

const FULL: MotionProfile = { shake: true, shakeCssPx: 2.5, shakeMs: 150, particleFactor: 1 };
const REDUCED: MotionProfile = { shake: false, shakeCssPx: 0, shakeMs: 0, particleFactor: 0.35 };

export function motionProfile(reducedMotion: boolean): MotionProfile {
  return { ...(reducedMotion ? REDUCED : FULL) };
}

/** The particles to throw instead of `n`: scaled and rounded, at least 1 when `n` is at least 1. */
export function particleCount(n: number, profile: MotionProfile): number {
  if (n < 1) return 0;
  return Math.max(1, Math.round(n * profile.particleFactor));
}

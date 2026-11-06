/**
 * What each play mode changes (amendment 17, FR-121 to FR-123), in one table: "Gemischt" ('mixed'), "Nur Zahlenstrahl"
 * ('ruler') and "Nur Rechnen" ('math'). The generator, the help steps, the overlay, the number line and the app read
 * these traits instead of checking the mode by name.
 */
import type { ChallengeKind, PlayMode } from './types';

export interface ModeTraits {
  /** The ruler is drawn and can be tapped; the tanks' pointer lines and the nearest-ten help use it. */
  showsRuler: boolean;
  /** The question banner shows and is read aloud ("Nur Zahlenstrahl" shows no question, FR-122). */
  showsQuestion: boolean;
  /** With the number pad setting "Automatisch", the pad shows on every screen (no ruler to tap, FR-123). */
  forcesPad: boolean;
  /**
   * The challenge kinds: 'enabled' follows the parent's challenge-type switches, 'readPosition' only reads the ruler,
   * 'enabledWithoutRuler' leaves out the kinds that need the ruler (RULER_KINDS in math/generate.ts).
   */
  kinds: 'enabled' | 'readPosition' | 'enabledWithoutRuler';
  /**
   * The kinds the generator tries, in order, when no allowed kind fits, before the final "find N" fallback; null keeps
   * the default (readPosition after keyboard input, FR-076). "Nur Rechnen" uses "after" and "before", which work for
   * almost every answer and need no ruler.
   */
  fallbackKinds: readonly ChallengeKind[] | null;
}

export const MODE_TRAITS: Readonly<Record<PlayMode, ModeTraits>> = {
  mixed: { showsRuler: true, showsQuestion: true, forcesPad: false, kinds: 'enabled', fallbackKinds: null },
  ruler: { showsRuler: true, showsQuestion: false, forcesPad: false, kinds: 'readPosition', fallbackKinds: null },
  math: { showsRuler: false, showsQuestion: true, forcesPad: true, kinds: 'enabledWithoutRuler', fallbackKinds: ['after', 'before'] },
};

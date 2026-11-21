/**
 * What each play mode changes (amendment 17, FR-121 to FR-123), in one table: "Gemischt" ('mixed'), "Nur Zahlenstrahl"
 * ('ruler'), "Plus und Minus" ('arithmetic') and "Zahlen-Rätsel" ('numbers', amendment 27). The generator, the help steps, the overlay, the number line and the app read
 * these traits instead of checking the mode by name.
 */
import { arithmeticAnswerSet } from './math/arithmetic';
import type { ChallengeKind, PlayMode, Settings } from './types';

export interface ModeTraits {
  /** The ruler is drawn and can be tapped; the tanks' pointer lines and the nearest-ten help use it. */
  showsRuler: boolean;
  /** The question banner shows and is read aloud ("Nur Zahlenstrahl" shows no question, FR-122). */
  showsQuestion: boolean;
  /** With the number pad setting "Automatisch", the pad shows on every screen (no ruler to tap, FR-123). */
  forcesPad: boolean;
  /**
   * The challenge kinds: 'enabled' follows the parent's challenge-type switches, 'readPosition' only reads the ruler,
   * 'arithmetic' keeps the turned-on kinds among addition and subtraction, 'numbersWithoutRuler' keeps the turned-on
   * kinds without addition, subtraction and the kinds that need the ruler (RULER_KINDS in math/generate.ts).
   * playModeKinds derives `onlyArithmetic` from 'arithmetic' (amendment 27, critique E1).
   */
  kinds: 'enabled' | 'readPosition' | 'arithmetic' | 'numbersWithoutRuler';
  /**
   * The kinds the generator tries, in order, when no allowed kind fits, before the final "find N" fallback; null keeps
   * the default (readPosition after keyboard input, FR-076). "Zahlen-Rätsel" uses "after" and "before", which work for
   * almost every answer and need no ruler. "Plus und Minus" has none: it never asks another kind (amendment 27).
   */
  fallbackKinds: readonly ChallengeKind[] | null;
}

export const MODE_TRAITS: Readonly<Record<PlayMode, ModeTraits>> = {
  mixed: { showsRuler: true, showsQuestion: true, forcesPad: false, kinds: 'enabled', fallbackKinds: null },
  ruler: { showsRuler: true, showsQuestion: false, forcesPad: false, kinds: 'readPosition', fallbackKinds: null },
  arithmetic: { showsRuler: false, showsQuestion: true, forcesPad: true, kinds: 'arithmetic', fallbackKinds: [] },
  numbers: { showsRuler: false, showsQuestion: true, forcesPad: true, kinds: 'numbersWithoutRuler', fallbackKinds: ['after', 'before'] },
};

/**
 * Whether `mode` can give a challenge with the settings `s`, without reading `s.playModes` (amendment 27, FR-167,
 * critique E2). "Plus und Minus" needs "Plus" or "Minus" and, at the parent's settings, a plus or minus exercise whose
 * answer keeps the enemy gap from the child's tank at range.min and at range.max. Every other mode always can.
 * The settings check `arithmeticModeNoExercise` and the battle controller use it; call it only with operand limits
 * that passed the settings checks, because the exercise search walks every operand.
 */
export function modeCanPlay(mode: PlayMode, s: Settings): boolean {
  if (MODE_TRAITS[mode].kinds !== 'arithmetic') return true;
  if (!s.challengeTypes.addition && !s.challengeTypes.subtraction) return false;
  return arithmeticAnswerSet(s, s.range.min).size > 0 && arithmeticAnswerSet(s, s.range.max).size > 0;
}

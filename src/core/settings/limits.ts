/**
 * Answer limits and the "Zahlengröße" test, shared by the settings checks (validate.ts) and the exercise builders
 * (core/math). It imports only types, so both sides can use it without an import cycle.
 */
import type { ArithmeticKind } from '../math/arithmetic';
import type { Settings, SettingsRange } from './schema';

/** Smallest result an exercise may have: range.min, or 0 when negative results are off. */
export function lowestResult(s: Pick<Settings, 'negativeResults'>, range: SettingsRange): number {
  return s.negativeResults ? range.min : Math.max(range.min, 0);
}

/** Largest result an exercise may have: min(addition.maxResult, range.max) for plus, range.max for minus. */
export function highestResult(kind: ArithmeticKind, settings: Settings): number {
  return kind === 'addition' ? Math.min(settings.addition.maxResult, settings.range.max) : settings.range.max;
}

/** Whether `kind` uses "Zwei Zahlen" (amendment 26, FR-148). */
export function isTwoNumbers(kind: ArithmeticKind, settings: Settings): boolean {
  return settings[kind].size === 'twoNumbers';
}

/**
 * Keyboard number entry (amendment 01, research R22, FR-060, FR-063, data-model.md "Keyboard entry").
 * Pure: applyKey returns a new entry and never changes its input.
 */

export type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface Entry {
  /** Digits typed so far, may start with '-'; '' when none. */
  typed: string;
  /** True when the typed number lies outside the range; the preview then stays at the nearest end. */
  outOfRange: boolean;
}

export type EntryKey = { digit: number } | 'minus' | 'backspace';

export interface EntryResult {
  entry: Entry;
  /** The number to preview, or null when nothing number-like is typed (the caller keeps its last selection). */
  selection: number | null;
}

export function emptyEntry(): Entry {
  return { typed: '', outOfRange: false };
}

export function applyKey(entry: Entry, key: EntryKey, range: { min: number; max: number }): EntryResult {
  let typed = entry.typed;
  if (key === 'backspace') {
    typed = typed.slice(0, -1);
  } else if (key === 'minus') {
    if (typed === '' && range.min < 0) typed = '-';
  } else if (Number.isInteger(key.digit) && key.digit >= 0 && key.digit <= 9) {
    if (digitCount(typed) < maxDigits(range)) typed += String(key.digit);
  }

  if (typed === '' || typed === '-') return { entry: { typed, outOfRange: false }, selection: null };
  const value = Number(typed);
  const selection = Math.min(range.max, Math.max(range.min, value)) + 0;
  return { entry: { typed, outOfRange: selection !== value }, selection };
}

function digitCount(typed: string): number {
  return typed.startsWith('-') ? typed.length - 1 : typed.length;
}

/** Digits of the longest number in the range, e.g. 3 for 0-100 and 2 for -20 to 30. */
function maxDigits(range: { min: number; max: number }): number {
  return Math.max(String(Math.abs(range.min)).length, String(Math.abs(range.max)).length);
}

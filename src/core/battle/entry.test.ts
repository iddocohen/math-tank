import { describe, expect, it } from 'vitest';
import { applyKey, emptyEntry, type Entry, type EntryKey } from './entry';

type Range = { min: number; max: number };

/** Applies keys one after another and returns the entry and the last non-null selection. */
function typeKeys(keys: EntryKey[], range: Range, start: Entry = emptyEntry()) {
  let entry = start;
  let selection: number | null = null;
  const selections: Array<number | null> = [];
  for (const key of keys) {
    const r = applyKey(entry, key, range);
    entry = r.entry;
    selections.push(r.selection);
    if (r.selection !== null) selection = r.selection;
  }
  return { entry, selection, selections };
}

const d = (digit: number): EntryKey => ({ digit });

describe('applyKey (FR-060, FR-063)', () => {
  it('starts empty', () => {
    expect(emptyEntry()).toEqual({ typed: '', outOfRange: false });
  });

  it('appends digits and the selection follows at once', () => {
    const r = typeKeys([d(3), d(7)], { min: 0, max: 100 });
    expect(r.selections).toEqual([3, 37]);
    expect(r.entry).toEqual({ typed: '37', outOfRange: false });
  });

  it('Backspace removes the last character; an empty entry gives no new selection', () => {
    const range = { min: 0, max: 100 };
    const r = typeKeys([d(3), d(7), 'backspace'], range);
    expect(r.entry.typed).toBe('3');
    expect(r.selections.at(-1)).toBe(3);
    const empty = applyKey(r.entry, 'backspace', range);
    expect(empty.entry).toEqual({ typed: '', outOfRange: false });
    // null means "keep the last selection" for the caller.
    expect(empty.selection).toBeNull();
    expect(applyKey(emptyEntry(), 'backspace', range)).toEqual({ entry: emptyEntry(), selection: null });
  });

  it('ignores digits past the length of the longest number in the range', () => {
    expect(typeKeys([d(1), d(0), d(0)], { min: 0, max: 10 }).entry.typed).toBe('10');
    expect(typeKeys([d(1), d(2), d(3), d(4)], { min: 0, max: 100 }).entry.typed).toBe('123');
    expect(typeKeys([d(6), d(3), d(7), d(1)], { min: 550, max: 780 }).entry.typed).toBe('637');
    // The minus sign is not a digit.
    expect(typeKeys(['minus', d(1), d(5), d(9)], { min: -20, max: 30 }).entry.typed).toBe('-15');
  });

  it('accepts minus only as the first character and only when range.min < 0', () => {
    expect(typeKeys(['minus'], { min: 0, max: 100 }).entry.typed).toBe('');
    expect(typeKeys([d(5), 'minus'], { min: -20, max: 30 }).entry.typed).toBe('5');
    expect(typeKeys(['minus', 'minus'], { min: -20, max: 30 }).entry.typed).toBe('-');
    const r = typeKeys(['minus', d(7)], { min: -20, max: 30 });
    expect(r.entry).toEqual({ typed: '-7', outOfRange: false });
    expect(r.selections).toEqual([null, -7]);
  });

  it('typing 150 in range 0-100 selects 100 and flags outOfRange', () => {
    const r = typeKeys([d(1), d(5), d(0)], { min: 0, max: 100 });
    expect(r.selections.at(-1)).toBe(100);
    expect(r.entry).toEqual({ typed: '150', outOfRange: true });
  });

  it('typing -25 in range -20 to 30 selects -20 and flags outOfRange', () => {
    const r = typeKeys(['minus', d(2), d(5)], { min: -20, max: 30 });
    expect(r.selections.at(-1)).toBe(-20);
    expect(r.entry).toEqual({ typed: '-25', outOfRange: true });
  });

  it('clears outOfRange when Backspace brings the number back into the range', () => {
    const r = typeKeys([d(1), d(5), d(0), 'backspace'], { min: 0, max: 100 });
    expect(r.entry).toEqual({ typed: '15', outOfRange: false });
    expect(r.selections.at(-1)).toBe(15);
  });

  it('selects the nearest end for a number below a range that does not start at 0', () => {
    const r = typeKeys([d(4), d(0), d(0)], { min: 550, max: 780 });
    expect(r.selections).toEqual([550, 550, 550]);
    expect(r.entry.outOfRange).toBe(true);
  });

  it('never changes its input', () => {
    const entry = { typed: '4', outOfRange: false };
    applyKey(entry, d(2), { min: 0, max: 100 });
    expect(entry).toEqual({ typed: '4', outOfRange: false });
  });
});

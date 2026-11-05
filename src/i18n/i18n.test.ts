import { describe, expect, it } from 'vitest';
import { SETTINGS_ERROR_KEYS } from '../core/settings/validate';
import { de } from './de';
import { encouragements, forbiddenWords, t } from './index';

const SAMPLE_ARGS = [7, 13, 42, 100, 5];

/** Every child-facing string in the table, with its path. Functions are called with sample numbers. */
function collectStrings(value: unknown, path: string, out: Array<{ path: string; text: string }>): void {
  if (typeof value === 'string') {
    out.push({ path, text: value });
  } else if (typeof value === 'function') {
    const result: unknown = (value as (...args: number[]) => unknown)(...SAMPLE_ARGS);
    collectStrings(result, `${path}()`, out);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => collectStrings(v, `${path}[${i}]`, out));
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) collectStrings(v, path ? `${path}.${k}` : k, out);
  }
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

describe('forbiddenWords', () => {
  it('lists the words from FR-033', () => {
    expect([...forbiddenWords].sort()).toEqual(['dumm', 'falsch', 'Fehler', 'schlecht', 'verloren', 'versagt'].sort());
  });
});

describe('de table', () => {
  const strings: Array<{ path: string; text: string }> = [];
  collectStrings(de, '', strings);

  it('has strings to check', () => {
    expect(strings.length).toBeGreaterThan(20);
  });

  it('contains no forbidden word, case-insensitive and inside compounds (FR-033, SC-006)', () => {
    const hits = strings.flatMap(({ path, text }) =>
      forbiddenWords
        .filter((w) => text.toLocaleLowerCase('de').includes(w.toLocaleLowerCase('de')))
        .map((w) => `${path}: "${text}" contains "${w}"`),
    );
    expect(hits).toEqual([]);
  });

  it('the check catches a forbidden word inside a compound', () => {
    const sample: Array<{ path: string; text: string }> = [];
    collectStrings({ a: 'Das war ein Rechenfehler.', b: () => 'FALSCH' }, '', sample);
    const flagged = sample.filter(({ text }) =>
      forbiddenWords.some((w) => text.toLocaleLowerCase('de').includes(w.toLocaleLowerCase('de'))),
    );
    expect(flagged).toHaveLength(2);
  });

  it('has at least 8 encouragements, each at most 8 words (FR-057)', () => {
    expect(encouragements.length).toBeGreaterThanOrEqual(8);
    for (const phrase of encouragements) {
      expect(wordCount(phrase), phrase).toBeLessThanOrEqual(8);
    }
  });

  it('has a message for every settings error key', () => {
    for (const key of SETTINGS_ERROR_KEYS) {
      expect(typeof de.settingsErrors[key], key).toBe('string');
    }
  });

  it('formats parameterized strings with the given numbers', () => {
    expect(t().challenge.findNumber(42)).toContain('42');
  });

  it('t() returns the German table', () => {
    expect(t()).toBe(de);
    expect(t().encouragements).toBe(encouragements);
  });
});

import { describe, expect, it } from 'vitest';
import { SETTINGS_ERROR_KEYS } from '../core/settings/validate';
import { de } from './de';
import { encouragements, forbiddenWords, promptText, t } from './index';

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

  it('has the amendment 06 hit feedback and end screen (FR-066, FR-072, FR-085, FR-086)', () => {
    const b = t().battle as Record<string, unknown>;
    expect(t().battle.hit).toBe('Getroffen!');
    expect(t().battle.near).toBe('Ganz knapp! Triff die Linie.');
    expect(t().battle.compare(30, 31)).toBe('Du: 30 · Gegner: 31 · 1 Schritt');
    expect(t().battle.compare(630, 637)).toBe('Du: 630 · Gegner: 637 · 7 Schritte');
    expect(t().battle.enemyStoodAt(637)).toBe('Der Gegner stand bei 637.');
    for (const removed of ['bullseye', 'bodyHit', 'close']) expect(b[removed]).toBeUndefined();
    expect((t().settings.labels as Record<string, unknown>).exactHit).toBeUndefined();
    const r = t().roundEnd;
    expect(r.result(9, '6:12')).toBe('9 Panzer getroffen in 6:12');
    expect(r.result(1, '0:42')).toBe('1 Panzer getroffen in 0:42');
    expect(r.newRecord).toBe('Neuer Rekord!');
    expect(r.yourRecord(12)).toBe('Dein Rekord: 12');
  });

  it('has a short prompt for each of the seven number-line kinds (T069, FR-056, FR-057)', () => {
    const c = t().challenge;
    expect(c.findNumber(37)).toBe('Finde 37');
    expect(c.after(41)).toBe('Welche Zahl kommt direkt nach 41?');
    expect(c.before(41)).toBe('Welche Zahl kommt direkt vor 41?');
    const prompts = [c.findNumber(37), c.after(41), c.before(41), c.stepsRight(40, 3), c.stepsLeft(40, 3), c.missingBetween(40, 42), c.midpoint(40, 60)];
    for (const p of prompts) expect(wordCount(p), p).toBeLessThanOrEqual(8);
    expect(c.stepsRight(40, 3)).toContain('40');
    expect(c.stepsRight(40, 1)).toContain('1 Schritt ');
    expect(c.midpoint(40, 60)).toMatch(/40.*60/);
  });

  it('promptText renders a challenge prompt from its key and parameters', () => {
    expect(promptText({ key: 'findNumber', params: { n: 37 } })).toBe('Finde 37');
    expect(promptText({ key: 'stepsLeft', params: { n: 40, k: 2 } })).toBe(t().challenge.stepsLeft(40, 2));
    expect(promptText({ key: 'missingBetween', params: { a: 40, b: 42 } })).toBe(t().challenge.missingBetween(40, 42));
    expect(promptText({ key: 'readPosition', params: {} })).toBe(t().challenge.readPosition);
    expect(promptText({ key: 'unknownKind', params: {} })).toBe('');
  });

  it('t() returns the German table', () => {
    expect(t()).toBe(de);
    expect(t().encouragements).toBe(encouragements);
  });
});

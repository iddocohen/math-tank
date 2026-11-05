import { describe, expect, it } from 'vitest';
import { SETTINGS_ERROR_KEYS } from '../core/settings/validate';
import { de } from './de';
import { comparisonPrompt, encouragements, forbiddenWords, helpText, messageText, promptText, t } from './index';
import { BattleController } from '../core/battle/controller';
import { memoryProgressStore, type Speaker } from '../core/battle/ports';
import { nextHelp } from '../core/battle/help';
import { generateChallenge } from '../core/math/generate';
import { defaultSettings } from '../core/settings/defaults';
import type { RoundState } from '../core/types';

const SAMPLE_ARGS = [7, 13, 42, 100, 5];

/**
 * Child-facing texts allowed more than 9 words (T152, FR-057), with the reason. Paths as collectStrings writes them;
 * functions are called with SAMPLE_ARGS.
 */
const ALLOWED_LONGER_TEXTS: Record<string, string> = {
  'challenge.between()': 'names two numbers; comparison prompts with their options have their own limit of 10 words (amendment 09)',
};

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

  it('every child-facing text has at most about 8 words: at most 9, apart from a short allowlist (T152, FR-057)', () => {
    // Sections the child reads or hears: start screen, garage, battle (banner, feedback, range hint), phone hint,
    // challenge banner, help steps, round end and the encouraging phrases.
    const CHILD_SECTIONS = ['start', 'garage', 'battle', 'rotate', 'challenge', 'helpSteps', 'roundEnd', 'encouragements'] as const;
    const ALLOWED_LONGER: Record<string, string> = ALLOWED_LONGER_TEXTS;
    const child: Array<{ path: string; text: string }> = [];
    for (const section of CHILD_SECTIONS) collectStrings(de[section], section, child);
    expect(child.length).toBeGreaterThan(50);
    const words = (text: string) => text.split(/\s+/).filter((w) => /\p{L}|\d/u.test(w)).length;
    const tooLong = child.filter(({ path, text }) => words(text) > 9 && !(path in ALLOWED_LONGER)).map(({ path, text }) => `${path}: ${text}`);
    expect(tooLong).toEqual([]);
    // Every allowlist entry still exists and is still longer, so the list does not hide new long texts.
    for (const path of Object.keys(ALLOWED_LONGER)) {
      const found = child.find((c) => c.path === path);
      expect(found, path).toBeDefined();
      expect(words(found!.text), path).toBeGreaterThan(9);
    }
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
    // PO3: like the other "Der Gegner ..." banners, and never "Von 2 aus 2 Schritte nach links."
    expect(c.stepsLeft(26, 3)).toBe('Der Gegner steht 3 Schritte links von 26.');
    expect(c.stepsRight(26, 3)).toBe('Der Gegner steht 3 Schritte rechts von 26.');
    expect(c.stepsRight(40, 1)).toBe('Der Gegner steht 1 Schritt rechts von 40.');
    expect(c.midpoint(40, 60)).toMatch(/40.*60/);
  });

  it('comparison prompts name the options in the banner, in at most 10 words (amendment 09, FR-026, FR-057)', () => {
    const cases: Array<[string, Record<string, number>, string]> = [
      ['greater', { o1: 47, o2: 74 }, 'Der Gegner steht bei der größeren Zahl: 47 oder 74'],
      ['smaller', { o1: 18, o2: 21 }, 'Der Gegner steht bei der kleineren Zahl: 18 oder 21'],
      ['largest3', { o1: 38, o2: 83, o3: 58 }, 'Der Gegner steht bei der größten Zahl: 38, 83, 58'],
      ['smallest3', { o1: 61, o2: 16, o3: 26 }, 'Der Gegner steht bei der kleinsten Zahl: 61, 16, 26'],
      ['closestTo', { o1: 46, o2: 57, n: 50 }, 'Der Gegner steht bei der Zahl näher an 50: 46 oder 57'],
      ['between', { o1: 27, o2: 35, o3: 48, a: 30, b: 40 }, 'Der Gegner steht bei der Zahl zwischen 30 und 40: 27, 35, 48'],
      ['middle3', { o1: 72, o2: 27, o3: 45 }, 'Der Gegner steht bei der mittleren Zahl: 72, 27, 45'],
    ];
    // Numbers are not words (FR-057 counts text).
    const words = (text: string) => text.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;
    for (const [key, params, text] of cases) {
      expect(promptText({ key, params })).toBe(text);
      expect(words(text), text).toBeLessThanOrEqual(10);
      expect(comparisonPrompt({ key, params })!.options).toEqual([params.o1, params.o2, params.o3].filter((o) => o !== undefined));
    }
    expect(comparisonPrompt({ key: 'greater', params: { o1: 47, o2: 74 } })).toEqual({ lead: 'Der Gegner steht bei der größeren Zahl:', options: [47, 74], separator: ' oder ' });
    expect(comparisonPrompt({ key: 'largest3', params: { o1: 38, o2: 83, o3: 58 } })!.separator).toBe(', ');
    expect(comparisonPrompt({ key: 'findNumber', params: { n: 37 } })).toBeNull();
    // Removed by amendment 09.
    expect(t().challenge).not.toHaveProperty('equal');
    expect(t().challenge).not.toHaveProperty('order3');
    expect(t().battle).not.toHaveProperty('notOnTank');
    expect(t().helpSteps).not.toHaveProperty('order');
  });

  it('promptText renders a challenge prompt from its key and parameters', () => {
    expect(promptText({ key: 'findNumber', params: { n: 37 } })).toBe('Finde 37');
    expect(promptText({ key: 'stepsLeft', params: { n: 40, k: 2 } })).toBe(t().challenge.stepsLeft(40, 2));
    expect(promptText({ key: 'missingBetween', params: { a: 40, b: 42 } })).toBe(t().challenge.missingBetween(40, 42));
    expect(promptText({ key: 'readPosition', params: {} })).toBe(t().challenge.readPosition);
    expect(promptText({ key: 'unknownKind', params: {} })).toBe('');
  });

  it('renders one- and two-step addition and subtraction prompts in at most 8 words (FR-056, FR-057)', () => {
    const prompts = [
      promptText({ key: 'subtraction', params: { a: 43, b: 7 } }),
      promptText({ key: 'subtraction', params: { a: 52, b: 4, c: 9 } }),
      promptText({ key: 'addition', params: { a: 24, b: 8 } }),
      promptText({ key: 'addition', params: { a: 24, b: 8, c: 5 } }),
    ];
    // T083, US3, amendment 01: the prompt says where the enemy is.
    expect(prompts).toEqual(['Der Gegner ist bei 43 − 7', 'Der Gegner ist bei 52 − 4 − 9', 'Der Gegner ist bei 24 + 8', 'Der Gegner ist bei 24 + 8 + 5']);
    // Numbers and signs are not words (FR-057 counts text): 4 words each.
    for (const p of prompts) expect(p.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length, p).toBeLessThanOrEqual(8);
  });

  it('t() returns the German table', () => {
    expect(t()).toBe(de);
    expect(t().encouragements).toBe(encouragements);
  });
});

function hasForbiddenWord(text: string): boolean {
  return forbiddenWords.some((w) => text.toLocaleLowerCase('de').includes(w.toLocaleLowerCase('de')));
}

describe('help and feedback texts (US5, T097, FR-033, SC-006)', () => {
  it('has the help phrases of US5 scenario 1', () => {
    expect(encouragements).toContain('Versuch eine andere Stelle.');
    expect(t().helpSteps.direction.right).toBe('Weiter nach rechts');
    expect(t().helpSteps.direction.left).toBe('Weiter nach links');
    expect(t().helpSteps.countFrom(31, 6)).toBe('Zähle von 31 aus 6 Schritte.');
    expect(t().helpSteps.countFrom(36, 1)).toBe('Zähle von 36 aus 1 Schritt.');
  });

  it('messageText gives the near-miss line or an encouraging phrase for any index', () => {
    expect(messageText({ key: 'near' })).toBe('Ganz knapp! Triff die Linie.');
    for (const index of [0, 1, 8, 9, 4_294_967_295]) expect(encouragements).toContain(messageText({ key: 'encouragement', index }));
  });

  it('every help line for generated challenges of every kind comes from the table, has no forbidden word and at most 8 words', () => {
    const settings = defaultSettings();
    const steps = { positions: 0, countForward: 0, countBackward: 0, tens: 0, crossTens: 0, addition: 0, subtraction: 0, comparison: 0 };
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const c = generateChallenge({ settings, skillSteps: steps, roundSeed: seed, turn: 0, playerPosition: 0, rulerLevel: 1 });
      kinds.add(c.kind);
      for (const level of [1, 2, 3]) {
        for (const landed of [null, c.answer === 0 ? 1 : c.answer - 1]) {
          const text = helpText(nextHelp(c, level, landed, settings));
          expect(text, `${c.kind} step ${level}`).not.toBeNull();
          expect(hasForbiddenWord(text!), text!).toBe(false);
          expect(wordCount(text!), text!).toBeLessThanOrEqual(8);
        }
      }
    }
    expect(kinds.size).toBeGreaterThan(8);
  });

  it('every text passed to Speaker.speak during a guided round is a table text with no forbidden word', () => {
    const spoken: string[] = [];
    const speaker: Speaker = { available: true, speak: (text) => spoken.push(text) };
    let now = 1_000;
    const controller = new BattleController({ settings: { ...defaultSettings(), noDamage: true, roundType: 'enemyCount', roundLength: 20 }, progress: memoryProgressStore(), clock: () => now, seed: 9, speaker });
    const allowed = new Set<string>();
    const remember = (s: RoundState) => {
      if (s.challenge) allowed.add(promptText(s.challenge.prompt));
      if (s.message) allowed.add(messageText(s.message));
      if (s.help.content) allowed.add(helpText(s.help.content) ?? '');
    };
    controller.subscribe(remember);
    controller.startRound('mixed');
    for (let i = 0; i < 30 && controller.getState().phase !== 'roundOver'; i++) {
      const s = controller.getState();
      now += 1_000;
      if (i % 3 === 0) controller.requestHelp();
      controller.fireAt(i % 2 === 0 ? s.player.position : s.challenge!.answer);
      controller.shotAnimationDone();
      if (controller.getState().phase === 'enemyTurn') controller.enemyShotAnimationDone();
    }
    for (const text of spoken) {
      expect(allowed.has(text), text).toBe(true);
      expect(hasForbiddenWord(text), text).toBe(false);
    }
  });
});

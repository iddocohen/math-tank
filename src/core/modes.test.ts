import { describe, expect, it } from 'vitest';
import { MODE_TRAITS, modeCanPlay } from './modes';
import { playModeKinds } from './math/generate';
import { defaultSettings } from './settings/defaults';
import { PLAY_MODES } from './settings/schema';
import type { Settings } from './types';

/** Battlefield 0 to 100, only "Plus", "Größtes Ergebnis" 5: no plus exercise keeps the enemy gap from 0 (amendment 27). */
function onlyPlusMaxResult5(): Settings {
  const s = defaultSettings();
  return {
    ...s,
    challengeTypes: { numberLine: false, addition: true, subtraction: false, comparison: false },
    addition: { ...s.addition, maxResult: 5 },
  };
}

describe('MODE_TRAITS for "Plus und Minus" and "Zahlen-Rätsel" (amendment 27, FR-159, FR-160)', () => {
  it('both new modes draw no ruler, show the question and force the number pad', () => {
    for (const mode of ['arithmetic', 'numbers'] as const) {
      expect(MODE_TRAITS[mode]).toMatchObject({ showsRuler: false, showsQuestion: true, forcesPad: true });
    }
  });

  it('"Plus und Minus" has no fallback kinds; "Zahlen-Rätsel" falls back to "after" and "before"', () => {
    expect(MODE_TRAITS.arithmetic.kinds).toBe('arithmetic');
    expect(MODE_TRAITS.arithmetic.fallbackKinds).toEqual([]);
    expect(MODE_TRAITS.numbers.kinds).toBe('numbersWithoutRuler');
    expect(MODE_TRAITS.numbers.fallbackKinds).toEqual(['after', 'before']);
  });

  it('for every mode, playModeKinds gives onlyArithmetic and withoutRuler exactly from the traits (critique E1)', () => {
    const s = defaultSettings();
    for (const mode of PLAY_MODES) {
      const traits = MODE_TRAITS[mode];
      const byMode = playModeKinds(mode, s);
      const arithmeticTraits = traits.kinds === 'arithmetic' && traits.fallbackKinds !== null && traits.fallbackKinds.length === 0;
      expect(Boolean(byMode.onlyArithmetic), mode).toBe(arithmeticTraits);
      expect(Boolean(byMode.withoutRuler), mode).toBe(!traits.showsRuler);
    }
  });

  it('playModeKinds: "Plus und Minus" allows only the turned-on arithmetic kinds, "Zahlen-Rätsel" never them or the ruler kinds', () => {
    const s = defaultSettings();
    expect(playModeKinds('arithmetic', s).kindsAllowed).toEqual(['addition', 'subtraction']);
    const onlyMinus = { ...s, challengeTypes: { ...s.challengeTypes, addition: false } };
    expect(playModeKinds('arithmetic', onlyMinus).kindsAllowed).toEqual(['subtraction']);
    const numbers = playModeKinds('numbers', s).kindsAllowed!;
    expect(numbers.length).toBeGreaterThan(0);
    for (const kind of ['addition', 'subtraction', 'readPosition', 'findNumber'] as const) expect(numbers).not.toContain(kind);
    expect(numbers).toContain('after');
    expect(numbers).toContain('greater');
  });
});

describe('modeCanPlay (amendment 27, FR-167, critique E2)', () => {
  const plusMinusOff = (s: Settings): Settings => ({ ...s, challengeTypes: { ...s.challengeTypes, addition: false, subtraction: false } });

  it('"Gemischt", "Nur Zahlenstrahl" and "Zahlen-Rätsel" can always play', () => {
    for (const s of [defaultSettings(), onlyPlusMaxResult5(), plusMinusOff(defaultSettings())]) {
      for (const mode of ['mixed', 'ruler', 'numbers'] as const) expect(modeCanPlay(mode, s), mode).toBe(true);
    }
  });

  it('"Plus und Minus" can play with the defaults', () => {
    expect(modeCanPlay('arithmetic', defaultSettings())).toBe(true);
  });

  it('"Plus und Minus" cannot play with "Plus" and "Minus" off', () => {
    expect(modeCanPlay('arithmetic', plusMinusOff(defaultSettings()))).toBe(false);
  });

  it('"Plus und Minus" cannot play with battlefield 0 to 100, only "Plus", "Größtes Ergebnis" 5', () => {
    expect(modeCanPlay('arithmetic', onlyPlusMaxResult5())).toBe(false);
  });

  it('does not read playModes', () => {
    for (const playModes of [
      { mixed: true, ruler: true, arithmetic: true, numbers: true },
      { mixed: false, ruler: true, arithmetic: false, numbers: false },
    ]) {
      expect(modeCanPlay('arithmetic', { ...defaultSettings(), playModes })).toBe(true);
      expect(modeCanPlay('arithmetic', { ...onlyPlusMaxResult5(), playModes })).toBe(false);
    }
  });
});

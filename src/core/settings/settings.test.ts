import { describe, expect, it } from 'vitest';
import { defaultSettings, RANGE_PRESETS } from './defaults';
import { settingsSchema, type Settings } from './schema';
import { validateSettings, withRange, type SettingsError } from './validate';

function clone(s: Settings): Settings {
  return structuredClone(s);
}

function errorsOf(s: Settings): SettingsError[] {
  const r = validateSettings(s);
  return r.ok ? [] : r.errors;
}

function paths(s: Settings): string[] {
  return errorsOf(s).map((e) => e.path);
}

describe('defaults', () => {
  it('match data-model.md', () => {
    const d = defaultSettings();
    expect(d).toEqual({
      version: 4,
      challengeTypes: { numberLine: true, addition: true, subtraction: true, comparison: true },
      range: { preset: '0-100', min: 0, max: 100 },
      addition: { maxOperand: 10, maxResult: 100, steps: 1 },
      subtraction: { maxOperand: 10, steps: 1 },
      crossTens: true,
      crossHundreds: false,
      negativeResults: false,
      rulerLevelStart: 1,
      rulerLevelMax: 5,
      enemyDifficulty: 'easy',
      help: { nearestTen: true, countSteps: true, zoom: true, stepAnimation: true },
      beginnerAssist: true,
      sound: { effects: true, music: false, speech: true },
      roundType: 'untilHearts',
      roundLength: 5,
      adaptive: true,
      freePlay: false,
      noDamage: false,
      showClock: false,
      showRecords: true,
      timeLimitSeconds: null,
    });
  });

  it('have no aimCorrection and no labelLevel (decision D13)', () => {
    const d = defaultSettings() as unknown as Record<string, unknown>;
    expect('aimCorrection' in d).toBe(false);
    expect('labelLevel' in d).toBe(false);
  });

  it('pass the schema and validateSettings', () => {
    const d = defaultSettings();
    expect(settingsSchema.safeParse(d).success).toBe(true);
    expect(validateSettings(d)).toEqual({ ok: true });
  });

  it('have no exactHit ("Genau treffen" is removed by amendment 06)', () => {
    const d = defaultSettings() as unknown as Record<string, unknown>;
    expect('exactHit' in d).toBe(false);
    const parsed = settingsSchema.safeParse({ ...d, exactHit: true });
    expect(parsed.success).toBe(true);
    expect(parsed.data && 'exactHit' in parsed.data).toBe(false);
  });

  it('the schema requires version 4, a known roundType and boolean showClock and showRecords (amendment 06)', () => {
    const d = defaultSettings() as unknown as Record<string, unknown>;
    expect(settingsSchema.safeParse({ ...d, version: 3 }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...d, roundType: 'enemyCount' }).success).toBe(true);
    expect(settingsSchema.safeParse({ ...d, roundType: 'turns' }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...d, showClock: 'yes' }).success).toBe(false);
    for (const key of ['roundType', 'showClock', 'showRecords']) {
      const without = { ...d };
      delete without[key];
      expect(settingsSchema.safeParse(without).success).toBe(false);
    }
  });

  it('returns a fresh object each call', () => {
    const a = defaultSettings();
    a.range.max = 5;
    expect(defaultSettings().range.max).toBe(100);
  });
});

describe('validateSettings', () => {
  it('rejects min >= max (FR-047, US6 scenario 5)', () => {
    const s = clone(defaultSettings());
    s.range = { preset: 'custom', min: 50, max: 50 };
    s.addition.maxResult = 50;
    expect(paths(s)).toContain('range');
    s.range = { preset: 'custom', min: 60, max: 40 };
    s.addition.maxResult = 40;
    expect(paths(s)).toContain('range');
  });

  it('rejects all challenge types off with freePlay false (US6 scenario 4)', () => {
    const s = clone(defaultSettings());
    s.challengeTypes = { numberLine: false, addition: false, subtraction: false, comparison: false };
    expect(paths(s)).toContain('challengeTypes');
    s.freePlay = true;
    expect(validateSettings(s)).toEqual({ ok: true });
  });

  it('rejects max - min outside 5 to 1000', () => {
    const s = clone(defaultSettings());
    s.range = { preset: 'custom', min: 0, max: 4 };
    s.addition.maxResult = 4;
    s.subtraction.maxOperand = 4;
    expect(paths(s)).toContain('range');

    s.range = { preset: 'custom', min: -1000, max: 1 };
    s.addition.maxResult = 1;
    s.negativeResults = true;
    expect(paths(s)).toContain('range');

    s.range = { preset: 'custom', min: 0, max: 5 };
    s.addition.maxResult = 5;
    s.addition.maxOperand = 5;
    s.subtraction.maxOperand = 5;
    s.negativeResults = false;
    expect(validateSettings(s)).toEqual({ ok: true });

    s.range = { preset: 'custom', min: -1000, max: 0 };
    s.addition.maxResult = 0;
    s.negativeResults = true;
    expect(validateSettings(s)).toEqual({ ok: true });
  });

  it('rejects custom min below -1000 and non-integer range values', () => {
    const s = clone(defaultSettings());
    s.range = { preset: 'custom', min: -1001, max: -500 };
    s.negativeResults = true;
    s.addition.maxResult = -500;
    expect(paths(s)).toContain('range');
    s.range = { preset: 'custom', min: 0.5, max: 50 };
    s.addition.maxResult = 50;
    expect(paths(s)).toContain('range');
  });

  it('rejects a minimum above 9000', () => {
    const s = clone(defaultSettings());
    s.range = { preset: 'custom', min: 9001, max: 9100 };
    s.addition.maxResult = 9100;
    expect(paths(s)).toContain('range');
    s.range = { preset: 'custom', min: 9000, max: 9100 };
    expect(validateSettings(s)).toEqual({ ok: true });
  });

  it('accepts the custom ranges 550 to 780 and -20 to 30 (US9 scenario 4)', () => {
    const a = withRange(defaultSettings(), { preset: 'custom', min: 550, max: 780 });
    expect(validateSettings(a)).toEqual({ ok: true });
    const b = withRange(defaultSettings(), { preset: 'custom', min: -20, max: 30 });
    expect(validateSettings(b)).toEqual({ ok: true });
  });

  it('rejects rulerLevelStart above rulerLevelMax, and accepts equal levels (FR-018)', () => {
    const s = clone(defaultSettings());
    s.rulerLevelStart = 4;
    s.rulerLevelMax = 3;
    expect(paths(s)).toContain('rulerLevelStart');
    s.rulerLevelMax = 4;
    expect(validateSettings(s)).toEqual({ ok: true });
  });

  it('rejects a preset whose min and max differ from the preset values', () => {
    const s = clone(defaultSettings());
    s.range = { preset: '0-20', min: 0, max: 100 };
    expect(paths(s)).toContain('range');
  });

  it('rejects roundLength (enemies per round) outside 1 to 20 (amendment 06)', () => {
    for (const roundLength of [0, 21, 2.5]) {
      const s = clone(defaultSettings());
      s.roundLength = roundLength;
      expect(paths(s)).toContain('roundLength');
    }
    for (const roundLength of [1, 20]) {
      const s = clone(defaultSettings());
      s.roundLength = roundLength;
      expect(validateSettings(s)).toEqual({ ok: true });
    }
  });

  it('rejects "Bis alle Herzen weg" with the no-damage mode, which would never end (FR-044, FR-082)', () => {
    const s = clone(defaultSettings());
    s.noDamage = true;
    const r = validateSettings(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ key: 'roundTypeNoDamage', path: 'roundType' });
    s.roundType = 'enemyCount';
    expect(validateSettings(s)).toEqual({ ok: true });
  });

  it('rejects timeLimitSeconds outside 10 to 120', () => {
    for (const t of [9, 121, 0]) {
      const s = clone(defaultSettings());
      s.timeLimitSeconds = t;
      expect(paths(s)).toContain('timeLimitSeconds');
    }
    for (const t of [10, 120, null]) {
      const s = clone(defaultSettings());
      s.timeLimitSeconds = t;
      expect(validateSettings(s)).toEqual({ ok: true });
    }
  });

  it('rejects subtraction.maxOperand above range.max - range.min', () => {
    const s = clone(defaultSettings());
    s.range = { preset: '0-10', min: 0, max: 10 };
    s.addition.maxResult = 10;
    s.subtraction.maxOperand = 11;
    expect(paths(s)).toContain('subtraction.maxOperand');
    s.subtraction.maxOperand = 10;
    expect(validateSettings(s)).toEqual({ ok: true });
  });

  it('rejects operands below 1', () => {
    const s = clone(defaultSettings());
    s.subtraction.maxOperand = 0;
    s.addition.maxOperand = 0;
    expect(paths(s)).toEqual(expect.arrayContaining(['subtraction.maxOperand', 'addition.maxOperand']));
  });

  it('rejects addition.maxResult above range.max', () => {
    const s = clone(defaultSettings());
    s.addition.maxResult = 101;
    expect(paths(s)).toContain('addition.maxResult');
  });

  it('rejects operand limits that allow no exercise in the range', () => {
    // maxResult too small for any sum of two positive numbers in 0-100.
    const s = clone(defaultSettings());
    s.addition.maxResult = 0;
    expect(paths(s)).toContain('addition.maxResult');

    // A fully negative range without negative results allows no addition or subtraction.
    const n = clone(defaultSettings());
    n.range = { preset: 'custom', min: -50, max: -10 };
    n.addition.maxResult = -10;
    n.negativeResults = false;
    expect(paths(n)).toEqual(expect.arrayContaining(['addition.maxResult', 'subtraction.maxOperand']));

    // The same limits are fine when those types are off.
    n.challengeTypes.addition = false;
    n.challengeTypes.subtraction = false;
    expect(validateSettings(n)).toEqual({ ok: true });
  });

  it('gives each error a translation key and a field path', () => {
    const s = clone(defaultSettings());
    s.roundLength = 99;
    const [e] = errorsOf(s);
    expect(e).toBeDefined();
    expect(typeof e?.key).toBe('string');
    expect(e?.key.length).toBeGreaterThan(0);
    expect(e?.path).toBe('roundLength');
  });
});

describe('withRange', () => {
  const presets = Object.keys(RANGE_PRESETS) as Array<keyof typeof RANGE_PRESETS>;

  it.each(presets)('gives valid settings for preset %s from defaults and from wide limits', (preset) => {
    const { min, max } = RANGE_PRESETS[preset];
    const range = { preset, min, max };

    const fromDefaults = withRange(defaultSettings(), range);
    expect(validateSettings(fromDefaults)).toEqual({ ok: true });
    expect(fromDefaults.range).toEqual(range);

    const wide = withRange(defaultSettings(), { preset: '0-1000', min: 0, max: 1000 });
    wide.addition.maxOperand = 900;
    wide.subtraction.maxOperand = 1000;
    expect(validateSettings(wide)).toEqual({ ok: true });
    const narrowed = withRange(wide, range);
    expect(validateSettings(narrowed)).toEqual({ ok: true });
    expect(narrowed.addition.maxResult).toBeLessThanOrEqual(max);
    expect(narrowed.addition.maxOperand).toBeLessThanOrEqual(max - min);
    expect(narrowed.subtraction.maxOperand).toBeLessThanOrEqual(max - min);
  });

  it('raises maxResult to follow the new range.max when it was at the old range.max', () => {
    const s = withRange(defaultSettings(), { preset: '0-1000', min: 0, max: 1000 });
    expect(s.addition.maxResult).toBe(1000);
  });

  it('does not change the input settings', () => {
    const d = defaultSettings();
    withRange(d, { preset: '0-10', min: 0, max: 10 });
    expect(d).toEqual(defaultSettings());
  });

  it('clamps the linked limits for the custom range 550 to 780', () => {
    const wide = withRange(defaultSettings(), { preset: '0-1000', min: 0, max: 1000 });
    wide.addition.maxOperand = 900;
    wide.subtraction.maxOperand = 1000;
    const s = withRange(wide, { preset: 'custom', min: 550, max: 780 });
    expect(validateSettings(s)).toEqual({ ok: true });
    expect(s.addition.maxResult).toBe(780);
    expect(s.addition.maxOperand).toBe(230);
    expect(s.subtraction.maxOperand).toBe(230);
  });

  it('gives valid settings for a custom range', () => {
    const s = withRange(defaultSettings(), { preset: 'custom', min: 15, max: 45 });
    expect(validateSettings(s)).toEqual({ ok: true });
    expect(s.range).toEqual({ preset: 'custom', min: 15, max: 45 });
  });
});

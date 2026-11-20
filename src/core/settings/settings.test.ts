import { describe, expect, it } from 'vitest';
import { defaultSettings, RANGE_PRESETS, twoNumberDefaults } from './defaults';
import { settingsSchema, type Settings } from './schema';
import { settingsNotices, validateSettings, withRange, type SettingsError } from './validate';
import { parseSettings } from '../storage/migrate';

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
      version: 13,
      challengeTypes: { numberLine: true, addition: true, subtraction: true, comparison: true },
      range: { preset: '0-100', min: 0, max: 100 },
      addition: { ...twoNumberDefaults(), maxOperand: 10, maxResult: 100, steps: 1, size: 'steps', first: { min: 10, max: 99 }, second: { min: 10, max: 99 }, carry: false },
      subtraction: { ...twoNumberDefaults(), maxOperand: 10, steps: 1, size: 'steps', first: { min: 10, max: 99 }, second: { min: 10, max: 99 }, carry: false },
      crossTens: true,
      crossHundreds: false,
      negativeResults: false,
      rulerLevelStart: 1,
      rulerLevelMax: 5,
      enemyDifficulty: 'easy',
      help: { nearestTen: true, countSteps: true, zoom: true, stepAnimation: true },
      beginnerAssist: true,
      // PO1: reading aloud is off unless the parent turns on "Vorlesen".
      sound: { effects: true, music: false, speech: false },
      roundType: 'untilHearts',
      roundLength: 5,
      adaptive: true,
      playModes: { mixed: true, ruler: true, math: true },
      noDamage: false,
      showClock: false,
      showRecords: true,
      timeLimitSeconds: null,
      pointAfterFullHelp: true,
      garage: true,
      numberPad: 'auto',
      aimCross: { mode: 'always', level: 2 },
      enemiesAtOnce: 1,
      lineStyle: 'straight',
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

  it('the schema requires version 6 and a boolean garage (amendment 11, FR-096)', () => {
    const d = defaultSettings() as unknown as Record<string, unknown>;
    expect(settingsSchema.safeParse({ ...d, version: 4 }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...d, version: 5 }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...d, garage: false }).success).toBe(true);
    expect(settingsSchema.safeParse({ ...d, garage: 'on' }).success).toBe(false);
    const without = { ...d };
    delete without.garage;
    expect(settingsSchema.safeParse(without).success).toBe(false);
  });

  it('the schema requires numberPad auto, always or never (amendment 12, FR-102)', () => {
    const d = defaultSettings() as unknown as Record<string, unknown>;
    for (const v of ['auto', 'always', 'never']) expect(settingsSchema.safeParse({ ...d, numberPad: v }).success).toBe(true);
    for (const v of ['on', true, null, 1]) expect(settingsSchema.safeParse({ ...d, numberPad: v }).success).toBe(false);
    const without = { ...d };
    delete without.numberPad;
    expect(settingsSchema.safeParse(without).success).toBe(false);
  });

  it('the schema requires a known roundType and boolean showClock and showRecords (amendment 06)', () => {
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

  it('rejects all challenge types off while "Gemischt" or "Nur Rechnen" is offered (US6 scenario 4, amendment 17)', () => {
    const s = clone(defaultSettings());
    s.challengeTypes = { numberLine: false, addition: false, subtraction: false, comparison: false };
    expect(paths(s)).toContain('challengeTypes');
    s.playModes = { mixed: false, ruler: true, math: true };
    expect(paths(s)).toContain('challengeTypes');
    s.playModes = { mixed: true, ruler: true, math: false };
    expect(paths(s)).toContain('challengeTypes');
    s.playModes = { mixed: false, ruler: true, math: false };
    expect(validateSettings(s)).toEqual({ ok: true });
  });

  it('rejects settings that offer no play mode (FR-121)', () => {
    const s = clone(defaultSettings());
    s.playModes = { mixed: false, ruler: false, math: false };
    expect(errorsOf(s)).toContainEqual({ key: 'noPlayMode', path: 'playModes' });
    s.playModes.math = true;
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

describe('addition.maxOperand limit (review R5)', () => {
  it('an addition operand larger than the range width is refused, like subtraction', () => {
    const s = { ...defaultSettings(), range: { preset: '0-20' as const, min: 0, max: 20 }, addition: { ...twoNumberDefaults(), maxOperand: 21, maxResult: 20, steps: 1 as const } };
    const r = validateSettings(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ key: 'additionMaxOperand', path: 'addition.maxOperand' });
    expect(validateSettings({ ...s, addition: { ...s.addition, maxOperand: 20 } })).toEqual({ ok: true });
  });
});

describe('whole numbers and one parse function (review T4)', () => {
  it('the schema needs pointAfterFullHelp as a boolean (amendment 18, FR-129)', () => {
    expect(settingsSchema.safeParse({ ...defaultSettings(), pointAfterFullHelp: false }).success).toBe(true);
    expect(settingsSchema.safeParse({ ...defaultSettings(), pointAfterFullHelp: 'no' }).success).toBe(false);
    const { pointAfterFullHelp: _drop, ...without } = defaultSettings();
    void _drop;
    expect(settingsSchema.safeParse(without).success).toBe(false);
  });

  it('the schema needs aimCross with a known mode and a level from 1 to 5 (amendment 19, FR-134)', () => {
    for (const mode of ['always', 'upToLevel', 'never'] as const) {
      for (const level of [1, 2, 3, 4, 5] as const) expect(settingsSchema.safeParse({ ...defaultSettings(), aimCross: { mode, level } }).success).toBe(true);
    }
    for (const aimCross of [{ mode: 'sometimes', level: 2 }, { mode: 'upToLevel', level: 0 }, { mode: 'upToLevel', level: 6 }, { mode: 'never' }, 'always']) {
      expect(settingsSchema.safeParse({ ...defaultSettings(), aimCross }).success, JSON.stringify(aimCross)).toBe(false);
    }
    const { aimCross: _drop, ...without } = defaultSettings();
    void _drop;
    expect(settingsSchema.safeParse(without).success).toBe(false);
  });

  it('the schema needs enemiesAtOnce 1 to 4 and a lineStyle of "Gerade" or "Keine Linien" (amendment 21, FR-136, FR-144)', () => {
    for (const enemiesAtOnce of [1, 2, 3, 4]) expect(settingsSchema.safeParse({ ...defaultSettings(), enemiesAtOnce }).success).toBe(true);
    for (const enemiesAtOnce of [0, 5, 2.5, '2']) expect(settingsSchema.safeParse({ ...defaultSettings(), enemiesAtOnce }).success, String(enemiesAtOnce)).toBe(false);
    for (const enemiesAtOnce of [1, 2, 3, 4] as const) {
      for (const lineStyle of ['straight', 'none'] as const) expect(validateSettings({ ...defaultSettings(), lineStyle, enemiesAtOnce }).ok).toBe(true);
    }
    // The curved styles were removed by the product owner (amendment 21 item 18); only migration still reads them.
    for (const lineStyle of ['curved', 'tangled', 'wavy']) expect(settingsSchema.safeParse({ ...defaultSettings(), lineStyle }).success, lineStyle).toBe(false);
    expect(defaultSettings().lineStyle).toBe('straight');
  });

  it('the schema accepts only whole numbers for roundLength and timeLimitSeconds', () => {
    expect(settingsSchema.safeParse({ ...defaultSettings(), roundLength: 5.5 }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...defaultSettings(), timeLimitSeconds: 30.5 }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...defaultSettings(), timeLimitSeconds: 30 }).success).toBe(true);
  });

  it('parseSettings migrates, checks the schema and the rules, and gives null for anything invalid', () => {
    const { numberPad: _drop, playModes: _modes, ...v5 } = { ...defaultSettings(), version: 5, freePlay: true };
    void _drop;
    void _modes;
    expect(parseSettings(v5)).toMatchObject({ version: 13, enemiesAtOnce: 1, lineStyle: 'straight', aimCross: { mode: 'always', level: 2 }, numberPad: 'auto', playModes: { mixed: true, ruler: true, math: true }, pointAfterFullHelp: true });
    expect(parseSettings({ ...defaultSettings(), roundLength: 99 })).toBeNull();
    expect(parseSettings('nope')).toBeNull();
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

describe('"Zwei Zahlen" settings (amendment 26, FR-148, FR-151, FR-152)', () => {
  /** Defaults with "Zwei Zahlen" for one or both kinds; `patch` changes the kind's fields. */
  function twoNumbers(patch: { addition?: Partial<Settings['addition']>; subtraction?: Partial<Settings['subtraction']> } = {}): Settings {
    const s = defaultSettings();
    s.addition = { ...s.addition, size: 'twoNumbers', ...patch.addition };
    s.subtraction = { ...s.subtraction, size: 'twoNumbers', ...patch.subtraction };
    return s;
  }

  function keys(s: Settings): string[] {
    return errorsOf(s).map((e) => e.key);
  }

  it('the defaults are "Kleine Schritte", both ranges 10 to 99 and no carrying, for plus and for minus', () => {
    for (const kind of ['addition', 'subtraction'] as const) {
      expect(defaultSettings()[kind]).toMatchObject({ size: 'steps', first: { min: 10, max: 99 }, second: { min: 10, max: 99 }, carry: false });
    }
    expect(validateSettings(twoNumbers())).toEqual({ ok: true });
  });

  it('the schema accepts the new fields and rejects wrong values', () => {
    expect(settingsSchema.safeParse(twoNumbers({ addition: { carry: true, first: { min: 100, max: 999 }, second: { min: 1, max: 9 } } })).success).toBe(true);
    const bad: unknown[] = [
      { size: 'big' },
      { first: { min: 10 } },
      { second: { min: 1.5, max: 9 } },
      { first: '10-99' },
      { carry: 'yes' },
    ];
    for (const kind of ['addition', 'subtraction'] as const) {
      for (const patch of bad) {
        const s = { ...defaultSettings(), [kind]: { ...defaultSettings()[kind], ...(patch as object) } };
        expect(settingsSchema.safeParse(s).success, `${kind} ${JSON.stringify(patch)}`).toBe(false);
      }
      const { size: _size, ...without } = defaultSettings()[kind];
      void _size;
      expect(settingsSchema.safeParse({ ...defaultSettings(), [kind]: without }).success).toBe(false);
    }
  });

  it('a range below 1, above 999 or with the smallest number above the largest is an error', () => {
    for (const r of [{ min: 0, max: 99 }, { min: 10, max: 1000 }, { min: 50, max: 40 }]) {
      expect(errorsOf(twoNumbers({ addition: { first: r } }))).toContainEqual({ key: 'additionFirstRange', path: 'addition.first' });
      expect(errorsOf(twoNumbers({ addition: { second: r } }))).toContainEqual({ key: 'additionSecondRange', path: 'addition.second' });
      expect(errorsOf(twoNumbers({ subtraction: { first: r } }))).toContainEqual({ key: 'subtractionFirstRange', path: 'subtraction.first' });
      expect(errorsOf(twoNumbers({ subtraction: { second: r } }))).toContainEqual({ key: 'subtractionSecondRange', path: 'subtraction.second' });
    }
    // 1 to 999 is allowed (with a battlefield where pairs fit).
    const wide = withRange(twoNumbers({ addition: { first: { min: 1, max: 999 }, second: { min: 1, max: 999 }, carry: true } }), { preset: '0-1000', min: 0, max: 1000 });
    wide.subtraction = { ...wide.subtraction, first: { min: 1, max: 999 }, second: { min: 1, max: 999 }, carry: true };
    expect(validateSettings(wide)).toEqual({ ok: true });
  });

  it('minus needs a first number that can be larger than the second', () => {
    const s = twoNumbers({ subtraction: { first: { min: 10, max: 20 }, second: { min: 20, max: 30 } } });
    expect(errorsOf(s)).toContainEqual({ key: 'subtractionOrder', path: 'subtraction.first' });
    expect(keys(s)).not.toContain('subtractionNoPair');
    expect(keys(twoNumbers({ subtraction: { first: { min: 10, max: 21 }, second: { min: 20, max: 30 }, carry: true } }))).not.toContain('subtractionOrder');
  });

  it('no exercise that fits the battlefield is an error for each kind that is on', () => {
    // Battlefield 550 to 780: no first number from 10 to 99 lies on it.
    const s = withRange(twoNumbers(), { preset: 'custom', min: 550, max: 780 });
    expect(errorsOf(s)).toEqual([
      { key: 'additionNoPair', path: 'addition.size' },
      { key: 'subtractionNoPair', path: 'subtraction.size' },
    ]);
    s.challengeTypes = { ...s.challengeTypes, addition: false, subtraction: false };
    expect(validateSettings(s)).toEqual({ ok: true });
    // Without carrying, first numbers 90 to 99 and second numbers 10 to 99 always carry.
    expect(keys(twoNumbers({ addition: { first: { min: 90, max: 99 } } }))).toContain('additionNoPair');
    expect(keys(twoNumbers({ addition: { first: { min: 90, max: 99 }, carry: true } }))).not.toContain('additionNoPair');
    // "Größtes Ergebnis" applies: sums of 10 to 99 and 10 to 99 are at least 20.
    const low = twoNumbers();
    low.addition.maxResult = 19;
    expect(keys(low)).toContain('additionNoPair');
  });

  it('the new checks apply only to "Zwei Zahlen"', () => {
    const s = defaultSettings();
    s.addition = { ...s.addition, first: { min: 0, max: 1000 }, second: { min: 50, max: 40 } };
    s.subtraction = { ...s.subtraction, first: { min: 10, max: 20 }, second: { min: 20, max: 30 } };
    expect(validateSettings(s)).toEqual({ ok: true });
    expect(validateSettings(withRange(defaultSettings(), { preset: 'custom', min: 550, max: 780 }))).toEqual({ ok: true });
    expect(settingsNotices(s)).toEqual([]);
  });

  it('settingsNotices names the largest plus answer when only some exercises fit', () => {
    // Both numbers 10 to 99 with carrying on the battlefield 0 to 100: sums above 100 do not come.
    expect(settingsNotices(twoNumbers({ addition: { carry: true } }))).toEqual([{ key: 'additionSomeOff', path: 'addition.size', value: 100 }]);
    // Without carrying every sum of two-digit numbers is at most 99, so all fit.
    expect(settingsNotices(twoNumbers())).toEqual([]);
    const low = twoNumbers();
    low.addition.maxResult = 50;
    expect(settingsNotices(low)).toEqual([{ key: 'additionSomeOff', path: 'addition.size', value: 50 }]);
  });

  it('settingsNotices names the smallest minus answer when only some exercises fit', () => {
    // Battlefield 50 to 150: answers below 50 and first numbers below 50 do not come.
    const s = withRange(twoNumbers({ subtraction: { carry: true } }), { preset: 'custom', min: 50, max: 150 });
    s.addition.size = 'steps';
    expect(validateSettings(s)).toEqual({ ok: true });
    expect(settingsNotices(s)).toEqual([{ key: 'subtractionSomeOff', path: 'subtraction.size', value: 50 }]);
  });

  it('settingsNotices is empty for a kind that is off or has no exercise at all', () => {
    const off = twoNumbers({ addition: { carry: true } });
    off.challengeTypes = { ...off.challengeTypes, addition: false };
    expect(settingsNotices(off)).toEqual([]);
    expect(settingsNotices(withRange(twoNumbers({ addition: { carry: true } }), { preset: 'custom', min: 550, max: 780 }))).toEqual([]);
  });
});

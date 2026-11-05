import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../settings/defaults';
import { settingsSchema } from '../settings/schema';
import { validateSettings } from '../settings/validate';
import type { Progress } from '../types';
import { memoryKeyValue, type KeyValue } from './keyValue';
import { migrate } from './migrate';

const ALL_MODES = { mixed: true, ruler: true, math: true };

/** The default aiming cross of settings version 10 (amendment 19). */
const AIM_CROSS_DEFAULT = { mode: 'always', level: 2 };

/**
 * The current defaults in the shape of settings before version 8: `freePlay` instead of `playModes` (amendment 17) and
 * no `pointAfterFullHelp` (amendment 18), no `aimCross` (amendment 19).
 */
function legacyDefaults(freePlay = false): Record<string, unknown> {
  const { playModes: _modes, pointAfterFullHelp: _point, aimCross: _cross, enemiesAtOnce: _wave, lineStyle: _lines, ...rest } = defaultSettings();
  void _wave;
  void _lines;
  void _modes;
  void _point;
  void _cross;
  return { ...rest, freePlay };
}

/** Settings `v` after every migration step: `freePlay` dropped, all play modes offered, a point after the full help, the aiming cross, version 10. */
function upgraded(v: Record<string, unknown>, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const { freePlay: _free, ...rest } = v;
  void _free;
  return { ...rest, playModes: ALL_MODES, pointAfterFullHelp: true, aimCross: AIM_CROSS_DEFAULT, enemiesAtOnce: 1, lineStyle: 'straight', ...extra, version: 11 };
}
import { progressSchema } from './progressSchema';
import { emptyRecords, type Records } from '../records/records';
import { emptyGarage, type Garage } from '../rewards/garage';
import {
  emptyProgress,
  GARAGE_KEY,
  loadGarage,
  loadProgress,
  loadRecords,
  loadSettings,
  PROGRESS_KEY,
  RECORDS_KEY,
  saveGarage,
  saveProgress,
  saveRecords,
  saveSettings,
  SETTINGS_KEY,
} from './storage';

function sampleProgress(): Progress {
  return {
    version: 1,
    attempts: [
      {
        challengeId: '42-0',
        seed: 123456,
        kind: 'subtraction',
        skills: ['subtraction', 'crossTens'],
        rangeKey: '0-100',
        difficultyStep: 2,
        solved: true,
        independent: false,
        helpLevel: 1,
        wrongAnswers: 1,
        responseMs: 5300,
        guess: false,
        sessionId: 's1',
        at: 1_762_300_000_000,
      },
    ],
    skills: {
      'subtraction|0-100': {
        step: 2,
        recent: ['independent', 'close', 'assisted'],
        masteryWindow: ['independent', 'close', 'assisted', 'unsolved'],
        guesses: 0,
        attempts: 3,
        independentCorrect: 1,
        assisted: 1,
      },
    },
    sessions: [{ id: 's1', startedAt: 1_762_300_000_000, lastActiveAt: 1_762_300_060_000, attempts: 1, independentCorrect: 0, assisted: 1 }],
  };
}

function throwingKeyValue(): KeyValue {
  return {
    get() {
      throw new Error('SecurityError');
    },
    set() {
      throw new Error('QuotaExceededError');
    },
    remove() {
      throw new Error('SecurityError');
    },
  };
}

describe('storage keys', () => {
  it('are exactly mathtanks.settings.v1 and mathtanks.progress.v1', () => {
    expect(SETTINGS_KEY).toBe('mathtanks.settings.v1');
    expect(PROGRESS_KEY).toBe('mathtanks.progress.v1');
  });

  it('save writes under those keys', () => {
    const kv = memoryKeyValue();
    saveSettings(kv, defaultSettings());
    saveProgress(kv, emptyProgress());
    expect(kv.get('mathtanks.settings.v1')).not.toBeNull();
    expect(kv.get('mathtanks.progress.v1')).not.toBeNull();
  });
});

describe('round trip (SC-007)', () => {
  it('keeps settings unchanged', () => {
    const kv = memoryKeyValue();
    const s = defaultSettings();
    s.range = { preset: 'custom', min: 15, max: 45 };
    s.addition.maxResult = 45;
    s.timeLimitSeconds = 30;
    s.enemyDifficulty = 'challenging';
    expect(saveSettings(kv, s)).toEqual({ ok: true });
    expect(loadSettings(kv)).toEqual({ settings: s, resetReason: 'none' });
  });

  it('keeps progress unchanged', () => {
    const kv = memoryKeyValue();
    const p = sampleProgress();
    expect(saveProgress(kv, p)).toEqual({ ok: true });
    expect(loadProgress(kv)).toEqual({ progress: p, resetReason: 'none' });
  });
});

describe('missing key', () => {
  it('gives defaults with resetReason none', () => {
    const kv = memoryKeyValue();
    expect(loadSettings(kv)).toEqual({ settings: defaultSettings(), resetReason: 'none' });
    expect(loadProgress(kv)).toEqual({ progress: emptyProgress(), resetReason: 'none' });
  });
});

describe('damaged data', () => {
  it('damaged JSON gives defaults with resetReason invalid', () => {
    const kv = memoryKeyValue();
    kv.set(SETTINGS_KEY, '{"version":1,');
    kv.set(PROGRESS_KEY, 'not json');
    expect(loadSettings(kv)).toEqual({ settings: defaultSettings(), resetReason: 'invalid' });
    expect(loadProgress(kv)).toEqual({ progress: emptyProgress(), resetReason: 'invalid' });
  });

  it('schema-invalid data gives defaults with resetReason invalid', () => {
    const kv = memoryKeyValue();
    kv.set(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), rulerLevelStart: 9 }));
    kv.set(PROGRESS_KEY, JSON.stringify({ version: 1, attempts: 'nope', skills: {}, sessions: [] }));
    expect(loadSettings(kv)).toEqual({ settings: defaultSettings(), resetReason: 'invalid' });
    expect(loadProgress(kv)).toEqual({ progress: emptyProgress(), resetReason: 'invalid' });
  });

  it('settings that break a validation rule give defaults with resetReason invalid', () => {
    const kv = memoryKeyValue();
    kv.set(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), roundLength: 99 }));
    expect(loadSettings(kv)).toEqual({ settings: defaultSettings(), resetReason: 'invalid' });
  });

  it('data from a newer version of the game gives defaults with resetReason newer, not invalid (review M2)', () => {
    const kv = memoryKeyValue({
      [SETTINGS_KEY]: JSON.stringify({ ...defaultSettings(), version: 99 }),
      [PROGRESS_KEY]: JSON.stringify({ ...emptyProgress(), version: 2 }),
      [RECORDS_KEY]: JSON.stringify({ version: 2, best: {} }),
      [GARAGE_KEY]: JSON.stringify({ version: 3, balance: 3, look: emptyGarage().look }),
    });
    expect(loadSettings(kv)).toEqual({ settings: defaultSettings(), resetReason: 'newer' });
    expect(loadProgress(kv)).toEqual({ progress: emptyProgress(), resetReason: 'newer' });
    expect(loadRecords(kv)).toEqual({ records: emptyRecords(), resetReason: 'newer' });
    expect(loadGarage(kv)).toEqual({ garage: emptyGarage(), resetReason: 'newer' });
  });
});

describe('stored addition operand above the range width (review R5)', () => {
  it('loads with the operand clamped to the range width instead of resetting the settings', () => {
    const stored = { ...defaultSettings(), range: { preset: '0-20', min: 0, max: 20 }, addition: { maxOperand: 500, maxResult: 20, steps: 1 } };
    const kv = memoryKeyValue({ [SETTINGS_KEY]: JSON.stringify(stored) });
    const r = loadSettings(kv);
    expect(r.resetReason).toBe('none');
    expect(r.settings.addition.maxOperand).toBe(20);
  });
});

describe('unavailable storage', () => {
  it('a throwing KeyValue gives defaults with resetReason unavailable', () => {
    const kv = throwingKeyValue();
    expect(loadSettings(kv)).toEqual({ settings: defaultSettings(), resetReason: 'unavailable' });
    expect(loadProgress(kv)).toEqual({ progress: emptyProgress(), resetReason: 'unavailable' });
  });

  it('saveSettings and saveProgress return ok false', () => {
    const kv = throwingKeyValue();
    expect(saveSettings(kv, defaultSettings())).toEqual({ ok: false });
    expect(saveProgress(kv, emptyProgress())).toEqual({ ok: false });
  });
});

describe('migrate', () => {
  it('turns a version 0 settings fixture into a valid version 6 object', () => {
    const v0 = {
      version: 0,
      challengeTypes: { numberLine: true, addition: false, subtraction: true, comparison: true },
      range: { preset: '0-20', min: 0, max: 20 },
      addition: { maxOperand: 5, maxResult: 20, steps: 1 },
      subtraction: { maxOperand: 5, steps: 1 },
      labelLevel: 2,
      enemyDifficulty: 'normal',
      roundLength: 8,
    };
    const migrated = migrate(v0, 'settings');
    const parsed = settingsSchema.safeParse(migrated);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.version).toBe(11);
    expect(parsed.data?.range).toEqual({ preset: '0-20', min: 0, max: 20 });
    expect(parsed.data?.challengeTypes.addition).toBe(false);
    expect(parsed.data?.rulerLevelStart).toBe(2);
    expect(parsed.data?.rulerLevelMax).toBe(5);
    expect(parsed.data?.roundLength).toBe(8);
    expect(parsed.data?.timeLimitSeconds).toBeNull();
  });

  function v1Settings(labelLevel: number, aimCorrection: boolean): Record<string, unknown> {
    const v1: Record<string, unknown> = { ...legacyDefaults(), version: 1, labelLevel, aimCorrection };
    delete v1.rulerLevelStart;
    delete v1.rulerLevelMax;
    delete v1.exactHit;
    return v1;
  }

  it('turns version 1 settings with labelLevel 4 and aimCorrection into version 6 with level 5 to 5 (decision D13)', () => {
    const migrated = migrate(v1Settings(4, true), 'settings') as Record<string, unknown>;
    const parsed = settingsSchema.safeParse(migrated);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.version).toBe(11);
    expect(parsed.data?.rulerLevelStart).toBe(5);
    expect(parsed.data?.rulerLevelMax).toBe(5);
    expect('aimCorrection' in migrated).toBe(false);
    expect('labelLevel' in migrated).toBe(false);
    expect(validateSettings(parsed.data!)).toEqual({ ok: true });
  });

  it('turns version 1 settings with labelLevel 2 into start 2 and max 5', () => {
    const parsed = settingsSchema.safeParse(migrate(v1Settings(2, false), 'settings'));
    expect(parsed.success).toBe(true);
    expect(parsed.data?.rulerLevelStart).toBe(2);
    expect(parsed.data?.rulerLevelMax).toBe(5);
  });

  it('loadSettings upgrades stored version 1 settings without a reset', () => {
    const kv = memoryKeyValue();
    kv.set(SETTINGS_KEY, JSON.stringify({ ...v1Settings(3, true), roundLength: 12 }));
    const { settings, resetReason } = loadSettings(kv);
    expect(resetReason).toBe('none');
    expect(settings.version).toBe(11);
    expect(settings.rulerLevelStart).toBe(3);
    expect(settings.roundLength).toBe(12);
  });

  it('turns a version 0 progress fixture into a valid version 1 object', () => {
    const v1 = sampleProgress();
    const v0 = {
      version: 0,
      attempts: v1.attempts,
      skills: { 'subtraction|0-100': { step: 2, recent: ['independent'], guesses: 0, attempts: 3, independentCorrect: 1, assisted: 1 } },
    };
    const migrated = migrate(v0, 'progress');
    const parsed = progressSchema.safeParse(migrated);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.version).toBe(1);
    expect(parsed.data?.sessions).toEqual([]);
    expect(parsed.data?.skills['subtraction|0-100']?.masteryWindow).toEqual([]);
    expect(parsed.data?.attempts).toEqual(v1.attempts);
  });

  it('loadSettings applies migrate to a stored version 0 object', () => {
    const kv = memoryKeyValue();
    kv.set(SETTINGS_KEY, JSON.stringify({ version: 0, roundLength: 12 }));
    const { settings, resetReason } = loadSettings(kv);
    expect(resetReason).toBe('none');
    expect(settings.version).toBe(11);
    expect(settings.roundLength).toBe(12);
  });

  /** A version 3 settings object as stored before amendment 06. */
  function v3Settings(over: Record<string, unknown> = {}): Record<string, unknown> {
    const v3: Record<string, unknown> = { ...legacyDefaults(), version: 3, exactHit: false, roundLength: 10, ...over };
    delete v3.roundType;
    delete v3.showClock;
    delete v3.showRecords;
    delete v3.garage;
    delete v3.numberPad;
    return v3;
  }

  it('turns version 2 settings into version 6 with every other field unchanged (amendments 04 and 06)', () => {
    const v2 = v3Settings({ version: 2, roundLength: 7, rulerLevelStart: 3 });
    delete v2.exactHit;
    const migrated = migrate(v2, 'settings') as Record<string, unknown>;
    expect(migrated).toEqual(upgraded(v2, { roundType: 'untilHearts', showClock: false, showRecords: true, garage: true, numberPad: 'auto' }));
    expect(settingsSchema.safeParse(migrated).success).toBe(true);
    expect(migrate(v1Settings(2, false), 'settings')).toMatchObject({ version: 11, roundType: 'untilHearts', garage: true });
  });

  it('turns version 3 settings into version 6: exactHit dropped, roundType, showClock, showRecords and garage added (amendments 06 and 11)', () => {
    const v3 = v3Settings({ exactHit: true, rulerLevelStart: 2 });
    const migrated = migrate(v3, 'settings') as Record<string, unknown>;
    const expected: Record<string, unknown> = upgraded(v3, { roundType: 'untilHearts', roundLength: 10, showClock: false, showRecords: true, garage: true, numberPad: 'auto' });
    delete expected.exactHit;
    expect(migrated).toEqual(expected);
    const parsed = settingsSchema.safeParse(migrated);
    expect(parsed.success).toBe(true);
    expect(validateSettings(parsed.data!)).toEqual({ ok: true });
  });

  it('version 3 with noDamage becomes "Gegner pro Runde", and a roundLength above 20 is clamped to 20', () => {
    expect(migrate(v3Settings({ noDamage: true }), 'settings')).toMatchObject({ roundType: 'enemyCount', noDamage: true });
    expect(migrate(v3Settings({ roundLength: 30 }), 'settings')).toMatchObject({ roundLength: 20 });
    expect(migrate(v3Settings({ roundLength: 3 }), 'settings')).toMatchObject({ roundLength: 3 });
  });

  it('loadSettings upgrades stored version 2 settings without a reset', () => {
    const kv = memoryKeyValue();
    const v2 = v3Settings({ version: 2, freePlay: true });
    delete v2.exactHit;
    kv.set(SETTINGS_KEY, JSON.stringify(v2));
    const { settings, resetReason } = loadSettings(kv);
    expect(resetReason).toBe('none');
    expect(settings).toMatchObject({ version: 11, roundType: 'untilHearts', playModes: ALL_MODES });
    expect('freePlay' in settings).toBe(false);
    expect('exactHit' in settings).toBe(false);
  });

  it('loadSettings upgrades stored version 3 settings with noDamage without a reset', () => {
    const kv = memoryKeyValue();
    kv.set(SETTINGS_KEY, JSON.stringify(v3Settings({ noDamage: true, exactHit: true })));
    const { settings, resetReason } = loadSettings(kv);
    expect(resetReason).toBe('none');
    expect(settings).toMatchObject({ version: 11, roundType: 'enemyCount', noDamage: true });
  });

  it('turns version 4 settings into version 6 with garage on, and keeps a stored garage value (amendment 11)', () => {
    const v4: Record<string, unknown> = { ...legacyDefaults(), version: 4, roundType: 'enemyCount', showClock: true };
    delete v4.garage;
    delete v4.numberPad;
    const migrated = migrate(v4, 'settings');
    expect(migrated).toEqual(upgraded(v4, { garage: true, numberPad: 'auto' }));
    expect(settingsSchema.safeParse(migrated).success).toBe(true);
    expect(migrate({ ...v4, garage: false }, 'settings')).toMatchObject({ version: 11, garage: false });
  });

  it('turns version 5 settings into version 6 with numberPad auto, and keeps a stored numberPad value (amendment 12)', () => {
    const v5: Record<string, unknown> = { ...legacyDefaults(), version: 5, garage: false };
    delete v5.numberPad;
    const migrated = migrate(v5, 'settings');
    expect(migrated).toEqual(upgraded(v5, { numberPad: 'auto' }));
    expect(settingsSchema.safeParse(migrated).success).toBe(true);
    expect(migrate({ ...v5, numberPad: 'always' }, 'settings')).toMatchObject({ version: 11, numberPad: 'always' });
  });

  it('loadSettings upgrades stored version 5 settings without a reset (amendment 12)', () => {
    const kv = memoryKeyValue();
    const v5: Record<string, unknown> = { ...legacyDefaults(true), version: 5 };
    delete v5.numberPad;
    kv.set(SETTINGS_KEY, JSON.stringify(v5));
    const { settings, resetReason } = loadSettings(kv);
    expect(resetReason).toBe('none');
    expect(settings).toMatchObject({ version: 11, numberPad: 'auto', playModes: ALL_MODES });
  });

  it('version 6 becomes version 7 with reading aloud turned off once (PO1)', () => {
    const v6 = { ...legacyDefaults(), version: 6, sound: { effects: false, music: true, speech: true }, showClock: true };
    expect(migrate(v6, 'settings')).toEqual(upgraded(v6, { sound: { effects: false, music: true, speech: false } }));
  });

  it('version 7 becomes version 8: free play becomes the play modes (amendment 17)', () => {
    const v7 = { ...legacyDefaults(), version: 7 };
    expect(migrate(v7, 'settings')).toEqual(upgraded(v7));
    expect(migrate({ ...v7, freePlay: true }, 'settings')).toMatchObject({ version: 11, playModes: ALL_MODES });
    const noTypes = { numberLine: false, addition: false, subtraction: false, comparison: false };
    const onlyFree = migrate({ ...v7, freePlay: true, challengeTypes: noTypes }, 'settings') as Record<string, unknown>;
    expect(onlyFree.playModes).toEqual({ mixed: false, ruler: true, math: false });
    expect('freePlay' in onlyFree).toBe(false);
    const parsed = settingsSchema.safeParse(onlyFree);
    expect(parsed.success).toBe(true);
    expect(validateSettings(parsed.data!)).toEqual({ ok: true });
  });

  it('version 8 becomes version 9: a point after the full help is added, on unless already set (amendment 18)', () => {
    const { pointAfterFullHelp: _point, aimCross: _cross, enemiesAtOnce: _wave, lineStyle: _lines, ...v8 } = { ...defaultSettings(), version: 8 };
    void _wave;
    void _lines;
    void _point;
    void _cross;
    expect(migrate(v8, 'settings')).toEqual({ ...defaultSettings(), version: 11, pointAfterFullHelp: true });
    expect(migrate({ ...v8, pointAfterFullHelp: false }, 'settings')).toMatchObject({ version: 11, pointAfterFullHelp: false });
    // Version 0 and version 7 data go through every step and get the default.
    expect(migrate({ ...legacyDefaults(), version: 7 }, 'settings')).toMatchObject({ version: 11, pointAfterFullHelp: true });
    expect(migrate({ rulerLevelStart: 2 }, 'settings')).toMatchObject({ version: 11, pointAfterFullHelp: true });
  });

  it('version 9 becomes version 10: the aiming cross is added as "Immer" unless already set (amendment 19, FR-135)', () => {
    const { aimCross: _cross, enemiesAtOnce: _wave, lineStyle: _lines, ...v9 } = { ...defaultSettings(), version: 9 };
    void _cross;
    void _wave;
    void _lines;
    expect(migrate(v9, 'settings')).toEqual({ ...defaultSettings(), version: 11, aimCross: { mode: 'always', level: 2 } });
    const never = { mode: 'never', level: 4 };
    expect(migrate({ ...v9, aimCross: never }, 'settings')).toMatchObject({ version: 11, aimCross: never });
    // Version 0 and version 8 data go through every step and get the default.
    expect(migrate({ ...legacyDefaults(), version: 7 }, 'settings')).toMatchObject({ version: 11, aimCross: AIM_CROSS_DEFAULT });
    expect(migrate({ rulerLevelStart: 2 }, 'settings')).toMatchObject({ version: 11, aimCross: AIM_CROSS_DEFAULT });
  });

  it('version 10 becomes version 11: one enemy at once and straight lines unless already set (amendment 21, FR-136)', () => {
    const { enemiesAtOnce: _wave, lineStyle: _lines, ...v10 } = { ...defaultSettings(), version: 10, aimCross: { mode: 'never', level: 3 } };
    void _wave;
    void _lines;
    expect(migrate(v10, 'settings')).toEqual({ ...defaultSettings(), aimCross: { mode: 'never', level: 3 }, version: 11, enemiesAtOnce: 1, lineStyle: 'straight' });
    expect(migrate({ ...v10, enemiesAtOnce: 3, lineStyle: 'tangled' }, 'settings')).toMatchObject({ version: 11, enemiesAtOnce: 3, lineStyle: 'tangled' });
    expect(migrate({ rulerLevelStart: 2 }, 'settings')).toMatchObject({ version: 11, enemiesAtOnce: 1, lineStyle: 'straight' });
  });

  it('loadSettings keeps a stored wave size and line style (amendment 21)', () => {
    const { settings, resetReason } = loadSettings(memoryKeyValue({ [SETTINGS_KEY]: JSON.stringify({ ...defaultSettings(), enemiesAtOnce: 4, lineStyle: 'curved' }) }));
    expect(resetReason).toBe('none');
    expect(settings).toMatchObject({ enemiesAtOnce: 4, lineStyle: 'curved' });
  });

  it('loadSettings keeps a stored aiming cross (amendment 19)', () => {
    const aimCross = { mode: 'upToLevel', level: 3 } as const;
    const { settings, resetReason } = loadSettings(memoryKeyValue({ [SETTINGS_KEY]: JSON.stringify({ ...defaultSettings(), aimCross }) }));
    expect(resetReason).toBe('none');
    expect(settings.aimCross).toEqual(aimCross);
  });

  it('loadSettings keeps a stored point after the full help that is off (amendment 18)', () => {
    const kv = memoryKeyValue({ [SETTINGS_KEY]: JSON.stringify({ ...defaultSettings(), pointAfterFullHelp: false }) });
    const { settings, resetReason } = loadSettings(kv);
    expect(resetReason).toBe('none');
    expect(settings.pointAfterFullHelp).toBe(false);
  });

  it('loadSettings upgrades stored version 7 settings that offered only free play without a reset (amendment 17)', () => {
    const noTypes = { numberLine: false, addition: false, subtraction: false, comparison: false };
    const kv = memoryKeyValue({ [SETTINGS_KEY]: JSON.stringify({ ...legacyDefaults(true), version: 7, challengeTypes: noTypes }) });
    const { settings, resetReason } = loadSettings(kv);
    expect(resetReason).toBe('none');
    expect(settings.playModes).toEqual({ mixed: false, ruler: true, math: false });
  });

  it('loadSettings turns reading aloud off in stored version 6 settings, and keeps it on when the parent turns it on again (PO1)', () => {
    const kv = memoryKeyValue({ [SETTINGS_KEY]: JSON.stringify({ ...legacyDefaults(), version: 6, sound: { effects: true, music: false, speech: true } }) });
    const first = loadSettings(kv);
    expect(first.resetReason).toBe('none');
    expect(first.settings.sound.speech).toBe(false);
    saveSettings(kv, { ...first.settings, sound: { ...first.settings.sound, speech: true } });
    expect(loadSettings(kv).settings.sound.speech).toBe(true);
  });

  it('leaves version 7 settings unchanged', () => {
    const s = { ...defaultSettings(), roundType: 'enemyCount' as const, showClock: true, garage: false, sound: { effects: true, music: false, speech: true } };
    expect(migrate(s, 'settings')).toEqual(s);
  });

  it('the progress schema accepts the outcome close and attempts with or without the old exact field', () => {
    const p = sampleProgress();
    expect(progressSchema.safeParse(p).success).toBe(true);
    const old: Record<string, unknown> = { ...p.attempts[0]! };
    delete old.exact;
    const parsed = progressSchema.safeParse({ ...p, attempts: [old] });
    expect(parsed.success).toBe(true);
    expect(progressSchema.safeParse({ ...p, attempts: [{ ...p.attempts[0]!, exact: true }] }).success).toBe(true);
    const bad = { ...p, skills: { 'x|0-100': { ...p.skills['subtraction|0-100']!, recent: ['nearly'] } } };
    expect(progressSchema.safeParse(bad).success).toBe(false);
  });
});

describe('memoryKeyValue', () => {
  it('returns null for missing keys and stores values', () => {
    const kv = memoryKeyValue();
    expect(kv.get('x')).toBeNull();
    kv.set('x', 'y');
    expect(kv.get('x')).toBe('y');
  });
});

describe('records storage (amendment 06, FR-086)', () => {
  const sample = (): Records => ({ version: 1, best: { '0-100|1|untilHearts': { enemies: 9, ms: 372000, at: 1_700_000_000_000 } } });

  it('uses the key mathtanks.records.v1 and round trips', () => {
    expect(RECORDS_KEY).toBe('mathtanks.records.v1');
    const kv = memoryKeyValue();
    expect(saveRecords(kv, sample())).toEqual({ ok: true });
    expect(kv.get('mathtanks.records.v1')).not.toBeNull();
    expect(loadRecords(kv)).toEqual({ records: sample(), resetReason: 'none' });
  });

  it('missing records load empty with resetReason none', () => {
    expect(loadRecords(memoryKeyValue())).toEqual({ records: emptyRecords(), resetReason: 'none' });
  });

  it('damaged or invalid records load empty with resetReason invalid', () => {
    for (const text of ['{"version":1,', JSON.stringify({ version: 1, best: { k: { enemies: 'nine', ms: 1, at: 1 } } })]) {
      const kv = memoryKeyValue({ [RECORDS_KEY]: text });
      expect(loadRecords(kv)).toEqual({ records: emptyRecords(), resetReason: 'invalid' });
    }
  });

  it('a throwing KeyValue gives empty records with resetReason unavailable, and saving reports ok false', () => {
    const kv: KeyValue = {
      get: () => {
        throw new Error('blocked');
      },
      set: () => {
        throw new Error('blocked');
      },
      remove: () => {
        throw new Error('blocked');
      },
    };
    expect(loadRecords(kv)).toEqual({ records: emptyRecords(), resetReason: 'unavailable' });
    expect(saveRecords(kv, sample())).toEqual({ ok: false });
  });
});

describe('garage storage (amendment 11, changed by amendment 19, FR-097, FR-133)', () => {
  const sample = (): Garage => ({ version: 2, balance: 23, totalEarned: 61, owned: ['sky', 'rocket'], look: { color: 'sky', flag: 'rocket', trail: 'plain', hat: 'none' } });

  it('uses the key mathtanks.garage.v1 and round trips balance, owned items, look and total ever earned', () => {
    expect(GARAGE_KEY).toBe('mathtanks.garage.v1');
    const kv = memoryKeyValue();
    expect(saveGarage(kv, sample())).toEqual({ ok: true });
    expect(loadGarage(kv)).toEqual({ garage: sample(), resetReason: 'none' });
  });

  it('a missing garage loads an empty garage with resetReason none', () => {
    expect(loadGarage(memoryKeyValue())).toEqual({ garage: emptyGarage(), resetReason: 'none' });
  });

  it('damaged JSON or a negative balance load an empty garage with resetReason invalid', () => {
    for (const text of ['{"version":2,', JSON.stringify({ ...sample(), balance: -3 }), JSON.stringify({ version: 1, stars: -3, look: emptyGarage().look })]) {
      expect(loadGarage(memoryKeyValue({ [GARAGE_KEY]: text }))).toEqual({ garage: emptyGarage(), resetReason: 'invalid' });
    }
  });

  it('migrates a stored version 1 garage: unlocked items become owned, the balance is the rest, the total is kept (FR-133)', () => {
    const look = { color: 'sky', flag: 'rocket', trail: 'sparkles', hat: 'crown' } as const;
    const kv = memoryKeyValue({ [GARAGE_KEY]: JSON.stringify({ version: 1, stars: 45, look }) });
    expect(loadGarage(kv)).toEqual({ garage: { version: 2, balance: 0, totalEarned: 45, owned: ['sky', 'rocket', 'sparkles', 'crown'], look }, resetReason: 'none' });
  });

  it('migrates data without a version through version 1', () => {
    const kv = memoryKeyValue({ [GARAGE_KEY]: JSON.stringify({ stars: 15, look: { flag: 'rocket' } }) });
    expect(loadGarage(kv)).toEqual({
      garage: { version: 2, balance: 5, totalEarned: 15, owned: ['rocket'], look: { color: 'blue', flag: 'rocket', trail: 'plain', hat: 'none' } },
      resetReason: 'none',
    });
  });

  it('replaces a look part that is not owned or unknown with the basic item of its kind', () => {
    const kv = memoryKeyValue({ [GARAGE_KEY]: JSON.stringify({ ...sample(), look: { color: 'navyStripes', flag: 'rocket', trail: 'glitter', hat: 'crown' } }) });
    expect(loadGarage(kv).garage.look).toEqual({ color: 'blue', flag: 'rocket', trail: 'plain', hat: 'none' });
  });

  it('a garage of version 3 is newer, not invalid', () => {
    const kv = memoryKeyValue({ [GARAGE_KEY]: JSON.stringify({ ...sample(), version: 3 }) });
    expect(loadGarage(kv)).toEqual({ garage: emptyGarage(), resetReason: 'newer' });
  });

  it('a throwing KeyValue gives 0 stars with resetReason unavailable, and saving reports ok false', () => {
    const kv: KeyValue = {
      get: () => {
        throw new Error('blocked');
      },
      set: () => {
        throw new Error('blocked');
      },
      remove: () => {
        throw new Error('blocked');
      },
    };
    expect(loadGarage(kv)).toEqual({ garage: emptyGarage(), resetReason: 'unavailable' });
    expect(saveGarage(kv, sample())).toEqual({ ok: false });
  });
});

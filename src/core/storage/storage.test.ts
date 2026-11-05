import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../settings/defaults';
import { settingsSchema } from '../settings/schema';
import { validateSettings } from '../settings/validate';
import type { Progress } from '../types';
import { memoryKeyValue, type KeyValue } from './keyValue';
import { migrate } from './migrate';
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
        exact: false,
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

  it('an unknown future version gives defaults with resetReason invalid', () => {
    const kv = memoryKeyValue();
    kv.set(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), version: 99 }));
    expect(loadSettings(kv).resetReason).toBe('invalid');
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
    expect(parsed.data?.version).toBe(6);
    expect(parsed.data?.range).toEqual({ preset: '0-20', min: 0, max: 20 });
    expect(parsed.data?.challengeTypes.addition).toBe(false);
    expect(parsed.data?.rulerLevelStart).toBe(2);
    expect(parsed.data?.rulerLevelMax).toBe(5);
    expect(parsed.data?.roundLength).toBe(8);
    expect(parsed.data?.timeLimitSeconds).toBeNull();
  });

  function v1Settings(labelLevel: number, aimCorrection: boolean): Record<string, unknown> {
    const v1: Record<string, unknown> = { ...defaultSettings(), version: 1, labelLevel, aimCorrection };
    delete v1.rulerLevelStart;
    delete v1.rulerLevelMax;
    delete v1.exactHit;
    return v1;
  }

  it('turns version 1 settings with labelLevel 4 and aimCorrection into version 6 with level 5 to 5 (decision D13)', () => {
    const migrated = migrate(v1Settings(4, true), 'settings') as Record<string, unknown>;
    const parsed = settingsSchema.safeParse(migrated);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.version).toBe(6);
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
    expect(settings.version).toBe(6);
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
    expect(settings.version).toBe(6);
    expect(settings.roundLength).toBe(12);
  });

  /** A version 3 settings object as stored before amendment 06. */
  function v3Settings(over: Record<string, unknown> = {}): Record<string, unknown> {
    const v3: Record<string, unknown> = { ...defaultSettings(), version: 3, exactHit: false, roundLength: 10, ...over };
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
    expect(migrated).toEqual({ ...v2, version: 6, roundType: 'untilHearts', showClock: false, showRecords: true, garage: true, numberPad: 'auto' });
    expect(settingsSchema.safeParse(migrated).success).toBe(true);
    expect(migrate(v1Settings(2, false), 'settings')).toMatchObject({ version: 6, roundType: 'untilHearts', garage: true });
  });

  it('turns version 3 settings into version 6: exactHit dropped, roundType, showClock, showRecords and garage added (amendments 06 and 11)', () => {
    const v3 = v3Settings({ exactHit: true, rulerLevelStart: 2 });
    const migrated = migrate(v3, 'settings') as Record<string, unknown>;
    const expected: Record<string, unknown> = { ...v3, version: 6, roundType: 'untilHearts', roundLength: 10, showClock: false, showRecords: true, garage: true, numberPad: 'auto' };
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
    expect(settings).toMatchObject({ version: 6, roundType: 'untilHearts', freePlay: true });
    expect('exactHit' in settings).toBe(false);
  });

  it('loadSettings upgrades stored version 3 settings with noDamage without a reset', () => {
    const kv = memoryKeyValue();
    kv.set(SETTINGS_KEY, JSON.stringify(v3Settings({ noDamage: true, exactHit: true })));
    const { settings, resetReason } = loadSettings(kv);
    expect(resetReason).toBe('none');
    expect(settings).toMatchObject({ version: 6, roundType: 'enemyCount', noDamage: true });
  });

  it('turns version 4 settings into version 6 with garage on, and keeps a stored garage value (amendment 11)', () => {
    const v4: Record<string, unknown> = { ...defaultSettings(), version: 4, roundType: 'enemyCount', showClock: true };
    delete v4.garage;
    delete v4.numberPad;
    const migrated = migrate(v4, 'settings');
    expect(migrated).toEqual({ ...v4, version: 6, garage: true, numberPad: 'auto' });
    expect(settingsSchema.safeParse(migrated).success).toBe(true);
    expect(migrate({ ...v4, garage: false }, 'settings')).toMatchObject({ version: 6, garage: false });
  });

  it('turns version 5 settings into version 6 with numberPad auto, and keeps a stored numberPad value (amendment 12)', () => {
    const v5: Record<string, unknown> = { ...defaultSettings(), version: 5, garage: false };
    delete v5.numberPad;
    const migrated = migrate(v5, 'settings');
    expect(migrated).toEqual({ ...v5, version: 6, numberPad: 'auto' });
    expect(settingsSchema.safeParse(migrated).success).toBe(true);
    expect(migrate({ ...v5, numberPad: 'always' }, 'settings')).toMatchObject({ version: 6, numberPad: 'always' });
  });

  it('loadSettings upgrades stored version 5 settings without a reset (amendment 12)', () => {
    const kv = memoryKeyValue();
    const v5: Record<string, unknown> = { ...defaultSettings(), version: 5, freePlay: true };
    delete v5.numberPad;
    kv.set(SETTINGS_KEY, JSON.stringify(v5));
    const { settings, resetReason } = loadSettings(kv);
    expect(resetReason).toBe('none');
    expect(settings).toMatchObject({ version: 6, numberPad: 'auto', freePlay: true });
  });

  it('leaves version 6 settings unchanged', () => {
    const s = { ...defaultSettings(), roundType: 'enemyCount' as const, showClock: true, garage: false };
    expect(migrate(s, 'settings')).toEqual(s);
  });

  it('the progress schema accepts the outcome close and attempts with or without exact (missing means true)', () => {
    const p = sampleProgress();
    expect(progressSchema.safeParse(p).success).toBe(true);
    const old: Record<string, unknown> = { ...p.attempts[0]! };
    delete old.exact;
    const parsed = progressSchema.safeParse({ ...p, attempts: [old] });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.attempts[0]?.exact).toBe(true);
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
    for (const text of ['{"version":1,', JSON.stringify({ version: 1, best: { k: { enemies: 'nine', ms: 1, at: 1 } } }), JSON.stringify({ version: 2, best: {} })]) {
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
    };
    expect(loadRecords(kv)).toEqual({ records: emptyRecords(), resetReason: 'unavailable' });
    expect(saveRecords(kv, sample())).toEqual({ ok: false });
  });
});

describe('garage storage (amendment 11, FR-097)', () => {
  const sample = (): Garage => ({ version: 1, stars: 23, look: { color: 'sky', flag: 'rocket', trail: 'plain', hat: 'none' } });

  it('uses the key mathtanks.garage.v1 and round trips', () => {
    expect(GARAGE_KEY).toBe('mathtanks.garage.v1');
    const kv = memoryKeyValue();
    expect(saveGarage(kv, sample())).toEqual({ ok: true });
    expect(loadGarage(kv)).toEqual({ garage: sample(), resetReason: 'none' });
  });

  it('a missing garage loads 0 stars and the standard look with resetReason none', () => {
    expect(loadGarage(memoryKeyValue())).toEqual({ garage: emptyGarage(), resetReason: 'none' });
  });

  it('damaged JSON, negative stars or an unknown version load 0 stars with resetReason invalid', () => {
    for (const text of ['{"version":1,', JSON.stringify({ ...sample(), stars: -3 }), JSON.stringify({ ...sample(), version: 2 })]) {
      expect(loadGarage(memoryKeyValue({ [GARAGE_KEY]: text }))).toEqual({ garage: emptyGarage(), resetReason: 'invalid' });
    }
  });

  it('migrates data without a version and keeps its stars', () => {
    const kv = memoryKeyValue({ [GARAGE_KEY]: JSON.stringify({ stars: 15, look: { flag: 'rocket' } }) });
    expect(loadGarage(kv)).toEqual({ garage: { version: 1, stars: 15, look: { color: 'blue', flag: 'rocket', trail: 'plain', hat: 'none' } }, resetReason: 'none' });
  });

  it('replaces a locked or unknown look part with the standard item of its kind', () => {
    const kv = memoryKeyValue({ [GARAGE_KEY]: JSON.stringify({ version: 1, stars: 12, look: { color: 'navyStripes', flag: 'rocket', trail: 'glitter', hat: 'crown' } }) });
    expect(loadGarage(kv).garage.look).toEqual({ color: 'blue', flag: 'rocket', trail: 'plain', hat: 'none' });
  });

  it('a throwing KeyValue gives 0 stars with resetReason unavailable, and saving reports ok false', () => {
    const kv: KeyValue = {
      get: () => {
        throw new Error('blocked');
      },
      set: () => {
        throw new Error('blocked');
      },
    };
    expect(loadGarage(kv)).toEqual({ garage: emptyGarage(), resetReason: 'unavailable' });
    expect(saveGarage(kv, sample())).toEqual({ ok: false });
  });
});

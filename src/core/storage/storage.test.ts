import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../settings/defaults';
import { settingsSchema } from '../settings/schema';
import type { Progress } from '../types';
import { memoryKeyValue, type KeyValue } from './keyValue';
import { migrate } from './migrate';
import { progressSchema } from './progressSchema';
import {
  emptyProgress,
  loadProgress,
  loadSettings,
  PROGRESS_KEY,
  saveProgress,
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
        recent: ['independent', 'assisted'],
        masteryWindow: ['independent', 'assisted', 'unsolved'],
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
    kv.set(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), labelLevel: 9 }));
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
  it('turns a version 0 settings fixture into a valid version 1 object', () => {
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
    expect(parsed.data?.version).toBe(1);
    expect(parsed.data?.range).toEqual({ preset: '0-20', min: 0, max: 20 });
    expect(parsed.data?.challengeTypes.addition).toBe(false);
    expect(parsed.data?.labelLevel).toBe(2);
    expect(parsed.data?.roundLength).toBe(8);
    expect(parsed.data?.timeLimitSeconds).toBeNull();
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
    expect(settings.version).toBe(1);
    expect(settings.roundLength).toBe(12);
  });

  it('leaves version 1 data unchanged', () => {
    const s = defaultSettings();
    expect(migrate(s, 'settings')).toEqual(s);
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

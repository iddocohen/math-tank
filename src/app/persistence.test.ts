import { describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../core/settings/defaults';
import type { Settings } from '../core/settings/schema';
import { exportData } from '../core/storage/exportImport';
import { memoryKeyValue, type KeyValue } from '../core/storage/keyValue';
import { emptyProgress, GARAGE_KEY, PROGRESS_KEY, RECORDS_KEY, SETTINGS_KEY } from '../core/storage/storage';
import { emptyGarage } from '../core/rewards/garage';
import { emptyRecords } from '../core/records/records';
import { createPersistence, type StorageManagerLike } from './persistence';

function changedSettings(): Settings {
  return { ...defaultSettings(), range: { preset: '0-20', min: 0, max: 20 }, addition: { maxOperand: 10, maxResult: 20, steps: 1 }, enemyDifficulty: 'normal', rulerLevelStart: 3 };
}

function storageManager(persisted: boolean, grant: boolean): StorageManagerLike & { persist: ReturnType<typeof vi.fn> } {
  return {
    persisted: vi.fn(() => Promise.resolve(persisted)),
    persist: vi.fn(() => Promise.resolve(grant)),
  };
}

/** A key-value store whose writes fail, as when browser storage is full or blocked. */
function failingWrites(kv: KeyValue): KeyValue {
  return {
    get: (key) => kv.get(key),
    set: () => {
      throw new DOMException('quota', 'QuotaExceededError');
    },
    remove: (key) => kv.remove(key),
  };
}

describe('createPersistence (FR-048)', () => {
  it('starts with defaults and resetReason none when nothing is stored', () => {
    const p = createPersistence({ kv: memoryKeyValue(), storage: undefined });
    expect(p.settings()).toEqual(defaultSettings());
    expect(p.progress()).toEqual(emptyProgress());
    expect(p.status()).toEqual({ resetReason: 'none', resetData: [], newerData: [], saveFailed: false, failedData: [], persistent: 'notAsked' });
  });

  it('saves settings so a new instance on the same store loads them', () => {
    const kv = memoryKeyValue();
    const first = createPersistence({ kv, storage: undefined });
    expect(first.saveSettings(changedSettings())).toEqual({ ok: true });
    expect(first.settings()).toEqual(changedSettings());
    expect(JSON.parse(kv.get(SETTINGS_KEY) ?? 'null')).toEqual(changedSettings());
    expect(createPersistence({ kv, storage: undefined }).settings()).toEqual(changedSettings());
  });

  it('reports resetReason invalid for damaged settings or progress, so the settings page can show it', () => {
    expect(createPersistence({ kv: memoryKeyValue({ [SETTINGS_KEY]: '{oops' }), storage: undefined }).status().resetReason).toBe('invalid');
    expect(createPersistence({ kv: memoryKeyValue({ [PROGRESS_KEY]: '[]' }), storage: undefined }).status().resetReason).toBe('invalid');
  });

  it('reports resetReason unavailable when storage cannot be read', () => {
    const blocked: KeyValue = {
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
    const p = createPersistence({ kv: blocked, storage: undefined });
    expect(p.settings()).toEqual(defaultSettings());
    expect(p.status().resetReason).toBe('unavailable');
  });

  it('reports a failed save and keeps the new settings for this session', () => {
    const p = createPersistence({ kv: failingWrites(memoryKeyValue()), storage: undefined });
    expect(p.saveSettings(changedSettings())).toEqual({ ok: false });
    expect(p.status().saveFailed).toBe(true);
    expect(p.settings()).toEqual(changedSettings());
  });

  it('clears the save failure after a later save works', () => {
    let fail = true;
    const inner = memoryKeyValue();
    const kv: KeyValue = {
      get: inner.get,
      remove: inner.remove,
      set: (k, v) => {
        if (fail) throw new Error('full');
        inner.set(k, v);
      },
    };
    const p = createPersistence({ kv, storage: undefined });
    p.saveSettings(changedSettings());
    fail = false;
    p.saveSettings(changedSettings());
    expect(p.status().saveFailed).toBe(false);
  });
});

describe('requestPersistentStorage (FR-048)', () => {
  it('asks the browser once to keep stored data, however often it is called', async () => {
    const storage = storageManager(false, true);
    const p = createPersistence({ kv: memoryKeyValue(), storage });
    const [a, b] = await Promise.all([p.requestPersistentStorage(), p.requestPersistentStorage()]);
    await p.requestPersistentStorage();
    expect(a).toBe('granted');
    expect(b).toBe('granted');
    expect(storage.persist).toHaveBeenCalledTimes(1);
    expect(p.status().persistent).toBe('granted');
  });

  it('does not ask again when the data is already kept', async () => {
    const storage = storageManager(true, false);
    const p = createPersistence({ kv: memoryKeyValue(), storage });
    expect(await p.requestPersistentStorage()).toBe('granted');
    expect(storage.persist).not.toHaveBeenCalled();
  });

  it('reports denied, unsupported and failed', async () => {
    expect(await createPersistence({ kv: memoryKeyValue(), storage: storageManager(false, false) }).requestPersistentStorage()).toBe('denied');
    expect(await createPersistence({ kv: memoryKeyValue(), storage: undefined }).requestPersistentStorage()).toBe('unsupported');
    expect(await createPersistence({ kv: memoryKeyValue(), storage: {} }).requestPersistentStorage()).toBe('unsupported');
    const throwing: StorageManagerLike = { persist: () => Promise.reject(new Error('no')) };
    expect(await createPersistence({ kv: memoryKeyValue(), storage: throwing }).requestPersistentStorage()).toBe('failed');
  });
});

describe('export and import through persistence (FR-048a)', () => {
  it('exports the current settings, progress and records', () => {
    const p = createPersistence({ kv: memoryKeyValue(), storage: undefined });
    p.saveSettings(changedSettings());
    p.submitResult('0-20|3|untilHearts', { enemies: 4, ms: 61_000, at: 5 });
    const file = JSON.parse(p.exportText(new Date('2026-11-05T00:00:00.000Z'))) as Record<string, unknown>;
    expect(file).toEqual({
      app: 'math-tanks',
      exportedAt: '2026-11-05T00:00:00.000Z',
      settings: changedSettings(),
      progress: emptyProgress(),
      records: { version: 1, best: { '0-20|3|untilHearts': { enemies: 4, ms: 61_000, at: 5 } } },
      garage: emptyGarage(),
    });
  });

  it('a valid import replaces and saves settings and progress', () => {
    const kv = memoryKeyValue();
    const p = createPersistence({ kv, storage: undefined });
    const records = { version: 1 as const, best: { 'k': { enemies: 2, ms: 1000, at: 1 } } };
    const garage = { version: 1 as const, stars: 21, look: { color: 'sky' as const, flag: 'rocket' as const, trail: 'plain' as const, hat: 'none' as const } };
    const r = p.importText(exportData(changedSettings(), emptyProgress(), records, garage));
    expect(r.ok).toBe(true);
    expect(p.settings()).toEqual(changedSettings());
    expect(p.records()).toEqual(records);
    expect(createPersistence({ kv, storage: undefined }).settings()).toEqual(changedSettings());
    expect(createPersistence({ kv, storage: undefined }).records()).toEqual(records);
    expect(createPersistence({ kv, storage: undefined }).garage()).toEqual(garage);
  });

  it('a failed import changes nothing', () => {
    const kv = memoryKeyValue();
    const p = createPersistence({ kv, storage: undefined });
    p.saveSettings(changedSettings());
    const stored = kv.get(SETTINGS_KEY);
    expect(p.importText('{"app":"other"}')).toEqual({ ok: false, reason: 'wrongApp' });
    expect(p.settings()).toEqual(changedSettings());
    expect(kv.get(SETTINGS_KEY)).toBe(stored);
  });
});

describe('personal bests through persistence (amendment 06, FR-086)', () => {
  it('starts with empty records', () => {
    expect(createPersistence({ kv: memoryKeyValue(), storage: undefined }).records()).toEqual(emptyRecords());
  });

  it('submitResult stores a new record so a new instance loads it, and reports the stored best otherwise', () => {
    const kv = memoryKeyValue();
    const p = createPersistence({ kv, storage: undefined });
    const first = p.submitResult('0-100|1|untilHearts', { enemies: 3, ms: 90_000, at: 1 });
    expect(first).toEqual({ newRecord: true, best: { enemies: 3, ms: 90_000, at: 1 } });
    expect(JSON.parse(kv.get(RECORDS_KEY) ?? 'null')).toEqual({ version: 1, best: { '0-100|1|untilHearts': { enemies: 3, ms: 90_000, at: 1 } } });
    const again = createPersistence({ kv, storage: undefined });
    expect(again.submitResult('0-100|1|untilHearts', { enemies: 2, ms: 10_000, at: 2 })).toEqual({ newRecord: false, best: { enemies: 3, ms: 90_000, at: 1 } });
  });

  it('keeps a new record for the session when it cannot be saved, and reports the failure', () => {
    const p = createPersistence({ kv: failingWrites(memoryKeyValue()), storage: undefined });
    expect(p.submitResult('k', { enemies: 1, ms: 1, at: 1 }).newRecord).toBe(true);
    expect(p.status().saveFailed).toBe(true);
    expect(p.records().best.k).toEqual({ enemies: 1, ms: 1, at: 1 });
  });
});

describe('stars and the chosen look through persistence (amendment 11, FR-089, FR-096, FR-097)', () => {
  it('loads the stored garage', () => {
    const stored = { version: 1, stars: 33, look: { color: 'sky', flag: 'rocket', trail: 'sparkles', hat: 'none' } };
    const p = createPersistence({ kv: memoryKeyValue({ [GARAGE_KEY]: JSON.stringify(stored) }), storage: undefined });
    expect(p.garage()).toEqual(stored);
  });

  it('addStars saves at once and returns the unlocked items', () => {
    const kv = memoryKeyValue({ [GARAGE_KEY]: JSON.stringify({ version: 1, stars: 9, look: emptyGarage().look }) });
    const p = createPersistence({ kv, storage: undefined });
    expect(p.addStars(1).map((i) => i.id)).toEqual(['rocket']);
    expect(p.garage().stars).toBe(10);
    expect(createPersistence({ kv, storage: undefined }).garage().stars).toBe(10);
    expect(p.addStars(2)).toEqual([]);
  });

  it('a progress reset keeps the stars and the look', () => {
    const kv = memoryKeyValue();
    const p = createPersistence({ kv, storage: undefined });
    p.addStars(12);
    p.equip('rocket');
    p.saveProgress(emptyProgress());
    const again = createPersistence({ kv, storage: undefined });
    expect(again.garage()).toEqual({ version: 1, stars: 12, look: { ...emptyGarage().look, flag: 'rocket' } });
  });

  it('equip saves the look and ignores a locked item', () => {
    const kv = memoryKeyValue();
    const p = createPersistence({ kv, storage: undefined });
    p.addStars(10);
    p.equip('sky');
    expect(p.garage().look.color).toBe('blue');
    p.equip('rocket');
    expect(createPersistence({ kv, storage: undefined }).garage().look.flag).toBe('rocket');
  });

  it('resetStars saves 0 stars and the standard look', () => {
    const kv = memoryKeyValue();
    const p = createPersistence({ kv, storage: undefined });
    p.addStars(25);
    p.equip('sky');
    p.resetStars();
    expect(p.garage()).toEqual(emptyGarage());
    expect(createPersistence({ kv, storage: undefined }).garage()).toEqual(emptyGarage());
  });

  it('importing a file without garage keeps the stars of this browser', () => {
    const p = createPersistence({ kv: memoryKeyValue(), storage: undefined });
    p.addStars(14);
    const file = JSON.parse(exportData(changedSettings(), emptyProgress(), emptyRecords(), emptyGarage())) as Record<string, unknown>;
    delete file.garage;
    expect(p.importText(JSON.stringify(file)).ok).toBe(true);
    expect(p.garage().stars).toBe(14);
    expect(p.settings()).toEqual(changedSettings());
  });

  it('a damaged garage key reports invalid and starts at 0 stars', () => {
    const p = createPersistence({ kv: memoryKeyValue({ [GARAGE_KEY]: '{"stars":' }), storage: undefined });
    expect(p.status().resetReason).toBe('invalid');
    expect(p.garage()).toEqual(emptyGarage());
  });
});

describe('saveData and applyTransfer (amendment 15, FR-119)', () => {
  it('saveData gives the current settings, progress, records and garage', () => {
    const p = createPersistence({ kv: memoryKeyValue(), storage: undefined });
    p.saveSettings(changedSettings());
    const d = p.saveData();
    expect(d.settings).toEqual(changedSettings());
    expect(d.progress).toEqual(emptyProgress());
    expect(d.records).toEqual(emptyRecords());
    expect(d.garage).toEqual(emptyGarage());
  });

  it('applyTransfer replaces and saves settings, progress without attempts, records and garage', () => {
    const kv = memoryKeyValue();
    const p = createPersistence({ kv, storage: undefined });
    const progress = { ...emptyProgress(), skills: { 'positions|0-20': { step: 1, recent: [], masteryWindow: ['independent' as const], guesses: 0, attempts: 4, independentCorrect: 3, assisted: 1 } } };
    const records = { version: 1 as const, best: { '0-20|3|untilHearts': { enemies: 6, ms: 90_000, at: 5 } } };
    const garage = { version: 1 as const, stars: 23, look: { color: 'sky' as const, flag: 'rocket' as const, trail: 'plain' as const, hat: 'none' as const } };
    expect(p.applyTransfer({ settings: changedSettings(), progress, records, garage })).toEqual({ ok: true });
    for (const loaded of [p, createPersistence({ kv, storage: undefined })]) {
      expect(loaded.settings()).toEqual(changedSettings());
      expect(loaded.progress()).toEqual(progress);
      expect(loaded.records()).toEqual(records);
      expect(loaded.garage()).toEqual(garage);
    }
  });

  it('applyTransfer reports a failed save and keeps the values of this browser (review M1, M4)', () => {
    const p = createPersistence({ kv: failingWrites(memoryKeyValue()), storage: undefined });
    expect(p.applyTransfer({ settings: changedSettings(), progress: emptyProgress(), records: emptyRecords(), garage: emptyGarage() })).toEqual({ ok: false });
    expect(p.status().saveFailed).toBe(true);
    expect(p.settings()).toEqual(defaultSettings());
  });
});

/** A key-value store whose writes fail for the keys in `failing`. */
function failingKeys(kv: KeyValue, failing: Set<string>): KeyValue {
  return {
    ...kv,
    get: (key) => kv.get(key),
    set: (key, value) => {
      if (failing.has(key)) throw new DOMException('quota', 'QuotaExceededError');
      kv.set(key, value);
    },
  };
}

describe('save failures per data kind (review H1, H2)', () => {
  it('a failed progress save stays reported after a later settings save works', () => {
    const failing = new Set([PROGRESS_KEY]);
    const p = createPersistence({ kv: failingKeys(memoryKeyValue(), failing), storage: undefined });
    expect(p.saveProgress(emptyProgress())).toEqual({ ok: false });
    expect(p.saveSettings(changedSettings())).toEqual({ ok: true });
    expect(p.status().saveFailed).toBe(true);
    expect(p.status().failedData).toEqual(['progress']);
  });

  it('the failure clears only when that data saves again', () => {
    const failing = new Set([PROGRESS_KEY, GARAGE_KEY]);
    const p = createPersistence({ kv: failingKeys(memoryKeyValue(), failing), storage: undefined });
    p.saveProgress(emptyProgress());
    p.addStars(2);
    expect(p.status().failedData).toEqual(['progress', 'garage']);
    failing.delete(PROGRESS_KEY);
    p.saveProgress(emptyProgress());
    expect(p.status().failedData).toEqual(['garage']);
    expect(p.status().saveFailed).toBe(true);
    failing.delete(GARAGE_KEY);
    p.addStars(1);
    expect(p.status()).toMatchObject({ saveFailed: false, failedData: [] });
  });
});

describe('data that could not be loaded is never overwritten (review M2, M3, P1)', () => {
  it('keeps damaged progress under <key>.unreadable before the first save replaces it', () => {
    const kv = memoryKeyValue({ [PROGRESS_KEY]: '{"version":1,"attempts":[' });
    const p = createPersistence({ kv, storage: undefined });
    expect(kv.get(`${PROGRESS_KEY}.unreadable`)).toBe('{"version":1,"attempts":[');
    expect(p.saveProgress(emptyProgress())).toEqual({ ok: true });
    expect(kv.get(`${PROGRESS_KEY}.unreadable`)).toBe('{"version":1,"attempts":[');
    expect(JSON.parse(kv.get(PROGRESS_KEY)!)).toEqual(emptyProgress());
  });

  it('keeps damaged records and garage the same way', () => {
    const kv = memoryKeyValue({ [RECORDS_KEY]: '[1]', [GARAGE_KEY]: '{"stars":' });
    const p = createPersistence({ kv, storage: undefined });
    p.submitResult('k', { enemies: 2, ms: 1, at: 1 });
    p.addStars(1);
    expect(kv.get(`${RECORDS_KEY}.unreadable`)).toBe('[1]');
    expect(kv.get(`${GARAGE_KEY}.unreadable`)).toBe('{"stars":');
  });

  it('refuses to save over damaged data when its copy cannot be written', () => {
    const inner = memoryKeyValue({ [PROGRESS_KEY]: 'broken' });
    const p = createPersistence({ kv: failingKeys(inner, new Set([`${PROGRESS_KEY}.unreadable`])), storage: undefined });
    expect(p.saveProgress(emptyProgress())).toEqual({ ok: false });
    expect(inner.get(PROGRESS_KEY)).toBe('broken');
    expect(p.status().failedData).toEqual(['progress']);
  });

  it('never saves over data from a newer version of the game, and tells the parent which data it is', () => {
    const newer = JSON.stringify({ version: 2, attempts: [], skills: {}, sessions: [], extra: 1 });
    const kv = memoryKeyValue({ [PROGRESS_KEY]: newer, [GARAGE_KEY]: JSON.stringify({ version: 5, stars: 40 }) });
    const p = createPersistence({ kv, storage: undefined });
    expect(p.status().resetReason).toBe('newer');
    expect(p.status().newerData).toEqual(['progress', 'garage']);
    expect(p.saveProgress(emptyProgress())).toEqual({ ok: false });
    p.addStars(3);
    expect(kv.get(PROGRESS_KEY)).toBe(newer);
    expect(JSON.parse(kv.get(GARAGE_KEY)!)).toEqual({ version: 5, stars: 40 });
    // The other data still saves.
    expect(p.saveSettings(changedSettings())).toEqual({ ok: true });
  });

  it('names the data that was reset (review M3)', () => {
    const kv = memoryKeyValue({ [SETTINGS_KEY]: '{oops', [GARAGE_KEY]: '[]' });
    expect(createPersistence({ kv, storage: undefined }).status().resetData).toEqual(['settings', 'garage']);
    expect(createPersistence({ kv: memoryKeyValue(), storage: undefined }).status().resetData).toEqual([]);
  });
});

describe('import and transfer are all or nothing (review M4, P2)', () => {
  const garage = { version: 1 as const, stars: 21, look: { color: 'sky' as const, flag: 'rocket' as const, trail: 'plain' as const, hat: 'none' as const } };
  const records = { version: 1 as const, best: { k: { enemies: 2, ms: 1000, at: 1 } } };

  function seeded() {
    const inner = memoryKeyValue();
    const before = createPersistence({ kv: inner, storage: undefined });
    before.saveSettings(defaultSettings());
    before.addStars(4);
    // Progress and records were never stored, so their keys are missing.
    return { inner, snapshot: () => [SETTINGS_KEY, PROGRESS_KEY, RECORDS_KEY, GARAGE_KEY].map((k) => inner.get(k)) };
  }

  it('an import whose last write fails leaves every key and every value as before', () => {
    const { inner, snapshot } = seeded();
    const stored = snapshot();
    const p = createPersistence({ kv: failingKeys(inner, new Set([GARAGE_KEY])), storage: undefined });
    const r = p.importText(exportData(changedSettings(), emptyProgress(), records, garage));
    expect(r).toEqual({ ok: false, reason: 'notSaved' });
    expect(snapshot()).toEqual(stored);
    expect(inner.get(PROGRESS_KEY)).toBeNull();
    expect(p.settings()).toEqual(defaultSettings());
    expect(p.garage().stars).toBe(4);
    expect(p.status().saveFailed).toBe(true);
  });

  it('a transfer whose write fails leaves every key and every value as before', () => {
    const { inner, snapshot } = seeded();
    const stored = snapshot();
    const p = createPersistence({ kv: failingKeys(inner, new Set([RECORDS_KEY])), storage: undefined });
    expect(p.applyTransfer({ settings: changedSettings(), progress: emptyProgress(), records, garage })).toEqual({ ok: false });
    expect(snapshot()).toEqual(stored);
    expect(p.settings()).toEqual(defaultSettings());
    expect(p.records()).toEqual(emptyRecords());
    expect(p.garage().stars).toBe(4);
  });

  it('an import does not write over data from a newer version and changes nothing', () => {
    const newer = JSON.stringify({ version: 9, best: {} });
    const kv = memoryKeyValue({ [RECORDS_KEY]: newer });
    const p = createPersistence({ kv, storage: undefined });
    expect(p.importText(exportData(changedSettings(), emptyProgress(), records, garage))).toEqual({ ok: false, reason: 'notSaved' });
    expect(kv.get(RECORDS_KEY)).toBe(newer);
    expect(kv.get(SETTINGS_KEY)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../settings/defaults';
import type { Settings } from '../settings/schema';
import type { Progress } from '../types';
import { exportData, importData } from './exportImport';
import { emptyRecords, type Records } from '../records/records';
import { emptyProgress } from './storage';
import { emptyGarage, type Garage } from '../rewards/garage';

function sampleSettings(): Settings {
  return {
    ...defaultSettings(),
    range: { preset: 'custom', min: 550, max: 780 },
    addition: { maxOperand: 10, maxResult: 780, steps: 1 },
    enemyDifficulty: 'challenging',
    rulerLevelStart: 2,
    rulerLevelMax: 4,
    roundType: 'enemyCount',
    roundLength: 12,
    showClock: true,
  };
}

function sampleGarage(): Garage {
  return { version: 1, stars: 47, look: { color: 'sky', flag: 'rocket', trail: 'sparkles', hat: 'crown' } };
}

function sampleRecords(): Records {
  return { version: 1, best: { '550-780|2|enemyCount': { enemies: 12, ms: 400000, at: 1_700_000_000_000 } } };
}

function sampleProgress(): Progress {
  return {
    version: 1,
    attempts: [
      {
        challengeId: '12-0',
        seed: 12,
        kind: 'findNumber',
        skills: ['positions'],
        rangeKey: '0-20',
        difficultyStep: 1,
        solved: true,
        independent: true,
        exact: true,
        helpLevel: 0,
        wrongAnswers: 0,
        responseMs: 4200,
        guess: false,
        sessionId: 's1',
        at: 1_700_000_000_000,
      },
    ],
    skills: {
      'positions|0-20': {
        step: 1,
        recent: ['independent'],
        masteryWindow: ['independent'],
        guesses: 0,
        attempts: 1,
        independentCorrect: 1,
        assisted: 0,
      },
    },
    sessions: [{ id: 's1', startedAt: 1, lastActiveAt: 2, attempts: 1, independentCorrect: 1, assisted: 0 }],
  };
}

/** Exports sample data, then lets the caller change the parsed file before it is turned back into text. */
function exportedFile(change: (file: Record<string, unknown>) => void = () => {}): string {
  const file = JSON.parse(exportData(sampleSettings(), sampleProgress(), sampleRecords(), sampleGarage())) as Record<string, unknown>;
  change(file);
  return JSON.stringify(file);
}

describe('exportData (FR-048a)', () => {
  it('produces { app, exportedAt, settings, progress, records, garage } as JSON text', () => {
    const at = new Date('2026-11-05T10:00:00.000Z');
    const text = exportData(sampleSettings(), sampleProgress(), sampleRecords(), sampleGarage(), at);
    const file = JSON.parse(text) as Record<string, unknown>;
    expect(Object.keys(file).sort()).toEqual(['app', 'exportedAt', 'garage', 'progress', 'records', 'settings']);
    expect(file.records).toEqual(sampleRecords());
    expect(file.garage).toEqual(sampleGarage());
    expect(file.app).toBe('math-tanks');
    expect(file.exportedAt).toBe('2026-11-05T10:00:00.000Z');
    expect(file.settings).toEqual(sampleSettings());
    expect(file.progress).toEqual(sampleProgress());
  });

  it('uses the current time when no date is given', () => {
    const before = Date.now();
    const file = JSON.parse(exportData(defaultSettings(), emptyProgress(), emptyRecords(), emptyGarage())) as { exportedAt: string };
    const at = Date.parse(file.exportedAt);
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(Date.now());
  });
});

describe('importData (FR-048, FR-048a)', () => {
  it('returns the same settings, progress, records and garage (stars and look) that were exported (amendment 11)', () => {
    const r = importData(exportData(sampleSettings(), sampleProgress(), sampleRecords(), sampleGarage()));
    expect(r).toEqual({ ok: true, settings: sampleSettings(), progress: sampleProgress(), records: sampleRecords(), garage: sampleGarage() });
  });

  it('round-trips the defaults, empty progress and empty records', () => {
    const r = importData(exportData(defaultSettings(), emptyProgress(), emptyRecords(), emptyGarage()));
    expect(r).toEqual({ ok: true, settings: defaultSettings(), progress: emptyProgress(), records: emptyRecords(), garage: emptyGarage() });
  });

  it('a file without records (exported before amendment 06) imports with empty records', () => {
    const r = importData(exportedFile((f) => delete f.records));
    expect(r).toEqual({ ok: true, settings: sampleSettings(), progress: sampleProgress(), records: emptyRecords(), garage: sampleGarage() });
  });

  it('a file without garage (exported before amendment 11) gives garage null, so the caller keeps its own stars', () => {
    const r = importData(exportedFile((f) => delete f.garage));
    expect(r).toEqual({ ok: true, settings: sampleSettings(), progress: sampleProgress(), records: sampleRecords(), garage: null });
  });

  it('a garage without a version is migrated, and a locked look part becomes the standard item', () => {
    const r = importData(exportedFile((f) => (f.garage = { stars: 12, look: { color: 'navyStripes', flag: 'rocket', trail: 'plain', hat: 'none' } })));
    expect(r.ok && r.garage).toEqual({ version: 1, stars: 12, look: { color: 'blue', flag: 'rocket', trail: 'plain', hat: 'none' } });
  });

  it.each([
    ['negative stars', (f: Record<string, unknown>) => (f.garage = { ...sampleGarage(), stars: -1 })],
    ['an unknown garage version', (f: Record<string, unknown>) => (f.garage = { ...sampleGarage(), version: 9 })],
    ['a garage that is not an object', (f: Record<string, unknown>) => (f.garage = 'lots of stars')],
  ])('rejects an invalid garage: %s', (_name, change) => {
    expect(importData(exportedFile(change))).toEqual({ ok: false, reason: 'invalidGarage' });
  });

  it.each([
    ['records of the wrong shape', (f: Record<string, unknown>) => (f.records = { version: 1, best: { k: { enemies: 'nine' } } })],
    ['an unknown records version', (f: Record<string, unknown>) => (f.records = { version: 7, best: {} })],
  ])('rejects invalid records: %s', (_name, change) => {
    expect(importData(exportedFile(change))).toEqual({ ok: false, reason: 'invalidRecords' });
  });

  it.each([
    ['broken JSON', '{"app": "math-tanks", "settings": '],
    ['an empty file', ''],
    ['JSON that is not an object', '[1, 2, 3]'],
    ['JSON null', 'null'],
  ])('rejects %s', (_name, text) => {
    const r = importData(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/\S/);
  });

  it.each([
    ['a different app', (f: Record<string, unknown>) => (f.app = 'other-game')],
    ['no app field', (f: Record<string, unknown>) => delete f.app],
  ])('rejects a file with %s', (_name, change) => {
    const r = importData(exportedFile(change));
    expect(r).toEqual({ ok: false, reason: 'wrongApp' });
  });

  it.each([
    ['missing settings', (f: Record<string, unknown>) => delete f.settings],
    ['a field of the wrong type', (f: Record<string, unknown>) => ((f.settings as Record<string, unknown>).enemyDifficulty = 'impossible')],
    ['a custom range with min above max', (f: Record<string, unknown>) => ((f.settings as Record<string, unknown>).range = { preset: 'custom', min: 50, max: 20 })],
    ['a ruler start above the hardest level', (f: Record<string, unknown>) => Object.assign(f.settings as object, { rulerLevelStart: 5, rulerLevelMax: 2 })],
    ['an unknown settings version', (f: Record<string, unknown>) => ((f.settings as Record<string, unknown>).version = 99)],
  ])('rejects invalid settings: %s', (_name, change) => {
    expect(importData(exportedFile(change))).toEqual({ ok: false, reason: 'invalidSettings' });
  });

  it.each([
    ['missing progress', (f: Record<string, unknown>) => delete f.progress],
    ['attempts that are not a list', (f: Record<string, unknown>) => ((f.progress as Record<string, unknown>).attempts = 'nope')],
  ])('rejects invalid progress: %s', (_name, change) => {
    expect(importData(exportedFile(change))).toEqual({ ok: false, reason: 'invalidProgress' });
  });

  it('changes nothing: the exported objects are left as they were', () => {
    const settings = sampleSettings();
    const progress = sampleProgress();
    const text = exportData(settings, progress, sampleRecords(), sampleGarage());
    importData(text);
    importData('{broken');
    expect(settings).toEqual(sampleSettings());
    expect(progress).toEqual(sampleProgress());
  });

  it('migrates a version 1 settings file to version 6 (decision D13)', () => {
    const v1: Record<string, unknown> = { ...defaultSettings(), version: 1, labelLevel: 4, aimCorrection: true };
    delete v1.rulerLevelStart;
    delete v1.rulerLevelMax;
    delete v1.exactHit;
    const r = importData(JSON.stringify({ app: 'math-tanks', exportedAt: '2026-01-01T00:00:00.000Z', settings: v1, progress: emptyProgress() }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.settings.version).toBe(6);
    expect(r.settings.rulerLevelStart).toBe(5);
    expect(r.settings.rulerLevelMax).toBe(5);
    expect('exactHit' in r.settings).toBe(false);
    expect('aimCorrection' in r.settings).toBe(false);
    expect('labelLevel' in r.settings).toBe(false);
  });

  it('migrates version 2 and version 3 settings files to version 6 (amendments 04, 06 and 11)', () => {
    for (const version of [2, 3]) {
      const old: Record<string, unknown> = { ...defaultSettings(), version, roundLength: 7, exactHit: true };
      delete old.roundType;
      delete old.showClock;
      delete old.showRecords;
      delete old.garage;
      delete old.numberPad;
      if (version === 2) delete old.exactHit;
      const r = importData(JSON.stringify({ app: 'math-tanks', exportedAt: '2026-01-01T00:00:00.000Z', settings: old, progress: emptyProgress() }));
      expect(r).toEqual({ ok: true, settings: { ...defaultSettings(), roundLength: 7 }, progress: emptyProgress(), records: emptyRecords(), garage: null });
    }
  });

  it('migrates version 0 progress and fills attempts stored before amendment 04 with exact: true', () => {
    const attempt: Record<string, unknown> = { ...sampleProgress().attempts[0] };
    delete attempt.exact;
    const progress = { version: 1, attempts: [attempt], skills: {}, sessions: [] };
    const r = importData(JSON.stringify({ app: 'math-tanks', exportedAt: 'x', settings: defaultSettings(), progress }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.progress.attempts[0]?.exact).toBe(true);

    const v0 = importData(JSON.stringify({ app: 'math-tanks', exportedAt: 'x', settings: defaultSettings(), progress: { skills: {} } }));
    expect(v0).toEqual({ ok: true, settings: defaultSettings(), progress: emptyProgress(), records: emptyRecords(), garage: null });
  });
});

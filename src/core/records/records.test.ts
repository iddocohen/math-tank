import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../settings/defaults';
import { emptyRecords, formatTime, recordKey, recordsSchema, submitResult, type Records } from './records';

const settings = (min: number, max: number, level: 1 | 2 | 3 | 4 | 5, roundType: 'untilHearts' | 'enemyCount') => ({
  ...defaultSettings(),
  range: { preset: 'custom' as const, min, max },
  rulerLevelStart: level,
  roundType,
});

describe('recordKey (amendment 06, FR-086)', () => {
  it('names the range, the ruler starting level and the round type', () => {
    expect(recordKey(settings(550, 780, 2, 'untilHearts'))).toBe('550-780|2|untilHearts');
  });

  it('differs when any of the three differs', () => {
    const base = recordKey(settings(550, 780, 2, 'untilHearts'));
    expect(recordKey(settings(550, 781, 2, 'untilHearts'))).not.toBe(base);
    expect(recordKey(settings(551, 780, 2, 'untilHearts'))).not.toBe(base);
    expect(recordKey(settings(550, 780, 3, 'untilHearts'))).not.toBe(base);
    expect(recordKey(settings(550, 780, 2, 'enemyCount'))).not.toBe(base);
  });

  it('ignores the round length and the other settings', () => {
    const a = settings(0, 100, 1, 'enemyCount');
    const b = { ...a, roundLength: 3, enemyDifficulty: 'normal' as const };
    const c = { ...a, roundLength: 9 };
    expect(recordKey(b)).toBe(recordKey(c));
  });
});

describe('submitResult (amendment 06, FR-086)', () => {
  const key = '0-100|1|untilHearts';
  const result = (enemies: number, ms = 60_000, at = 1) => ({ enemies, ms, at });

  it('the first result with at least one enemy is a new record and is stored', () => {
    const r = submitResult(emptyRecords(), key, result(3, 90_000, 5));
    expect(r.newRecord).toBe(true);
    expect(r.best).toEqual(result(3, 90_000, 5));
    expect(r.records.best[key]).toEqual(result(3, 90_000, 5));
  });

  it('fewer or equally many enemies are not a new record and keep the stored best', () => {
    const first = submitResult(emptyRecords(), key, result(3, 90_000)).records;
    const fewer = submitResult(first, key, result(2, 10_000));
    expect(fewer.newRecord).toBe(false);
    expect(fewer.best).toEqual(result(3, 90_000));
    expect(fewer.records).toEqual(first);
    const same = submitResult(first, key, result(3, 10_000));
    expect(same.newRecord).toBe(false);
    expect(same.best).toEqual(result(3, 90_000));
  });

  it('more enemies are a new record', () => {
    const first = submitResult(emptyRecords(), key, result(3)).records;
    const more = submitResult(first, key, result(4, 200_000, 9));
    expect(more.newRecord).toBe(true);
    expect(more.best).toEqual(result(4, 200_000, 9));
  });

  it('0 enemies is never a new record and stores nothing', () => {
    const r = submitResult(emptyRecords(), key, result(0));
    expect(r.newRecord).toBe(false);
    expect(r.best).toBeNull();
    expect(r.records).toEqual(emptyRecords());
  });

  it('keeps the bests of other keys and does not change its input', () => {
    const input: Records = { version: 1, best: { other: result(7) } };
    const copy = structuredClone(input);
    const r = submitResult(input, key, result(2));
    expect(input).toEqual(copy);
    expect(r.records.best).toEqual({ other: result(7), [key]: result(2) });
  });

  it('the stored shape passes the records schema', () => {
    const r = submitResult(emptyRecords(), key, result(2));
    expect(recordsSchema.safeParse(r.records).success).toBe(true);
    expect(recordsSchema.safeParse({ version: 1, best: { k: { enemies: -1, ms: 0, at: 0 } } }).success).toBe(false);
  });
});

describe('formatTime (FR-084, FR-085)', () => {
  it('writes minutes and two-digit seconds', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(372_000)).toBe('6:12');
    expect(formatTime(59_999)).toBe('0:59');
    expect(formatTime(60_000)).toBe('1:00');
    expect(formatTime(3_665_000)).toBe('61:05');
  });
});

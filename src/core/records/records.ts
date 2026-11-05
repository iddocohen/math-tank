/**
 * Personal bests (amendment 06, FR-084 to FR-086, data-model.md "Records"). Pure functions; storage.ts persists them
 * under `mathtanks.records.v1`, and the export file carries them.
 *
 * One best per number range, ruler starting level, round type and play mode (amendment 17): the most enemies destroyed in one round, with
 * the time of that round. A result is a new record only when it destroys more enemies than the stored best, and a
 * round with no destroyed enemy never is.
 */
import { z } from 'zod';
import type { PlayMode, Settings } from '../settings/schema';

export const bestResultSchema = z.object({
  enemies: z.number().int().min(0),
  ms: z.number().min(0),
  at: z.number(),
});

export const recordsSchema = z.object({
  version: z.literal(1),
  best: z.record(z.string(), bestResultSchema),
});

/** Enemies destroyed, time played in milliseconds, and when the best was set (epoch milliseconds). */
export type BestResult = z.infer<typeof bestResultSchema>;
export type Records = z.infer<typeof recordsSchema>;

export function emptyRecords(): Records {
  return { version: 1, best: {} };
}

/**
 * `${min}-${max}|${rulerLevelStart}|${roundType}`, from the round's settings snapshot, plus `|ruler` or `|math` for
 * those play modes (amendment 17, FR-086). "Gemischt" keeps the key without a mode part, so the bests stored before
 * amendment 17 stay its bests.
 */
export function recordKey(s: Pick<Settings, 'range' | 'rulerLevelStart' | 'roundType'>, mode: PlayMode = 'mixed'): string {
  const key = `${s.range.min}-${s.range.max}|${s.rulerLevelStart}|${s.roundType}`;
  return mode === 'mixed' ? key : `${key}|${mode}`;
}

export interface SubmitOutcome {
  records: Records;
  /** The result beat the stored best (or there was none) with at least one enemy. */
  newRecord: boolean;
  /** The best for the key after this result, or null when there is none. */
  best: BestResult | null;
}

/** Compares a finished round with the stored best and returns new records; `records` itself is not changed. */
export function submitResult(records: Records, key: string, result: BestResult): SubmitOutcome {
  const stored = records.best[key] ?? null;
  const newRecord = result.enemies >= 1 && (stored === null || result.enemies > stored.enemies);
  if (!newRecord) return { records, newRecord, best: stored };
  const best = { ...result };
  return { records: { ...records, best: { ...records.best, [key]: best } }, newRecord, best };
}

/** Minutes and two-digit seconds, rounded down: 372000 gives "6:12", one hour and 5 seconds "61:05". */
export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

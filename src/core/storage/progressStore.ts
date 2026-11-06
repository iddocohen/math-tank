/**
 * The ProgressStore the BattleController records attempts through (FR-035, FR-037, FR-048, data-model.md Progress).
 * Each attempt starts or continues the session, goes through recordAttempt (counters, guess flag, adaptive step) and
 * is saved at once, between turns. The store reads the progress from its source before every attempt, so a reset or
 * an import on the parent pages is never overwritten by an older copy.
 */
import type { ProgressStore } from '../battle/ports';
import { recordAttempt } from '../progress/adaptive';
import { currentSession, startOrContinueSession } from '../progress/session';
import type { Progress } from '../types';
import { emptyProgress } from './storage';

/** Where the progress lives: the app passes its persistence, tests a variable. */
export interface ProgressSource {
  load(): Progress;
  save(p: Progress): void;
}

export function createProgressStore(source: ProgressSource): ProgressStore {
  // The first attempt after the game loaded always starts a new session.
  let gameLoad = true;
  return {
    getProgress: () => source.load(),
    record(attempt, settings) {
      const withSession = startOrContinueSession(source.load(), attempt.at, { gameLoad });
      gameLoad = false;
      const sessionId = currentSession(withSession)!.id;
      source.save(recordAttempt(withSession, { ...attempt, sessionId }, settings));
    },
  };
}

/** A ProgressStore that keeps the progress in memory only. */
export function memoryProgressStore(initial: Progress = emptyProgress()): ProgressStore {
  let progress = initial;
  return createProgressStore({
    load: () => progress,
    save: (p) => {
      progress = p;
    },
  });
}

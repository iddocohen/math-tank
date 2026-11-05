/** Ports the BattleController uses to reach storage and speech without knowing the browser. */
import type { Attempt, Progress } from '../types';
import { emptyProgress } from '../storage/storage';

export interface ProgressStore {
  record(attempt: Attempt): void;
  getProgress(): Progress;
}

export interface Speaker {
  readonly available: boolean;
  speak(text: string): void;
}

/** In-memory store for tests and for running without storage. */
export function memoryProgressStore(initial: Progress = emptyProgress()): ProgressStore {
  let progress = initial;
  return {
    record(attempt) {
      progress = { ...progress, attempts: [...progress.attempts, attempt] };
    },
    getProgress: () => progress,
  };
}

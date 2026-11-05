/** Ports the BattleController uses to reach storage and speech without knowing the browser. */
import type { Attempt, Progress, Settings } from '../types';

/** An attempt as the controller builds it; the progress store adds the session (FR-035). */
export type NewAttempt = Omit<Attempt, 'sessionId'>;

export interface ProgressStore {
  /**
   * Starts or continues the session at `attempt.at`, applies the attempt with the round's settings (counters, guess
   * flag, adaptive step) and saves. Called between turns, never during a shot animation (FR-035, FR-048).
   */
  record(attempt: NewAttempt, settings: Settings): void;
  getProgress(): Progress;
}

export interface Speaker {
  readonly available: boolean;
  speak(text: string): void;
}

/** In-memory store for tests and for running without storage. */
export { memoryProgressStore } from '../storage/progressStore';

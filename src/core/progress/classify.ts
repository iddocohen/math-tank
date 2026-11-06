/**
 * Classifies one finished guided search for the progress records (FR-038, FR-075). Since amendment 06 a near miss on
 * the tank body is a miss, so the outcome is 'independent', 'assisted' or 'unsolved', never 'close'.
 */
import type { RecentOutcome } from '../types';

/** A hit confirmed sooner than this after answers became possible is a guess (FR-038). */
export const GUESS_RESPONSE_MS = 1500;
/** A hit after this many misses ... */
export const GUESS_MISS_COUNT = 3;
/** ... within this many milliseconds before the hit is a guess (FR-038). */
export const GUESS_MISS_WINDOW_MS = 5000;

export interface ClassifyInput {
  /** A correct answer was given before the solution was shown. */
  solved: boolean;
  /** Highest help step reached; 3 means the solution was shown. */
  helpLevel: number;
  wrongAnswers: number;
  /** From challenge answerable to final answer. */
  responseMs: number;
  /** Clock times of the misses in this search. */
  wrongAnswerTimes: number[];
  /** Clock time of the final answer. */
  submittedAt: number;
}

export interface Classification {
  independent: boolean;
  guess: boolean;
  outcome: RecentOutcome;
}

/**
 * The FR-038 guess rule for one answer, right or wrong: confirmed less than 1.5 s after answers became possible, or
 * after 3 or more misses within the 5 seconds before it. Amendment 13 (FR-098) applies it to misses too.
 */
export function isFastGuess(a: Pick<ClassifyInput, 'responseMs' | 'wrongAnswerTimes' | 'submittedAt'>): boolean {
  const quickMisses = a.wrongAnswerTimes.filter((t) => t <= a.submittedAt && a.submittedAt - t <= GUESS_MISS_WINDOW_MS).length;
  return a.responseMs < GUESS_RESPONSE_MS || quickMisses >= GUESS_MISS_COUNT;
}

export function classifyAttempt(a: ClassifyInput): Classification {
  const independent = a.solved && a.helpLevel === 0 && a.wrongAnswers === 0;
  const guess = a.solved && isFastGuess(a);
  let outcome: RecentOutcome = 'assisted';
  if (!a.solved) outcome = 'unsolved';
  else if (independent) outcome = 'independent';
  return { independent, guess, outcome };
}

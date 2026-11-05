/**
 * The record of one finished guided search (FR-035, FR-075, decision D5). Built when the search ends with a hit,
 * including a shot at the shown solution. Until Phase 22 brings classifyAttempt, `independent` is the exact number on
 * the first shot without help, and `guess` is always false.
 */
import type { Attempt, Challenge, RoundState } from '../types';
import { SOLUTION_HELP_LEVEL } from './guided';

export interface AttemptInput {
  challenge: Challenge;
  help: RoundState['help'];
  /** Clock time when answers became possible. */
  answerableAt: number;
  /** Clock time of the shot that ended the search. */
  answeredAt: number;
  range: { min: number; max: number };
  sessionId: string;
  /** Epoch milliseconds of the record. */
  at: number;
}

export function rangeKeyOf(range: { min: number; max: number }): string {
  return `${range.min}-${range.max}`;
}

export function buildAttempt(input: AttemptInput): Attempt {
  const { challenge, help } = input;
  // A shot at the shown solution ends the search, but the child did not find the answer.
  const solved = help.level < SOLUTION_HELP_LEVEL;
  return {
    challengeId: challenge.id,
    seed: challenge.seed,
    kind: challenge.kind,
    skills: challenge.skills,
    rangeKey: rangeKeyOf(input.range),
    difficultyStep: challenge.difficultyStep,
    solved,
    independent: solved && help.level === 0 && help.wrongAnswers === 0,
    exact: true,
    helpLevel: help.level,
    wrongAnswers: help.wrongAnswers,
    responseMs: Math.max(0, input.answeredAt - input.answerableAt),
    guess: false,
    sessionId: input.sessionId,
    at: input.at,
  };
}

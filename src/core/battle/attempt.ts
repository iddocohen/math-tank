/**
 * The record of one finished guided search (FR-035, FR-038, FR-075). Built when the search ends with a hit, including
 * a shot at the shown solution. `independent` and `guess` come from classifyAttempt (replacing the interim rule of
 * decision D5). The progress store adds the session.
 */
import type { Challenge, RoundState } from '../types';
import { classifyAttempt } from '../progress/classify';
import type { NewAttempt } from './ports';
import { SOLUTION_HELP_LEVEL } from './guided';

export interface AttemptInput {
  challenge: Challenge;
  help: RoundState['help'];
  /** Clock time when answers became possible. */
  answerableAt: number;
  /** Clock time of the shot that ended the search. */
  answeredAt: number;
  range: { min: number; max: number };
  /** Epoch milliseconds of the record. */
  at: number;
}

export function rangeKeyOf(range: { min: number; max: number }): string {
  return `${range.min}-${range.max}`;
}

export function buildAttempt(input: AttemptInput): NewAttempt {
  const { challenge, help } = input;
  // A shot at the shown solution ends the search, but the child did not find the answer.
  const solved = help.level < SOLUTION_HELP_LEVEL;
  const responseMs = Math.max(0, input.answeredAt - input.answerableAt);
  const { independent, guess } = classifyAttempt({
    solved,
    exact: true,
    helpLevel: help.level,
    wrongAnswers: help.wrongAnswers,
    responseMs,
    wrongAnswerTimes: help.wrongAnswerTimes,
    submittedAt: input.answeredAt,
  });
  return {
    challengeId: challenge.id,
    seed: challenge.seed,
    kind: challenge.kind,
    skills: challenge.skills,
    rangeKey: rangeKeyOf(input.range),
    difficultyStep: challenge.difficultyStep,
    solved,
    independent,
    exact: true,
    helpLevel: help.level,
    wrongAnswers: help.wrongAnswers,
    responseMs,
    guess,
    at: input.at,
  };
}

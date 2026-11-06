/**
 * Subtraction builder, answer first (FR-023, FR-025, research R10): a − b = answer, or a − b − c = answer with
 * `subtraction.steps: 2`. The subtracted numbers are at most subtraction.maxOperand; no result is below 0 unless
 * negative results are on, and never below range.min.
 */
import type { DifficultyStep, Settings } from '../types';
import { arithmeticAnswers, arithmeticDraft, arithmeticRules, searchOperands } from './arithmetic';
import type { Builder } from './numberLine';

export const buildSubtraction: Builder = (answer, settings, step, rng) => {
  const operands = searchOperands(answer, arithmeticRules('subtraction', settings, step), settings, step, rng);
  return operands ? arithmeticDraft('subtraction', operands) : null;
};

/** Answers a subtraction can have inside the range and above the lowest allowed result. */
export function subtractionAnswers(settings: Settings, step: DifficultyStep): number[] {
  return arithmeticAnswers(arithmeticRules('subtraction', settings, step), settings);
}

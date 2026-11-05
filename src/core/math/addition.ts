/**
 * Addition builder, answer first (FR-022, FR-025, research R10): a + b = answer, or a + b + c = answer with
 * `addition.steps: 2`. Every operand is at most addition.maxOperand, every sum at most addition.maxResult.
 */
import type { DifficultyStep, Settings } from '../types';
import { arithmeticAnswers, arithmeticDraft, arithmeticRules, searchOperands } from './arithmetic';
import type { Builder } from './numberLine';

export const buildAddition: Builder = (answer, settings, step, rng) => {
  const operands = searchOperands(answer, arithmeticRules('addition', settings, step), settings, step, rng);
  return operands ? arithmeticDraft('addition', operands) : null;
};

/** Answers an addition can have under the operand and result limits. */
export function additionAnswers(settings: Settings, step: DifficultyStep): number[] {
  return arithmeticAnswers(arithmeticRules('addition', settings, step), settings);
}

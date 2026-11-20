/**
 * Addition builder, answer first (FR-022, FR-025, research R10): a + b = answer, or a + b + c = answer with
 * `addition.steps: 2`. Every added number is at most addition.maxOperand (T216: the start can be any number in the
 * range, for example 560 + 5 in 550 to 780), every sum at most addition.maxResult. With `addition.size: 'twoNumbers'`
 * (amendment 26) the exercise is a + b from the first and second ranges instead (twoNumbers.ts).
 */
import { isTwoNumbers } from '../settings/limits';
import type { DifficultyStep, Settings } from '../types';
import { arithmeticAnswers, arithmeticDraft, arithmeticRules, searchOperands, twoNumberCandidates, twoNumberDraft } from './arithmetic';
import type { Builder } from './numberLine';

export const buildAddition: Builder = (answer, settings, step, rng) => {
  if (isTwoNumbers('addition', settings)) return twoNumberDraft('addition', answer, settings, step, rng);
  const operands = searchOperands(answer, arithmeticRules('addition', settings, step), settings, step, rng);
  return operands ? arithmeticDraft('addition', operands) : null;
};

/** Answers an addition can have under the operand and result limits. */
export function additionAnswers(settings: Settings, step: DifficultyStep): number[] {
  if (isTwoNumbers('addition', settings)) return twoNumberCandidates('addition', settings, step);
  return arithmeticAnswers(arithmeticRules('addition', settings, step), settings);
}

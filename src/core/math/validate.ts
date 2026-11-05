/** Challenge validation and answer checking (FR-029, data-model.md "Validation"). */
import type { Challenge, Settings } from '../types';
import { minEnemyGap } from './gaps';
import { movementAllowed, rangeMajorStep } from './numberLine';
import { readPositionAnswers } from './readPosition';

/** Returns one message per broken rule; empty when the challenge is valid. */
export function validateChallenge(c: Challenge, settings: Settings, playerPosition: number): string[] {
  const errors: string[] = [];
  const { min, max } = settings.range;
  const check = (label: string, n: number | undefined) => {
    if (n === undefined || !Number.isInteger(n)) errors.push(`${label} ${String(n)} is not a whole number`);
    else if (n < min || n > max) errors.push(`${label} ${n} is outside ${min} to ${max}`);
  };

  check('answer', c.answer);
  c.operands.forEach((n, i) => check(`operand ${i}`, n));
  c.steps?.forEach((n, i) => check(`step ${i}`, n));
  c.options?.forEach((n, i) => check(`option ${i}`, n));
  c.orderAnswer?.forEach((n, i) => check(`order ${i}`, n));

  const gap = minEnemyGap(min, max);
  if (Math.abs(c.answer - playerPosition) < gap) {
    errors.push(`answer ${c.answer} is closer than ${gap} to the player at ${playerPosition}`);
  }

  if (c.options) {
    if (new Set(c.options).size !== c.options.length) errors.push('options are not distinct');
    if (!c.options.includes(c.answer)) errors.push('options do not include the answer');
  }

  const p = c.prompt.params;
  const expect = (ok: boolean, message: string) => {
    if (!ok) errors.push(message);
  };
  switch (c.kind) {
    case 'findNumber':
      expect(p.n === c.answer, 'findNumber: prompt number differs from the answer');
      break;
    case 'after':
      expect(p.n !== undefined && c.answer === p.n + 1, 'after: answer is not the next number');
      break;
    case 'before':
      expect(p.n !== undefined && c.answer === p.n - 1, 'before: answer is not the previous number');
      break;
    case 'stepsRight':
    case 'stepsLeft': {
      const direction = c.kind === 'stepsRight' ? 1 : -1;
      const { n, k } = p;
      if (n === undefined || k === undefined || !Number.isInteger(k) || k < 1) {
        errors.push(`${c.kind}: missing start or step count`);
        break;
      }
      expect(c.answer === n + direction * k, `${c.kind}: answer does not follow from start and steps`);
      expect(movementAllowed(n, c.answer, settings), `${c.kind}: crosses a ten or hundred that the settings forbid`);
      break;
    }
    case 'missingBetween':
      expect(p.a === c.answer - 1 && p.b === c.answer + 1, 'missingBetween: answer is not the number between');
      break;
    case 'midpoint': {
      const major = rangeMajorStep(settings);
      const { a, b } = p;
      expect(
        a !== undefined && b !== undefined && b - a === major && a % major === 0 && c.answer * 2 === a + b,
        'midpoint: not the middle of two neighboring major ticks',
      );
      break;
    }
    case 'readPosition': {
      const level = c.rulerLevel;
      if (level === undefined) {
        errors.push('readPosition: missing ruler level');
        break;
      }
      expect(readPositionAnswers(settings, level).includes(c.answer), 'readPosition: answer not allowed at this ruler level');
      break;
    }
    default:
      // Arithmetic and comparison rules are added with those challenge kinds.
      break;
  }

  return errors;
}

/**
 * Accepts only the exact answer, for every kind; for 'order3' only the exact tap sequence.
 * Whether a shot damages the enemy is decided by core/battle/hitRule.ts (amendment 04).
 */
export function checkAnswer(c: Challenge, answer: number | number[]): boolean {
  if (c.orderAnswer) {
    return Array.isArray(answer) && answer.length === c.orderAnswer.length && answer.every((n, i) => n === c.orderAnswer![i]);
  }
  if (typeof answer !== 'number') return false;
  return answer === c.answer;
}

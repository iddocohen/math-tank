/** Challenge validation (FR-029, data-model.md "Validation"). */
import type { Challenge, Settings } from '../types';
import { arithmeticErrors } from './arithmetic';
import { comparisonErrors } from './comparison';
import { minEnemyGap } from './gaps';
import { isRangeEnd, MIN_STEP_COUNT, movementAllowed, rangeMajorStep } from './numberLine';
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
  // The added or subtracted numbers of an addition or subtraction may lie outside the range (560 + 5 in 550 to
  // 780); arithmeticErrors checks them against the maximum operand. Every other operand is a shown position.
  const arithmetic = c.kind === 'addition' || c.kind === 'subtraction';
  (arithmetic ? c.operands.slice(0, 1) : c.operands).forEach((n, i) => check(`operand ${i}`, n));
  c.steps?.forEach((n, i) => check(`step ${i}`, n));
  c.options?.forEach((n, i) => check(`option ${i}`, n));

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
      expect(!isRangeEnd(c.answer, settings), 'after: answer is a range end');
      break;
    case 'before':
      expect(p.n !== undefined && c.answer === p.n - 1, 'before: answer is not the previous number');
      expect(!isRangeEnd(c.answer, settings), 'before: answer is a range end');
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
      // PO3: at least 2 steps, never as many steps as the start number, and no answer at a range end.
      expect(k >= MIN_STEP_COUNT, `${c.kind}: fewer than ${MIN_STEP_COUNT} steps`);
      expect(k !== n, `${c.kind}: the step count equals the start`);
      expect(!isRangeEnd(c.answer, settings), `${c.kind}: answer is a range end`);
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
    case 'addition':
    case 'subtraction':
      errors.push(...arithmeticErrors({ ...c, kind: c.kind }, settings));
      break;
    default:
      // Comparison: option count, minOptionGap and exactly one correct option (FR-027, amendment 09).
      errors.push(...comparisonErrors(c, settings, playerPosition));
      break;
  }

  return errors;
}

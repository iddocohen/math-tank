/** The marker path of the step animation for addition and subtraction (FR-024, US3 scenarios 1 and 2, FR-154). */
import type { Challenge } from '../types';
import { placeValuePath, tensBetween, twoNumberOperands } from './placeValue';

/**
 * The positions the marker stops at: start, intermediate result of a two-step exercise, result. With beginner
 * assistance it also stops at every ten it crosses: 43 − 7 is [43, 40, 36], without assistance [43, 36].
 * A "Zwei Zahlen" challenge (`twoNumbers`, amendment 26) jumps by place value instead (placeValuePath).
 */
export function stepPath(c: Pick<Challenge, 'kind' | 'operands' | 'answer' | 'steps' | 'twoNumbers'>, beginnerAssist: boolean): number[] {
  const two = twoNumberOperands(c);
  if (two) return placeValuePath(two.kind, two.a, two.b, beginnerAssist);
  const points = c.steps && c.steps.length >= 2 ? c.steps : [c.operands[0] ?? c.answer, c.answer];
  if (!beginnerAssist) return [...points];
  const out: number[] = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    out.push(...tensBetween(points[i - 1]!, points[i]!));
    out.push(points[i]!);
  }
  return out;
}

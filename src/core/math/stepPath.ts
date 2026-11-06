/** The marker path of the step animation for addition and subtraction (FR-024, US3 scenarios 1 and 2). */
import type { Challenge } from '../types';

/**
 * The positions the marker stops at: start, intermediate result of a two-step exercise, result. With beginner
 * assistance it also stops at every ten it crosses: 43 − 7 is [43, 40, 36], without assistance [43, 36].
 */
export function stepPath(c: Pick<Challenge, 'kind' | 'operands' | 'answer' | 'steps'>, beginnerAssist: boolean): number[] {
  const points = c.steps && c.steps.length >= 2 ? c.steps : [c.operands[0] ?? c.answer, c.answer];
  if (!beginnerAssist) return [...points];
  const out: number[] = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1]!;
    const to = points[i]!;
    if (to > from) {
      for (let t = Math.floor(from / 10) * 10 + 10; t < to; t += 10) out.push(t + 0);
    } else if (to < from) {
      for (let t = Math.ceil(from / 10) * 10 - 10; t > to; t -= 10) out.push(t + 0);
    }
    out.push(to);
  }
  return out;
}

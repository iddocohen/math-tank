/** Skills per challenge (data-model.md "Main skill per kind", FR-036). */
import type { Challenge, ChallengeKind, Skill } from '../types';

const MAIN_SKILL: Record<ChallengeKind, Skill> = {
  findNumber: 'positions',
  missingBetween: 'positions',
  midpoint: 'positions',
  readPosition: 'positions',
  after: 'countForward',
  stepsRight: 'countForward',
  before: 'countBackward',
  stepsLeft: 'countBackward',
  addition: 'addition',
  subtraction: 'subtraction',
  greater: 'comparison',
  smaller: 'comparison',
  equal: 'comparison',
  order3: 'comparison',
  largest3: 'comparison',
  smallest3: 'comparison',
  closestTo: 'comparison',
  between: 'comparison',
};

export function mainSkillOf(kind: ChallengeKind): Skill {
  return MAIN_SKILL[kind];
}

/**
 * True when a multiple of `step` lies strictly between `a` and `b`.
 * 38 → 43 crosses 40; 37 → 40 and 40 → 43 do not.
 */
export function crossesMultiple(a: number, b: number, step: number): boolean {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const firstAbove = Math.floor(lo / step) * step + step;
  return firstAbove < hi;
}

/** Kinds that move from a start number to the answer one step at a time. */
const MOVING_KINDS: ReadonlySet<ChallengeKind> = new Set(['stepsRight', 'stepsLeft', 'addition', 'subtraction']);

/** The positions a moving challenge passes through: start, intermediate steps, answer. */
function path(c: Pick<Challenge, 'kind' | 'operands' | 'answer' | 'steps'>): number[] {
  if (!MOVING_KINDS.has(c.kind)) return [];
  if (c.steps && c.steps.length >= 2) return c.steps;
  const start = c.operands[0];
  return start === undefined ? [] : [start, c.answer];
}

/** Further skills a challenge counts toward: `tens` for multiples of ten, `crossTens` for a crossed ten boundary. */
export function secondarySkills(c: Pick<Challenge, 'kind' | 'operands' | 'answer' | 'steps'>): Skill[] {
  const out: Skill[] = [];
  const numbers = MOVING_KINDS.has(c.kind) ? [c.operands[0] ?? c.answer, c.answer] : [...c.operands, c.answer];
  if (numbers.some((n) => n !== 0 && n % 10 === 0)) out.push('tens');
  const p = path(c);
  for (let i = 1; i < p.length; i++) {
    if (crossesMultiple(p[i - 1]!, p[i]!, 10)) {
      out.push('crossTens');
      break;
    }
  }
  return out;
}

/** Main skill first, then the further skills (without duplicates). */
export function skillsOf(c: Pick<Challenge, 'kind' | 'operands' | 'answer' | 'steps'>): Skill[] {
  const main = mainSkillOf(c.kind);
  return [main, ...secondarySkills(c).filter((s) => s !== main)];
}

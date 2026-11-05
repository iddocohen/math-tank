/**
 * Mastery of a skill in a range (FR-039). Assisted answers and a stored 'close' never count toward mastery, and the
 * mastery window is kept across step changes.
 */
import type { SkillProgress } from '../types';

export const MASTERY_MIN_INDEPENDENT = 10;
export const MASTERY_WINDOW = 10;
export const MASTERY_NEEDED_IN_WINDOW = 8;

export function skillStatus(sp: SkillProgress): 'mastered' | 'developing' {
  const window = sp.masteryWindow.slice(-MASTERY_WINDOW);
  const independent = window.filter((o) => o === 'independent').length;
  return sp.independentCorrect >= MASTERY_MIN_INDEPENDENT &&
    window.length === MASTERY_WINDOW &&
    independent >= MASTERY_NEEDED_IN_WINDOW
    ? 'mastered'
    : 'developing';
}

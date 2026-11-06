import { describe, expect, it } from 'vitest';
import { skillStatus } from './mastery';
import { recordAttempt } from './adaptive';
import { skillKey } from './ladders';
import { defaultSettings } from '../settings/defaults';
import { emptyProgress } from '../storage/storage';
import type { Attempt, RecentOutcome, SkillProgress } from '../types';

function skill(extra: Partial<SkillProgress>): SkillProgress {
  return { step: 0, recent: [], masteryWindow: [], guesses: 0, attempts: 0, independentCorrect: 0, assisted: 0, ...extra };
}

const I: RecentOutcome = 'independent';
const A: RecentOutcome = 'assisted';
const U: RecentOutcome = 'unsolved';

describe('skillStatus (FR-039, FR-075, US7 scenario 4)', () => {
  it('is mastered with 10 independent correct, a full window of 10 and at least 8 independent', () => {
    expect(skillStatus(skill({ independentCorrect: 10, masteryWindow: [A, U, I, I, I, I, I, I, I, I] }))).toBe('mastered');
    expect(skillStatus(skill({ independentCorrect: 25, masteryWindow: Array<RecentOutcome>(10).fill(I) }))).toBe('mastered');
  });

  it('is developing with fewer than 10 independent correct answers', () => {
    expect(skillStatus(skill({ independentCorrect: 9, masteryWindow: Array<RecentOutcome>(10).fill(I) }))).toBe('developing');
  });

  it('is developing when the window is not full', () => {
    expect(skillStatus(skill({ independentCorrect: 12, masteryWindow: Array<RecentOutcome>(9).fill(I) }))).toBe('developing');
  });

  it('is developing with only 7 independent in the window', () => {
    expect(skillStatus(skill({ independentCorrect: 12, masteryWindow: [A, A, U, I, I, I, I, I, I, I] }))).toBe('developing');
  });

  it("never counts a stored 'close' toward mastery", () => {
    expect(skillStatus(skill({ independentCorrect: 12, masteryWindow: ['close', 'close', 'close', I, I, I, I, I, I, I] }))).toBe(
      'developing',
    );
    expect(skillStatus(skill({ independentCorrect: 12, masteryWindow: ['close', 'close', I, I, I, I, I, I, I, I] }))).toBe(
      'mastered',
    );
  });

  it('keeps the mastery window across a step change', () => {
    const settings = defaultSettings();
    let p = emptyProgress();
    for (let i = 0; i < 12; i++) {
      const a: Attempt = {
        challengeId: `c${i}`,
        seed: i,
        kind: 'findNumber',
        skills: ['positions'],
        rangeKey: '0-100',
        difficultyStep: 0,
        solved: true,
        independent: true,
        helpLevel: 0,
        wrongAnswers: 0,
        responseMs: 4000,
        guess: false,
        sessionId: 's',
        at: i,
      };
      p = recordAttempt(p, a, settings);
    }
    const sp = p.skills[skillKey('positions', '0-100')];
    expect(sp?.step).toBeGreaterThan(0);
    expect(sp?.masteryWindow).toHaveLength(10);
    expect(skillStatus(sp as SkillProgress)).toBe('mastered');
  });

  it('never masters a skill whose correct answers all needed help', () => {
    expect(skillStatus(skill({ attempts: 40, assisted: 40, independentCorrect: 0, masteryWindow: Array<RecentOutcome>(10).fill(A) }))).toBe(
      'developing',
    );
  });
});

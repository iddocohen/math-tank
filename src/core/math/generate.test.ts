import { describe, expect, it } from 'vitest';
import { skillStepsFor } from '../progress/ladders';
import { defaultSettings } from '../settings/defaults';
import { emptyProgress } from '../storage/storage';
import type { Settings } from '../types';
import { minEnemyGap } from './gaps';
import { generateChallenge, playModeKinds } from './generate';
import { skillsOf } from './skills';
import { borrows, carries } from './twoNumbers';

type Kind = 'addition' | 'subtraction';

/** Only `kind` on, in "Zwei Zahlen" with the given fields, range 0 to 100. */
function onlyTwoNumbers(kind: Kind, own: Partial<Settings['addition']> = {}, adaptive = false): Settings {
  const s = defaultSettings();
  s.adaptive = adaptive;
  s.challengeTypes = { numberLine: false, addition: kind === 'addition', subtraction: kind === 'subtraction', comparison: false };
  if (kind === 'addition') s.addition = { ...s.addition, size: 'twoNumbers', ...own };
  else s.subtraction = { ...s.subtraction, size: 'twoNumbers', ...own };
  return s;
}

function generateInput(settings: Settings, roundSeed: number, playerPosition: number) {
  return {
    settings,
    skillSteps: skillStepsFor(emptyProgress(), `${settings.range.min}-${settings.range.max}`, settings),
    roundSeed,
    turn: 0,
    playerPosition,
    rulerLevel: 1 as const,
  };
}

function generate(settings: Settings, roundSeed: number, playerPosition: number) {
  return generateChallenge(generateInput(settings, roundSeed, playerPosition));
}

describe('generateChallenge with "Zwei Zahlen" (amendment 26, FR-025, FR-149, FR-150)', () => {
  for (const kind of ['addition', 'subtraction'] as const) {
    it(`${kind}: two numbers, steps [a, answer], twoNumbers set, the prompt a ${kind === 'addition' ? '+' : '−'} b`, () => {
      const settings = onlyTwoNumbers(kind);
      for (let seed = 1; seed <= 200; seed++) {
        const player = seed % 2 === 0 ? 0 : 100;
        const c = generate(settings, seed, player);
        expect(c.kind).toBe(kind);
        expect(c.twoNumbers).toBe(true);
        expect(c.operands).toHaveLength(2);
        const [a, b] = c.operands as [number, number];
        expect(a >= 10 && a <= 99 && b >= 10 && b <= 99).toBe(true);
        expect(c.answer).toBe(kind === 'addition' ? a + b : a - b);
        expect(c.steps).toEqual([a, c.answer]);
        expect(c.prompt).toEqual({ key: kind, params: { a, b } });
        expect(kind === 'addition' ? carries(a, b) : borrows(a, b)).toBe(false);
        if (kind === 'subtraction') expect(a).toBeGreaterThan(b);
      }
    });
  }

  it('only plus on with a narrow answer set and the player near it still gives a plus challenge', () => {
    // 10 to 12 plus 1 to 3 gives the answers 11 to 15; the player at 0 keeps 15 away, so only 12 + 3 is left.
    const settings = onlyTwoNumbers('addition', { first: { min: 10, max: 12 }, second: { min: 1, max: 3 } });
    for (let seed = 1; seed <= 50; seed++) {
      const c = generate(settings, seed, 0);
      expect(c.kind).toBe('addition');
      expect(c.operands).toEqual([12, 3]);
    }
  });

  it('a step that prefers small answers does not hide the two-number answers', () => {
    // Adaptive on and a new player: the addition ladder's first step (half the range from the smallest allowed
    // answer). The answers 61 to 75 lie above that half, and the challenge is still a plus exercise.
    const settings = onlyTwoNumbers('addition', { first: { min: 60, max: 70 }, second: { min: 1, max: 5 } }, true);
    for (let seed = 1; seed <= 50; seed++) {
      const c = generate(settings, seed, 100);
      expect(c.kind).toBe('addition');
      expect(c.twoNumbers).toBe(true);
    }
  });

  it('when the enemy gap leaves no answer at the playable step, a harder step gives the plus challenge (review)', () => {
    // Adaptive on and a new player: step 0 (no carrying, 1 + 1 to 9 + 5) has the answers 2 to 9, steps 1 and 2 reach
    // at most 14, and the player at 0 needs at least 15 (the enemy gap). Only step 3 (9 + 6 to 9 + 9) has answers.
    // The review's own example (first 10 to 20, second 1 to 9, no carrying, player at 15) has no answer at any step:
    // the largest sum without carrying is 29, and the gap needs 30.
    const settings = onlyTwoNumbers('addition', { first: { min: 1, max: 9 }, second: { min: 1, max: 9 }, carry: true }, true);
    const gap = minEnemyGap(0, 100);
    for (let seed = 1; seed <= 50; seed++) {
      const c = generate(settings, seed, 0);
      expect(c.kind).toBe('addition');
      expect(c.twoNumbers).toBe(true);
      expect(c.answer).toBeGreaterThanOrEqual(gap);
      // The stored step stays the child's: the challenge records step 0.
      expect(c.difficultyStep).toBe(0);
    }
    // The same in "Nur Rechnen", which uses this generator with its own kinds and fallbacks.
    for (let seed = 1; seed <= 50; seed++) {
      const c = generateChallenge({ ...generateInput(settings, seed, 0), ...playModeKinds('numbers', settings) });
      expect(c.kind).toBe('addition');
    }
  });

  it('"Kleine Schritte" challenges carry no twoNumbers flag', () => {
    const settings = onlyTwoNumbers('addition', { size: 'steps' });
    const c = generate(settings, 7, 0);
    expect(c.kind).toBe('addition');
    expect(c.twoNumbers).toBeUndefined();
  });
});

describe('skillsOf for "Zwei Zahlen" (amendment 26)', () => {
  const two = (kind: Kind, a: number, b: number) => {
    const answer = kind === 'addition' ? a + b : a - b;
    return { kind, operands: [a, b], answer, steps: [a, answer], twoNumbers: true as const };
  };

  it('counts toward crossing tens only when the ones column carries or borrows', () => {
    expect(skillsOf(two('addition', 35, 12))).toEqual(['addition']);
    expect(skillsOf(two('addition', 34, 19))).toEqual(['addition', 'crossTens']);
    expect(skillsOf(two('subtraction', 46, 12))).toEqual(['subtraction']);
    expect(skillsOf(two('subtraction', 42, 17))).toEqual(['subtraction', 'crossTens']);
    expect(skillsOf(two('addition', 35, 15))).toEqual(['addition', 'tens', 'crossTens']);
  });
});

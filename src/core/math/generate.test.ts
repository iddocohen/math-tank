import { describe, expect, it } from 'vitest';
import { skillStepsFor } from '../progress/ladders';
import { defaultSettings } from '../settings/defaults';
import { withRange } from '../settings/validate';
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
    // The same in "Plus und Minus", which uses this generator with its own kinds and stages (amendment 27).
    for (let seed = 1; seed <= 50; seed++) {
      const c = generateChallenge({ ...generateInput(settings, seed, 0), ...playModeKinds('arithmetic', settings) });
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

describe('generateChallenge in "Plus und Minus" and "Zahlen-Rätsel" (amendment 27, FR-159, FR-160, FR-163)', () => {
  const ARITHMETIC = new Set(['addition', 'subtraction']);

  function withTypes(types: Partial<Settings['challengeTypes']>, patch: Partial<Settings> = {}): Settings {
    const s = defaultSettings();
    return { ...s, ...patch, challengeTypes: { numberLine: false, addition: false, subtraction: false, comparison: false, ...types } };
  }

  const arithmeticCases: Array<[string, Settings]> = [
    ['every type on', { ...defaultSettings(), adaptive: true }],
    ['only "Plus"', withTypes({ addition: true }, { adaptive: true })],
    ['only "Minus"', withTypes({ subtraction: true }, { adaptive: true })],
    ['"Zwei Zahlen"', { ...onlyTwoNumbers('addition', {}, true), challengeTypes: { numberLine: true, addition: true, subtraction: true, comparison: true }, subtraction: { ...defaultSettings().subtraction, size: 'twoNumbers' } }],
  ];

  for (const [label, settings] of arithmeticCases) {
    it(`"Plus und Minus", ${label}: over 500 seeds and both player positions every challenge is addition or subtraction`, () => {
      const problems: string[] = [];
      for (let seed = 1; seed <= 500; seed++) {
        for (const player of [0, 100]) {
          const c = generateChallenge({ ...generateInput(settings, seed, player), ...playModeKinds('arithmetic', settings) });
          if (!ARITHMETIC.has(c.kind)) problems.push(`seed ${seed} player ${player}: ${c.kind}`);
          if (label === 'only "Plus"' && c.kind !== 'addition') problems.push(`seed ${seed} player ${player}: ${c.kind}`);
          if (label === 'only "Minus"' && c.kind !== 'subtraction') problems.push(`seed ${seed} player ${player}: ${c.kind}`);
          if (label === '"Zwei Zahlen"' && !c.twoNumbers) problems.push(`seed ${seed} player ${player}: no "Zwei Zahlen"`);
        }
      }
      expect(problems).toEqual([]);
    });
  }

  it('"Plus und Minus": when the step has no answer far enough from the tank, stage 2 uses the same step over the whole battlefield', () => {
    // Battlefield -60 to 40, only "Minus", no negative results, player at 40. Step 0 of the minus ladder keeps the
    // answers from -60 to -10, where no subtraction result is allowed (0 and above). Stage 2 drops that part of the
    // range and keeps the step's largest operand 5.
    const base = withRange(defaultSettings(), { preset: 'custom', min: -60, max: 40 });
    const settings: Settings = { ...base, adaptive: true, negativeResults: false, challengeTypes: { numberLine: false, addition: false, subtraction: true, comparison: false } };
    for (let seed = 1; seed <= 100; seed++) {
      const c = generateChallenge({ ...generateInput(settings, seed, 40), ...playModeKinds('arithmetic', settings) });
      expect(c.kind).toBe('subtraction');
      expect(c.answer).toBeGreaterThanOrEqual(0);
      expect(Math.max(...c.operands.slice(1))).toBeLessThanOrEqual(5);
      expect(c.difficultyStep).toBe(0);
    }
  });

  it('"Plus und Minus": when stages 1 and 2 find nothing, stage 3 uses the parent settings and records the current step', () => {
    // No allowed kind is left for stages 1 and 2, so only stage 3 (arithmeticExerciseAt) can give the challenge.
    const settings = { ...defaultSettings(), adaptive: true };
    const answers = new Set<string>();
    for (let seed = 1; seed <= 100; seed++) {
      for (const player of [0, 100]) {
        const input = { ...generateInput(settings, seed, player), ...playModeKinds('arithmetic', settings), kindsAllowed: [] };
        input.skillSteps = { ...input.skillSteps, addition: 1, subtraction: 2 };
        const c = generateChallenge(input);
        expect(ARITHMETIC.has(c.kind)).toBe(true);
        expect(c.difficultyStep).toBe(c.kind === 'addition' ? 1 : 2);
        expect(Math.abs(c.answer - player)).toBeGreaterThanOrEqual(minEnemyGap(0, 100));
        answers.add(`${c.kind} ${c.operands.join(',')}`);
      }
    }
    expect(answers.size).toBeGreaterThan(1);
  });

  it('"Plus und Minus": no exercise at all throws instead of asking another kind', () => {
    const settings = withTypes({ addition: true }, { addition: { ...defaultSettings().addition, maxResult: 5 } });
    expect(() => generateChallenge({ ...generateInput(settings, 1, 0), ...playModeKinds('arithmetic', settings) })).toThrow();
  });

  it('"Zahlen-Rätsel": over 500 seeds and both player positions no challenge is addition, subtraction, readPosition or findNumber', () => {
    const settings = { ...defaultSettings(), adaptive: true };
    const banned = new Set(['addition', 'subtraction', 'readPosition', 'findNumber']);
    const problems: string[] = [];
    for (let seed = 1; seed <= 500; seed++) {
      for (const player of [0, 100]) {
        for (const inputMethod of ['pointer', 'keyboard'] as const) {
          const c = generateChallenge({ ...generateInput(settings, seed, player), inputMethod, ...playModeKinds('numbers', settings) });
          if (banned.has(c.kind)) problems.push(`seed ${seed} player ${player} ${inputMethod}: ${c.kind}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('"Zahlen-Rätsel" with only "Vergleichen" falls back to "after" or "before" when no comparison fits', () => {
    const settings: Settings = { ...defaultSettings(), challengeTypes: { numberLine: false, addition: false, subtraction: false, comparison: true } };
    const byMode = playModeKinds('numbers', settings);
    expect(byMode.fallbackKinds).toEqual(['after', 'before']);
    expect(byMode.onlyArithmetic).toBeUndefined();
    // No comparison fits: the mode's fallbacks give the challenge, never addition, subtraction or a ruler kind.
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      for (const player of [0, 100]) {
        kinds.add(generateChallenge({ ...generateInput(settings, seed, player), ...byMode, kindsAllowed: [] }).kind);
      }
    }
    for (const kind of kinds) expect(['after', 'before']).toContain(kind);
  });
});

import { describe, expect, it } from 'vitest';
import { LAST_STEPS } from '../progress/ladders';
import { createRng } from '../rng';
import { defaultSettings } from '../settings/defaults';
import type { ChallengeKind, DifficultyStep, Settings } from '../types';
import { generateChallenge, type GenerateInput } from './generate';
import { NUMBER_LINE_KINDS, numberLineBuilders } from './numberLine';

const FULL_STEP: DifficultyStep = { maxNumberFraction: 1, allowCrossTens: true };
/** The top ladder step per skill: the generator follows the parent settings unchanged. */
const PARENT_STEPS = LAST_STEPS;

function settingsFor(min: number, max: number, patch: Partial<Settings> = {}): Settings {
  const s = defaultSettings();
  const preset = `${min}-${max}`;
  const known = ['0-10', '0-20', '0-50', '0-100', '0-1000'];
  return {
    ...s,
    range: { preset: (known.includes(preset) ? preset : 'custom') as Settings['range']['preset'], min, max },
    addition: { ...s.addition, maxResult: max },
    ...patch,
  };
}

function input(settings: Settings, kind: ChallengeKind, roundSeed: number, playerPosition = settings.range.min): GenerateInput {
  return {
    settings,
    skillSteps: PARENT_STEPS,
    roundSeed,
    turn: 1,
    playerPosition,
    rulerLevel: 1,
    kindsAllowed: [kind],
  };
}

describe('number-line builders (FR-021)', () => {
  const s = settingsFor(0, 100);
  const rng = () => createRng(42);

  it('lists the seven number-line kinds', () => {
    expect([...NUMBER_LINE_KINDS].sort()).toEqual(
      ['after', 'before', 'findNumber', 'midpoint', 'missingBetween', 'stepsLeft', 'stepsRight'].sort(),
    );
  });

  it('findNumber 37 asks for 37', () => {
    expect(numberLineBuilders.findNumber(37, s, FULL_STEP, rng())).toMatchObject({
      kind: 'findNumber',
      prompt: { key: 'findNumber', params: { n: 37 } },
      operands: [37],
      answer: 37,
    });
  });

  it('after with 49 gives answer 50', () => {
    expect(numberLineBuilders.after(50, s, FULL_STEP, rng())).toMatchObject({
      kind: 'after',
      prompt: { key: 'after', params: { n: 49 } },
      operands: [49],
      answer: 50,
    });
  });

  it('before with 61 gives answer 60', () => {
    expect(numberLineBuilders.before(60, s, FULL_STEP, rng())).toMatchObject({
      kind: 'before',
      prompt: { key: 'before', params: { n: 61 } },
      operands: [61],
      answer: 60,
    });
  });

  it('stepsRight starts k steps left of the answer', () => {
    const c = numberLineBuilders.stepsRight(46, s, FULL_STEP, rng());
    expect(c).not.toBeNull();
    const { n, k } = c!.prompt.params as { n: number; k: number };
    expect(c!.prompt.key).toBe('stepsRight');
    expect(n + k).toBe(46);
    expect(k).toBeGreaterThanOrEqual(2);
    expect(c!.operands).toEqual([n]);
  });

  it('"2 steps to the left from 2" can no longer occur: no step count equals the start, no answer is a range end (PO3)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      // Answer 0 is the range start: refused.
      expect(numberLineBuilders.stepsLeft(0, s, FULL_STEP, createRng(seed))).toBeNull();
      // Answer 4 to the right: the start 2 with 2 steps is never chosen.
      const c = numberLineBuilders.stepsRight(4, s, FULL_STEP, createRng(seed));
      if (c) expect(c.prompt.params.k).not.toBe(c.prompt.params.n);
    }
  });

  it('stepsLeft starts k steps right of the answer', () => {
    const c = numberLineBuilders.stepsLeft(46, s, FULL_STEP, rng());
    expect(c).not.toBeNull();
    const { n, k } = c!.prompt.params as { n: number; k: number };
    expect(c!.prompt.key).toBe('stepsLeft');
    expect(n - k).toBe(46);
    expect(c!.operands).toEqual([n]);
  });

  it('missingBetween 71 asks for the number between 70 and 72', () => {
    expect(numberLineBuilders.missingBetween(71, s, FULL_STEP, rng())).toMatchObject({
      kind: 'missingBetween',
      prompt: { key: 'missingBetween', params: { a: 70, b: 72 } },
      operands: [70, 72],
      answer: 71,
    });
  });

  it('midpoint 35 asks for the middle of the major ticks 30 and 40', () => {
    expect(numberLineBuilders.midpoint(35, s, FULL_STEP, rng())).toMatchObject({
      kind: 'midpoint',
      prompt: { key: 'midpoint', params: { a: 30, b: 40 } },
      operands: [30, 40],
      answer: 35,
    });
    expect(numberLineBuilders.midpoint(36, s, FULL_STEP, rng())).toBeNull();
  });

  it('returns null when a shown number would leave the range', () => {
    expect(numberLineBuilders.after(0, s, FULL_STEP, rng())).toBeNull();
    expect(numberLineBuilders.before(100, s, FULL_STEP, rng())).toBeNull();
    expect(numberLineBuilders.missingBetween(100, s, FULL_STEP, rng())).toBeNull();
    expect(numberLineBuilders.stepsRight(1, s, FULL_STEP, rng())).toBeNull();
    expect(numberLineBuilders.stepsLeft(99, s, FULL_STEP, rng())).toBeNull();
  });

  it('steps challenges do not cross a ten when crossing tens is off', () => {
    const noCross = settingsFor(0, 100, { crossTens: false });
    for (let seed = 0; seed < 200; seed++) {
      const right = numberLineBuilders.stepsRight(46, noCross, FULL_STEP, createRng(seed));
      expect(right).not.toBeNull();
      expect(right!.prompt.params.n).toBeGreaterThanOrEqual(40);
      const left = numberLineBuilders.stepsLeft(43, noCross, FULL_STEP, createRng(seed));
      expect(left).not.toBeNull();
      expect(left!.prompt.params.n).toBeLessThanOrEqual(50);
    }
    // 41 cannot be reached by 2 or more steps to the right without crossing 40.
    expect(numberLineBuilders.stepsRight(41, noCross, FULL_STEP, createRng(1))).toBeNull();
  });

  it('steps challenges also respect a step that forbids crossing tens', () => {
    const c = numberLineBuilders.stepsRight(41, s, { maxNumberFraction: 1, allowCrossTens: false }, createRng(1));
    expect(c).toBeNull();
  });
});

describe('generateChallenge for number-line kinds (FR-021, FR-028)', () => {
  const s = settingsFor(0, 100, {
    challengeTypes: { numberLine: true, addition: false, subtraction: false, comparison: false },
  });

  for (const kind of NUMBER_LINE_KINDS) {
    it(`${kind}: right prompt key, operands and answer`, () => {
      for (let seed = 1; seed <= 50; seed++) {
        const c = generateChallenge(input(s, kind, seed));
        expect(c.kind).toBe(kind);
        expect(c.prompt.key).toBe(kind);
        const p = c.prompt.params;
        switch (kind) {
          case 'findNumber':
            expect(c.operands).toEqual([c.answer]);
            expect(p.n).toBe(c.answer);
            break;
          case 'after':
            expect(c.answer).toBe(p.n! + 1);
            expect(c.operands).toEqual([p.n]);
            break;
          case 'before':
            expect(c.answer).toBe(p.n! - 1);
            expect(c.operands).toEqual([p.n]);
            break;
          case 'stepsRight':
            expect(c.answer).toBe(p.n! + p.k!);
            expect(c.operands).toEqual([p.n]);
            break;
          case 'stepsLeft':
            expect(c.answer).toBe(p.n! - p.k!);
            expect(c.operands).toEqual([p.n]);
            break;
          case 'missingBetween':
            expect(c.operands).toEqual([c.answer - 1, c.answer + 1]);
            expect(p).toEqual({ a: c.answer - 1, b: c.answer + 1 });
            break;
          case 'midpoint':
            expect(p.b! - p.a!).toBe(10);
            expect(p.a! % 10).toBe(0);
            expect(c.answer).toBe((p.a! + p.b!) / 2);
            break;
        }
      }
    });
  }

  it('sets id, seed, main skill and skills', () => {
    const c = generateChallenge({ ...input(s, 'after', 77), turn: 4 });
    expect(c.id).toBe('77-4');
    expect(typeof c.seed).toBe('number');
    expect(c.mainSkill).toBe('countForward');
    expect(c.skills[0]).toBe('countForward');
    // The main skill's step from skillSteps.
    expect(c.difficultyStep).toBe(LAST_STEPS.countForward);
  });

  it('skips midpoint when the range has no two major ticks with a whole midpoint (range 0 to 10)', () => {
    const tiny = settingsFor(0, 10);
    for (let seed = 0; seed < 200; seed++) {
      const c = generateChallenge(input(tiny, 'midpoint', seed));
      expect(c.kind).toBe('findNumber');
    }
    for (let answer = 0; answer <= 10; answer++) {
      expect(numberLineBuilders.midpoint(answer, tiny, FULL_STEP, createRng(answer))).toBeNull();
    }
  });

  it('uses midpoints 5 and 15 in range 0 to 20', () => {
    const r = settingsFor(0, 20);
    const answers = new Set<number>();
    for (let seed = 0; seed < 100; seed++) {
      const c = generateChallenge(input(r, 'midpoint', seed));
      expect(c.kind).toBe('midpoint');
      answers.add(c.answer);
    }
    expect([...answers].sort((a, b) => a - b)).toEqual([5, 15]);
  });

  it('the same seed gives the same challenge, and different seeds vary (FR-028)', () => {
    const all = { ...input(s, 'findNumber', 1), kindsAllowed: undefined };
    for (let seed = 0; seed < 50; seed++) {
      expect(generateChallenge({ ...all, roundSeed: seed })).toEqual(generateChallenge({ ...all, roundSeed: seed }));
    }
    const distinct = new Set(
      Array.from({ length: 50 }, (_, seed) => JSON.stringify(generateChallenge({ ...all, roundSeed: seed }))),
    );
    expect(distinct.size).toBeGreaterThan(10);
  });

  it('uses every number-line kind, including readPosition, when all are allowed', () => {
    const all = { ...input(s, 'findNumber', 1), kindsAllowed: undefined };
    const kinds = new Set<ChallengeKind>();
    for (let seed = 0; seed < 500; seed++) kinds.add(generateChallenge({ ...all, roundSeed: seed }).kind);
    expect([...kinds].sort()).toEqual([...NUMBER_LINE_KINDS, 'readPosition'].sort());
  });
});

describe('number-line challenge rules over presets and seeds (PO3, FR-021)', () => {
  const ranges: Array<[number, number]> = [
    [0, 10],
    [0, 20],
    [0, 50],
    [0, 100],
    [0, 1000],
    [-20, 30],
    [550, 780],
  ];
  const kinds = ['after', 'before', 'stepsRight', 'stepsLeft', 'missingBetween'] as const;

  for (const [min, max] of ranges) {
    it(`${min} to ${max}: the answer is never a range end; steps have at least 2 steps, never as many as the start`, () => {
      const settings = settingsFor(min, max, {
        challengeTypes: { numberLine: true, addition: false, subtraction: false, comparison: false },
        negativeResults: min < 0,
      });
      for (const kind of kinds) {
        for (let seed = 1; seed <= 60; seed++) {
          for (const player of [min, max, Math.round((min + max) / 2)]) {
            const c = generateChallenge(input(settings, kind, seed, player));
            if (c.kind !== kind) continue;
            expect(c.answer, `${kind} seed ${seed}`).not.toBe(min);
            expect(c.answer, `${kind} seed ${seed}`).not.toBe(max);
            if (kind === 'stepsRight' || kind === 'stepsLeft') {
              const { n, k } = c.prompt.params as { n: number; k: number };
              expect(k).toBeGreaterThanOrEqual(2);
              expect(k, `${kind} seed ${seed}: ${k} steps from ${n}`).not.toBe(n);
              expect(c.answer).not.toBe(n);
            }
          }
        }
      }
    });
  }
});

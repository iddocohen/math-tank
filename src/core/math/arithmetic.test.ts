import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { defaultSettings } from '../settings/defaults';
import { withRange } from '../settings/validate';
import type { Challenge, Settings } from '../types';
import { arithmeticAnswerSet, arithmeticDraft, arithmeticExerciseAt, type ArithmeticKind } from './arithmetic';
import { minEnemyGap } from './gaps';
import type { ChallengeDraft } from './numberLine';
import { mainSkillOf, skillsOf } from './skills';
import { validateChallenge } from './validate';

function asChallenge(draft: ChallengeDraft): Challenge {
  const mainSkill = mainSkillOf(draft.kind);
  return { id: 'test-0', seed: 1, ...draft, difficultyStep: 0, mainSkill, skills: skillsOf(draft) };
}

/** Every answer of a valid exercise of the turned-on kinds, found by trying every start and operand. */
function bruteForceAnswers(s: Settings, player: number): Set<number> {
  const out = new Set<number>();
  const { min, max } = s.range;
  const kinds: ArithmeticKind[] = [];
  if (s.challengeTypes.addition) kinds.push('addition');
  if (s.challengeTypes.subtraction) kinds.push('subtraction');
  const valid = (kind: ArithmeticKind, operands: number[], twoNumbers: boolean): void => {
    const draft = { ...arithmeticDraft(kind, operands), ...(twoNumbers ? { twoNumbers: true as const } : {}) };
    if (validateChallenge(asChallenge(draft), s, player).length === 0) out.add(draft.answer);
  };
  for (const kind of kinds) {
    const own = s[kind];
    if (own.size === 'twoNumbers') {
      for (let a = own.first.min; a <= own.first.max; a++) for (let b = own.second.min; b <= own.second.max; b++) valid(kind, [a, b], true);
      continue;
    }
    for (let start = min; start <= max; start++) {
      for (let b = 1; b <= own.maxOperand; b++) {
        if (own.steps === 1) valid(kind, [start, b], false);
        else for (let c = 1; c <= own.maxOperand; c++) valid(kind, [start, b, c], false);
      }
    }
  }
  return out;
}

function small(min: number, max: number, patch: (s: Settings) => Settings = (s) => s): Settings {
  const base = withRange(defaultSettings(), { preset: 'custom', min, max });
  return patch(base);
}

function types(addition: boolean, subtraction: boolean) {
  return (s: Settings): Settings => ({ ...s, challengeTypes: { numberLine: false, addition, subtraction, comparison: false } });
}

describe('arithmeticAnswerSet (amendment 27, research R25)', () => {
  const cases: Array<[string, Settings]> = [];
  for (const steps of [1, 2] as const) {
    for (const crossTens of [true, false]) {
      for (const crossHundreds of [true, false]) {
        for (const negativeResults of [true, false]) {
          for (const [min, max] of [
            [0, 30],
            [85, 125],
            [-20, 15],
          ] as const) {
            cases.push([
              `${min} to ${max}, ${steps} step(s), crossTens ${crossTens}, crossHundreds ${crossHundreds}, negatives ${negativeResults}`,
              small(min, max, (s) => ({
                ...types(true, true)(s),
                crossTens,
                crossHundreds,
                negativeResults,
                addition: { ...s.addition, steps, maxOperand: 7, maxResult: max - 3 },
                subtraction: { ...s.subtraction, steps, maxOperand: 6 },
              })),
            ]);
          }
        }
      }
    }
  }
  cases.push([
    '"Zwei Zahlen" plus and minus on 0 to 100',
    small(0, 100, (s) => ({
      ...types(true, true)(s),
      addition: { ...s.addition, size: 'twoNumbers', first: { min: 10, max: 40 }, second: { min: 1, max: 30 }, carry: false },
      subtraction: { ...s.subtraction, size: 'twoNumbers', first: { min: 20, max: 60 }, second: { min: 5, max: 19 }, carry: true },
    })),
  ]);

  for (const [label, s] of cases) {
    it(`equals the brute-force set: ${label}`, () => {
      for (const player of [s.range.min, s.range.max]) {
        const expected = [...bruteForceAnswers(s, player)].sort((a, b) => a - b);
        expect([...arithmeticAnswerSet(s, player)].sort((a, b) => a - b), `player ${player}`).toEqual(expected);
      }
    });
  }

  it('every answer keeps minEnemyGap from the player', () => {
    const s = defaultSettings();
    for (const player of [0, 100]) {
      for (const n of arithmeticAnswerSet(s, player)) expect(Math.abs(n - player)).toBeGreaterThanOrEqual(minEnemyGap(0, 100));
    }
  });

  it('is empty for battlefield 0 to 100, only "Plus", "Größtes Ergebnis" 5 at position 0', () => {
    const s = small(0, 100, (x) => ({ ...types(true, false)(x), addition: { ...x.addition, maxResult: 5 } }));
    expect(arithmeticAnswerSet(s, 0).size).toBe(0);
    expect(arithmeticAnswerSet(s, 100).size).toBeGreaterThan(0);
  });
});

describe('arithmeticExerciseAt (amendment 27, FR-163, research R25)', () => {
  it('returns a draft that passes validateChallenge, for both player positions', () => {
    const settings: Settings[] = [
      defaultSettings(),
      small(0, 100, types(true, false)),
      small(0, 100, types(false, true)),
      small(0, 1000, (s) => ({ ...types(true, true)(s), addition: { ...s.addition, steps: 2, maxOperand: 300, maxResult: 1000 }, subtraction: { ...s.subtraction, steps: 2, maxOperand: 300 } })),
      small(0, 100, (s) => ({ ...types(true, true)(s), addition: { ...s.addition, size: 'twoNumbers' }, subtraction: { ...s.subtraction, size: 'twoNumbers' } })),
    ];
    for (const s of settings) {
      for (const player of [s.range.min, s.range.max]) {
        for (let seed = 1; seed <= 40; seed++) {
          const draft = arithmeticExerciseAt(s, player, createRng(seed));
          expect(draft).not.toBeNull();
          expect(['addition', 'subtraction']).toContain(draft!.kind);
          expect(validateChallenge(asChallenge(draft!), s, player)).toEqual([]);
        }
      }
    }
  });

  it('different seeds give more than one exercise (critique E6)', () => {
    const s = defaultSettings();
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const draft = arithmeticExerciseAt(s, 0, createRng(seed))!;
      seen.add(`${draft.kind} ${draft.operands.join(',')}`);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('is null for battlefield 0 to 100, only "Plus", "Größtes Ergebnis" 5 at position 0', () => {
    const s = small(0, 100, (x) => ({ ...types(true, false)(x), addition: { ...x.addition, maxResult: 5 } }));
    expect(arithmeticExerciseAt(s, 0, createRng(1))).toBeNull();
  });

  it('the worst case (width 1000, largest operand 1000, two steps, no valid answer) finishes in under about 50 ms (critique E7)', () => {
    // A battlefield and limits no other test uses, so the memoized sets are computed here.
    const s = small(0, 1000, (x) => ({
      ...types(true, true)(x),
      negativeResults: false,
      addition: { ...x.addition, steps: 2, maxOperand: 1000, maxResult: 149 },
      subtraction: { ...x.subtraction, steps: 2, maxOperand: 999 },
    }));
    // Minus: every answer from 0 to 998 is reachable; with the player at 1000 only plus can miss. Turn minus off.
    const onlyPlus = types(true, false)(s);
    const started = performance.now();
    const draft = arithmeticExerciseAt(onlyPlus, 0, createRng(1));
    const elapsed = performance.now() - started;
    expect(draft).toBeNull();
    expect(elapsed).toBeLessThan(50);
  });
});

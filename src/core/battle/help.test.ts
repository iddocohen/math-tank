import { describe, expect, it } from 'vitest';
import { directionTo, nearestMajorTick, nextHelp } from './help';
import { defaultSettings } from '../settings/defaults';
import { helpZoomView } from '../numberline/zoom';
import { stepPath } from '../math/stepPath';
import type { Challenge, ChallengeKind, Settings } from '../types';

function challenge(kind: ChallengeKind, answer: number, extra: Partial<Challenge> = {}): Challenge {
  return {
    id: 'test-0',
    seed: 1,
    kind,
    difficultyStep: 0,
    mainSkill: 'positions',
    skills: ['positions'],
    prompt: { key: kind, params: {} },
    operands: [answer],
    answer,
    ...extra,
  };
}

function settings(help: Partial<Settings['help']> = {}, range = { preset: '0-100' as const, min: 0, max: 100 }): Settings {
  const s = defaultSettings();
  return { ...s, range, help: { ...s.help, ...help } };
}

const find37 = challenge('findNumber', 37);
const sub43minus7 = challenge('subtraction', 36, { operands: [43, 7], steps: [43, 40, 36] });
const greater = challenge('greater', 74, { options: [74, 47] });
const middle = challenge('middle3', 45, { options: [72, 27, 45] });

describe('directionTo and nearestMajorTick', () => {
  it('directionTo gives right, left or null for the same number', () => {
    expect(directionTo(31, 37)).toBe('right');
    expect(directionTo(40, 37)).toBe('left');
    expect(directionTo(37, 37)).toBeNull();
  });

  it('nearestMajorTick gives the nearest major line of the range (major step 10 in 0 to 100, 50 in 0 to 230, 100 in 0 to 1000)', () => {
    expect(nearestMajorTick(37, 0, 100)).toBe(40);
    expect(nearestMajorTick(34, 0, 100)).toBe(30);
    expect(nearestMajorTick(30, 0, 100)).toBe(30);
    expect(nearestMajorTick(120, 0, 230)).toBe(100);
    expect(nearestMajorTick(651, 0, 1000)).toBe(700);
    // Stays inside the range.
    expect(nearestMajorTick(98, 0, 98)).toBe(90);
    expect(nearestMajorTick(-38, -50, 50)).toBe(-40);
  });
});

describe('nextHelp for position challenges (FR-031)', () => {
  it('step 1 after a miss: the direction from the landing number to the answer and the nearest major line', () => {
    expect(nextHelp(find37, 1, 31, settings())).toMatchObject({ step: 1, direction: 'right', nearestMajor: 40, zoom: null, count: null, solution: null });
    expect(nextHelp(find37, 1, 52, settings())).toMatchObject({ step: 1, direction: 'left', nearestMajor: 40 });
  });

  it('step 1 before any miss has no direction', () => {
    expect(nextHelp(find37, 1, null, settings())).toMatchObject({ step: 1, direction: null, nearestMajor: 40 });
  });

  it('step 2: the ten from helpZoomView and a count from the landing number to the answer', () => {
    const h = nextHelp(find37, 2, 31, settings());
    expect(h).toMatchObject({ step: 2, zoom: helpZoomView(37, 0, 100), count: { from: 31, to: 37, steps: 6 }, stepPath: null, solution: null });
    expect(h.zoom).toEqual({ min: 30, max: 40 });
  });

  it('step 2 without a landing number counts from the nearest major line', () => {
    expect(nextHelp(find37, 2, null, settings())).toMatchObject({ step: 2, count: { from: 40, to: 37, steps: 3 } });
  });

  it('step 2 for addition and subtraction is the step path', () => {
    const h = nextHelp(sub43minus7, 2, 50, settings());
    expect(h).toMatchObject({ step: 2, stepPath: stepPath(sub43minus7, true), count: null, zoom: null });
    expect(h.stepPath).toEqual([43, 40, 36]);
  });

  it('step 3 is the solution', () => {
    expect(nextHelp(find37, 3, 31, settings())).toMatchObject({ step: 3, solution: 37, direction: null, zoom: null, count: null });
    expect(nextHelp(sub43minus7, 3, null, settings())).toMatchObject({ step: 3, solution: 36 });
  });

  it('every kind on the number line gets the position help, readPosition included', () => {
    expect(nextHelp(challenge('readPosition', 63), 1, 70, settings())).toMatchObject({ step: 1, direction: 'left', nearestMajor: 60 });
  });
});

describe('nextHelp for comparison challenges (FR-031)', () => {
  it('step 1 highlights the tens digits in the banner, step 2 marks every option on the ruler, step 3 shows the solution (amendment 09)', () => {
    expect(nextHelp(greater, 1, 47, settings())).toMatchObject({ step: 1, tensDigits: true, direction: null, nearestMajor: null });
    expect(nextHelp(greater, 2, 47, settings())).toMatchObject({ step: 2, optionMarkers: [47, 74], zoom: null, count: null });
    expect(nextHelp(greater, 3, 47, settings())).toMatchObject({ step: 3, solution: 74 });
  });

  it('middle3: the markers are sorted ascending and step 3 shows the middle number; no step has an order', () => {
    expect(nextHelp(middle, 2, null, settings())).toMatchObject({ step: 2, optionMarkers: [27, 45, 72] });
    expect(nextHelp(middle, 3, null, settings())).toMatchObject({ step: 3, solution: 45 });
    for (const level of [1, 2, 3]) expect(nextHelp(middle, level, null, settings())).not.toHaveProperty('order');
  });
});

describe('nextHelp with help types turned off by the parent (FR-032)', () => {
  it('without nearestTen step 1 keeps the direction but has no highlight; with no landing number it is skipped', () => {
    expect(nextHelp(find37, 1, 31, settings({ nearestTen: false }))).toMatchObject({ step: 1, direction: 'right', nearestMajor: null });
    expect(nextHelp(find37, 1, null, settings({ nearestTen: false }))).toMatchObject({ step: 2 });
  });

  it('without zoom or countSteps step 2 leaves that part out; without both it is skipped', () => {
    expect(nextHelp(find37, 2, 31, settings({ zoom: false }))).toMatchObject({ step: 2, zoom: null, count: { from: 31 } });
    expect(nextHelp(find37, 2, 31, settings({ countSteps: false }))).toMatchObject({ step: 2, zoom: { min: 30, max: 40 }, count: null });
    expect(nextHelp(find37, 2, 31, settings({ zoom: false, countSteps: false }))).toMatchObject({ step: 3, solution: 37 });
  });

  it('without stepAnimation the step 2 of addition and subtraction is skipped', () => {
    expect(nextHelp(sub43minus7, 2, 50, settings({ stepAnimation: false }))).toMatchObject({ step: 3, solution: 36, stepPath: null });
  });

  it('comparison: without nearestTen step 1 is skipped, without zoom step 2 is skipped', () => {
    expect(nextHelp(greater, 1, null, settings({ nearestTen: false }))).toMatchObject({ step: 2, optionMarkers: [47, 74] });
    expect(nextHelp(greater, 2, null, settings({ zoom: false }))).toMatchObject({ step: 3, solution: 74 });
  });

  it('with every help type off, the solution is still returned at once', () => {
    const off = settings({ nearestTen: false, countSteps: false, zoom: false, stepAnimation: false });
    for (const c of [find37, sub43minus7, greater, middle]) {
      expect(nextHelp(c, 1, null, off)).toMatchObject({ step: 3, solution: c.answer });
    }
  });
});

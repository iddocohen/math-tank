import { describe, expect, it } from 'vitest';
import { aimCrossShown } from './aimCross';
import { defaultSettings } from '../settings/defaults';
import { rulerLevelFor, skillKey } from '../progress/ladders';
import { emptySkillProgress } from '../progress/adaptive';
import { emptyProgress } from '../storage/storage';
import { rangeKeyOf } from './attempt';
import type { Progress, RulerLevel } from '../types';

const LEVELS: RulerLevel[] = [1, 2, 3, 4, 5];

describe('aimCrossShown (amendment 19, FR-134)', () => {
  it('"Immer" shows the cross at every ruler level', () => {
    for (const level of LEVELS) expect(aimCrossShown({ mode: 'always', level: 2 }, level)).toBe(true);
  });

  it('"Nie" hides the cross at every ruler level', () => {
    for (const level of LEVELS) expect(aimCrossShown({ mode: 'never', level: 5 }, level)).toBe(false);
  });

  it('"Bis Zahlenstrahl-Stufe 2" shows it at levels 1 and 2 and hides it at 3 to 5', () => {
    expect(LEVELS.map((level) => aimCrossShown({ mode: 'upToLevel', level: 2 }, level))).toEqual([true, true, false, false, false]);
  });

  it('"Bis Zahlenstrahl-Stufe N" for every N shows it exactly up to N', () => {
    for (const n of LEVELS) {
      for (const level of LEVELS) expect(aimCrossShown({ mode: 'upToLevel', level: n }, level), `${n}/${level}`).toBe(level <= n);
    }
  });

  it('follows an adaptive ruler level change: hidden once the level rises above N, shown again when it falls back', () => {
    const settings = { ...defaultSettings(), adaptive: true, aimCross: { mode: 'upToLevel', level: 2 } as const };
    const rangeKey = rangeKeyOf(settings.range);
    const withPositionsStep = (step: number): Progress => {
      const p = emptyProgress();
      return { ...p, skills: { ...p.skills, [skillKey('positions', rangeKey)]: { ...emptySkillProgress(), step } } };
    };
    // The positions ladder reaches ruler level 2 at step 3 and level 3 at step 4 (data-model.md "Difficulty ladders").
    const atLevel2 = rulerLevelFor(withPositionsStep(3), rangeKey, settings);
    const atLevel3 = rulerLevelFor(withPositionsStep(4), rangeKey, settings);
    expect([atLevel2, atLevel3]).toEqual([2, 3]);
    expect(aimCrossShown(settings.aimCross, atLevel2)).toBe(true);
    expect(aimCrossShown(settings.aimCross, atLevel3)).toBe(false);
    expect(aimCrossShown(settings.aimCross, rulerLevelFor(withPositionsStep(3), rangeKey, settings))).toBe(true);
  });
});

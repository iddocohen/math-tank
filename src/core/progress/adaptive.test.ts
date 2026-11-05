import { describe, expect, it } from 'vitest';
import { MAX_ATTEMPTS, recordAttempt } from './adaptive';
import { effectiveStep, ladders, skillKey, topStep } from './ladders';
import { defaultSettings } from '../settings/defaults';
import { emptyProgress } from '../storage/storage';
import type { Attempt, Progress, RecentOutcome, Settings, Skill, SkillProgress } from '../types';

const RANGE = '0-100';
const ALL_SKILLS: Skill[] = [
  'positions',
  'countForward',
  'countBackward',
  'tens',
  'crossTens',
  'addition',
  'subtraction',
  'comparison',
];

type Kind = 'independent' | 'assisted' | 'unsolved' | 'guess';

let counter = 0;
function attempt(kind: Kind, skills: Skill[] = ['positions'], extra: Partial<Attempt> = {}): Attempt {
  counter += 1;
  return {
    challengeId: `c-${counter}`,
    seed: counter,
    kind: skills[0] === 'addition' ? 'addition' : skills[0] === 'subtraction' ? 'subtraction' : 'findNumber',
    skills,
    rangeKey: RANGE,
    difficultyStep: 0,
    solved: kind !== 'unsolved',
    independent: kind === 'independent' || kind === 'guess',
    exact: true,
    helpLevel: kind === 'unsolved' ? 3 : kind === 'assisted' ? 1 : 0,
    wrongAnswers: 0,
    responseMs: kind === 'guess' ? 800 : 4000,
    guess: kind === 'guess',
    sessionId: 's1',
    at: 1_000_000 + counter,
    ...extra,
  };
}

function settings(extra: Partial<Settings> = {}): Settings {
  return { ...defaultSettings(), ...extra };
}

function play(p: Progress, kinds: Kind[], s: Settings, skills: Skill[] = ['positions']): Progress {
  return kinds.reduce((acc, k) => recordAttempt(acc, attempt(k, skills), s), p);
}

function withSkill(skill: Skill, sp: Partial<SkillProgress>): Progress {
  const p = emptyProgress();
  p.skills[skillKey(skill, RANGE)] = {
    step: 0,
    recent: [],
    masteryWindow: [],
    guesses: 0,
    attempts: 0,
    independentCorrect: 0,
    assisted: 0,
    ...sp,
  };
  return p;
}

function sp(p: Progress, skill: Skill = 'positions'): SkillProgress {
  const found = p.skills[skillKey(skill, RANGE)];
  if (!found) throw new Error(`no progress for ${skill}`);
  return found;
}

describe('recordAttempt and effectiveStep (FR-018, FR-037, FR-075, AC-09)', () => {
  it('starts each skill at step 0', () => {
    const s = settings();
    for (const skill of ALL_SKILLS) {
      expect(effectiveStep(emptyProgress(), skill, RANGE, s)).toEqual(effectiveStep(withSkill(skill, {}), skill, RANGE, s));
    }
    const p = recordAttempt(emptyProgress(), attempt('assisted'), s);
    expect(sp(p).step).toBe(0);
    expect(effectiveStep(emptyProgress(), 'positions', RANGE, s).maxNumberFraction).toBe(ladders.positions[0]?.maxNumberFraction);
  });

  it('raises the step by one after 5 independent of the last 6 non-guess outcomes and clears recent', () => {
    const s = settings();
    const before = play(emptyProgress(), ['independent', 'assisted', 'independent', 'independent', 'independent'], s);
    expect(sp(before).step).toBe(0);
    const after = recordAttempt(before, attempt('independent'), s);
    expect(sp(after).step).toBe(1);
    expect(sp(after).recent).toEqual([]);
  });

  it('never raises after a single correct answer', () => {
    const p = play(emptyProgress(), ['independent'], settings());
    expect(sp(p).step).toBe(0);
  });

  it('lowers the step by one after 3 assisted or unsolved of the last 5, never below 0', () => {
    const s = settings();
    const p = play(withSkill('positions', { step: 2 }), ['assisted', 'independent', 'unsolved', 'independent'], s);
    expect(sp(p).step).toBe(2);
    const lowered = recordAttempt(p, attempt('assisted'), s);
    expect(sp(lowered).step).toBe(1);
    expect(sp(lowered).recent).toEqual([]);

    const atZero = play(emptyProgress(), ['assisted', 'unsolved', 'assisted', 'unsolved'], s);
    expect(sp(atZero).step).toBe(0);
  });

  it('keeps masteryWindow when the step changes', () => {
    const p = play(emptyProgress(), ['independent', 'independent', 'independent', 'independent', 'independent'], settings());
    expect(sp(p).step).toBe(1);
    expect(sp(p).masteryWindow).toHaveLength(5);
  });

  it('never passes the top of the ladder', () => {
    const s = settings();
    const top = ladders.positions.length - 1;
    const p = play(withSkill('positions', { step: top }), Array<Kind>(6).fill('independent'), s);
    expect(sp(p).step).toBe(top);
    expect(effectiveStep(p, 'positions', RANGE, s)).toEqual({ ...ladders.positions[top], rulerLevel: 5 });
  });

  it('caps the ladder maxOperand by the parent addition.maxOperand', () => {
    const s = settings({ addition: { maxOperand: 10, maxResult: 100, steps: 1 } });
    for (let step = 0; step < ladders.addition.length; step++) {
      const e = effectiveStep(withSkill('addition', { step }), 'addition', RANGE, s);
      expect(e.maxOperand).toBeDefined();
      expect(e.maxOperand).toBeLessThanOrEqual(10);
    }
    const tight = settings({ addition: { maxOperand: 3, maxResult: 100, steps: 1 } });
    let p = emptyProgress();
    for (let i = 0; i < 40; i++) p = recordAttempt(p, attempt('independent', ['addition']), tight);
    expect(effectiveStep(p, 'addition', RANGE, tight).maxOperand).toBe(3);
    expect(sp(p, 'addition').step).toBeLessThanOrEqual(topStep('addition', tight));
  });

  it('never allows crossing tens when the parent forbids it', () => {
    const s = settings({ crossTens: false });
    for (const skill of ALL_SKILLS)
      for (let step = 0; step < ladders[skill].length; step++)
        expect(effectiveStep(withSkill(skill, { step }), skill, RANGE, s).allowCrossTens).toBe(false);
  });

  it('keeps the positions ruler level within rulerLevelStart and rulerLevelMax', () => {
    const s = settings({ rulerLevelStart: 2, rulerLevelMax: 3 });
    const levels = new Set<number | undefined>();
    let p = emptyProgress();
    for (let i = 0; i < 60; i++) {
      levels.add(effectiveStep(p, 'positions', RANGE, s).rulerLevel);
      p = recordAttempt(p, attempt('independent'), s);
    }
    levels.add(effectiveStep(p, 'positions', RANGE, s).rulerLevel);
    expect([...levels].sort()).toEqual([2, 3]);
    expect(sp(p).step).toBe(topStep('positions', s));
  });

  it('locks the ruler level when the start and hardest levels are equal', () => {
    const s = settings({ rulerLevelStart: 4, rulerLevelMax: 4 });
    for (let step = 0; step < ladders.positions.length; step++)
      expect(effectiveStep(withSkill('positions', { step }), 'positions', RANGE, s).rulerLevel).toBe(4);
  });

  it('gives a ruler level only on the positions ladder', () => {
    const s = settings();
    for (const skill of ALL_SKILLS.filter((k) => k !== 'positions')) {
      for (const step of ladders[skill]) expect(step.rulerLevel).toBeUndefined();
      expect(effectiveStep(emptyProgress(), skill, RANGE, s).rulerLevel).toBeUndefined();
    }
  });

  it('never lets guesses enter recent or masteryWindow', () => {
    const s = settings();
    const p = play(emptyProgress(), ['guess', 'guess', 'guess', 'guess', 'guess', 'guess'], s);
    expect(sp(p).recent).toEqual([]);
    expect(sp(p).masteryWindow).toEqual([]);
    expect(sp(p).guesses).toBe(6);
    expect(sp(p).attempts).toBe(6);
    expect(sp(p).independentCorrect).toBe(0);
    expect(sp(p).step).toBe(0);
  });

  it("counts a stored 'close' neither toward raising nor toward lowering", () => {
    const s = settings();
    const raising = recordAttempt(
      withSkill('positions', { step: 1, recent: ['close', 'close', 'independent', 'independent', 'independent'] }),
      attempt('independent'),
      s,
    );
    expect(sp(raising).step).toBe(1);

    const lowering = recordAttempt(
      withSkill('positions', { step: 1, recent: ['close', 'close', 'close', 'assisted'] }),
      attempt('assisted'),
      s,
    );
    expect(sp(lowering).step).toBe(1);

    const recent: RecentOutcome[] = ['close', 'independent', 'independent', 'independent', 'independent'];
    const stillRaises = recordAttempt(withSkill('positions', { step: 1, recent }), attempt('independent'), s);
    expect(sp(stillRaises).step).toBe(2);
  });

  it('keeps recent at most 6 and masteryWindow at most 10, newest last', () => {
    const s = settings();
    let p = withSkill('positions', { step: 3 });
    const kinds: Kind[] = ['independent', 'assisted', 'independent', 'assisted', 'independent', 'independent', 'independent', 'assisted', 'independent', 'independent', 'independent', 'assisted'];
    for (const k of kinds) p = recordAttempt(p, attempt(k), s);
    expect(sp(p).recent.length).toBeLessThanOrEqual(6);
    expect(sp(p).masteryWindow).toHaveLength(10);
    expect(sp(p).masteryWindow.at(-1)).toBe('assisted');
  });

  it('updates the main skill and every further skill with counters', () => {
    const s = settings();
    const p = recordAttempt(emptyProgress(), attempt('assisted', ['subtraction', 'crossTens']), s);
    for (const skill of ['subtraction', 'crossTens'] as const) {
      expect(sp(p, skill)).toMatchObject({ attempts: 1, assisted: 1, independentCorrect: 0, recent: ['assisted'] });
    }
    const q = recordAttempt(p, attempt('independent', ['subtraction', 'crossTens']), s);
    expect(sp(q, 'subtraction')).toMatchObject({ attempts: 2, assisted: 1, independentCorrect: 1 });
    expect(q.attempts).toHaveLength(2);
  });

  it('does not change the original progress', () => {
    const p = emptyProgress();
    recordAttempt(p, attempt('independent'), settings());
    expect(p).toEqual(emptyProgress());
  });

  it('with adaptive off uses the top step clamped by settings and the ruler level rulerLevelStart', () => {
    const s = settings({ adaptive: false, rulerLevelStart: 2, rulerLevelMax: 5, addition: { maxOperand: 7, maxResult: 100, steps: 1 } });
    const top = ladders.positions.length - 1;
    expect(effectiveStep(emptyProgress(), 'positions', RANGE, s)).toEqual({ ...ladders.positions[top], rulerLevel: 2 });
    const add = effectiveStep(emptyProgress(), 'addition', RANGE, s);
    expect(add.maxOperand).toBe(7);
    expect(add.maxNumberFraction).toBe(1);
    expect(add.allowCrossTens).toBe(true);

    const p = play(emptyProgress(), Array<Kind>(6).fill('independent'), s);
    expect(sp(p).step).toBe(0);
  });
});

describe('attempt history cap (research R11)', () => {
  it('keeps only the newest 2000 attempts while session summaries keep the totals of older ones', () => {
    const s = settings();
    const p = emptyProgress();
    p.sessions.push({ id: 's1', startedAt: 0, lastActiveAt: 0, attempts: 0, independentCorrect: 0, assisted: 0 });
    let q = p;
    for (let i = 0; i < MAX_ATTEMPTS; i++) q = recordAttempt(q, attempt(i % 2 === 0 ? 'independent' : 'assisted'), s);
    expect(q.attempts).toHaveLength(MAX_ATTEMPTS);
    const firstId = q.attempts[0]?.challengeId;
    const last = attempt('independent');
    q = recordAttempt(q, last, s);
    expect(MAX_ATTEMPTS).toBe(2000);
    expect(q.attempts).toHaveLength(2000);
    expect(q.attempts.at(-1)?.challengeId).toBe(last.challengeId);
    expect(q.attempts.some((a) => a.challengeId === firstId)).toBe(false);
    expect(q.sessions[0]).toMatchObject({ attempts: 2001, independentCorrect: 1001, assisted: 1000 });
    expect(sp(q).attempts).toBe(2001);
  });

  it('adds a session summary for an attempt whose session is not listed yet', () => {
    const q = recordAttempt(emptyProgress(), attempt('independent', ['positions'], { sessionId: 'new', at: 5000 }), settings());
    expect(q.sessions).toEqual([{ id: 'new', startedAt: 5000, lastActiveAt: 5000, attempts: 1, independentCorrect: 1, assisted: 0 }]);
  });
});

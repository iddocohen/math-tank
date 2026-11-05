import { describe, expect, it } from 'vitest';
import { summarize } from './summarize';
import { ladders, skillKey } from './ladders';
import { emptyProgress } from '../storage/storage';
import { emptyRecords, type Records } from '../records/records';
import type { Progress, RecentOutcome, Skill, SkillProgress } from '../types';

function skill(sp: Partial<SkillProgress>): SkillProgress {
  return { step: 0, recent: [], masteryWindow: [], guesses: 0, attempts: 0, independentCorrect: 0, assisted: 0, ...sp };
}

const tenIndependent: RecentOutcome[] = Array.from({ length: 10 }, () => 'independent');

function fixture(): Progress {
  const p = emptyProgress();
  // positions: 14 attempts, 12 independent, 1 with help, 1 unsolved: mastered.
  p.skills[skillKey('positions', '0-100')] = skill({ step: 3, attempts: 14, independentCorrect: 12, assisted: 1, masteryWindow: tenIndependent });
  // addition: every answer with help: developing, the most help needed.
  p.skills[skillKey('addition', '0-100')] = skill({ step: 0, attempts: 6, independentCorrect: 0, assisted: 6, masteryWindow: Array(6).fill('assisted') });
  // subtraction: 2 guesses, 1 with help, 1 unsolved.
  p.skills[skillKey('subtraction', '0-100')] = skill({ step: 1, attempts: 5, independentCorrect: 1, assisted: 1, guesses: 2 });
  // positions in another range.
  p.skills[skillKey('positions', '0-20')] = skill({ step: 1, attempts: 2, independentCorrect: 2 });
  p.sessions = [
    { id: 'a', startedAt: Date.UTC(2026, 10, 1, 9), lastActiveAt: Date.UTC(2026, 10, 1, 9, 20), attempts: 20, independentCorrect: 13, assisted: 6 },
    { id: 'b', startedAt: Date.UTC(2026, 10, 2, 9), lastActiveAt: Date.UTC(2026, 10, 2, 9, 5), attempts: 0, independentCorrect: 0, assisted: 0 },
    { id: 'c', startedAt: Date.UTC(2026, 10, 3, 9), lastActiveAt: Date.UTC(2026, 10, 3, 9, 30), attempts: 7, independentCorrect: 2, assisted: 2 },
  ];
  return p;
}

function records(): Records {
  return {
    version: 1,
    best: {
      '0-100|1|untilHearts': { enemies: 12, ms: 372_000, at: 1 },
      '0-20|2|enemyCount': { enemies: 5, ms: 61_000, at: 2 },
      '-20-30|3|untilHearts': { enemies: 4, ms: 90_000, at: 3 },
      '0-100|3|untilHearts': { enemies: 7, ms: 200_000, at: 4 },
    },
  };
}

describe('summarize (FR-040, FR-087)', () => {
  it('returns per skill and range the attempts, independent correct, with help, current step and status', () => {
    const s = summarize(fixture(), emptyRecords());
    const row = (sk: Skill, range: string) => s.skills.find((r) => r.skill === sk && r.rangeKey === range);
    expect(row('positions', '0-100')).toEqual({
      skill: 'positions',
      rangeKey: '0-100',
      attempts: 14,
      independentCorrect: 12,
      withHelp: 1,
      guesses: 0,
      step: 3,
      stepCount: ladders.positions.length,
      status: 'mastered',
    });
    expect(row('addition', '0-100')).toMatchObject({ attempts: 6, independentCorrect: 0, withHelp: 6, step: 0, status: 'developing' });
    expect(row('subtraction', '0-100')).toMatchObject({ attempts: 5, independentCorrect: 1, withHelp: 1, guesses: 2, status: 'developing' });
    expect(row('positions', '0-20')).toMatchObject({ attempts: 2, independentCorrect: 2, step: 1, status: 'developing' });
    expect(s.skills).toHaveLength(4);
  });

  it('orders the skill rows by skill, then by range', () => {
    const s = summarize(fixture(), emptyRecords());
    expect(s.skills.map((r) => `${r.skill}|${r.rangeKey}`)).toEqual(['positions|0-20', 'positions|0-100', 'addition|0-100', 'subtraction|0-100']);
  });

  it('lists the skills sorted by help needed, most first, and leaves out skills that never needed help', () => {
    const s = summarize(fixture(), emptyRecords());
    // Help needed: answers with help plus unsolved ones; guesses do not count.
    expect(s.mostHelp.map((r) => `${r.skill}|${r.rangeKey}`)).toEqual(['addition|0-100', 'positions|0-100', 'subtraction|0-100']);
    expect(s.mostHelp.map((r) => r.helpNeeded)).toEqual([6, 2, 2]);
  });

  it('lists the sessions with attempts, newest first, with date, attempts, independent correct and with help', () => {
    const s = summarize(fixture(), emptyRecords());
    expect(s.sessions).toEqual([
      { id: 'c', startedAt: Date.UTC(2026, 10, 3, 9), attempts: 7, independentCorrect: 2, withHelp: 2 },
      { id: 'a', startedAt: Date.UTC(2026, 10, 1, 9), attempts: 20, independentCorrect: 13, withHelp: 6 },
    ]);
  });

  it('lists the personal bests per range, ruler starting level and round type with their time (FR-087, US7 scenario 8)', () => {
    const s = summarize(emptyProgress(), records());
    expect(s.bests).toEqual([
      { min: -20, max: 30, rulerLevelStart: 3, roundType: 'untilHearts', enemies: 4, ms: 90_000 },
      { min: 0, max: 20, rulerLevelStart: 2, roundType: 'enemyCount', enemies: 5, ms: 61_000 },
      { min: 0, max: 100, rulerLevelStart: 1, roundType: 'untilHearts', enemies: 12, ms: 372_000 },
      { min: 0, max: 100, rulerLevelStart: 3, roundType: 'untilHearts', enemies: 7, ms: 200_000 },
    ]);
  });

  it('skips a personal best whose key cannot be read', () => {
    const r = emptyRecords();
    r.best['nonsense'] = { enemies: 3, ms: 1000, at: 1 };
    expect(summarize(emptyProgress(), r).bests).toEqual([]);
  });

  it('returns empty lists for empty progress and records', () => {
    expect(summarize(emptyProgress(), emptyRecords())).toEqual({ skills: [], mostHelp: [], sessions: [], bests: [] });
  });
});

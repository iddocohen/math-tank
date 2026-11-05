import { describe, expect, it } from 'vitest';
import { createProgressStore } from './progressStore';
import { emptyProgress } from './storage';
import { defaultSettings } from '../settings/defaults';
import { skillKey } from '../progress/ladders';
import type { NewAttempt } from '../battle/ports';
import type { Progress } from '../types';

function attempt(at: number, extra: Partial<NewAttempt> = {}): NewAttempt {
  return {
    challengeId: `c-${at}`,
    seed: at,
    kind: 'addition',
    skills: ['addition'],
    rangeKey: '0-100',
    difficultyStep: 0,
    solved: true,
    independent: true,
    exact: true,
    helpLevel: 0,
    wrongAnswers: 0,
    responseMs: 3000,
    guess: false,
    at,
    ...extra,
  };
}

function source(initial: Progress = emptyProgress()) {
  const saved: Progress[] = [];
  let current = initial;
  return {
    saved,
    set: (p: Progress) => (current = p),
    io: {
      load: () => current,
      save: (p: Progress) => {
        current = p;
        saved.push(p);
      },
    },
  };
}

describe('createProgressStore (T131, FR-035, FR-048)', () => {
  it('applies recordAttempt and saves once after each attempt', () => {
    const src = source();
    const store = createProgressStore(src.io);
    store.record(attempt(1_000), defaultSettings());
    store.record(attempt(2_000), defaultSettings());
    expect(src.saved).toHaveLength(2);
    expect(store.getProgress().attempts).toHaveLength(2);
    expect(store.getProgress().skills[skillKey('addition', '0-100')]).toMatchObject({ attempts: 2, independentCorrect: 2 });
  });

  it('the first attempt after the game loaded starts a new session; later ones continue it', () => {
    const earlier = emptyProgress();
    earlier.sessions.push({ id: 'old', startedAt: 500, lastActiveAt: 900, attempts: 1, independentCorrect: 1, assisted: 0 });
    const src = source(earlier);
    const store = createProgressStore(src.io);
    store.record(attempt(1_000), defaultSettings());
    store.record(attempt(2_000), defaultSettings());
    const p = store.getProgress();
    expect(p.sessions.map((s) => s.attempts)).toEqual([1, 2]);
    expect(p.attempts.every((a) => a.sessionId === p.sessions[1]!.id)).toBe(true);
  });

  it('reads the progress from its source before every attempt, so a reset is not overwritten', () => {
    const src = source();
    const store = createProgressStore(src.io);
    store.record(attempt(1_000), defaultSettings());
    src.set(emptyProgress());
    store.record(attempt(2_000), defaultSettings());
    expect(store.getProgress().attempts.map((a) => a.at)).toEqual([2_000]);
  });

  it('moves the adaptive step with the settings it is given', () => {
    const src = source();
    const store = createProgressStore(src.io);
    for (let i = 1; i <= 5; i++) store.record(attempt(i * 10_000), { ...defaultSettings(), adaptive: true });
    expect(store.getProgress().skills[skillKey('addition', '0-100')]!.step).toBe(1);
  });
});

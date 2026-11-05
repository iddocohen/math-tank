import { describe, expect, it } from 'vitest';
import { classifyAttempt, type ClassifyInput } from './classify';

function input(extra: Partial<ClassifyInput> = {}): ClassifyInput {
  return {
    solved: true,
    exact: true,
    helpLevel: 0,
    wrongAnswers: 0,
    responseMs: 4000,
    wrongAnswerTimes: [],
    submittedAt: 100_000,
    ...extra,
  };
}

describe('classifyAttempt (FR-038, FR-075)', () => {
  it('flags a hit 1400 ms after answers became possible as a guess, but not one at 1500 ms', () => {
    expect(classifyAttempt(input({ responseMs: 1400 })).guess).toBe(true);
    expect(classifyAttempt(input({ responseMs: 1500 })).guess).toBe(false);
  });

  it('flags a hit after 3 misses within 5000 ms before the hit as a guess', () => {
    const at = 100_000;
    const result = classifyAttempt(
      input({ wrongAnswers: 3, responseMs: 9000, submittedAt: at, wrongAnswerTimes: [at - 4500, at - 3000, at - 1000] }),
    );
    expect(result.guess).toBe(true);
  });

  it('does not flag a hit after 3 misses spread over 6000 ms', () => {
    const at = 100_000;
    const result = classifyAttempt(
      input({ wrongAnswers: 3, responseMs: 9000, submittedAt: at, wrongAnswerTimes: [at - 6000, at - 3000, at - 1000] }),
    );
    expect(result.guess).toBe(false);
  });

  it('never flags an unsolved search as a guess', () => {
    expect(classifyAttempt(input({ solved: false, helpLevel: 3, responseMs: 500 })).guess).toBe(false);
  });

  it('is independent only for the exact number on the first shot with help level 0', () => {
    expect(classifyAttempt(input()).independent).toBe(true);
    expect(classifyAttempt(input()).outcome).toBe('independent');
    expect(classifyAttempt(input({ wrongAnswers: 1, wrongAnswerTimes: [99_000] })).independent).toBe(false);
    expect(classifyAttempt(input({ helpLevel: 1 })).independent).toBe(false);
    expect(classifyAttempt(input({ exact: false })).independent).toBe(false);
    expect(classifyAttempt(input({ solved: false, helpLevel: 3 })).independent).toBe(false);
  });

  it('records a hit after a near miss on the body as assisted (amendment 06: a near miss is a miss)', () => {
    const result = classifyAttempt(input({ wrongAnswers: 1, wrongAnswerTimes: [96_000] }));
    expect(result.outcome).toBe('assisted');
  });

  it('records a hit after help as assisted', () => {
    expect(classifyAttempt(input({ helpLevel: 1 })).outcome).toBe('assisted');
    expect(classifyAttempt(input({ helpLevel: 2 })).outcome).toBe('assisted');
  });

  it('records a search that ended at the shown solution as unsolved', () => {
    expect(classifyAttempt(input({ solved: false, helpLevel: 3 })).outcome).toBe('unsolved');
  });

  it("produces only 'independent', 'assisted' or 'unsolved', never 'close'", () => {
    const outcomes = new Set<string>();
    for (const solved of [true, false])
      for (const exact of [true, false])
        for (const helpLevel of [0, 1, 2, 3])
          for (const wrongAnswers of [0, 1, 4])
            outcomes.add(classifyAttempt(input({ solved, exact, helpLevel, wrongAnswers })).outcome);
    expect([...outcomes].sort()).toEqual(['assisted', 'independent', 'unsolved']);
  });
});

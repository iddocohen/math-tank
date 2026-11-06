import { describe, expect, it } from 'vitest';
import { currentSession, SESSION_IDLE_MS, startOrContinueSession } from './session';
import { emptyProgress } from '../storage/storage';
import type { Progress } from '../types';

/** Local time, so the calendar-day rule does not depend on the test machine's time zone. */
function at(day: number, hour: number, minute = 0): number {
  return new Date(2026, 10, day, hour, minute).getTime();
}

function withSession(startedAt: number, lastActiveAt: number): Progress {
  const p = emptyProgress();
  p.sessions.push({ id: 'old', startedAt, lastActiveAt, attempts: 4, independentCorrect: 2, assisted: 2 });
  return p;
}

describe('startOrContinueSession (Key Entities "Session")', () => {
  it('starts the first session with empty totals', () => {
    const now = at(5, 10);
    const p = startOrContinueSession(emptyProgress(), now);
    expect(p.sessions).toHaveLength(1);
    expect(p.sessions[0]).toMatchObject({ startedAt: now, lastActiveAt: now, attempts: 0, independentCorrect: 0, assisted: 0 });
    expect(currentSession(p)?.id).toBe(p.sessions[0]?.id);
  });

  it('starts a new session on game load even shortly after the last activity', () => {
    const p = startOrContinueSession(withSession(at(5, 10), at(5, 10, 5)), at(5, 10, 6), { gameLoad: true });
    expect(p.sessions).toHaveLength(2);
    expect(p.sessions[1]?.id).not.toBe('old');
    expect(p.sessions[1]?.startedAt).toBe(at(5, 10, 6));
  });

  it('starts a new session after more than 30 minutes since lastActiveAt', () => {
    expect(SESSION_IDLE_MS).toBe(30 * 60 * 1000);
    const last = at(5, 10);
    const p = startOrContinueSession(withSession(at(5, 9), last), last + SESSION_IDLE_MS + 1);
    expect(p.sessions).toHaveLength(2);
    expect(p.sessions[0]).toMatchObject({ id: 'old', lastActiveAt: last });
  });

  it('continues the session at exactly 30 minutes and updates lastActiveAt', () => {
    const last = at(5, 10);
    const now = last + SESSION_IDLE_MS;
    const p = startOrContinueSession(withSession(at(5, 9), last), now);
    expect(p.sessions).toEqual([{ id: 'old', startedAt: at(5, 9), lastActiveAt: now, attempts: 4, independentCorrect: 2, assisted: 2 }]);
  });

  it('starts a new session on a new calendar day', () => {
    const p = startOrContinueSession(withSession(at(5, 23, 40), at(5, 23, 50)), at(6, 0, 5));
    expect(p.sessions).toHaveLength(2);
    expect(p.sessions[1]?.startedAt).toBe(at(6, 0, 5));
  });

  it('gives every session a different id and does not change the original progress', () => {
    const original = withSession(at(5, 10), at(5, 10));
    const p = startOrContinueSession(original, at(5, 10), { gameLoad: true });
    const q = startOrContinueSession(p, at(5, 10), { gameLoad: true });
    expect(new Set(q.sessions.map((s) => s.id)).size).toBe(3);
    expect(original.sessions).toHaveLength(1);
    expect(original.sessions[0]?.lastActiveAt).toBe(at(5, 10));
  });
});

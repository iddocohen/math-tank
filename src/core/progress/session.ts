/**
 * Play sessions (spec Key Entities "Session", data-model.md Progress). A new session starts on game load, after more
 * than 30 minutes without activity, or on a new calendar day (local time); otherwise the current session's
 * `lastActiveAt` moves to `now`. Pure: returns a new Progress.
 */
import type { Progress, SessionSummary } from '../types';

export const SESSION_IDLE_MS = 30 * 60 * 1000;

export interface SessionOptions {
  /** The game was just loaded: always start a new session. */
  gameLoad?: boolean;
}

/** The session attempts are recorded in: the newest one. */
export function currentSession(p: Progress): SessionSummary | undefined {
  return p.sessions.at(-1);
}

function sameDay(a: number, b: number): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

function newSessionId(p: Progress, now: number): string {
  const taken = new Set(p.sessions.map((s) => s.id));
  let n = p.sessions.length;
  let id = `${now}-${n}`;
  while (taken.has(id)) id = `${now}-${++n}`;
  return id;
}

export function startOrContinueSession(p: Progress, now: number, options: SessionOptions = {}): Progress {
  const last = currentSession(p);
  const continues =
    last !== undefined && !options.gameLoad && now - last.lastActiveAt <= SESSION_IDLE_MS && sameDay(last.startedAt, now);
  if (continues) {
    const updated = { ...last, lastActiveAt: Math.max(last.lastActiveAt, now) };
    return { ...p, sessions: [...p.sessions.slice(0, -1), updated] };
  }
  const fresh: SessionSummary = {
    id: newSessionId(p, now),
    startedAt: now,
    lastActiveAt: now,
    attempts: 0,
    independentCorrect: 0,
    assisted: 0,
  };
  return { ...p, sessions: [...p.sessions, fresh] };
}

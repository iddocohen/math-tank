/**
 * Records one attempt in Progress (FR-035, FR-036, FR-037, FR-075, research R11). Pure: returns a new Progress.
 * Every skill of the attempt (the main skill and further skills) gets its counters and windows updated; with
 * adaptive difficulty on, its step moves by the adaptive rule. Guesses are counted but never enter `recent` or
 * `masteryWindow`. A stored 'close' from amendment 04 counts neither toward raising nor toward lowering.
 *
 * Amendment 17 (FR-037): up one step after RAISE_ROW independent answers in a row, down one step when LOWER_NEEDED of
 * the last LOWER_WINDOW needed help or were unsolved. `recent` is cleared on a step change, so the row starts again;
 * guesses never enter it, so they neither count nor break the row.
 */
import { skillKey, stepDown, stepUp, topStep } from './ladders';
import type { Attempt, Progress, RecentOutcome, SessionSummary, Settings, Skill, SkillProgress } from '../types';

/** Attempt history is capped at the newest 2000; session summaries keep the totals (research R11). */
export const MAX_ATTEMPTS = 2000;
export const RECENT_MAX = 6;
export const MASTERY_WINDOW_MAX = 10;
/** Raise after this many independent outcomes in a row (amendment 17). */
export const RAISE_ROW = 3;
/** Lower when at least 2 of the last 3 counted outcomes are assisted or unsolved (amendment 17). */
const LOWER_WINDOW = 3;
const LOWER_NEEDED = 2;

export function emptySkillProgress(): SkillProgress {
  return { step: 0, recent: [], masteryWindow: [], guesses: 0, attempts: 0, independentCorrect: 0, assisted: 0 };
}

/** The progress outcome of a stored attempt. */
export function outcomeOf(a: Attempt): RecentOutcome {
  if (!a.solved) return 'unsolved';
  return a.independent ? 'independent' : 'assisted';
}

/** The independent outcomes at the end of `recent`, a stored 'close' left out. */
function rowOf(sp: SkillProgress): number {
  const counted = sp.recent.filter((o) => o !== 'close');
  let row = 0;
  while (row < counted.length && counted[counted.length - 1 - row] === 'independent') row += 1;
  return row;
}

/**
 * How many more independent answers in a row raise the step (FR-040): 1 to RAISE_ROW, or null at the highest step the
 * settings allow or with adaptive difficulty off.
 */
export function rowToRaise(sp: SkillProgress, skill: Skill, settings: Settings): number | null {
  if (!settings.adaptive || sp.step >= topStep(skill, settings)) return null;
  return Math.max(1, RAISE_ROW - rowOf(sp));
}

function nextStep(sp: SkillProgress, skill: Skill, settings: Settings): SkillProgress {
  const counted = sp.recent.filter((o) => o !== 'close');
  const struggling = counted.slice(-LOWER_WINDOW).filter((o) => o === 'assisted' || o === 'unsolved').length;
  let step = sp.step;
  if (rowOf(sp) >= RAISE_ROW) step = stepUp(skill, sp.step, settings);
  else if (struggling >= LOWER_NEEDED) step = stepDown(skill, sp.step, settings);
  return step === sp.step ? sp : { ...sp, step, recent: [] };
}

function updateSkill(sp: SkillProgress, a: Attempt, skill: Attempt['skills'][number], settings: Settings): SkillProgress {
  if (a.guess) return { ...sp, attempts: sp.attempts + 1, guesses: sp.guesses + 1 };
  const outcome = outcomeOf(a);
  const updated: SkillProgress = {
    ...sp,
    attempts: sp.attempts + 1,
    independentCorrect: sp.independentCorrect + (outcome === 'independent' ? 1 : 0),
    assisted: sp.assisted + (outcome === 'assisted' ? 1 : 0),
    recent: [...sp.recent, outcome].slice(-RECENT_MAX),
    masteryWindow: [...sp.masteryWindow, outcome].slice(-MASTERY_WINDOW_MAX),
  };
  return settings.adaptive ? nextStep(updated, skill, settings) : updated;
}

function updateSessions(sessions: SessionSummary[], a: Attempt): SessionSummary[] {
  const outcome = a.guess ? null : outcomeOf(a);
  const add = (s: SessionSummary): SessionSummary => ({
    ...s,
    lastActiveAt: Math.max(s.lastActiveAt, a.at),
    attempts: s.attempts + 1,
    independentCorrect: s.independentCorrect + (outcome === 'independent' ? 1 : 0),
    assisted: s.assisted + (outcome === 'assisted' ? 1 : 0),
  });
  const index = sessions.findIndex((s) => s.id === a.sessionId);
  if (index < 0) {
    const fresh = { id: a.sessionId, startedAt: a.at, lastActiveAt: a.at, attempts: 0, independentCorrect: 0, assisted: 0 };
    return [...sessions, add(fresh)];
  }
  return sessions.map((s, i) => (i === index ? add(s) : s));
}

export function recordAttempt(p: Progress, a: Attempt, settings: Settings): Progress {
  const skills = { ...p.skills };
  for (const skill of new Set(a.skills)) {
    const key = skillKey(skill, a.rangeKey);
    skills[key] = updateSkill(skills[key] ?? emptySkillProgress(), a, skill, settings);
  }
  return {
    ...p,
    attempts: [...p.attempts, a].slice(-MAX_ATTEMPTS),
    skills,
    sessions: updateSessions(p.sessions, a),
  };
}

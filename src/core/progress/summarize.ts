/**
 * Data for the parent progress page (FR-040, FR-087, US7 scenarios 5 and 8). Pure: reads Progress and the personal
 * bests and returns plain rows; the page only formats them.
 */
import type { Records } from '../records/records';
import type { PlayMode, RoundType, Settings } from '../settings/schema';
import type { Progress, Skill } from '../types';
import { rowToRaise } from './adaptive';
import { ladders } from './ladders';
import { skillStatus } from './mastery';

/** The order of the skills on the page: the order of FR-036. */
export const SKILL_ORDER: readonly Skill[] = ['positions', 'countForward', 'countBackward', 'tens', 'crossTens', 'addition', 'subtraction', 'comparison'];

export interface SkillRow {
  skill: Skill;
  rangeKey: string;
  attempts: number;
  independentCorrect: number;
  /** Answers given after help or misses; shown separately from accuracy. */
  withHelp: number;
  guesses: number;
  /** Index into the skill's ladder; the page shows it as `step + 1` of `stepCount`. */
  step: number;
  stepCount: number;
  /** More independent answers in a row that raise the step (amendment 17); null at the top step, with adaptive off or without settings. */
  toRaise: number | null;
  status: 'mastered' | 'developing';
}

export interface HelpRow extends SkillRow {
  /** Answers with help plus unsolved answers; guesses do not count. */
  helpNeeded: number;
}

export interface SessionRow {
  id: string;
  startedAt: number;
  attempts: number;
  independentCorrect: number;
  withHelp: number;
}

export interface BestRow {
  min: number;
  max: number;
  rulerLevelStart: number;
  roundType: RoundType;
  /** The play mode (amendment 17); a key without a mode part belongs to "Gemischt". */
  mode: PlayMode;
  enemies: number;
  ms: number;
}

export interface ProgressSummary {
  /** Per skill and range, by skill order, then by range. */
  skills: SkillRow[];
  /** The skills that needed help, most help first. */
  mostHelp: HelpRow[];
  /** Sessions with at least one attempt, newest first. */
  sessions: SessionRow[];
  /** Personal bests per range, ruler starting level and round type; a plain list, no ranking. */
  bests: BestRow[];
}

/** `min` and `max` from a range key such as `0-100` or `-20-30`, or null. */
export function parseRangeKey(rangeKey: string): { min: number; max: number } | null {
  const m = /^(-?\d+)-(-?\d+)$/.exec(rangeKey);
  return m ? { min: Number(m[1]), max: Number(m[2]) } : null;
}

const MODE_ORDER: readonly PlayMode[] = ['mixed', 'ruler', 'math'];

/** A record key `${min}-${max}|${rulerLevelStart}|${roundType}` with an optional `|ruler` or `|math` (records.ts recordKey). */
function parseRecordKey(key: string): Omit<BestRow, 'enemies' | 'ms'> | null {
  const [range, level, roundType, mode = 'mixed', ...rest] = key.split('|');
  const r = range === undefined ? null : parseRangeKey(range);
  if (!r || !/^[1-5]$/.test(level ?? '') || (roundType !== 'untilHearts' && roundType !== 'enemyCount')) return null;
  if (rest.length > 0 || (mode !== 'ruler' && mode !== 'math' && mode !== 'mixed')) return null;
  return { ...r, rulerLevelStart: Number(level), roundType, mode };
}

function compareRange(a: string, b: string): number {
  const ra = parseRangeKey(a);
  const rb = parseRangeKey(b);
  if (!ra || !rb) return a.localeCompare(b);
  return ra.min - rb.min || ra.max - rb.max;
}

function skillRows(p: Progress, settings: Settings | undefined): SkillRow[] {
  const rows: SkillRow[] = [];
  for (const [key, sp] of Object.entries(p.skills)) {
    const sep = key.indexOf('|');
    const skill = key.slice(0, sep) as Skill;
    if (!SKILL_ORDER.includes(skill)) continue;
    rows.push({
      skill,
      rangeKey: key.slice(sep + 1),
      attempts: sp.attempts,
      independentCorrect: sp.independentCorrect,
      withHelp: sp.assisted,
      guesses: sp.guesses,
      step: sp.step,
      stepCount: ladders[skill].length,
      toRaise: settings ? rowToRaise(sp, skill, settings) : null,
      status: skillStatus(sp),
    });
  }
  return rows.sort((a, b) => SKILL_ORDER.indexOf(a.skill) - SKILL_ORDER.indexOf(b.skill) || compareRange(a.rangeKey, b.rangeKey));
}

/** `settings` gives each skill row its `toRaise` (amendment 17, FR-040). */
export function summarize(p: Progress, records: Records, settings?: Settings): ProgressSummary {
  const skills = skillRows(p, settings);
  const mostHelp = skills
    .map((r) => ({ ...r, helpNeeded: Math.max(0, r.attempts - r.independentCorrect - r.guesses) }))
    .filter((r) => r.helpNeeded > 0)
    // A stable sort keeps the skill order for equal help.
    .sort((a, b) => b.helpNeeded - a.helpNeeded);
  const sessions = p.sessions
    .filter((s) => s.attempts > 0)
    .map((s) => ({ id: s.id, startedAt: s.startedAt, attempts: s.attempts, independentCorrect: s.independentCorrect, withHelp: s.assisted }))
    .reverse();
  const bests: BestRow[] = [];
  for (const [key, best] of Object.entries(records.best)) {
    const parsed = parseRecordKey(key);
    if (parsed) bests.push({ ...parsed, enemies: best.enemies, ms: best.ms });
  }
  bests.sort((a, b) => a.min - b.min || a.max - b.max || a.rulerLevelStart - b.rulerLevelStart || a.roundType.localeCompare(b.roundType) || MODE_ORDER.indexOf(a.mode) - MODE_ORDER.indexOf(b.mode));
  return { skills, mostHelp, sessions, bests };
}

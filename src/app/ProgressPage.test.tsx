/**
 * Progress page (FR-040, FR-087, US7 scenarios 4, 5 and 8): per-skill counts, "with help" apart from the independent
 * answers, the skills with the most help, sessions, personal bests per range without ranking, reset with confirmation.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryKeyValue } from '../core/storage/keyValue';
import { GARAGE_KEY, PROGRESS_KEY, RECORDS_KEY } from '../core/storage/storage';
import { emptyGarage } from '../core/rewards/garage';
import { skillKey } from '../core/progress/ladders';
import type { Records } from '../core/records/records';
import type { Progress, RecentOutcome, SkillProgress } from '../core/types';
import { t } from '../i18n';
import { createPersistence } from './persistence';
import { ProgressPage } from './ProgressPage';

const m = t();
const P = m.progressPage;

function skill(sp: Partial<SkillProgress>): SkillProgress {
  return { step: 0, recent: [], masteryWindow: [], guesses: 0, attempts: 0, independentCorrect: 0, assisted: 0, ...sp };
}

function fixture(): Progress {
  const tenIndependent: RecentOutcome[] = Array.from({ length: 10 }, () => 'independent');
  return {
    version: 1,
    attempts: [],
    skills: {
      [skillKey('positions', '0-100')]: skill({ step: 3, attempts: 14, independentCorrect: 12, assisted: 1, masteryWindow: tenIndependent }),
      // Every correct answer with help: never mastered (US7 scenario 4).
      [skillKey('addition', '0-100')]: skill({ step: 0, attempts: 11, independentCorrect: 0, assisted: 11, masteryWindow: Array(10).fill('assisted') }),
    },
    sessions: [
      { id: 'a', startedAt: new Date(2026, 10, 3, 9).getTime(), lastActiveAt: new Date(2026, 10, 3, 9, 20).getTime(), attempts: 25, independentCorrect: 12, assisted: 12 },
    ],
  };
}

function records(): Records {
  return {
    version: 1,
    best: {
      '0-100|1|untilHearts': { enemies: 12, ms: 372_000, at: 1 },
      '0-20|2|enemyCount': { enemies: 5, ms: 61_000, at: 2 },
    },
  };
}

function setup(progress: Progress = fixture(), recs: Records = records()) {
  const garage = { version: 2, balance: 23, totalEarned: 64, owned: ['rocket'], look: { ...emptyGarage().look, flag: 'rocket' } };
  const kv = memoryKeyValue({ [PROGRESS_KEY]: JSON.stringify(progress), [RECORDS_KEY]: JSON.stringify(recs), [GARAGE_KEY]: JSON.stringify(garage) });
  const persistence = createPersistence({ kv, storage: undefined });
  const onClose = vi.fn();
  render(<ProgressPage persistence={persistence} onClose={onClose} />);
  return { kv, persistence, onClose };
}

const skillRow = (name: string) => screen.getByRole('row', { name: new RegExp(`^${name}`) });
const cell = (row: HTMLElement, col: string) => row.querySelector(`[data-col="${col}"]`)!.textContent;

afterEach(() => {
  cleanup();
});

describe('ProgressPage', () => {
  it('renders the counts per skill and range from the stored progress (FR-040, US7 scenario 5)', () => {
    setup();
    expect(screen.getByRole('heading', { name: P.title })).toBeTruthy();
    const row = skillRow(P.skills.positions);
    expect(cell(row, 'range')).toBe(P.range(0, 100));
    expect(cell(row, 'attempts')).toBe('14');
    expect(cell(row, 'independent')).toBe('12');
    expect(cell(row, 'step')).toBe(P.step(4, 7));
    expect(cell(row, 'status')).toBe(P.status.mastered);
  });

  it('shows per skill how many more correct answers in a row raise its step (amendment 17, FR-040)', () => {
    const p = fixture();
    p.skills[skillKey('positions', '0-100')] = skill({ step: 3, attempts: 2, independentCorrect: 1, recent: ['independent'] });
    p.skills[skillKey('comparison', '0-100')] = skill({ step: 2, attempts: 9, independentCorrect: 9 });
    setup(p);
    expect(screen.getByRole('columnheader', { name: P.columns.toRaise })).toBeTruthy();
    expect(cell(skillRow(P.skills.positions), 'toRaise')).toBe(P.toRaise(2));
    expect(cell(skillRow(P.skills.comparison), 'toRaise')).toBe(P.topStep);
  });

  it('shows "with help" in its own column, apart from the independent correct answers', () => {
    setup();
    const table = screen.getByRole('table', { name: P.skillsTitle });
    expect(within(table).getByRole('columnheader', { name: P.columns.withHelp })).toBeTruthy();
    expect(within(table).getByRole('columnheader', { name: P.columns.independent })).toBeTruthy();
    const row = skillRow(P.skills.addition);
    expect(cell(row, 'withHelp')).toBe('11');
    expect(cell(row, 'independent')).toBe('0');
  });

  it('a skill with only assisted answers shows "noch am Üben" (US7 scenario 4)', () => {
    setup();
    expect(P.status.developing).toBe('noch am Üben');
    expect(cell(skillRow(P.skills.addition), 'status')).toBe('noch am Üben');
  });

  it('lists the skills with the most help needed, most first', () => {
    setup();
    const list = screen.getByRole('list', { name: P.mostHelpTitle });
    const items = within(list).getAllByRole('listitem').map((li) => li.textContent);
    expect(items[0]).toContain(P.skills.addition);
    expect(items[1]).toContain(P.skills.positions);
  });

  it('lists the sessions with date, attempts, independent correct and with help', () => {
    setup();
    const table = screen.getByRole('table', { name: P.sessionsTitle });
    const [, row] = within(table).getAllByRole('row');
    expect(row!.textContent).toContain('03.11.2026');
    expect(cell(row!, 'attempts')).toBe('25');
    expect(cell(row!, 'independent')).toBe('12');
    expect(cell(row!, 'withHelp')).toBe('12');
  });

  it('lists the personal bests per range with round type, starting level, enemies and time, without ranking (FR-087, US7 scenario 8)', () => {
    setup();
    const table = screen.getByRole('table', { name: P.bestsTitle });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    // Ordered by range, not by result.
    expect(cell(rows[0]!, 'range')).toBe(P.range(0, 20));
    expect(cell(rows[0]!, 'roundType')).toBe(m.settings.labels.roundTypeEnemyCount);
    expect(cell(rows[0]!, 'level')).toBe(P.level(2));
    expect(cell(rows[0]!, 'enemies')).toBe('5');
    expect(cell(rows[0]!, 'time')).toBe('1:01');
    expect(cell(rows[1]!, 'range')).toBe(P.range(0, 100));
    expect(cell(rows[1]!, 'roundType')).toBe(m.settings.labels.roundTypeUntilHearts);
    expect(cell(rows[1]!, 'level')).toBe(P.level(1));
    expect(cell(rows[1]!, 'enemies')).toBe('12');
    expect(cell(rows[1]!, 'time')).toBe('6:12');
    expect(cell(rows[1]!, 'mode')).toBe(m.start.modes.mixed);
    const text = table.textContent ?? '';
    for (const word of ['Platz', 'Rang', 'besser', 'schlechter', '1.']) expect(text).not.toContain(word);
  });

  it('reset asks for confirmation; "Abbrechen" keeps the progress, "Ja" clears it and keeps the records', () => {
    const { persistence, kv } = setup();
    fireEvent.click(screen.getByRole('button', { name: P.reset }));
    expect(screen.getByText(P.resetConfirm)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: P.resetNo }));
    expect(persistence.progress().skills[skillKey('addition', '0-100')]).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: P.reset }));
    fireEvent.click(screen.getByRole('button', { name: P.resetYes }));
    expect(persistence.progress()).toEqual({ version: 1, attempts: [], skills: {}, sessions: [] });
    expect(JSON.parse(kv.get(PROGRESS_KEY)!)).toMatchObject({ attempts: [], skills: {}, sessions: [] });
    expect(Object.keys(persistence.records().best)).toHaveLength(2);
    expect(screen.getByText(P.empty)).toBeTruthy();
    expect(screen.getByText(P.resetDone)).toBeTruthy();
  });

  it('shows a note when nothing was played yet and when there are no records', () => {
    setup({ version: 1, attempts: [], skills: {}, sessions: [] }, { version: 1, best: {} });
    expect(screen.getByText(P.empty)).toBeTruthy();
    expect(screen.getByText(P.noBests)).toBeTruthy();
  });

  it('"Schließen" calls onClose', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: m.parent.close }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ProgressPage stars (amendments 11 and 19, FR-040, FR-096, FR-132)', () => {
  it('"Fortschritt zurücksetzen" keeps the stars and the chosen look', () => {
    const { persistence } = setup();
    fireEvent.click(screen.getByRole('button', { name: P.reset }));
    fireEvent.click(screen.getByRole('button', { name: P.resetYes }));
    expect(persistence.garage().balance).toBe(23);
    expect(persistence.garage().owned).toEqual(['rocket']);
    expect(persistence.garage().look.flag).toBe('rocket');
  });

  it('shows the balance and the total ever earned; "Sterne zurücksetzen" asks first, then sets balance 0 and the basic look and keeps the total', () => {
    const { persistence } = setup();
    expect(screen.getByTestId('progress-stars').textContent).toBe(P.stars(23));
    expect(screen.getByTestId('progress-stars-total').textContent).toBe(P.starsTotal(64));
    fireEvent.click(screen.getByRole('button', { name: P.starsReset }));
    expect(screen.getByText(P.starsResetConfirm)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: P.resetNo }));
    expect(persistence.garage().balance).toBe(23);
    fireEvent.click(screen.getByRole('button', { name: P.starsReset }));
    fireEvent.click(screen.getByRole('button', { name: P.starsResetYes }));
    expect(persistence.garage()).toEqual({ ...emptyGarage(), totalEarned: 64 });
    expect(screen.getByTestId('progress-stars').textContent).toBe(P.stars(0));
    expect(screen.getByTestId('progress-stars-total').textContent).toBe(P.starsTotal(64));
    expect(screen.getByText(P.starsResetDone)).toBeTruthy();
    // The learning progress stays.
    expect(persistence.progress().sessions).toHaveLength(1);
  });
});


/**
 * Amendment 06 (FR-083 to FR-086): the end screen shows the destroyed enemies and the time played, an encouraging
 * message, and either "Neuer Rekord!" or the record in small neutral form; nothing compares the two numbers.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { forbiddenWords, t } from '../i18n';
import { RoundEnd } from './RoundEnd';
import { itemById } from '../core/rewards/items';

const m = t();

function show(over: Partial<ComponentProps<typeof RoundEnd>> = {}) {
  const props: ComponentProps<typeof RoundEnd> = {
    outcome: 'heartsGone',
    enemiesDestroyed: 9,
    elapsedMs: 372_000,
    record: null,
    onAgain: vi.fn(),
    onBackToStart: vi.fn(),
    ...over,
  };
  const view = render(<RoundEnd {...props} />);
  return { props, view, root: screen.getByTestId('round-end') };
}

afterEach(cleanup);

describe('RoundEnd (amendment 06)', () => {
  it('shows the encouraging message and "9 Panzer getroffen in 6:12" when the hearts are gone', () => {
    const { root } = show();
    expect(root.textContent).toContain('Gut gekämpft! Noch eine Runde?');
    expect(screen.getByTestId('round-result').textContent).toBe('9 Panzer getroffen in 6:12');
  });

  it('shows "Super! Alle Gegner getroffen." when the parent\'s number of enemies is reached', () => {
    const { root } = show({ outcome: 'goalReached', enemiesDestroyed: 1, elapsedMs: 42_000 });
    expect(root.textContent).toContain('Super! Alle Gegner getroffen.');
    expect(screen.getByTestId('round-result').textContent).toBe('1 Panzer getroffen in 0:42');
  });

  it('celebrates a new record with "Neuer Rekord!"', () => {
    show({ record: { newRecord: true, best: { enemies: 9, ms: 372_000, at: 1 } } });
    expect(screen.getByTestId('new-record').textContent).toBe('Neuer Rekord!');
    expect(screen.queryByTestId('record')).toBeNull();
  });

  it('otherwise shows the record small and neutral, with no comparison wording', () => {
    const { view, root } = show({ enemiesDestroyed: 4, record: { newRecord: false, best: { enemies: 12, ms: 500_000, at: 1 } } });
    const record = screen.getByTestId('record');
    expect(record.textContent).toBe('Dein Rekord: 12');
    expect(record.classList.contains('record')).toBe(true);
    expect(view.container.querySelector('.new-record')).toBeNull();
    for (const word of ['nicht geschafft', 'mehr', 'weniger', 'besser', 'schlechter', 'nur ']) expect(root.textContent?.toLowerCase()).not.toContain(word);
  });

  it('shows neither when there is no record yet or "Rekord zeigen" is off (record null)', () => {
    show({ enemiesDestroyed: 0, record: { newRecord: false, best: null } });
    expect(screen.queryByTestId('record')).toBeNull();
    expect(screen.queryByTestId('new-record')).toBeNull();
    cleanup();
    show({ record: null });
    expect(screen.queryByTestId('record')).toBeNull();
    expect(screen.queryByTestId('new-record')).toBeNull();
  });

  it('contains no forbidden word and never says "nicht geschafft" in any variant', () => {
    const variants: Array<Partial<ComponentProps<typeof RoundEnd>>> = [
      { outcome: 'heartsGone', enemiesDestroyed: 0, record: { newRecord: false, best: null } },
      { outcome: 'heartsGone', enemiesDestroyed: 3, record: { newRecord: false, best: { enemies: 7, ms: 1, at: 1 } } },
      { outcome: 'goalReached', enemiesDestroyed: 5, record: { newRecord: true, best: { enemies: 5, ms: 1, at: 1 } } },
    ];
    for (const v of variants) {
      const { root } = show(v);
      const text = (root.textContent ?? '').toLowerCase();
      for (const word of forbiddenWords) expect(text).not.toContain(word.toLowerCase());
      expect(text).not.toContain('nicht geschafft');
      expect(text).not.toContain('verloren');
      cleanup();
    }
  });

  it('"Nochmal" and "Zum Start" call their handlers', () => {
    const { props } = show();
    fireEvent.click(screen.getByRole('button', { name: m.roundEnd.again }));
    fireEvent.click(screen.getByRole('button', { name: m.roundEnd.backToStart }));
    expect(props.onAgain).toHaveBeenCalledOnce();
    expect(props.onBackToStart).toHaveBeenCalledOnce();
  });
});

describe('RoundEnd stars of the round, balance and one affordable item (amendments 11 and 19, FR-094, FR-095)', () => {
  it('shows the stars of the round and the balance', () => {
    show({ garage: { earned: 3, balance: 17, affordable: null } });
    expect(screen.getByTestId('round-stars').textContent).toBe('+3 Sterne');
    expect(screen.getByTestId('star-total').textContent).toContain('17');
    expect(screen.queryByTestId('affordable')).toBeNull();
  });

  it('says "+1 Stern" for one star and "+0 Sterne" for none', () => {
    show({ garage: { earned: 1, balance: 1, affordable: null } });
    expect(screen.getByTestId('round-stars').textContent).toBe('+1 Stern');
    cleanup();
    show({ garage: { earned: 0, balance: 5, affordable: null } });
    expect(screen.getByTestId('round-stars').textContent).toBe('+0 Sterne');
  });

  it('names one item the balance now reaches: "Genug Sterne für: Krone"', () => {
    const { root } = show({ garage: { earned: 4, balance: 41, affordable: itemById('crown')! } });
    expect(screen.getAllByTestId('affordable')).toHaveLength(1);
    expect(screen.getByTestId('affordable').textContent).toBe('Genug Sterne für: Krone');
    expect(root.textContent).not.toMatch(/noch \d+ Stern/i);
    expect(root.textContent).not.toMatch(/freigeschaltet/i);
  });

  it('shows no star lines without garage data (garage off)', () => {
    show({ garage: null });
    expect(screen.queryByTestId('round-stars')).toBeNull();
    expect(screen.queryByTestId('affordable')).toBeNull();
    expect(screen.queryByTestId('star-total')).toBeNull();
  });
});

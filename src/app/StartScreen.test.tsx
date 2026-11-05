/**
 * Start screen (T070, FR-014, FR-062): "Spielen" starts guided mode; "Freies Spiel" appears only when the parent
 * allows free play. Enter or Space start guided mode, or free play with `?mode=free` when free play is allowed.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '../i18n';
import { keyStartMode, StartScreen } from './StartScreen';

afterEach(cleanup);

describe('StartScreen (T070)', () => {
  it('"Spielen" starts guided mode and there is no "Freies Spiel" without the parent setting', () => {
    const onPlay = vi.fn();
    render(<StartScreen onPlay={onPlay} freePlay={false} />);
    fireEvent.click(screen.getByRole('button', { name: t().start.play }));
    expect(onPlay).toHaveBeenCalledWith('guided');
    expect(screen.queryByRole('button', { name: t().start.freePlay })).toBeNull();
  });

  it('"Freies Spiel" appears next to "Spielen" when free play is allowed and starts free play', () => {
    const onPlay = vi.fn();
    render(<StartScreen onPlay={onPlay} freePlay={true} />);
    fireEvent.click(screen.getByRole('button', { name: t().start.freePlay }));
    expect(onPlay).toHaveBeenCalledWith('freePlay');
  });

  it('Enter starts guided mode, or free play with ?mode=free when free play is allowed', () => {
    expect(keyStartMode('', true)).toBe('guided');
    expect(keyStartMode('?seed=3', true)).toBe('guided');
    expect(keyStartMode('?seed=3&mode=free', true)).toBe('freePlay');
    expect(keyStartMode('?mode=free', false)).toBe('guided');
    expect(keyStartMode('?mode=other', true)).toBe('guided');
  });
});

describe('StartScreen garage button and star total (amendment 11, FR-091, FR-095, FR-096)', () => {
  it('shows a "Garage" button and the star total when the garage is on', () => {
    const onGarage = vi.fn();
    render(<StartScreen onPlay={vi.fn()} freePlay={false} garage={{ stars: 12 }} onGarage={onGarage} />);
    expect(screen.getByTestId('star-total').textContent).toContain('12');
    fireEvent.click(screen.getByRole('button', { name: t().start.garage }));
    expect(onGarage).toHaveBeenCalledTimes(1);
  });

  it('shows neither without garage data (the parent turned the garage off)', () => {
    render(<StartScreen onPlay={vi.fn()} freePlay={false} garage={null} onGarage={vi.fn()} />);
    expect(screen.queryByRole('button', { name: t().start.garage })).toBeNull();
    expect(screen.queryByTestId('star-total')).toBeNull();
  });
});


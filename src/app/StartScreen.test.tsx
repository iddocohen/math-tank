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


describe('StartScreen fullscreen button (amendment 12, FR-106)', () => {
  const original = Object.getOwnPropertyDescriptor(Document.prototype, 'fullscreenEnabled');
  function setFullscreenEnabled(value: boolean | undefined): void {
    Object.defineProperty(document, 'fullscreenEnabled', { value, configurable: true });
  }
  afterEach(() => {
    delete (document as unknown as Record<string, unknown>).fullscreenEnabled;
    if (original) Object.defineProperty(Document.prototype, 'fullscreenEnabled', original);
  });

  it('shows the fullscreen button where the browser allows fullscreen', () => {
    setFullscreenEnabled(true);
    render(<StartScreen onPlay={vi.fn()} freePlay={false} />);
    expect(screen.getByRole('button', { name: t().start.fullscreen })).toBeTruthy();
  });

  it('hides it where fullscreen is not available, as on iPhone', () => {
    setFullscreenEnabled(false);
    render(<StartScreen onPlay={vi.fn()} freePlay={false} />);
    expect(screen.queryByRole('button', { name: t().start.fullscreen })).toBeNull();
    cleanup();
    setFullscreenEnabled(undefined);
    render(<StartScreen onPlay={vi.fn()} freePlay={false} />);
    expect(screen.queryByRole('button', { name: t().start.fullscreen })).toBeNull();
  });

  it('shows a small parent hint when saving failed, and none otherwise (review H1)', () => {
    render(<StartScreen onPlay={vi.fn()} freePlay={false} saveFailed={true} />);
    const hint = screen.getByTestId('save-failed-hint');
    expect(hint.textContent).toBe(t().start.saveFailed);
    // The hint does not block the game: "Spielen" still works.
    expect(screen.getByRole('button', { name: t().start.play })).toBeTruthy();
    cleanup();
    render(<StartScreen onPlay={vi.fn()} freePlay={false} />);
    expect(screen.queryByTestId('save-failed-hint')).toBeNull();
  });
});

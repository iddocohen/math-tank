/**
 * Start screen (T070, FR-121, amendment 17): one big picture button per offered play mode, or one "Spielen" button when
 * only one mode is offered. Enter or Space start the first offered mode, or the mode of `?mode=` when it is offered.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '../i18n';
import { keyStartMode, StartScreen } from './StartScreen';
import type { PlayMode } from '../core/types';

afterEach(cleanup);

const ALL: PlayMode[] = ['mixed', 'ruler', 'math'];

describe('StartScreen play modes (T070, amendment 17, FR-121)', () => {
  it('shows one picture button per offered mode, in the order mixed, ruler, math, each starting its mode', () => {
    const onPlay = vi.fn();
    render(<StartScreen onPlay={onPlay} modes={ALL} />);
    const buttons = screen.getAllByTestId('mode-button');
    expect(buttons.map((b) => b.dataset.mode)).toEqual(['mixed', 'ruler', 'math']);
    for (const mode of ALL) {
      const button = screen.getByRole('button', { name: new RegExp(t().start.modes[mode]) });
      expect(button.querySelector('svg')).toBeTruthy();
      expect(button.getAttribute('aria-keyshortcuts')).toBe(String(ALL.indexOf(mode) + 1));
      fireEvent.click(button);
      expect(onPlay).toHaveBeenLastCalledWith(mode);
    }
    expect(screen.queryByRole('button', { name: t().start.play })).toBeNull();
  });

  it('shows only the offered modes, with the key of each mode', () => {
    render(<StartScreen onPlay={vi.fn()} modes={['ruler', 'math']} />);
    expect(screen.getAllByTestId('mode-button').map((b) => [b.dataset.mode, b.getAttribute('aria-keyshortcuts')])).toEqual([
      ['ruler', '2'],
      ['math', '3'],
    ]);
  });

  it('with one offered mode shows a single "Spielen" button that starts it', () => {
    const onPlay = vi.fn();
    render(<StartScreen onPlay={onPlay} modes={['math']} />);
    expect(screen.queryAllByTestId('mode-button')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: t().start.play }));
    expect(onPlay).toHaveBeenCalledWith('math');
  });

  it('Enter and Space start the first offered mode, or the offered mode of ?mode=', () => {
    expect(keyStartMode('', ALL)).toBe('mixed');
    expect(keyStartMode('', ['ruler', 'math'])).toBe('ruler');
    expect(keyStartMode('?seed=3&mode=math', ALL)).toBe('math');
    expect(keyStartMode('?mode=ruler', ['mixed', 'math'])).toBe('mixed');
    expect(keyStartMode('?mode=free', ALL)).toBe('mixed');
  });
});

describe('StartScreen garage button and star total (amendment 11, FR-091, FR-095, FR-096)', () => {
  it('shows a "Garage" button and the star total when the garage is on', () => {
    const onGarage = vi.fn();
    render(<StartScreen onPlay={vi.fn()} modes={ALL} garage={{ balance: 12 }} onGarage={onGarage} />);
    expect(screen.getByTestId('star-total').textContent).toContain('12');
    fireEvent.click(screen.getByRole('button', { name: t().start.garage }));
    expect(onGarage).toHaveBeenCalledTimes(1);
  });

  it('shows neither without garage data (the parent turned the garage off)', () => {
    render(<StartScreen onPlay={vi.fn()} modes={ALL} garage={null} onGarage={vi.fn()} />);
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
    render(<StartScreen onPlay={vi.fn()} modes={ALL} />);
    expect(screen.getByRole('button', { name: t().start.fullscreen })).toBeTruthy();
  });

  it('hides it where fullscreen is not available, as on iPhone', () => {
    setFullscreenEnabled(false);
    render(<StartScreen onPlay={vi.fn()} modes={ALL} />);
    expect(screen.queryByRole('button', { name: t().start.fullscreen })).toBeNull();
    cleanup();
    setFullscreenEnabled(undefined);
    render(<StartScreen onPlay={vi.fn()} modes={ALL} />);
    expect(screen.queryByRole('button', { name: t().start.fullscreen })).toBeNull();
  });

  it('shows a small parent hint when saving failed, and none otherwise (review H1)', () => {
    render(<StartScreen onPlay={vi.fn()} modes={['mixed']} saveFailed={true} />);
    const hint = screen.getByTestId('save-failed-hint');
    expect(hint.textContent).toBe(t().start.saveFailed);
    // The hint does not block the game: "Spielen" still works.
    expect(screen.getByRole('button', { name: t().start.play })).toBeTruthy();
    cleanup();
    render(<StartScreen onPlay={vi.fn()} modes={ALL} />);
    expect(screen.queryByTestId('save-failed-hint')).toBeNull();
  });
});

/**
 * Amendment 05 (FR-019, FR-053, FR-076, FR-078): no −1 and +1 buttons, no health bars or labels in the corners,
 * no number in the readout while pointing, and the fire button counts as pointer input.
 * Amendment 06 (FR-066, FR-072, FR-083, FR-084): the tank counter, the optional clock, the hit and near-miss status,
 * and the data attributes for the end-to-end tests.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BattleController } from '../core/battle/controller';
import { memoryProgressStore } from '../core/battle/ports';
import { defaultSettings } from '../core/settings/defaults';
import type { Settings } from '../core/settings/schema';
import { t } from '../i18n';
import { BattleOverlay } from './BattleOverlay';
import { useRoundState } from './useController';

function Overlay({ controller }: { controller: BattleController }) {
  const state = useRoundState(controller);
  return <BattleOverlay controller={controller} state={state} />;
}

function setup(over: Partial<Settings> = {}) {
  let now = 1000;
  const controller = new BattleController({ settings: { ...defaultSettings(), freePlay: true, ...over }, progress: memoryProgressStore(), clock: () => now, seed: 7 });
  controller.startRound('freePlay');
  const view = render(<Overlay controller={controller} />);
  return { controller, view, advance: (ms: number) => (now += ms) };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('BattleOverlay (amendment 05)', () => {
  it('has no −1 or +1 buttons', () => {
    setup();
    for (const name of ['+1', '−1', '-1', 'Eins mehr', 'Eins weniger']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
      expect(screen.queryByText(name)).toBeNull();
    }
  });

  it('has no health bars or health labels in the corners', () => {
    const { view } = setup();
    expect(view.container.querySelector('.top-bars')).toBeNull();
    expect(view.container.querySelector('.health-label')).toBeNull();
    expect(screen.queryByText('Dein Panzer')).toBeNull();
    expect(screen.queryByText('Gegner')).toBeNull();
    // The test hooks (tasks.md D4): hearts and score instead of health (amendment 06).
    const root = screen.getByTestId('battle-overlay');
    expect(root.getAttribute('data-lives')).toBe('3');
    expect(root.getAttribute('data-enemies-destroyed')).toBe('0');
    expect(root.hasAttribute('data-player-health')).toBe(false);
    expect(root.hasAttribute('data-enemy-health')).toBe(false);
  });

  it('shows no number while pointing, and typed digits as typed', () => {
    const { controller } = setup();
    const n = 87;
    act(() => controller.selectNumber(n));
    expect(screen.getByTestId('battle-overlay').getAttribute('data-selection')).toBe(String(n));
    expect(screen.getByTestId('readout').textContent).toBe('?');
    expect(screen.getByTestId('battle-overlay').textContent).not.toContain(String(n));

    act(() => {
      controller.typeDigit(4);
      controller.typeDigit(2);
    });
    expect(screen.getByTestId('readout').textContent).toBe('42');
  });

  it('the fire button fires and records pointer input (FR-076)', () => {
    const { controller } = setup();
    act(() => {
      controller.typeDigit(4);
      controller.typeDigit(2);
    });
    fireEvent.click(screen.getByRole('button', { name: t().battle.fire }));
    expect(controller.getState().phase).toBe('playerShot');
    expect(controller.getState().inputMethod).toBe('pointer');
  });
});

describe('BattleOverlay (amendment 06)', () => {
  it('shows a tank counter with the number of destroyed enemies and no text', () => {
    const { controller } = setup();
    const score = screen.getByTestId('score');
    expect(score.textContent).toBe('0');
    expect(score.querySelector('svg')).not.toBeNull();
    act(() => {
      controller.fireAt(controller.getState().enemy.position);
      controller.shotAnimationDone();
    });
    expect(screen.getByTestId('score').textContent).toBe('1');
    expect(screen.getByTestId('battle-overlay').getAttribute('data-enemies-destroyed')).toBe('1');
  });

  it('after a hit shows "Getroffen!" with the number the enemy stood at, and data-last-shot hit', () => {
    const { controller } = setup();
    const n = controller.getState().enemy.position;
    act(() => {
      controller.fireAt(n);
      controller.shotAnimationDone();
    });
    expect(screen.getByTestId('hit-feedback').textContent).toBe(`${t().battle.hit} ${t().battle.enemyStoodAt(n)}`);
    expect(screen.getByTestId('battle-overlay').getAttribute('data-last-shot')).toBe('hit');
  });

  it('after a near miss shows "Ganz knapp! Triff die Linie." with both numbers, and data-last-shot near', () => {
    const { controller } = setup();
    const e = controller.getState().enemy.position;
    const near = e + (e < 100 ? 1 : -1);
    act(() => {
      controller.fireAt(near);
      controller.shotAnimationDone();
    });
    expect(screen.getByTestId('hit-feedback').textContent).toContain('Ganz knapp! Triff die Linie.');
    expect(screen.getByTestId('compare').textContent).toBe(t().battle.compare(near, e));
    expect(screen.getByTestId('battle-overlay').getAttribute('data-last-shot')).toBe('near');
  });

  it('a plain miss sets data-last-shot miss and shows the landing number', () => {
    const { controller } = setup();
    const p = controller.getState().player.position;
    act(() => {
      controller.fireAt(p);
      controller.shotAnimationDone();
    });
    expect(screen.getByTestId('battle-overlay').getAttribute('data-last-shot')).toBe('miss');
    expect(screen.queryByTestId('hit-feedback')).toBeNull();
    expect(screen.getByTestId('battle-overlay').textContent).toContain(t().battle.landedAt(p));
  });

  it('shows no clock by default', () => {
    setup();
    expect(screen.queryByTestId('clock')).toBeNull();
  });

  it('with showClock shows an up-counting clock m:ss that stops while paused', () => {
    vi.useFakeTimers();
    const { controller, advance } = setup({ showClock: true });
    expect(screen.getByTestId('clock').textContent).toBe('0:00');
    advance(65_000);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('clock').textContent).toBe('1:05');
    act(() => controller.pause());
    advance(30_000);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('clock').textContent).toBe('1:05');
  });
});

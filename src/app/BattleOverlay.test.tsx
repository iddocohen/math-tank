/**
 * Amendment 05 (FR-019, FR-053, FR-076, FR-078): no −1 and +1 buttons, no health bars or labels in the corners,
 * no number in the readout while pointing, and the fire button counts as pointer input.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BattleController } from '../core/battle/controller';
import { memoryProgressStore } from '../core/battle/ports';
import { defaultSettings } from '../core/settings/defaults';
import { t } from '../i18n';
import { BattleOverlay } from './BattleOverlay';
import { useRoundState } from './useController';

function Overlay({ controller }: { controller: BattleController }) {
  const state = useRoundState(controller);
  return <BattleOverlay controller={controller} state={state} />;
}

function setup() {
  const controller = new BattleController({ settings: { ...defaultSettings(), freePlay: true }, progress: memoryProgressStore(), clock: () => 1000, seed: 7 });
  controller.startRound('freePlay');
  const view = render(<Overlay controller={controller} />);
  return { controller, view };
}

afterEach(cleanup);

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
    // The test hooks stay (tasks.md D4).
    expect(screen.getByTestId('battle-overlay').getAttribute('data-player-health')).toBe('100');
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

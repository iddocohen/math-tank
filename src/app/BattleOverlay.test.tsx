/**
 * Amendment 05 (FR-019, FR-053, FR-076, FR-078): no −1 and +1 buttons, no health bars or labels in the corners,
 * no number in the readout while pointing, and the fire button counts as pointer input.
 * Amendment 06 (FR-066, FR-072, FR-083, FR-084): the tank counter, the optional clock, the hit and near-miss status,
 * and the data attributes for the end-to-end tests.
 * Amendment 07 (FR-010, FR-072, FR-073): the enemy is visible in a guided search, and every miss carries the step count.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BattleController } from '../core/battle/controller';
import { memoryProgressStore } from '../core/battle/ports';
import type { RoundState, TankState } from '../core/types';
import { defaultSettings } from '../core/settings/defaults';
import type { Settings } from '../core/settings/schema';
import { encouragements, promptText, t } from '../i18n';
import { BattleOverlay } from './BattleOverlay';
import { useRoundState } from './useController';

/** The enemy with its number; it is always visible (amendment 07). */
function enemyOf(s: RoundState): TankState {
  return s.enemy;
}

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
      controller.fireAt(enemyOf(controller.getState()).position);
      controller.shotAnimationDone();
    });
    expect(screen.getByTestId('score').textContent).toBe('1');
    expect(screen.getByTestId('battle-overlay').getAttribute('data-enemies-destroyed')).toBe('1');
  });

  it('after a hit shows "Getroffen!" with the number the enemy stood at, and data-last-shot hit', () => {
    const { controller } = setup();
    const n = enemyOf(controller.getState()).position;
    act(() => {
      controller.fireAt(n);
      controller.shotAnimationDone();
    });
    expect(screen.getByTestId('hit-feedback').textContent).toBe(`${t().battle.hit} ${t().battle.enemyStoodAt(n)}`);
    expect(screen.getByTestId('battle-overlay').getAttribute('data-last-shot')).toBe('hit');
  });

  it('after a near miss shows "Ganz knapp! Triff die Linie." with both numbers, and data-last-shot near', () => {
    const { controller } = setup();
    const e = enemyOf(controller.getState()).position;
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

/** A guided round whose first search is a position search (not readPosition). */
function setupGuided(over: Partial<Settings> = {}) {
  for (let seed = 1; seed < 200; seed++) {
    let now = 1000;
    const controller = new BattleController({ settings: { ...defaultSettings(), noDamage: true, ...over }, progress: memoryProgressStore(), clock: () => now, seed });
    controller.startRound('guided');
    if (controller.getState().challenge?.kind === 'readPosition') continue;
    const view = render(<Overlay controller={controller} />);
    return { controller, view, advance: (ms: number) => (now += ms) };
  }
  throw new Error('no seed found');
}

describe('BattleOverlay in a guided search (T068, amendment 07)', () => {
  it('shows the challenge banner at the top with the prompt text', () => {
    const { controller } = setupGuided();
    const banner = screen.getByTestId('challenge-banner');
    expect(banner.textContent).toBe(promptText(controller.getState().challenge!.prompt));
    expect(banner.textContent).not.toBe('');
  });

  it('data-challenge-answerable turns true 1 second after the challenge appears; data-help-level follows the help step', () => {
    vi.useFakeTimers();
    const { controller, advance } = setupGuided();
    const root = screen.getByTestId('battle-overlay');
    expect(root.getAttribute('data-challenge-answerable')).toBe('false');
    expect(root.getAttribute('data-help-level')).toBe('0');
    advance(1000);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(root.getAttribute('data-challenge-answerable')).toBe('true');
    const s = controller.getState();
    act(() => {
      controller.fireAt(Math.round((s.player.position + s.challenge!.answer) / 2));
      controller.shotAnimationDone();
    });
    expect(root.getAttribute('data-help-level')).toBe('1');
  });

  it('after a miss shows the landing number and an encouraging phrase, with the enemy number and the step count in the data attributes', () => {
    const { controller, advance } = setupGuided();
    const s = controller.getState();
    const miss = Math.round((s.player.position + s.challenge!.answer) / 2);
    advance(1000);
    act(() => {
      controller.fireAt(miss);
      controller.shotAnimationDone();
    });
    const root = screen.getByTestId('battle-overlay');
    expect(root.textContent).toContain(t().battle.landedAt(miss));
    expect(encouragements).toContain(screen.getByTestId('encouragement').textContent);
    expect(root.getAttribute('data-enemy-number')).toBe(String(s.challenge!.answer));
    expect(root.getAttribute('data-last-distance')).toBe(String(Math.abs(miss - s.challenge!.answer)));
    expect(root.hasAttribute('data-shots-since-enemy-fire')).toBe(false);
  });

  it('sets data-enemy-number from the start of the search: the enemy is visible (amendment 07, FR-010)', () => {
    const { controller } = setupGuided();
    expect(screen.getByTestId('battle-overlay').getAttribute('data-enemy-number')).toBe(String(controller.getState().challenge!.answer));
  });

  it('a near miss in a guided search shows "Ganz knapp! Triff die Linie." with both numbers and the step count (amendment 07, FR-072)', () => {
    const { controller, advance } = setupGuided();
    const s = controller.getState();
    const answer = s.challenge!.answer;
    const near = answer + Math.sign(s.player.position - answer);
    advance(1000);
    act(() => {
      controller.fireAt(near);
      controller.shotAnimationDone();
    });
    const root = screen.getByTestId('battle-overlay');
    expect(root.getAttribute('data-last-shot')).toBe('near');
    expect(screen.getByTestId('hit-feedback').textContent).toContain(t().battle.near);
    expect(screen.getByTestId('compare').textContent).toBe(t().battle.compare(near, answer));
    expect(t().battle).not.toHaveProperty('nearHidden');
  });
});

describe('BattleOverlay comparison (US4, T091)', () => {
  const onlyComparison = { challengeTypes: { numberLine: false, addition: false, subtraction: false, comparison: true } };

  /** A guided round whose first search matches `accept`, rendered. */
  function guided(accept: (s: RoundState) => boolean) {
    for (let seed = 1; seed < 400; seed++) {
      let now = 1000;
      const controller = new BattleController({ settings: { ...defaultSettings(), ...onlyComparison }, progress: memoryProgressStore(), clock: () => now, seed });
      controller.startRound('guided');
      if (!accept(controller.getState())) continue;
      render(<Overlay controller={controller} />);
      return { controller, advance: (ms: number) => (now += ms) };
    }
    throw new Error('no seed found');
  }

  it('the banner names every option as its own element, in banner order (amendment 09, FR-026)', () => {
    const { controller } = guided((s) => s.challenge?.kind === 'greater');
    const c = controller.getState().challenge!;
    expect(screen.getByTestId('challenge-banner').textContent).toBe(promptText(c.prompt));
    expect(screen.getAllByTestId('banner-option').map((e) => Number(e.textContent))).toEqual(c.options);
    expect(screen.queryByTestId('reference-number')).toBeNull();
    expect(screen.queryByTestId('not-on-tank')).toBeNull();
    expect(screen.queryAllByTestId('tens-digit')).toHaveLength(0);
  });

  it('help step 1 marks the tens digit of every option in the banner (FR-031)', () => {
    const { controller } = guided((s) => s.challenge?.kind === 'largest3' && s.challenge.options!.every((o) => o >= 10));
    const options = controller.getState().challenge!.options!;
    act(() => controller.requestHelp());
    expect(controller.getState().help.content).toMatchObject({ step: 1, tensDigits: true });
    const tens = screen.getAllByTestId('tens-digit').map((e) => e.textContent);
    expect(tens).toEqual(options.map((o) => String(Math.floor(o / 10) % 10)));
    // The banner text stays the same.
    expect(screen.getByTestId('challenge-banner').textContent).toBe(promptText(controller.getState().challenge!.prompt));
    act(() => controller.requestHelp());
    expect(screen.queryAllByTestId('tens-digit')).toHaveLength(0);
  });

  it('a one-digit option has no tens digit to mark', () => {
    const { controller } = guided((s) => s.challenge?.options?.some((o) => o < 10) === true);
    const options = controller.getState().challenge!.options!;
    act(() => controller.requestHelp());
    if (controller.getState().help.content?.tensDigits) {
      expect(screen.queryAllByTestId('tens-digit')).toHaveLength(options.filter((o) => o >= 10).length);
    }
  });
});

describe('BattleOverlay help (US5, T101, FR-030, FR-031, FR-034)', () => {
  const onlyNumberLine = { challengeTypes: { numberLine: true, addition: false, subtraction: false, comparison: false } };

  it('shows a help button during a guided challenge; a tap shows the next help step and its text, and it never takes focus', () => {
    const { controller } = setupGuided(onlyNumberLine);
    const button = screen.getByTestId('help-button');
    expect(button.getAttribute('aria-label')).toBe(t().battle.help);
    expect(button.getAttribute('tabindex')).toBe('-1');
    expect(screen.queryByTestId('help-text')).toBeNull();
    act(() => fireEvent.click(button));
    expect(controller.getState().help.level).toBe(1);
    expect(screen.getByTestId('battle-overlay').getAttribute('data-help-level')).toBe('1');
    expect(screen.getByTestId('help-text').textContent).not.toBe('');
  });

  it('has no help button in free play', () => {
    setup();
    expect(screen.queryByTestId('help-button')).toBeNull();
  });

  it('at the solution step the fire button reads "Feuer auf N" and the help button is disabled', () => {
    const { controller } = setupGuided(onlyNumberLine);
    act(() => {
      controller.requestHelp();
      controller.requestHelp();
      controller.requestHelp();
    });
    const answer = controller.getState().challenge!.answer;
    expect(screen.getByRole('button', { name: t().battle.fireAt(answer) })).toBeTruthy();
    expect(screen.getByTestId('help-text').textContent).toBe(t().helpSteps.solution(answer));
    expect((screen.getByTestId('help-button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the encouraging phrase from the state message after a miss', () => {
    const { controller, advance } = setupGuided(onlyNumberLine);
    const s = controller.getState();
    advance(1000);
    act(() => {
      controller.fireAt(s.challenge!.answer > 50 ? s.challenge!.answer - 20 : s.challenge!.answer + 20);
      controller.shotAnimationDone();
    });
    const message = controller.getState().message;
    expect(message?.key).toBe('encouragement');
    expect(screen.getByTestId('encouragement').textContent).toBe(encouragements[(message as { index: number }).index % encouragements.length]);
  });

  it('without a time limit shows no time indicator', () => {
    setupGuided(onlyNumberLine);
    expect(screen.queryByTestId('help-timer')).toBeNull();
  });

  it('with a time limit shows the indicator and ticks the controller once a second, so the next help step comes', () => {
    vi.useFakeTimers();
    const { controller, advance } = setupGuided({ ...onlyNumberLine, timeLimitSeconds: 5 });
    expect(screen.getByTestId('help-timer')).toBeTruthy();
    expect(controller.getState().help.level).toBe(0);
    for (let i = 0; i < 6; i++) {
      advance(1000);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }
    expect(controller.getState().help.level).toBe(1);
    expect(screen.getByTestId('battle-overlay').getAttribute('data-help-level')).toBe('1');
  });
});

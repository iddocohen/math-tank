/**
 * Amendment 23: the garage opens from the battle. With the garage on, a garage icon beside the gear opens the garage
 * over the battle with one tap; the battle stays loaded. A running round pauses while the garage is open and continues
 * when the child closes it; a round the child paused stays paused. While the garage is open, the battle's keys do
 * nothing and the garage's keys work. A look equipped in the garage reaches the battle scene (`setLook`) at once.
 *
 * The Phaser game is replaced by a stand-in (createGame), and sound by a silent one, so the app runs in jsdom.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../core/settings/defaults';
import { emptyGarage } from '../core/rewards/garage';
import { GARAGE_KEY, SETTINGS_KEY } from '../core/storage/storage';
import { t } from '../i18n';
import { App } from './App';
import { BattleController } from '../core/battle/controller';
import { HOLD_MS } from './ParentGate';

const game = vi.hoisted(() => ({ created: 0, destroyed: 0, setLook: [] as unknown[] }));

vi.mock('../game/createGame', () => ({
  createGame: () => {
    game.created++;
    return {
      game: {},
      destroy: () => void game.destroyed++,
      setLook: (look: unknown) => void game.setLook.push(look),
    };
  },
}));

vi.mock('../audio/sfx', () => {
  const noop = () => {};
  return {
    createSfx: () => ({
      shot: noop,
      boom: noop,
      chime: noop,
      plopp: noop,
      startMusic: noop,
      stopMusic: noop,
      unlock: () => Promise.resolve(),
      installUnlock: () => noop,
    }),
  };
});

const m = t();

function seed(entries: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(entries)) window.localStorage.setItem(k, JSON.stringify(v));
}

/** Renders the app, starts a "Nur Zahlenstrahl" round with Enter and waits until the game stand-in is created. */
async function startBattle(): Promise<HTMLElement> {
  window.history.replaceState(null, '', '/?seed=3&mode=ruler');
  render(<App />);
  act(() => {
    fireEvent.keyDown(window, { key: 'Enter' });
  });
  await waitFor(() => expect(game.created).toBe(1));
  const overlay = screen.getByTestId('battle-overlay');
  expect(overlay.getAttribute('data-phase')).toBe('challenge');
  return overlay;
}

function press(key: string): void {
  act(() => {
    fireEvent.keyDown(window, { key });
  });
}

beforeEach(() => {
  window.localStorage.clear();
  game.created = 0;
  game.destroyed = 0;
  game.setLook = [];
});

afterEach(() => {
  cleanup();
});

describe('the garage from the battle (amendment 23)', () => {
  it('shows the garage icon beside the gear only with the garage on', async () => {
    await startBattle();
    const icon = screen.getByRole('button', { name: m.battle.garage });
    expect(m.battle.garage).toBe('Garage');
    expect(icon.closest('.top-right')).not.toBeNull();
    cleanup();

    window.localStorage.clear();
    game.created = 0;
    seed({ [SETTINGS_KEY]: { ...defaultSettings(), garage: false } });
    await startBattle();
    expect(screen.queryByRole('button', { name: m.battle.garage })).toBeNull();
  });

  it('opens the garage over the battle with one tap; the round pauses and continues after "Zurück"', async () => {
    const overlay = await startBattle();
    fireEvent.click(screen.getByRole('button', { name: m.battle.garage }));
    expect(screen.getByTestId('garage')).toBeTruthy();
    // The battle stays loaded underneath: the game is neither destroyed nor created again.
    expect(screen.getByTestId('battle-main')).toBeTruthy();
    expect(game.destroyed).toBe(0);
    expect(overlay.getAttribute('data-phase')).toBe('paused');

    fireEvent.click(screen.getByRole('button', { name: m.garage.back }));
    expect(screen.queryByTestId('garage')).toBeNull();
    expect(overlay.getAttribute('data-phase')).toBe('challenge');
    expect(game.created).toBe(1);
    expect(game.destroyed).toBe(0);
  });

  it('keeps a round the child paused paused after the garage closes', async () => {
    const overlay = await startBattle();
    fireEvent.click(screen.getByRole('button', { name: m.battle.pause }));
    expect(overlay.getAttribute('data-phase')).toBe('paused');
    fireEvent.click(screen.getByRole('button', { name: m.battle.garage }));
    expect(screen.getByTestId('garage')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: m.garage.back }));
    expect(overlay.getAttribute('data-phase')).toBe('paused');
    expect(screen.getByTestId('pause-screen')).toBeTruthy();
  });

  it('gives the keys to the garage, not to the battle, while the garage is open', async () => {
    const overlay = await startBattle();
    fireEvent.click(screen.getByRole('button', { name: m.battle.garage }));
    // A digit selects garage item 7 and does not reach the battle's readout.
    press('7');
    expect(screen.getByTestId('garage-item-rocket').getAttribute('data-selected')).toBe('true');
    expect(screen.getByTestId('readout').textContent).toBe('?');
    press('Backspace');
    // Escape is the garage's back key: it closes the garage and does not pause the battle.
    press('Escape');
    expect(screen.queryByTestId('garage')).toBeNull();
    expect(overlay.getAttribute('data-phase')).toBe('challenge');
    // The battle's keys work again.
    press('4');
    expect(screen.getByTestId('readout').textContent).toBe('4');
  });

  it('hands a look equipped in the garage to the battle scene', async () => {
    seed({ [GARAGE_KEY]: { ...emptyGarage(), owned: ['rocket'] } });
    await startBattle();
    fireEvent.click(screen.getByRole('button', { name: m.battle.garage }));
    fireEvent.click(screen.getByTestId('garage-item-rocket'));
    fireEvent.click(screen.getByRole('button', { name: m.garage.back }));
    expect(game.setLook.at(-1)).toEqual({ ...emptyGarage().look, flag: 'rocket' });
  });
});

/** Opens the settings page through the parent gate: a 2-second press on the gear, then "Einstellungen". */
function openSettings(): void {
  vi.useFakeTimers();
  const gear = screen.getByTestId('parent-gate');
  fireEvent.pointerDown(gear, { pointerId: 1, button: 0 });
  act(() => {
    vi.advanceTimersByTime(HOLD_MS + 100);
  });
  fireEvent.pointerUp(gear);
  vi.useRealTimers();
  fireEvent.click(screen.getByRole('button', { name: m.parent.settings }));
  expect(screen.getByTestId('settings-page')).toBeTruthy();
}

const saveSettings = () => fireEvent.click(screen.getByRole('button', { name: m.settings.save }));
const closeSettings = () => fireEvent.click(screen.getByRole('button', { name: m.parent.close }));
const chooseRange = (preset: string) => fireEvent.change(screen.getByLabelText(m.settings.labels.rangePreset), { target: { value: preset } });

describe('saved settings reach the running round when the settings page closes (amendment 25)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('gives the round a new scene with the new range when the page closes after a save; the round continues', async () => {
    const apply = vi.spyOn(BattleController.prototype, 'applySettingsNow');
    const overlay = await startBattle();
    openSettings();
    expect(overlay.getAttribute('data-phase')).toBe('paused');
    chooseRange('0-20');
    saveSettings();
    // Nothing changes while the page is open.
    expect(apply).not.toHaveBeenCalled();
    closeSettings();
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply.mock.calls[0]![0].range).toEqual({ preset: '0-20', min: 0, max: 20 });
    expect(overlay.getAttribute('data-phase')).toBe('challenge');
    expect(Number(overlay.getAttribute('data-enemy-number'))).toBeLessThanOrEqual(20);
    expect(overlay.getAttribute('data-lives')).toBe('3');
    expect(overlay.getAttribute('data-enemies-destroyed')).toBe('0');
  });

  it('applies several saves once, with the latest settings', async () => {
    const apply = vi.spyOn(BattleController.prototype, 'applySettingsNow');
    await startBattle();
    openSettings();
    chooseRange('0-50');
    saveSettings();
    chooseRange('0-20');
    saveSettings();
    closeSettings();
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply.mock.calls[0]![0].range).toEqual({ preset: '0-20', min: 0, max: 20 });
  });

  it('changes nothing when the page closes without a save', async () => {
    const apply = vi.spyOn(BattleController.prototype, 'applySettingsNow');
    const overlay = await startBattle();
    const enemy = overlay.getAttribute('data-enemy-number');
    openSettings();
    chooseRange('0-20');
    closeSettings();
    expect(apply).not.toHaveBeenCalled();
    expect(overlay.getAttribute('data-enemy-number')).toBe(enemy);
    expect(overlay.getAttribute('data-phase')).toBe('challenge');
  });

  it('keeps a round the child paused paused, with the new scene', async () => {
    const apply = vi.spyOn(BattleController.prototype, 'applySettingsNow');
    const overlay = await startBattle();
    fireEvent.click(screen.getByRole('button', { name: m.battle.pause }));
    expect(overlay.getAttribute('data-phase')).toBe('paused');
    openSettings();
    chooseRange('0-20');
    saveSettings();
    closeSettings();
    expect(apply).toHaveBeenCalledTimes(1);
    expect(overlay.getAttribute('data-phase')).toBe('paused');
    expect(Number(overlay.getAttribute('data-enemy-number'))).toBeLessThanOrEqual(20);
  });

  it('does not touch a round from the start screen; the next round uses the saved settings', async () => {
    const apply = vi.spyOn(BattleController.prototype, 'applySettingsNow');
    window.history.replaceState(null, '', '/?seed=3&mode=ruler');
    render(<App />);
    openSettings();
    chooseRange('0-20');
    saveSettings();
    closeSettings();
    expect(apply).not.toHaveBeenCalled();
    press('Enter');
    await waitFor(() => expect(game.created).toBe(1));
    expect(Number(screen.getByTestId('battle-overlay').getAttribute('data-enemy-number'))).toBeLessThanOrEqual(20);
  });
});

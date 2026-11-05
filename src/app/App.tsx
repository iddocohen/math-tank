/**
 * App shell (FR-050): loads settings, creates one BattleController, mounts the Phaser game under
 * the React overlay while a battle is shown, and switches between the start screen, the battle
 * and the round end.
 *
 * Keyboard (FR-059, FR-062, research R22): one window listener (useKeyboard). The app root has tabIndex -1 and
 * receives focus on load and on every screen change, so typing works without a click; there is no text field.
 *
 * Parent gate (FR-045): the gear on the start screen and in the battle opens the parent menu after a 2-second press;
 * in a battle this pauses the game, and closing the menu or the settings page resumes it. While a parent screen is
 * open, keys do nothing in the game. Saved settings go to `controller.updateSettings` and apply from the next round.
 *
 * `?seed=<n>` fixes the base seed so rounds are reproducible (quickstart.md, tasks.md D4).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createSfx } from '../audio/sfx';
import { BattleController } from '../core/battle/controller';
import { memoryProgressStore } from '../core/battle/ports';
import { createGame } from '../game/createGame';
import { BattleOverlay } from './BattleOverlay';
import { ParentGate } from './ParentGate';
import { RoundEnd } from './RoundEnd';
import { SettingsPage } from './SettingsPage';
import { StartScreen } from './StartScreen';
import { createPersistence } from './persistence';
import type { KeyAction, KeyScreen } from './keyboard';
import { useRoundState } from './useController';
import { applyBattleAction, useKeyboard } from './useKeyboard';

type Screen = 'start' | 'battle';

/** The parent screens over the game (FR-045): the parent menu and the settings page. */
type ParentView = 'closed' | 'menu' | 'settings';

/** The `seed` query parameter as a non-negative integer, or undefined. */
export function seedFromUrl(search: string): number | undefined {
  const raw = new URLSearchParams(search).get('seed');
  if (raw === null || !/^\d{1,10}$/.test(raw)) return undefined;
  return Number(raw) >>> 0;
}

function createApp() {
  const persistence = createPersistence();
  // Ask once per page load to keep stored data (FR-048); the result is shown on the settings page.
  void persistence.requestPersistentStorage();
  const settings = persistence.settings();
  const controller = new BattleController({
    settings,
    // Free play records no attempts; recording into stored progress arrives with guided mode.
    progress: memoryProgressStore(persistence.progress()),
    clock: () => Date.now(),
    seed: seedFromUrl(window.location.search),
  });
  const sfx = createSfx({ enabled: () => persistence.settings().sound.effects });
  return { settings, controller, sfx, persistence };
}

export function App() {
  const [{ controller, sfx, persistence }] = useState(createApp);
  const [screen, setScreen] = useState<Screen>('start');
  const [parent, setParent] = useState<ParentView>('closed');
  // True when the parent gate paused the battle, so closing it resumes only what it paused (FR-045, FR-054).
  const pausedByGate = useRef(false);
  const state = useRoundState(controller);
  const gameParent = useRef<HTMLDivElement>(null);

  useEffect(() => sfx.installUnlock(document), [sfx]);

  useEffect(() => {
    const parent = gameParent.current;
    if (screen !== 'battle' || !parent) return;
    const handle = createGame(parent, controller, { sounds: sfx });
    return () => handle.destroy();
  }, [screen, controller, sfx]);

  // Until Phase 15, "Spielen", Enter on the start screen and "Nochmal" start free play (tasks.md D3).
  const startRound = useCallback(() => controller.startRound('freePlay'), [controller]);
  const play = useCallback(() => {
    startRound();
    setScreen('battle');
  }, [startRound]);

  const openParent = useCallback(() => {
    setParent('menu');
    if (screen === 'battle' && controller.getState().phase !== 'paused') {
      controller.pause();
      pausedByGate.current = controller.getState().phase === 'paused';
    }
  }, [controller, screen]);
  const closeParent = useCallback(() => {
    setParent('closed');
    if (pausedByGate.current) controller.resume();
    pausedByGate.current = false;
  }, [controller]);
  const gear = <ParentGate onOpen={openParent} onClose={closeParent} onSettings={() => setParent('settings')} />;

  // While a parent screen is open, keys do nothing in the game (FR-045, T115).
  const keyScreen = parent === 'closed' ? keyScreenFor(screen, state.phase) : null;
  const onAction = useCallback(
    (action: KeyAction) => {
      if (action.type === 'start') play();
      else if (action.type === 'newRound') startRound();
      else applyBattleAction(controller, action);
    },
    [controller, play, startRound],
  );
  useKeyboard({ screen: keyScreen, helpLevel: state.help.level, onAction });

  // Focus the root on load and on every screen change (start, battle, round end).
  const root = useRef<HTMLDivElement>(null);
  const roundOver = state.phase === 'roundOver';
  useEffect(() => {
    root.current?.focus({ preventScroll: true });
  }, [screen, roundOver, parent]);

  return (
    <div className="app-root" ref={root} tabIndex={-1} data-testid="app-root">
      {screen === 'start' ? (
        <StartScreen onPlay={play} gear={gear} />
      ) : (
        <main className="battle">
          <div className="game-parent" ref={gameParent} />
          <BattleOverlay controller={controller} state={state} gear={gear} />
          {roundOver && <RoundEnd outcome={state.outcome} onAgain={startRound} onBackToStart={() => setScreen('start')} />}
        </main>
      )}
      {parent === 'settings' && (
        <SettingsPage persistence={persistence} onSaved={(s) => controller.updateSettings(s)} onClose={closeParent} />
      )}
    </div>
  );
}

/** Which keyboard map applies; null while a shell is in flight, so keys do nothing (FR-061). */
export function keyScreenFor(screen: Screen, phase: string): KeyScreen | null {
  if (screen === 'start') return 'start';
  switch (phase) {
    case 'roundOver':
      return 'roundEnd';
    case 'paused':
      return 'paused';
    case 'aiming':
    case 'challenge':
      return 'battle';
    default:
      return null;
  }
}

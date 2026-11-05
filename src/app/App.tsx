/**
 * App shell (FR-050): loads settings, creates one BattleController, mounts the Phaser game under
 * the React overlay while a battle is shown, and switches between the start screen, the battle
 * and the round end.
 *
 * Keyboard (FR-059, FR-062, research R22): one window listener (useKeyboard). The app root has tabIndex -1 and
 * receives focus on load and on every screen change, so typing works without a click; there is no text field.
 *
 * `?seed=<n>` fixes the base seed so rounds are reproducible (quickstart.md, tasks.md D4).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createSfx } from '../audio/sfx';
import { BattleController } from '../core/battle/controller';
import { memoryProgressStore } from '../core/battle/ports';
import { localStorageKeyValue } from '../core/storage/keyValue';
import { loadSettings } from '../core/storage/storage';
import { createGame } from '../game/createGame';
import { BattleOverlay } from './BattleOverlay';
import { RoundEnd } from './RoundEnd';
import { StartScreen } from './StartScreen';
import type { KeyAction, KeyScreen } from './keyboard';
import { useRoundState } from './useController';
import { applyBattleAction, useKeyboard } from './useKeyboard';

type Screen = 'start' | 'battle';

/** The `seed` query parameter as a non-negative integer, or undefined. */
export function seedFromUrl(search: string): number | undefined {
  const raw = new URLSearchParams(search).get('seed');
  if (raw === null || !/^\d{1,10}$/.test(raw)) return undefined;
  return Number(raw) >>> 0;
}

function createApp() {
  const { settings } = loadSettings(localStorageKeyValue());
  const controller = new BattleController({
    settings,
    // Free play records no attempts; storage-backed progress arrives with guided mode.
    progress: memoryProgressStore(),
    clock: () => Date.now(),
    seed: seedFromUrl(window.location.search),
  });
  const sfx = createSfx({ enabled: () => settings.sound.effects });
  return { settings, controller, sfx };
}

export function App() {
  const [{ controller, sfx }] = useState(createApp);
  const [screen, setScreen] = useState<Screen>('start');
  const state = useRoundState(controller);
  const gameParent = useRef<HTMLDivElement>(null);

  useEffect(() => sfx.installUnlock(document), [sfx]);

  useEffect(() => {
    const parent = gameParent.current;
    if (screen !== 'battle' || !parent) return;
    const handle = createGame(parent, controller, { sounds: sfx });
    return () => handle.destroy();
  }, [screen, controller, sfx]);

  // Until Phase 13, "Spielen", Enter on the start screen and "Nochmal" start free play (tasks.md D3).
  const startRound = useCallback(() => controller.startRound('freePlay'), [controller]);
  const play = useCallback(() => {
    startRound();
    setScreen('battle');
  }, [startRound]);

  const keyScreen = keyScreenFor(screen, state.phase);
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
  }, [screen, roundOver]);

  return (
    <div className="app-root" ref={root} tabIndex={-1} data-testid="app-root">
      {screen === 'start' ? (
        <StartScreen onPlay={play} />
      ) : (
        <main className="battle">
          <div className="game-parent" ref={gameParent} />
          <BattleOverlay controller={controller} state={state} />
          {roundOver && <RoundEnd outcome={state.outcome} onAgain={startRound} onBackToStart={() => setScreen('start')} />}
        </main>
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

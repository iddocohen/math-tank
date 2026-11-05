/**
 * App shell (FR-050): loads settings, creates one BattleController, mounts the Phaser game under
 * the React overlay while a battle is shown, and switches between the start screen, the battle
 * and the round end.
 *
 * `?seed=<n>` fixes the base seed so rounds are reproducible (quickstart.md, tasks.md D4).
 */
import { useEffect, useRef, useState } from 'react';
import { createSfx } from '../audio/sfx';
import { BattleController } from '../core/battle/controller';
import { memoryProgressStore } from '../core/battle/ports';
import { localStorageKeyValue } from '../core/storage/keyValue';
import { loadSettings } from '../core/storage/storage';
import { createGame } from '../game/createGame';
import { BattleOverlay } from './BattleOverlay';
import { RoundEnd } from './RoundEnd';
import { StartScreen } from './StartScreen';
import { useRoundState } from './useController';

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

  // Until Phase 9, "Spielen" and "Nochmal" start free play (tasks.md D3).
  const startRound = () => controller.startRound('freePlay');

  if (screen === 'start') {
    return (
      <StartScreen
        onPlay={() => {
          startRound();
          setScreen('battle');
        }}
      />
    );
  }

  return (
    <main className="battle">
      <div className="game-parent" ref={gameParent} />
      <BattleOverlay controller={controller} state={state} />
      {state.phase === 'roundOver' && <RoundEnd outcome={state.outcome} onAgain={startRound} onBackToStart={() => setScreen('start')} />}
    </main>
  );
}

/**
 * App shell (FR-050): loads settings, creates one BattleController, mounts the Phaser game under
 * the React overlay while a battle is shown, and switches between the start screen, the battle
 * and the round end.
 *
 * Keyboard (FR-059, FR-062, research R22): one window listener (useKeyboard). The app root has tabIndex -1 and
 * receives focus on load and on every screen change, so typing works without a click; there is no text field.
 *
 * Parent gate (FR-045): the gear on the start screen and in the battle opens the parent menu after a 2-second press;
 * in a battle this pauses the game, and closing the menu, the settings page or the progress page resumes it. While a parent screen is
 * open, keys do nothing in the game. Saved settings go to `controller.updateSettings` and apply from the next round.
 *
 * Amendment 06 (FR-084, FR-086): when a round ends, its result (destroyed enemies and time) is compared once with
 * the personal best for the round's range, ruler starting level and round type, and the end screen shows it. While
 * the browser tab is hidden the battle is paused, so the time does not run; it resumes only what it paused.
 *
 * `?seed=<n>` fixes the base seed so rounds are reproducible (quickstart.md, tasks.md D4). Amendment 17 (FR-121): the
 * start screen offers the play modes the parent chose; a mode button or the keys 1, 2 and 3 start that mode, Enter and
 * Space the first offered one, or the offered mode of `?mode=mixed|ruler|math` (T070). "Nochmal" and Enter on the end
 * screen start a new round in the same mode. The personal best is kept per play mode too. "Nur Zahlenstrahl" is not
 * read aloud (it has no question), and "Nur Rechnen" shows the number pad unless "Zahlenfeld" is "Nie", because there is
 * no ruler to tap.
 *
 * Amendment 11 (FR-089 to FR-096): every increase of `enemiesDestroyed` (enemies only, never decoys) adds stars at
 * once, with the garage on or off. The garage screen opens from the start screen (button or G, only with the garage
 * on), and the battle draws the child's tank with the chosen look, or the standard look when the garage is off.
 * Amendment 19 (FR-094, FR-130, FR-131): the garage is a star shop (buy and return), and the end screen shows the stars
 * of the round, the balance and, from `newlyAffordable`, at most one item the balance reached during the round.
 *
 * Amendment 12 (FR-102, FR-104): useScreen picks the battle layout (`data-layout` on the battle: wide, portrait or
 * side) and whether the number pad shows (`data-number-pad`). A phone held upright shows RotateScreen over the start
 * screen, the garage and the battle, with the gear on it; while it shows, keys do nothing and a running round is
 * paused, and turning the phone sideways resumes only what it paused. The settings and progress pages open over it.
 *
 * US8 (T138, T139, T141, T142, FR-051a, FR-054, FR-055, FR-009): the "Spielen" tap or the starting Enter resumes Web
 * Audio and, with "Vorlesen" on, primes speech with a short greeting; each new challenge is then spoken, and the
 * speaker button repeats it. The music loop plays during a running round only with "Musik" on. A waiting new version
 * of the game is applied only while the start screen shows (swUpdate). After leaving fullscreen the app root gets the
 * focus back, so the keys keep working.
 *
 * Amendment 15 (FR-119, FR-120): when the address has `#save=` (on load, or when only the fragment changes), the code
 * is decoded and TransferDialog asks the parent; "Übernehmen" (a 2-second hold) replaces the settings, progress,
 * records and garage, "Abbrechen" changes nothing. Closing the dialog removes the fragment with history.replaceState.
 * While the dialog shows, keys do nothing in the game and a running round is paused (review R4). When storing the save
 * fails, the dialog says so and the fragment stays (review M1).
 *
 * Review fixes: useAutoPause holds every pause the app makes (parent screens, hidden tab, phone upright, transfer
 * dialog) in one flag, and the app keeps the parent menu's state, so turning the phone with the menu open keeps it
 * open (R1). A waiting service worker update reloads only on the start screen with nothing open over it (R2).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createSfx } from '../audio/sfx';
import { createSpeaker } from '../audio/speaker';
import { promptText } from '../i18n';
import { canApplyUpdate, swUpdate } from './swUpdate';
import { BattleController } from '../core/battle/controller';
import { createProgressStore } from '../core/storage/progressStore';
import type { GameHandle } from '../game/createGame';
import { BattleOverlay } from './BattleOverlay';
import { ParentGate } from './ParentGate';
import { RoundEnd, type RoundRecord } from './RoundEnd';
import { recordKey } from '../core/records/records';
import { SettingsPage } from './SettingsPage';
import { ProgressPage } from './ProgressPage';
import { keyStartMode, offeredModes, StartScreen } from './StartScreen';
import type { PlayMode } from '../core/settings/schema';
import { createPersistence } from './persistence';
import type { KeyAction, KeyScreen } from './keyboard';
import { useRoundState } from './useController';
import { Garage } from './Garage';
import { newlyAffordable, newlyDestroyed } from '../core/rewards/garage';
import { STANDARD_LOOK } from '../core/rewards/items';
import { applyBattleAction, useKeyboard } from './useKeyboard';
import { RotateScreen } from './RotateScreen';
import { debugScreenRequested, ScreenDebug } from './ScreenDebug';
import { useScreen } from './useScreen';
import { decodeTransfer, saveCodeFromHash, type SaveData } from '../core/transfer/transfer';
import { TransferDialog, type TransferDialogState } from './TransferDialog';
import { useAutoPause, useDocumentHidden } from './useAutoPause';
import { MODE_TRAITS } from '../core/modes';

/** A save link being read, or its dialog (amendment 15). */
type Transfer = { kind: 'reading' } | (TransferDialogState & { data?: SaveData });

type Screen = 'start' | 'garage' | 'battle';

/** The parent screens over the game (FR-045): the parent menu, the settings page and the progress page (FR-040). */
type ParentView = 'closed' | 'menu' | 'settings' | 'progress';

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
    // Each attempt is recorded and saved at once, between turns (FR-035, FR-048).
    progress: createProgressStore({ load: () => persistence.progress(), save: (p) => void persistence.saveProgress(p) }),
    clock: () => Date.now(),
    seed: seedFromUrl(window.location.search),
  });
  const sfx = createSfx({ enabled: () => persistence.settings().sound.effects, music: () => persistence.settings().sound.music });
  const speaker = createSpeaker();
  return { settings, controller, sfx, speaker, persistence };
}

/** The Phaser game and the battle scene, in their own chunk; the module is loaded once and then reused. */
function loadGame(): Promise<typeof import('../game/createGame')> {
  return import('../game/createGame');
}

/** Runs `load` once the browser is idle (or after a second where requestIdleCallback is missing); returns a cancel. */
function prefetchWhenIdle(load: () => Promise<unknown>): () => void {
  const run = () => void load().catch(() => {});
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(run, { timeout: 3000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(run, 1000);
  return () => window.clearTimeout(id);
}

export function App() {
  const [{ controller, sfx, speaker, persistence }] = useState(createApp);
  const [screen, setScreen] = useState<Screen>('start');
  const [parent, setParent] = useState<ParentView>('closed');
  // The personal best after the latest finished round, by round seed, so each round is compared only once (FR-086).
  const [roundRecord, setRoundRecord] = useState<{ seed: number; record: RoundRecord } | null>(null);
  const state = useRoundState(controller);
  // Stars and the chosen look (amendment 11); a copy of persistence.garage() so screens redraw when it changes.
  const [garage, setGarage] = useState(() => persistence.garage());
  // The destroyed-enemy count already turned into stars, and the balance when the current round started.
  const seenDestroyed = useRef(0);
  const roundStartBalance = useRef(garage.balance);
  const gameParent = useRef<HTMLDivElement>(null);
  const [transfer, setTransfer] = useState<Transfer | null>(() => (saveCodeFromHash(window.location.hash) === null ? null : { kind: 'reading' }));
  // "Nur Rechnen" has no ruler to tap, so "Automatisch" shows the number pad on every screen there (amendment 17).
  const { layout, numberPad, lastEvent } = useScreen(persistence.settings().numberPad, screen === 'battle' && MODE_TRAITS[state.mode].forcesPad);
  // Bug "iPhone rotation in Chrome" (Phase 24): `?debug=screen` shows what the app measured.
  const [debugScreen] = useState(() => debugScreenRequested(window.location.search));
  // The picture shows over the child's screens; the settings and progress pages open over it (FR-104).
  const rotate = layout === 'rotate' && parent !== 'settings' && parent !== 'progress';

  useEffect(() => sfx.installUnlock(document), [sfx]);

  // Phaser loads in its own chunk: fetched when the browser is idle after the first screen, and at the latest when a
  // battle starts. The service worker precaches the chunk with the rest of the game, so it also loads offline.
  useEffect(() => prefetchWhenIdle(loadGame), []);

  useEffect(() => {
    const parent = gameParent.current;
    if (screen !== 'battle' || !parent) return;
    const look = persistence.settings().garage ? persistence.garage().look : STANDARD_LOOK;
    let handle: GameHandle | null = null;
    let left = false;
    loadGame().then(
      ({ createGame }) => {
        if (!left) handle = createGame(parent, controller, { sounds: sfx, look });
      },
      // Without the game chunk no shell can land, so the round could never go on: back to the start screen.
      () => {
        if (!left) setScreen('start');
      },
    );
    return () => {
      left = true;
      handle?.destroy();
    };
  }, [screen, controller, sfx, persistence]);

  // A running round pauses while a parent screen or the transfer dialog is open, the tab is hidden (the time stops,
  // FR-084) or the phone is held upright (FR-104), and resumes only when none of them is left (review P3, R1, R4).
  const hidden = useDocumentHidden();
  const upright = layout === 'rotate';
  useAutoPause(controller, state.phase, screen === 'battle' && (parent !== 'closed' || hidden || upright || transfer !== null));

  // Compare a finished round with the personal best once (FR-086).
  const roundOverSeed = state.phase === 'roundOver' && state.outcome !== null ? state.seed : null;
  useEffect(() => {
    if (roundOverSeed === null) return;
    const s = controller.getState();
    const record = persistence.submitResult(recordKey(controller.getRoundSettings(), s.mode), { enemies: s.enemiesDestroyed, ms: s.elapsedMs, at: Date.now() });
    setRoundRecord({ seed: roundOverSeed, record });
  }, [roundOverSeed, controller, persistence]);

  // One star per destroyed enemy, stored at once (FR-089). A new round starts the count at 0 again.
  const destroyed = state.enemiesDestroyed;
  useEffect(() => {
    const n = newlyDestroyed(seenDestroyed.current, destroyed);
    seenDestroyed.current = destroyed;
    if (n > 0) {
      persistence.addStars(n);
      setGarage(persistence.garage());
    }
  }, [destroyed, persistence]);

  // A save link (FR-119): decode it on load and whenever only the fragment changes (review P6). Only the latest code
  // counts, and a decode that throws shows "Dieser Code passt nicht" (review L1).
  const latestDecode = useRef(0);
  useEffect(() => {
    let live = true;
    const decode = (code: string) => {
      const id = ++latestDecode.current;
      const show = (next: Transfer) => {
        if (live && id === latestDecode.current) setTransfer(next);
      };
      decodeTransfer(code).then(
        (r) => show(r.ok ? { kind: 'ready', summary: r.summary, data: r.data } : { kind: 'invalid' }),
        () => show({ kind: 'invalid' }),
      );
    };
    // The initial state is already 'reading' when the page opened with a save link.
    const first = saveCodeFromHash(window.location.hash);
    if (first !== null) decode(first);
    const onHash = () => {
      const code = saveCodeFromHash(window.location.hash);
      if (code === null) return;
      setTransfer({ kind: 'reading' });
      decode(code);
    };
    window.addEventListener('hashchange', onHash);
    return () => {
      live = false;
      window.removeEventListener('hashchange', onHash);
    };
  }, []);
  const closeTransfer = useCallback(() => {
    setTransfer(null);
    // The link does not stay in the address bar, and a reload does not ask again (FR-119).
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  }, []);
  const acceptTransfer = useCallback(() => {
    if (transfer?.kind !== 'ready' || !transfer.data) return closeTransfer();
    if (!persistence.applyTransfer(transfer.data).ok) {
      // Nothing was stored (review M1, M4): say so and keep `#save=`, so a reload can try again.
      setTransfer({ kind: 'failed' });
      return;
    }
    controller.updateSettings(persistence.settings());
    setGarage(persistence.garage());
    // The end screen counts the stars of the round, not the stars that came with the save (review R4).
    roundStartBalance.current = persistence.garage().balance;
    closeTransfer();
  }, [transfer, persistence, controller, closeTransfer]);

  // A waiting new version is applied only on the start screen, never during a round (FR-051a), and never while a
  // parent screen or the transfer dialog is open (review R2).
  const updateAllowed = canApplyUpdate({ screen, parentOpen: parent !== 'closed', transferOpen: transfer !== null });
  useEffect(() => {
    swUpdate.setStartScreen(updateAllowed);
  }, [updateAllowed]);

  // Spoken challenges (FR-055): each new challenge is read aloud while "Vorlesen" is on and a German voice exists.
  // "Nur Zahlenstrahl" shows no question, so nothing is read aloud (amendment 17, FR-122).
  const speech = persistence.settings().sound.speech && MODE_TRAITS[state.mode].showsQuestion;
  const challenge = state.challenge;
  const speakChallenge = useCallback(() => {
    const c = controller.getState().challenge;
    if (c) speaker.speak(promptText(c.prompt));
  }, [controller, speaker]);
  useEffect(() => {
    if (screen !== 'battle' || !challenge || !speech) return;
    speaker.speak(promptText(challenge.prompt));
  }, [screen, challenge, speech, speaker]);

  // The optional music loop plays only during a running round (FR-009, T142).
  const musicOn = screen === 'battle' && state.phase !== 'paused' && state.phase !== 'roundOver';
  useEffect(() => {
    if (!musicOn) return;
    sfx.startMusic();
    return () => sfx.stopMusic();
  }, [musicOn, sfx]);

  // "Nochmal" and Enter on the end screen repeat the mode of the round that ended (T070).
  const startRound = useCallback(() => {
    roundStartBalance.current = persistence.garage().balance;
    controller.startRound(controller.getState().mode);
  }, [controller, persistence]);
  const play = useCallback(
    (mode: PlayMode) => {
      // Tablet browsers play sound and speak only after a user tap: this tap (or Enter) unlocks both (FR-055).
      void sfx.unlock();
      if (persistence.settings().sound.speech) speaker.prime();
      roundStartBalance.current = persistence.garage().balance;
      controller.startRound(mode);
      setScreen('battle');
    },
    [controller, persistence, sfx, speaker],
  );
  const equip = useCallback(
    (id: string) => {
      persistence.equip(id);
      setGarage(persistence.garage());
    },
    [persistence],
  );
  const buy = useCallback(
    (id: string) => {
      persistence.buy(id);
      setGarage(persistence.garage());
    },
    [persistence],
  );
  const returnItem = useCallback(
    (id: string) => {
      persistence.returnItem(id);
      setGarage(persistence.garage());
    },
    [persistence],
  );

  const openParent = useCallback(() => setParent('menu'), []);
  const closeParent = useCallback(() => {
    setParent('closed');
    // An import or "Sterne zurücksetzen" may have changed the stars and the look (amendments 11 and 19).
    setGarage(persistence.garage());
  }, [persistence]);
  // One gear shows at a time: on the rotate picture while it shows, otherwise on the screen below. The app keeps the
  // menu's state, so a menu opened on the rotate picture stays open after the phone turns sideways (review R1).
  const gear = (
    <ParentGate
      open={parent === 'menu'}
      onOpen={openParent}
      onClose={closeParent}
      onSettings={() => setParent('settings')}
      onProgress={() => setParent('progress')}
    />
  );
  const screenGear = rotate ? undefined : gear;

  // While a parent screen is open, keys do nothing in the game (FR-045, T115).
  const keyScreen = parent === 'closed' && !rotate && transfer === null ? keyScreenFor(screen, state.phase) : null;
  const onAction = useCallback(
    (action: KeyAction) => {
      if (action.type === 'start') play(action.mode ?? keyStartMode(window.location.search, offeredModes(persistence.settings().playModes)));
      else if (action.type === 'garage') setScreen('garage');
      else if (action.type === 'newRound') startRound();
      else applyBattleAction(controller, action);
    },
    [controller, persistence, play, startRound],
  );
  const garageOn = persistence.settings().garage;
  const modes = offeredModes(persistence.settings().playModes);
  useKeyboard({ screen: keyScreen, helpLevel: state.help.level, garage: garageOn, modes, onAction });

  // Focus the root on load and on every screen change (start, battle, round end).
  const root = useRef<HTMLDivElement>(null);
  const roundOver = state.phase === 'roundOver';
  useEffect(() => {
    root.current?.focus({ preventScroll: true });
  }, [screen, roundOver, parent]);
  // Leaving fullscreen gives the focus back to the app root (FR-059).
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) root.current?.focus({ preventScroll: true });
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  return (
    <div className="app-root" ref={root} tabIndex={-1} data-testid="app-root">
      {screen === 'start' ? (
        <StartScreen
          onPlay={play}
          modes={modes}
          gear={screenGear}
          garage={garageOn ? garage : null}
          onGarage={() => setScreen('garage')}
          saveFailed={persistence.status().saveFailed}
        />
      ) : screen === 'garage' ? (
        <Garage garage={garage} onEquip={equip} onBuy={buy} onReturn={returnItem} onBack={() => setScreen('start')} />
      ) : (
        <main className="battle" data-testid="battle-main" data-layout={layout === 'rotate' ? 'portrait' : layout} data-number-pad={numberPad}>
          <div className="game-parent" ref={gameParent} />
          <BattleOverlay
            controller={controller}
            state={state}
            gear={screenGear}
            numberPad={numberPad}
            onSpeak={speech && speaker.available ? speakChallenge : undefined}
          />
          {roundOver && (
            <RoundEnd
              outcome={state.outcome}
              enemiesDestroyed={state.enemiesDestroyed}
              elapsedMs={state.elapsedMs}
              record={controller.getRoundSettings().showRecords && roundRecord?.seed === state.seed ? roundRecord.record : null}
              garage={
                garageOn
                  ? {
                      earned: Math.max(0, garage.balance - roundStartBalance.current),
                      balance: garage.balance,
                      affordable: newlyAffordable(roundStartBalance.current, garage.balance, garage.owned),
                    }
                  : null
              }
              onAgain={startRound}
              onBackToStart={() => setScreen('start')}
            />
          )}
        </main>
      )}
      {rotate && <RotateScreen gear={gear} />}
      {debugScreen && <ScreenDebug layout={layout} lastEvent={lastEvent} />}
      {parent === 'settings' && (
        <SettingsPage persistence={persistence} onSaved={(s) => controller.updateSettings(s)} onClose={closeParent} />
      )}
      {parent === 'progress' && <ProgressPage persistence={persistence} onClose={closeParent} />}
      {transfer !== null && transfer.kind !== 'reading' && (
        <TransferDialog state={transfer} onAccept={acceptTransfer} onCancel={transfer.kind === 'failed' ? () => setTransfer(null) : closeTransfer} />
      )}
    </div>
  );
}

/** Which keyboard map applies; null while a shell is in flight, so keys do nothing (FR-061). */
export function keyScreenFor(screen: Screen, phase: string): KeyScreen | null {
  if (screen === 'start') return 'start';
  // The garage has its own key listener (Garage.tsx).
  if (screen === 'garage') return null;
  switch (phase) {
    case 'roundOver':
      return 'roundEnd';
    case 'paused':
      return 'paused';
    case 'challenge':
      return 'battle';
    default:
      return null;
  }
}

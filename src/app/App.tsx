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
 * `?seed=<n>` fixes the base seed so rounds are reproducible (quickstart.md, tasks.md D4). "Spielen", Enter and Space
 * start guided mode; "Freies Spiel" (only with the parent's free-play setting) starts free play, and so do Enter and
 * Space with `?mode=free` (T070). "Nochmal" and Enter on the end screen start a new round in the same mode.
 *
 * Amendment 11 (FR-089 to FR-096): every increase of `enemiesDestroyed` (enemies only, never decoys) adds stars at
 * once, with the garage on or off. The end screen names the items unlocked since the round started. The garage screen
 * opens from the start screen (button or G, only with the garage on), and the battle draws the child's tank with the
 * chosen look, or the standard look when the garage is off.
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
 * While the dialog shows, keys do nothing in the game.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createSfx } from '../audio/sfx';
import { createSpeaker } from '../audio/speaker';
import { promptText } from '../i18n';
import { swUpdate } from './swUpdate';
import { BattleController } from '../core/battle/controller';
import { createProgressStore } from '../core/storage/progressStore';
import { createGame } from '../game/createGame';
import { BattleOverlay } from './BattleOverlay';
import { ParentGate } from './ParentGate';
import { RoundEnd, type RoundRecord } from './RoundEnd';
import { recordKey } from '../core/records/records';
import { SettingsPage } from './SettingsPage';
import { ProgressPage } from './ProgressPage';
import { keyStartMode, StartScreen, type StartMode } from './StartScreen';
import { createPersistence } from './persistence';
import type { KeyAction, KeyScreen } from './keyboard';
import { useRoundState } from './useController';
import { Garage } from './Garage';
import { newlyDestroyed, unlockedBetween } from '../core/rewards/garage';
import { STANDARD_LOOK } from '../core/rewards/items';
import { applyBattleAction, useKeyboard } from './useKeyboard';
import { RotateScreen } from './RotateScreen';
import { useScreen } from './useScreen';
import { decodeTransfer, saveCodeFromHash, type SaveData } from '../core/transfer/transfer';
import { TransferDialog, type TransferDialogState } from './TransferDialog';

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

export function App() {
  const [{ controller, sfx, speaker, persistence }] = useState(createApp);
  const [screen, setScreen] = useState<Screen>('start');
  const [parent, setParent] = useState<ParentView>('closed');
  // True when the parent gate paused the battle, so closing it resumes only what it paused (FR-045, FR-054).
  const pausedByGate = useRef(false);
  // True when hiding the tab paused the battle, so showing it again resumes only what it paused (FR-084).
  const pausedByHiding = useRef(false);
  // True when the phone was turned upright and that paused the battle (amendment 12, FR-104).
  const pausedByRotate = useRef(false);
  // The personal best after the latest finished round, by round seed, so each round is compared only once (FR-086).
  const [roundRecord, setRoundRecord] = useState<{ seed: number; record: RoundRecord } | null>(null);
  const state = useRoundState(controller);
  // Stars and the chosen look (amendment 11); a copy of persistence.garage() so screens redraw when it changes.
  const [garage, setGarage] = useState(() => persistence.garage());
  // The destroyed-enemy count already turned into stars, and the star total when the current round started.
  const seenDestroyed = useRef(0);
  const roundStartStars = useRef(garage.stars);
  const gameParent = useRef<HTMLDivElement>(null);
  const [transfer, setTransfer] = useState<Transfer | null>(() => (saveCodeFromHash(window.location.hash) === null ? null : { kind: 'reading' }));
  const { layout, numberPad } = useScreen(persistence.settings().numberPad);
  // The picture shows over the child's screens; the settings and progress pages open over it (FR-104).
  const rotate = layout === 'rotate' && parent !== 'settings' && parent !== 'progress';

  useEffect(() => sfx.installUnlock(document), [sfx]);

  useEffect(() => {
    const parent = gameParent.current;
    if (screen !== 'battle' || !parent) return;
    const look = persistence.settings().garage ? persistence.garage().look : STANDARD_LOOK;
    const handle = createGame(parent, controller, { sounds: sfx, look });
    return () => handle.destroy();
  }, [screen, controller, sfx, persistence]);

  // Pause while the tab is hidden, so the round's time stops (FR-084).
  useEffect(() => {
    if (screen !== 'battle') return;
    const onVisibility = () => {
      if (document.hidden) {
        if (controller.getState().phase === 'paused' || controller.getState().phase === 'roundOver') return;
        controller.pause();
        pausedByHiding.current = controller.getState().phase === 'paused';
      } else if (pausedByHiding.current) {
        pausedByHiding.current = false;
        // A parent screen that opened meanwhile keeps the game paused until it closes.
        if (!pausedByGate.current) controller.resume();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [screen, controller]);

  // A phone held upright pauses the round until it is turned sideways again (amendment 12, FR-104). The phase is a
  // dependency, so a round that could not pause at once (it was already paused by the gate) is paused later.
  const upright = layout === 'rotate';
  const phase = state.phase;
  useEffect(() => {
    if (screen !== 'battle') return;
    if (upright) {
      if (pausedByRotate.current || phase === 'paused' || phase === 'roundOver') return;
      controller.pause();
      pausedByRotate.current = controller.getState().phase === 'paused';
    } else if (pausedByRotate.current) {
      pausedByRotate.current = false;
      // A parent screen or a hidden tab that paused it meanwhile keeps it paused until they end.
      if (!pausedByGate.current && !pausedByHiding.current) controller.resume();
    }
  }, [upright, phase, screen, controller]);

  // Compare a finished round with the personal best once (FR-086).
  const roundOverSeed = state.phase === 'roundOver' && state.outcome !== null ? state.seed : null;
  useEffect(() => {
    if (roundOverSeed === null) return;
    const s = controller.getState();
    const record = persistence.submitResult(recordKey(controller.getRoundSettings()), { enemies: s.enemiesDestroyed, ms: s.elapsedMs, at: Date.now() });
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

  // A save link (FR-119): decode it on load and whenever only the fragment changes.
  useEffect(() => {
    let live = true;
    const decode = (code: string) =>
      void decodeTransfer(code).then((r) => {
        if (live) setTransfer(r.ok ? { kind: 'ready', summary: r.summary, data: r.data } : { kind: 'invalid' });
      });
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
    if (transfer?.kind === 'ready' && transfer.data) {
      persistence.applyTransfer(transfer.data);
      controller.updateSettings(persistence.settings());
      setGarage(persistence.garage());
    }
    closeTransfer();
  }, [transfer, persistence, controller, closeTransfer]);

  // A waiting new version is applied only on the start screen, never during a round (FR-051a).
  useEffect(() => {
    swUpdate.setStartScreen(screen === 'start');
  }, [screen]);

  // Spoken challenges (FR-055): each new challenge is read aloud while "Vorlesen" is on and a German voice exists.
  const speech = persistence.settings().sound.speech;
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
    roundStartStars.current = persistence.garage().stars;
    controller.startRound(controller.getState().mode);
  }, [controller, persistence]);
  const play = useCallback(
    (mode: StartMode) => {
      // Tablet browsers play sound and speak only after a user tap: this tap (or Enter) unlocks both (FR-055).
      void sfx.unlock();
      if (persistence.settings().sound.speech) speaker.prime();
      roundStartStars.current = persistence.garage().stars;
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

  const openParent = useCallback(() => {
    setParent('menu');
    if (screen === 'battle' && controller.getState().phase !== 'paused') {
      controller.pause();
      pausedByGate.current = controller.getState().phase === 'paused';
    }
  }, [controller, screen]);
  const closeParent = useCallback(() => {
    setParent('closed');
    // An import or "Sterne zurücksetzen" may have changed the stars and the look (amendment 11).
    setGarage(persistence.garage());
    if (pausedByGate.current) controller.resume();
    pausedByGate.current = false;
  }, [controller, persistence]);
  const gear = (
    <ParentGate onOpen={openParent} onClose={closeParent} onSettings={() => setParent('settings')} onProgress={() => setParent('progress')} />
  );

  // While a parent screen is open, keys do nothing in the game (FR-045, T115).
  const keyScreen = parent === 'closed' && !rotate && transfer === null ? keyScreenFor(screen, state.phase) : null;
  const onAction = useCallback(
    (action: KeyAction) => {
      if (action.type === 'start') play(keyStartMode(window.location.search, persistence.settings().freePlay));
      else if (action.type === 'garage') setScreen('garage');
      else if (action.type === 'newRound') startRound();
      else applyBattleAction(controller, action);
    },
    [controller, persistence, play, startRound],
  );
  const garageOn = persistence.settings().garage;
  useKeyboard({ screen: keyScreen, helpLevel: state.help.level, garage: garageOn, onAction });

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
          freePlay={persistence.settings().freePlay}
          gear={gear}
          garage={garageOn ? garage : null}
          onGarage={() => setScreen('garage')}
          saveFailed={persistence.status().saveFailed}
        />
      ) : screen === 'garage' ? (
        <Garage garage={garage} onEquip={equip} onBack={() => setScreen('start')} />
      ) : (
        <main className="battle" data-testid="battle-main" data-layout={layout === 'rotate' ? 'portrait' : layout} data-number-pad={numberPad}>
          <div className="game-parent" ref={gameParent} />
          <BattleOverlay
            controller={controller}
            state={state}
            gear={gear}
            numberPad={numberPad}
            onSpeak={speech && speaker.available ? speakChallenge : undefined}
          />
          {roundOver && (
            <RoundEnd
              outcome={state.outcome}
              enemiesDestroyed={state.enemiesDestroyed}
              elapsedMs={state.elapsedMs}
              record={controller.getRoundSettings().showRecords && roundRecord?.seed === state.seed ? roundRecord.record : null}
              garage={garageOn ? { stars: garage.stars, unlocked: unlockedBetween(roundStartStars.current, garage.stars) } : null}
              onAgain={startRound}
              onBackToStart={() => setScreen('start')}
            />
          )}
        </main>
      )}
      {rotate && <RotateScreen gear={gear} />}
      {parent === 'settings' && (
        <SettingsPage persistence={persistence} onSaved={(s) => controller.updateSettings(s)} onClose={closeParent} />
      )}
      {parent === 'progress' && <ProgressPage persistence={persistence} onClose={closeParent} />}
      {transfer !== null && transfer.kind !== 'reading' && <TransferDialog state={transfer} onAccept={acceptTransfer} onCancel={closeTransfer} />}
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
    case 'aiming':
    case 'challenge':
      return 'battle';
    default:
      return null;
  }
}

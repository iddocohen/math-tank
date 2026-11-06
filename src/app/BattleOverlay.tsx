/**
 * Battle overlay (FR-003, FR-019, FR-053, FR-063): at the bottom right the large readout of typed digits and the
 * fire button. There are no angle or power controls (amendment 01). Amendment 05 removed the −1 and +1 buttons
 * (no stepping toward the answer) and the corner health bars; amendment 06 removed health altogether, and the
 * child's hearts are drawn above its tank in the canvas. While the child points on the ruler the readout shows no number (FR-019), and the fire button
 * counts as pointer input (FR-076).
 * At the right side, the "Neue Landschaft" button makes a new landscape with one new enemy in the same round
 * (amendment 03, amendment 08, FR-070). It is for mouse and
 * touch only: it never takes focus and ignores keys, so a keyboard player cannot press it by accident.
 *
 * The root carries the data-* attributes the end-to-end tests read (tasks.md D4); there is no global debug API.
 * `data-mode` is the play mode and `data-skill-step` the main skill's step of the current challenge (amendment 17).
 * `data-miss-streak` is the child's misses in a row (amendment 13, FR-098).
 * `data-enemy-number` is the living enemy's number; the enemy is always visible (amendment 07). `data-last-distance`
 * is the step count of the last shot, which the ruler shows after every miss.
 * `data-last-shot` names the result of the last player shot (amendment 06): `hit` (the exact number, the enemy was
 * destroyed), `near` (on the tank body but not exact) or `miss`. `data-lives`, `data-enemies-destroyed` and
 * `data-outcome` replace the health attributes.
 *
 * Hit feedback (amendment 06, FR-066, FR-072, contracts/ui-flows.md): a hit shows "Getroffen!" and the number the
 * enemy stood at; a near miss on the body shows "Ganz knapp! Triff die Linie." with the child's number and the distance,
 * never the enemy's number (changed by product owner); a miss shows the landing number.
 *
 * Guided searches (T068, FR-010, FR-019, FR-053): the challenge banner at the top center shows the prompt; after a
 * miss the status line shows the landing number and an encouraging phrase; a near miss shows the child's number and
 * the step count, in every play mode (amendments 07 and 17).
 * `data-challenge-answerable` turns true once the challenge accepts answers (1 second after it appears), and
 * `data-help-level` is the help step. The fire button stays the only submit control.
 *
 * Comparison (US4, amendment 09, FR-026, FR-031): the banner names the options after the question, each as its own
 * element (`data-testid="banner-option"`). At help step 1 the tens digit of every option is highlighted
 * (`data-testid="tens-digit"`); a one-digit option has none.
 *
 * Help (US5, T101, FR-030, FR-031, FR-034): during every guided challenge a round help button (at least 48 by 48 CSS
 * pixels, mouse and touch only like "Neue Landschaft"; H is the key) shows the next help step. The status line shows
 * the encouraging phrase of the latest miss (state.message) and the help step's text (`data-testid="help-text"`). At
 * the solution step the fire button reads "Feuer auf {n}". The overlay calls controller.tick() once a second while a
 * challenge is shown, so a parent-set time limit brings the next help step; only with such a limit a thin bar shows
 * the time until then (`data-testid="help-timer"`), with no number and no warning colour.
 *
 * One message line (T230, FR-057): the status line shows at most one child message: the range hint; else the hit text
 * while it is shown; else, after a miss, the encouraging phrase (or the near-miss line) until
 * MISS_MESSAGE_MS after the child can choose again, then the help step's text; else the help step's text. There is no
 * "Gelandet bei N" message: the ruler shows the landing number.
 *
 * Old results leave the screen (T233, FR-004, FR-066): the hit text fades and is gone HIT_FEEDBACK_MS after the hit,
 * and at once when a later challenge starts; the near-miss line stays until the next shot.
 *
 * The challenge card (T234, FR-088): each new challenge first shows the banner large in the middle of the sky
 * (`data-placement="center"`) for CARD_CENTER_MS or until the first input (a digit, a tap on the ruler, a help
 * request, a shot), then large at the top center (`data-placement="top"`).
 *
 * Top left (FR-083, FR-084): a tank symbol with the number of destroyed enemies, and with the parent setting
 * "Uhr beim Spielen zeigen" an up-counting clock, refreshed once a second; it stops while the game is paused.
 *
 * Number pad (amendment 12, FR-102, FR-103): with `numberPad` the control bar also holds the on-screen number pad, and
 * the fire button acts like Enter (`confirm('keyboard')`), so the pad counts as keyboard input for "Finde N". Without
 * the pad the fire button counts as pointer input, as before. `data-number-pad` tells the stylesheet and the tests.
 *
 * US8 (T138, T140, T141, FR-054, FR-055, FR-106): at the top left the pause button before the tank counter; at the top
 * right, beside the gear, the speaker button when speech is available (`onSpeak`, which reads the current challenge
 * again) and the fullscreen button where the browser allows fullscreen (`document.fullscreenEnabled`), which asks for
 * fullscreen on the app root. Both groups stay narrow, so the banner between them covers none of them (FR-104).
 * These buttons are for mouse and touch only, like "Neue Landschaft": they never take focus. While the round is
 * paused the pause screen covers the battle with "Weiterspielen"; Escape, Enter and Space resume it too (useKeyboard).
 *
 * Amendment 23: with `onGarage` (the garage is on) a garage icon sits beside the gear; one tap opens the garage over
 * the battle. It never takes focus and does not show on the round end screen.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { formatTime } from '../core/records/records';
import type { BattleController } from '../core/battle/controller';
import { SOLUTION_HELP_LEVEL } from '../core/battle/guided';
import { acceptsInput, visibleEnemy } from '../core/battle/round';
import { MODE_TRAITS } from '../core/modes';
import { followHit, HIT_FEEDBACK_MS, hitOutdated, type HitOwner } from '../core/view/hitFeedback';
import type { LastShot, PromptSpec, RoundState } from '../core/types';
import { comparisonPrompt, helpText, messageText, promptText, t } from '../i18n';
import { clamp } from '../core/util';
import { NumberPad } from './NumberPad';

/** The hit text is shown this long after the hit (T233). */
export { HIT_FEEDBACK_MS };
/** After a miss the phrase stays this long after the child can choose again, then the help text follows (T230). */
export const MISS_MESSAGE_MS = 2000;
/** A new challenge stays in the middle of the sky this long unless the child starts earlier (T234). */
export const CARD_CENTER_MS = 3000;

interface Props {
  controller: BattleController;
  state: RoundState;
  /** The parent gate's gear, shown at the top right (FR-045, contracts/ui-flows.md battle layout). */
  gear?: ReactNode;
  /** Show the on-screen number pad (amendment 12, FR-102); the app decides from the screen and the setting. */
  numberPad?: boolean;
  /** Reads the current challenge aloud again; the speaker button shows only when this is given (FR-055). */
  onSpeak?: () => void;
  /** Opens the garage over the battle (amendment 23); the garage icon shows only when this is given. */
  onGarage?: () => void;
}

/** Props of a button that never takes focus, so keys cannot press it (like "Neue Landschaft"). */
const noFocus = {
  tabIndex: -1,
  onMouseDown: (e: { preventDefault(): void }) => e.preventDefault(),
  onKeyDown: (e: { preventDefault(): void }) => e.preventDefault(),
} as const;

/** Asks for fullscreen on the app root (FR-054); some browsers refuse, and the game still works. */
function enterFullscreen(from: HTMLElement): void {
  const root = from.closest<HTMLElement>('[data-testid="app-root"]') ?? document.documentElement;
  if (document.fullscreenElement || !root.requestFullscreen) return;
  root.requestFullscreen().catch(() => {});
}

export function BattleOverlay({ controller, state, gear, numberPad = false, onSpeak, onGarage }: Props) {
  const m = t();
  const { min, max } = controller.getRoundSettings().range;
  const choosing = acceptsInput(state.phase);
  const answerable = useAnswerable(controller, state);
  const enemy = visibleEnemy(state);
  // Typed digits are shown exactly as typed (a lone "-" too). A number chosen by pointing is not shown (FR-019).
  const readout = state.entry.typed !== '' ? state.entry.typed : '?';
  // A new round starts only from the round-end screen (amendment 08).
  const sceneLocked = state.phase === 'playerShot' || state.phase === 'enemyTurn' || state.phase === 'paused' || state.phase === 'roundOver';
  const lastShot = state.phase !== 'playerShot' ? state.lastShot : null;
  const showClock = controller.getRoundSettings().showClock;
  const inSearch = state.challenge !== null && state.phase !== 'roundOver';
  const content = inSearch && state.phase !== 'playerShot' ? state.help.content : null;
  const hint = content ? helpText(content) : null;
  const freshHit = useFreshHit(state);
  const missMessageOn = useMissMessage(state);
  const missed = lastShot !== null && !lastShot.hit;
  // One message line (T230): the miss message gives way to the help text once its time is over.
  const showMiss = missed && (hint === null || missMessageOn);
  const encouragement = showMiss && inSearch && !lastShot.nearMiss && state.message?.key === 'encouragement' ? messageText(state.message) : null;
  const placement = useCardPlacement(state);
  const solution = state.help.level === SOLUTION_HELP_LEVEL && state.challenge !== null && state.selection === state.challenge.answer && state.entry.typed === '' ? state.selection : null;
  useHelpTick(controller, state);
  const canFullscreen = document.fullscreenEnabled === true;
  // Amendment 23: no garage icon on the round end screen.
  const showGarage = onGarage !== undefined && state.phase !== 'roundOver';

  return (
    <div
      className="battle-overlay"
      data-testid="battle-overlay"
      data-phase={state.phase}
      data-turn={state.turn}
      data-round-seed={state.seed}
      data-player-side={state.playerSide}
      data-lives={state.lives}
      data-enemies-destroyed={state.enemiesDestroyed}
      data-miss-streak={state.missStreak}
      data-outcome={state.outcome ?? undefined}
      data-challenge-answerable={answerable}
      data-help-level={state.help.level}
      data-selection={state.selection ?? undefined}
      data-last-landing={state.lastShot?.landed ?? undefined}
      data-last-distance={state.lastShot?.distance ?? undefined}
      data-last-shot={state.lastShot ? lastShotKind(state.lastShot) : undefined}
      data-enemy-number={enemy?.position}
      data-number-pad={numberPad}
      data-mode={state.mode}
      data-skill-step={state.challenge?.difficultyStep}
    >
      {/* "Nur Zahlenstrahl" has no question banner: the child reads the ruler (amendment 17, FR-122). */}
      {state.challenge && MODE_TRAITS[state.mode].showsQuestion && (
        <div className={`challenge-banner placement-${placement}`} data-testid="challenge-banner" data-placement={placement}>
          <BannerText prompt={state.challenge.prompt} tens={state.help.content?.tensDigits === true} />
        </div>
      )}

      <div className="status-line" role="status" aria-live="polite">
        {state.entry.outOfRange ? (
          <span className="range-hint">{m.battle.rangeHint(min, max)}</span>
        ) : lastShot?.hit && freshHit ? (
          // The hit names the number the destroyed enemy stood at, also after the new one appeared (FR-066, FR-068);
          // it fades and is gone after HIT_FEEDBACK_MS (T233). A hit that does not count reads "Getroffen, mit Hilfe."
          // (amendment 18, FR-129).
          <span className="landed hit fade-out" data-testid="hit-feedback">
            {lastShot.uncounted ? m.battle.hitWithHelp : m.battle.hit} {m.battle.enemyStoodAt(lastShot.enemyNumber)}
          </span>
        ) : showMiss && lastShot.nearMiss ? (
          // On a tank body but not exact: a miss with the child's number and the distance, never "falsch" and never the
          // enemy's number (FR-072, changed by product owner). In a comparison turn the distance is to the nearest
          // standing tank, so it does not show which tank is the enemy.
          <span className="landed near" data-testid="hit-feedback">
            {m.battle.near} <span data-testid="compare">{m.battle.compare(lastShot.fired, lastShot.targetNumber)}</span>
          </span>
        ) : encouragement ? (
          <span className="encouragement" data-testid="encouragement">
            {encouragement}
          </span>
        ) : hint ? (
          <span className="help-text" data-testid="help-text">
            {hint}
          </span>
        ) : null}
      </div>

      <div className="top-left">
        <button
          type="button"
          className="icon-button pause-button"
          data-testid="pause-button"
          aria-label={m.battle.pause}
          title={m.battle.pause}
          disabled={state.phase === 'roundOver' || state.phase === 'paused'}
          {...noFocus}
          onClick={() => controller.pause()}
        >
          <span aria-hidden="true">⏸</span>
        </button>
        <div className="score" data-testid="score" role="img" aria-label={`${m.battle.score}: ${state.enemiesDestroyed}`}>
          <TankIcon />
          <span aria-hidden="true">{state.enemiesDestroyed}</span>
        </div>
        {showClock && <Clock controller={controller} running={state.phase !== 'paused'} />}
      </div>

      {(gear || canFullscreen || onSpeak || showGarage) && (
        <div className="top-right">
          {showGarage && (
            <button
              type="button"
              className="icon-button garage-icon"
              data-testid="battle-garage"
              aria-label={m.battle.garage}
              title={m.battle.garage}
              {...noFocus}
              onClick={onGarage}
            >
              <GarageIcon />
            </button>
          )}
          {gear}
          {onSpeak && (
            <button type="button" className="icon-button speaker-button" data-testid="speaker-button" aria-label={m.battle.speak} title={m.battle.speak} {...noFocus} onClick={onSpeak}>
              <span aria-hidden="true">🔊</span>
            </button>
          )}
          {canFullscreen && (
            <button
              type="button"
              className="icon-button"
              data-testid="battle-fullscreen"
              aria-label={m.start.fullscreen}
              title={m.start.fullscreen}
              {...noFocus}
              onClick={(e) => enterFullscreen(e.currentTarget)}
            >
              <span aria-hidden="true">⛶</span>
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        className="icon-button new-scene-button"
        data-testid="new-scene"
        aria-label={m.battle.newScene}
        title={m.battle.newScene}
        tabIndex={-1}
        disabled={sceneLocked}
        onMouseDown={(e) => e.preventDefault()}
        onKeyDown={(e) => e.preventDefault()}
        onClick={() => controller.newScene()}
      >
        <span aria-hidden="true">↻</span>
      </button>

      {inSearch && (
        <button
          type="button"
          className="icon-button help-button"
          data-testid="help-button"
          aria-label={m.battle.help}
          title={m.battle.help}
          tabIndex={-1}
          disabled={state.phase !== 'challenge' || state.help.level >= SOLUTION_HELP_LEVEL}
          onMouseDown={(e) => e.preventDefault()}
          onKeyDown={(e) => e.preventDefault()}
          onClick={() => controller.requestHelp()}
        >
          <span aria-hidden="true">?</span>
        </button>
      )}
      {inSearch && <HelpTimer controller={controller} state={state} />}

      <div className="controls">
        <div className="readout" aria-label={m.battle.yourNumber}>
          <span className="readout-label">{m.battle.yourNumber}</span>
          {/* T153 (FR-053): screen readers announce the typed digits; while pointing it shows "?" (amendment 05). */}
          <span className="readout-value" data-testid="readout" aria-live="polite">
            {readout}
          </span>
        </div>
        {numberPad && (
          <NumberPad
            negative={min < 0}
            disabled={!choosing}
            onDigit={(d) => controller.typeDigit(d)}
            onMinus={() => controller.typeMinus()}
            onBackspace={() => controller.backspace()}
          />
        )}
        <button
          type="button"
          className="fire-button"
          disabled={!choosing}
          tabIndex={numberPad ? -1 : undefined}
          onMouseDown={numberPad ? (e) => e.preventDefault() : undefined}
          // The pad's fire key acts like Enter, so it counts as keyboard input (FR-103).
          onClick={() => controller.confirm(numberPad ? 'keyboard' : 'pointer')}
        >
          {solution !== null ? m.battle.fireAt(solution) : m.battle.fire}
        </button>
      </div>

      {state.phase === 'paused' && (
        <div className="pause-screen" data-testid="pause-screen">
          <h2 className="pause-title">{m.battle.pause}</h2>
          <button type="button" className="play-button" {...noFocus} onClick={() => controller.resume()}>
            {m.battle.resume}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * True once `ms` have passed while `running` since `key` became the current key; false for a null key. A new key
 * starts the wait again, and a pause (`running` false) starts it again when it ends.
 */
function useExpired<K>(key: K | null, ms: number, running = true): boolean {
  const [expired, setExpired] = useState<K | null>(null);
  useEffect(() => {
    if (key === null || !running) return;
    const id = setTimeout(() => setExpired(() => key), ms);
    return () => clearTimeout(id);
  }, [key, ms, running]);
  return key !== null && expired === key;
}

/**
 * Once a second while `running`: calls `each` when given, else re-renders the caller (decision D1, FR-034, FR-084).
 * `each` must keep its identity between renders, or the second starts again.
 */
function useEverySecond(running: boolean, each?: () => void): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => (each ? each() : setTick((n) => n + 1)), 1000);
    return () => clearInterval(id);
  }, [running, each]);
}

/**
 * True while the latest hit's text is shown (T233): for HIT_FEEDBACK_MS after the hit, and only as long as the
 * challenge that came with the hit is still the current one.
 */
function useFreshHit(state: RoundState): boolean {
  // The hit belongs to the challenge shown after it (followHit).
  const seen = useRef<HitOwner | null>(null);
  seen.current = followHit(seen.current, state);
  const owner = seen.current;
  const expired = useExpired(owner?.shot ?? null, HIT_FEEDBACK_MS);
  return owner !== null && !expired && owner.challenge !== undefined && !hitOutdated(owner, state);
}

/**
 * True while the message of the latest miss is shown (T230): from the miss until MISS_MESSAGE_MS after the child can
 * choose again (phase 'challenge').
 */
function useMissMessage(state: RoundState): boolean {
  const shot = state.lastShot && !state.lastShot.hit ? state.lastShot : null;
  const expired = useExpired(shot, MISS_MESSAGE_MS, acceptsInput(state.phase));
  return shot !== null && !expired;
}

/**
 * Where the challenge card stands (T234): 'center' for a new challenge, 'top' after CARD_CENTER_MS or from the first
 * input on (a typed digit, a chosen number, a help request, a shot).
 */
function useCardPlacement(state: RoundState): 'center' | 'top' {
  const challenge = state.challenge;
  const input = state.entry.typed !== '' || state.selection !== null || state.help.level > 0 || state.phase === 'playerShot' || state.phase === 'enemyTurn';
  const moved = useRef<{ challenge: RoundState['challenge']; top: boolean }>({ challenge: null, top: false });
  if (moved.current.challenge !== challenge) moved.current = { challenge, top: false };
  if (input) moved.current.top = true;
  const timedOut = useExpired(challenge, CARD_CENTER_MS);
  return moved.current.top || challenge === null || timedOut ? 'top' : 'center';
}

/** True once the current challenge accepts answers; re-renders when the 1-second wait ends (edge case "Rapid tapping"). */
function useAnswerable(controller: BattleController, state: RoundState): boolean {
  const [, setTick] = useState(0);
  const waiting = state.phase === 'challenge' && state.challenge !== null ? controller.answerableIn() : 0;
  useEffect(() => {
    if (waiting <= 0) return;
    const id = setTimeout(() => setTick((n) => n + 1), waiting);
    return () => clearTimeout(id);
  }, [waiting, state.answerableAt]);
  return state.phase === 'challenge' && state.challenge !== null && state.answerableAt !== null && waiting <= 0;
}

/** Calls controller.tick() once a second while a challenge is shown (decision D1, FR-034). */
function useHelpTick(controller: BattleController, state: RoundState): void {
  const tick = useCallback(() => controller.tick(), [controller]);
  useEverySecond(state.phase === 'challenge' && state.challenge !== null, tick);
}

/**
 * The time until a parent-set time limit shows the next help step (FR-034): a thin bar that shrinks, with no number.
 * Shown only when the controller reports a limit; re-read once a second.
 */
function HelpTimer({ controller, state }: { controller: BattleController; state: RoundState }) {
  const left = controller.helpTimeLeftMs();
  const limit = controller.getRoundSettings().timeLimitSeconds;
  useEverySecond(left !== null && state.phase === 'challenge');
  if (left === null || limit === null) return null;
  const share = clamp(left / (limit * 1000), 0, 1);
  return (
    <div className="help-timer" data-testid="help-timer" role="img" aria-label={t().battle.helpSoon}>
      <div className="help-timer-fill" style={{ width: `${Math.round(share * 100)}%` }} />
    </div>
  );
}

function lastShotKind(shot: LastShot): 'hit' | 'near' | 'miss' {
  if (shot.hit) return 'hit';
  return shot.nearMiss ? 'near' : 'miss';
}

/**
 * The up-counting clock m:ss (FR-084); it re-reads the controller's time once a second. While the game is paused the
 * time stands still, so it does not re-read then.
 */
function Clock({ controller, running }: { controller: BattleController; running: boolean }) {
  useEverySecond(running);
  return (
    <div className="clock" data-testid="clock" aria-label={t().battle.clock}>
      {formatTime(controller.elapsedMs())}
    </div>
  );
}

/** A small enemy tank: red angular body, turret and a black flag, like the enemy on the battlefield (FR-077, FR-083). */
function TankIcon() {
  return (
    <svg viewBox="0 0 40 26" aria-hidden="true" focusable="false">
      <line x1="10" y1="12" x2="10" y2="2" stroke="#2b2f36" strokeWidth="1.5" />
      <path d="M10 2 L18 5 L10 8 Z" fill="#111" />
      <rect x="20" y="9" width="16" height="3" rx="1" fill="#b3261e" transform="rotate(-20 20 10)" />
      <path d="M8 12 L30 12 L36 18 L36 22 L2 22 L2 18 Z" fill="#b3261e" stroke="#4a0f0b" strokeWidth="1.5" />
      <rect x="4" y="22" width="30" height="3" rx="1.5" fill="#2b2f36" />
    </svg>
  );
}

/**
 * The banner text: the prompt, or for a comparison the question followed by the options, each in its own element so
 * help step 1 can highlight its tens digit (amendment 09, FR-026, FR-031).
 */
function BannerText({ prompt, tens }: { prompt: PromptSpec; tens: boolean }) {
  const comparison = comparisonPrompt(prompt);
  if (!comparison) return <>{promptText(prompt)}</>;
  return (
    <>
      {comparison.lead}{' '}
      {comparison.options.map((o, i) => (
        <span key={i}>
          {i > 0 && comparison.separator}
          <span className="banner-option" data-testid="banner-option">
            {tens ? <TensDigit n={o} /> : o}
          </span>
        </span>
      ))}
    </>
  );
}

/** A number with its tens digit highlighted; a one-digit number stays as it is. */
function TensDigit({ n }: { n: number }) {
  const text = String(n);
  const sign = text.startsWith('-') ? '-' : '';
  const digits = text.slice(sign.length);
  if (digits.length < 2) return <>{text}</>;
  const at = digits.length - 2;
  return (
    <>
      {sign}
      {digits.slice(0, at)}
      <span className="tens-digit" data-testid="tens-digit">
        {digits[at]}
      </span>
      {digits.slice(at + 1)}
    </>
  );
}

/** A small garage: a roof over a wide door with slats (amendment 23). */
function GarageIcon() {
  return (
    <svg className="garage-icon-svg" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true" focusable="false">
      <path d="M3 14 L16 4 L29 14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 13 V28 H25 V13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M10 17 H22 M10 21 H22 M10 25 H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

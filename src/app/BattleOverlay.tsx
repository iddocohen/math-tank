/**
 * Battle overlay (FR-003, FR-019, FR-053, FR-063): at the bottom right the large readout of typed digits and the
 * fire button. There are no angle or power controls (amendment 01). Amendment 05 removed the −1 and +1 buttons
 * (no stepping toward the answer) and the corner health bars: each tank's health bar is drawn above it in the
 * canvas (FR-078). While the child points on the ruler the readout shows no number (FR-019), and the fire button
 * counts as pointer input (FR-076).
 * At the right side, the "Neue Landschaft" button starts a new scene (amendment 03, FR-070). It is for mouse and
 * touch only: it never takes focus and ignores keys, so a keyboard player cannot press it by accident.
 *
 * The root carries the data-* attributes the end-to-end tests read (tasks.md D4); there is no global debug API.
 * `data-enemy-number` is set only while the enemy is visible, so a test cannot read a hidden enemy's number.
 * `data-last-shot` names the result of the last player shot (amendment 06): `hit` (the exact number, the enemy was
 * destroyed), `near` (on the tank body but not exact) or `miss`. `data-lives`, `data-enemies-destroyed`,
 * `data-shots-since-enemy-fire` and `data-outcome` replace the health attributes.
 *
 * Hit feedback (amendment 06, FR-066, FR-072, contracts/ui-flows.md): a hit shows "Getroffen!" and the number the
 * enemy stood at; a near miss on the body shows "Ganz knapp! Triff die Linie." with both numbers and the distance;
 * a miss shows the landing number.
 *
 * Top left (FR-083, FR-084): a tank symbol with the number of destroyed enemies, and with the parent setting
 * "Uhr beim Spielen zeigen" an up-counting clock, refreshed once a second; it stops while the game is paused.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { formatTime } from '../core/records/records';
import type { BattleController } from '../core/battle/controller';
import { visibleEnemy } from '../core/battle/round';
import type { LastShot, RoundState } from '../core/types';
import { t } from '../i18n';

interface Props {
  controller: BattleController;
  state: RoundState;
  /** The parent gate's gear, shown at the top right (FR-045, contracts/ui-flows.md battle layout). */
  gear?: ReactNode;
}

export function BattleOverlay({ controller, state, gear }: Props) {
  const m = t();
  const { min, max } = controller.getRoundSettings().range;
  const choosing = state.phase === 'aiming' || state.phase === 'challenge';
  const answerable = state.challenge !== null && state.answerableAt !== null && state.phase === 'challenge';
  const enemy = visibleEnemy(state);
  // Typed digits are shown exactly as typed (a lone "-" too). A number chosen by pointing is not shown (FR-019).
  const readout = state.entry.typed !== '' ? state.entry.typed : '?';
  const sceneLocked = state.phase === 'playerShot' || state.phase === 'enemyTurn' || state.phase === 'paused';
  const lastShot = state.phase !== 'playerShot' ? state.lastShot : null;
  const showClock = controller.getRoundSettings().showClock;

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
      data-shots-since-enemy-fire={state.shotsSinceEnemyFire}
      data-outcome={state.outcome ?? undefined}
      data-challenge-answerable={answerable}
      data-selection={state.selection ?? undefined}
      data-last-landing={state.lastShot?.landed ?? undefined}
      data-last-shot={state.lastShot ? lastShotKind(state.lastShot) : undefined}
      data-enemy-number={enemy?.position}
    >
      <div className="status-line" role="status" aria-live="polite">
        {state.entry.outOfRange ? (
          <span className="range-hint">{m.battle.rangeHint(min, max)}</span>
        ) : lastShot?.hit ? (
          // The hit names the number the destroyed enemy stood at, also after the new one appeared (FR-066, FR-068).
          <span className="landed hit" data-testid="hit-feedback">
            {m.battle.hit} {m.battle.enemyStoodAt(lastShot.enemyNumber)}
          </span>
        ) : lastShot?.nearMiss ? (
          // On the tank body but not exact: a miss with both numbers and the distance, never "falsch" (FR-072).
          <span className="landed near" data-testid="hit-feedback">
            {m.battle.near} <span data-testid="compare">{m.battle.compare(lastShot.fired, lastShot.enemyNumber)}</span>
          </span>
        ) : lastShot ? (
          <span className="landed">{m.battle.landedAt(lastShot.landed)}</span>
        ) : null}
      </div>

      <div className="top-left">
        <div className="score" data-testid="score" role="img" aria-label={`${m.battle.score}: ${state.enemiesDestroyed}`}>
          <TankIcon />
          <span aria-hidden="true">{state.enemiesDestroyed}</span>
        </div>
        {showClock && <Clock controller={controller} />}
      </div>

      {gear && <div className="top-right">{gear}</div>}

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

      <div className="controls">
        <div className="readout" aria-label={m.battle.yourNumber}>
          <span className="readout-label">{m.battle.yourNumber}</span>
          <span className="readout-value" data-testid="readout">
            {readout}
          </span>
        </div>
        <button type="button" className="fire-button" disabled={!choosing} onClick={() => controller.confirm('pointer')}>
          {m.battle.fire}
        </button>
      </div>
    </div>
  );
}

function lastShotKind(shot: LastShot): 'hit' | 'near' | 'miss' {
  if (shot.hit) return 'hit';
  return shot.nearMiss ? 'near' : 'miss';
}

/** The up-counting clock m:ss (FR-084); it re-reads the controller's time once a second. */
function Clock({ controller }: { controller: BattleController }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
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

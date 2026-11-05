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
 * `data-last-shot` names the result of the last player shot (amendment 04): `bullseye`, `body`, `close` (on the tank
 * body without damage under "Genau treffen") or `miss`.
 *
 * Hit feedback (amendment 04, FR-071, FR-072, FR-074, contracts/ui-flows.md): a Volltreffer names the enemy's
 * number; a body hit that is not exact shows "Treffer!" or, under "Genau treffen", "Ganz knapp!", with both
 * numbers and the distance; a miss shows the landing number.
 */
import type { ReactNode } from 'react';
import type { BattleController } from '../core/battle/controller';
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
  const enemyVisible = state.enemyFound && state.enemy.alive;
  // Typed digits are shown exactly as typed (a lone "-" too). A number chosen by pointing is not shown (FR-019).
  const readout = state.entry.typed !== '' ? state.entry.typed : '?';
  const sceneLocked = state.phase === 'playerShot' || state.phase === 'enemyTurn' || state.phase === 'paused';
  const lastShot = state.phase !== 'playerShot' ? state.lastShot : null;

  return (
    <div
      className="battle-overlay"
      data-testid="battle-overlay"
      data-phase={state.phase}
      data-turn={state.turn}
      data-round-seed={state.seed}
      data-player-side={state.playerSide}
      data-player-health={Math.round(state.player.health)}
      data-enemy-health={Math.round(state.enemy.health)}
      data-challenge-answerable={answerable}
      data-selection={state.selection ?? undefined}
      data-last-landing={state.lastShot?.landed ?? undefined}
      data-last-shot={state.lastShot ? lastShotKind(state.lastShot) : undefined}
      data-enemy-number={enemyVisible ? state.enemy.position : undefined}
    >
      <div className="status-line" role="status" aria-live="polite">
        {state.entry.outOfRange ? (
          <span className="range-hint">{m.battle.rangeHint(min, max)}</span>
        ) : lastShot?.bullseye && lastShot.hit ? (
          // A Volltreffer names the number the enemy stood at, also after it has moved (FR-068, FR-071).
          <span className="landed hit bullseye" data-testid="hit-feedback">
            {m.battle.bullseye} {m.battle.enemyStoodAt(lastShot.enemyNumber)}
          </span>
        ) : lastShot?.bodyHit ? (
          // On the tank body but not exact: both numbers and the distance, never "falsch" (FR-072, FR-074).
          <span className={lastShot.hit ? 'landed hit' : 'landed close'} data-testid="hit-feedback">
            {lastShot.hit ? m.battle.bodyHit : m.battle.close}{' '}
            <span data-testid="compare">{m.battle.compare(lastShot.fired, lastShot.enemyNumber)}</span>
          </span>
        ) : lastShot ? (
          <span className="landed">{m.battle.landedAt(lastShot.landed)}</span>
        ) : null}
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

function lastShotKind(shot: LastShot): 'bullseye' | 'body' | 'close' | 'miss' {
  if (shot.bullseye && shot.hit) return 'bullseye';
  if (shot.bodyHit) return shot.hit ? 'body' : 'close';
  return 'miss';
}

/**
 * Battle overlay (FR-003, FR-019, FR-053, FR-063): health bars at the top; at the bottom right the large number
 * readout, −1 and +1 buttons and the fire button. There are no angle or power controls (amendment 01).
 * At the right side, the "Neue Landschaft" button starts a new scene (amendment 03, FR-070). It is for mouse and
 * touch only: it never takes focus and ignores keys, so a keyboard player cannot press it by accident.
 *
 * The root carries the data-* attributes the end-to-end tests read (tasks.md D4); there is no global debug API.
 * `data-enemy-number` is set only while the enemy is visible, so a test cannot read a hidden enemy's number.
 */
import type { BattleController } from '../core/battle/controller';
import type { RoundState } from '../core/types';
import { t } from '../i18n';

interface Props {
  controller: BattleController;
  state: RoundState;
}

export function BattleOverlay({ controller, state }: Props) {
  const m = t();
  const { min, max } = controller.getRoundSettings().range;
  const choosing = state.phase === 'aiming' || state.phase === 'challenge';
  const answerable = state.challenge !== null && state.answerableAt !== null && state.phase === 'challenge';
  const enemyVisible = state.enemyFound && state.enemy.alive;
  // Typed digits are shown exactly as typed (a lone "-" too); otherwise the previewed number.
  const readout = state.entry.typed !== '' ? state.entry.typed : state.selection !== null ? String(state.selection) : '?';
  const sceneLocked = state.phase === 'playerShot' || state.phase === 'enemyTurn' || state.phase === 'paused';
  const landed = state.lastShot && state.phase !== 'playerShot' ? state.lastShot.landed : null;

  const playerBar = <HealthBar label={m.battle.playerHealth} health={state.player.health} kind="player" />;
  const enemyBar = <HealthBar label={m.battle.enemyHealth} health={state.enemy.health} kind="enemy" />;

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
      data-enemy-number={enemyVisible ? state.enemy.position : undefined}
    >
      <div className="top-bars">
        {state.playerSide === 'left' ? playerBar : enemyBar}
        {state.playerSide === 'left' ? enemyBar : playerBar}
      </div>

      <div className="status-line" role="status" aria-live="polite">
        {state.entry.outOfRange ? (
          <span className="range-hint">{m.battle.rangeHint(min, max)}</span>
        ) : landed !== null ? (
          <span className="landed">{m.battle.landedAt(landed)}</span>
        ) : null}
      </div>

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
        <div className="nudge-row">
          <button type="button" className="step-button" aria-label={m.battle.minusOneLabel} disabled={!choosing || state.selection === min} onClick={() => controller.nudge(-1)}>
            {m.battle.minusOne}
          </button>
          <button type="button" className="step-button" aria-label={m.battle.plusOneLabel} disabled={!choosing || state.selection === max} onClick={() => controller.nudge(1)}>
            {m.battle.plusOne}
          </button>
        </div>
        <button type="button" className="fire-button" disabled={!choosing} onClick={() => controller.confirm()}>
          {m.battle.fire}
        </button>
      </div>
    </div>
  );
}

function HealthBar({ label, health, kind }: { label: string; health: number; kind: 'player' | 'enemy' }) {
  const value = Math.max(0, Math.round(health));
  return (
    <div className={`health health-${kind}`}>
      <span className="health-label">{label}</span>
      <div className="health-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <div className="health-fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

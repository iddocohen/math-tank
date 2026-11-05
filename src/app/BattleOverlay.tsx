/**
 * Battle overlay (FR-003, FR-053): health bars at the top, angle and power controls and the
 * fire button at the bottom right. The root carries the data-* attributes that the end-to-end
 * tests read (tasks.md D4); there is no global debug API.
 *
 * The angle is shown toward the enemy side: 0 is flat toward the enemy, 90 is straight up,
 * so "plus" always raises the cannon whichever side the player stands on.
 */
import type { BattleController } from '../core/battle/controller';
import type { RoundState } from '../core/types';
import { t } from '../i18n';

const ANGLE_STEP = 5;
const POWER_STEP = 5;

interface Props {
  controller: BattleController;
  state: RoundState;
}

export function BattleOverlay({ controller, state }: Props) {
  const m = t();
  const aiming = state.phase === 'aiming';
  const toDisplay = (angleDeg: number) => (state.playerSide === 'left' ? angleDeg : 180 - angleDeg);
  const angle = Math.round(toDisplay(state.aim.angleDeg));
  const power = Math.round(state.aim.power);
  const setAngle = (display: number) => controller.setAim(toDisplay(clamp(display, 0, 180)), state.aim.power);
  const setPower = (p: number) => controller.setAim(state.aim.angleDeg, clamp(p, 0, 100));
  const answerable = state.challenge !== null && state.answerableAt !== null && state.phase === 'challenge';

  const playerBar = <HealthBar label={m.battle.playerHealth} health={state.player.health} kind="player" />;
  const enemyBar = <HealthBar label={m.battle.enemyHealth} health={state.enemy.health} kind="enemy" />;

  return (
    <div
      className="battle-overlay"
      data-testid="battle-overlay"
      data-phase={state.phase}
      data-turn={state.turn}
      data-player-health={Math.round(state.player.health)}
      data-enemy-health={Math.round(state.enemy.health)}
      data-challenge-answerable={answerable}
    >
      <div className="top-bars">
        {state.playerSide === 'left' ? playerBar : enemyBar}
        {state.playerSide === 'left' ? enemyBar : playerBar}
      </div>

      <div className="controls">
        <Stepper
          label={m.battle.angle}
          value={angle}
          unit="°"
          min={0}
          max={180}
          step={ANGLE_STEP}
          upLabel={m.battle.angleUp}
          downLabel={m.battle.angleDown}
          disabled={!aiming}
          onChange={setAngle}
        />
        <Stepper
          label={m.battle.power}
          value={power}
          unit=""
          min={0}
          max={100}
          step={POWER_STEP}
          upLabel={m.battle.powerUp}
          downLabel={m.battle.powerDown}
          disabled={!aiming}
          onChange={setPower}
        />
        <button type="button" className="fire-button" disabled={!aiming} onClick={() => controller.fire()}>
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

interface StepperProps {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  upLabel: string;
  downLabel: string;
  disabled: boolean;
  onChange: (v: number) => void;
}

function Stepper({ label, value, unit, min, max, step, upLabel, downLabel, disabled, onChange }: StepperProps) {
  const m = t();
  return (
    <div className="stepper">
      <div className="stepper-head">
        <span className="stepper-label">{label}</span>
        <span className="stepper-value">
          {value}
          {unit}
        </span>
      </div>
      <div className="stepper-row">
        <button type="button" className="step-button" aria-label={downLabel} disabled={disabled || value <= min} onClick={() => onChange(value - step)}>
          {m.battle.minus}
        </button>
        <input
          type="range"
          className="slider"
          aria-label={label}
          min={min}
          max={max}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.currentTarget.value))}
        />
        <button type="button" className="step-button" aria-label={upLabel} disabled={disabled || value >= max} onClick={() => onChange(value + step)}>
          {m.battle.plus}
        </button>
      </div>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

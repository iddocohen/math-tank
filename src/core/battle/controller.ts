/**
 * BattleController (research R4, contracts/core-api.md core/battle): the single state machine for a round.
 * React and Phaser subscribe to it and call its methods; neither changes state directly.
 * Each change produces a new RoundState object, so `useSyncExternalStore` sees it.
 *
 * This phase covers free play. Guided mode, challenges and help arrive in later phases.
 */
import { createRng, deriveSeed, type Rng } from '../rng';
import type { RoundState, Settings, ShotInFlight, TankState } from '../types';
import { simulateShot } from '../physics/ballistics';
import { BLAST_RADIUS } from '../physics/damage';
import { enemyDamageFactor, enemyShot } from '../ai/enemy';
import type { ProgressStore, Speaker } from './ports';
import { applyImpact, blastRadiusFor, createRound, muzzle, tankCenter, TANK_HIT_RADIUS, WORLD_HEIGHT, WORLD_WIDTH, type DamageRules } from './round';

export interface BattleDeps {
  settings: Settings;
  progress: ProgressStore;
  clock: () => number;
  /** Base seed; each round derives its own seed from it. Defaults to the clock. */
  seed?: number;
  speaker?: Speaker;
}

type Listener = (s: RoundState) => void;

export class BattleController {
  private readonly deps: BattleDeps;
  private readonly baseSeed: number;
  private nextSettings: Settings;
  /** Settings snapshot for the current round (FR-049). */
  private settings: Settings;
  private state: RoundState;
  private readonly listeners = new Set<Listener>();
  private roundIndex = 0;
  private nextSide: 'left' | 'right';
  private enemyRng: Rng = createRng(0);
  private enemyShotIndex = 0;
  private phaseBeforePause: RoundState['phase'] | null = null;

  constructor(deps: BattleDeps) {
    this.deps = deps;
    this.baseSeed = (deps.seed ?? Math.floor(deps.clock())) >>> 0;
    this.nextSettings = structuredClone(deps.settings);
    this.settings = this.nextSettings;
    this.nextSide = createRng(deriveSeed(this.baseSeed, 0)).next() < 0.5 ? 'left' : 'right';
    // A placeholder round until startRound; it is never shown.
    this.state = { ...createRound(this.settings, this.baseSeed, this.nextSide), phase: 'roundOver' };
  }

  getState(): RoundState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** New settings apply from the next round (FR-049). */
  setSettings(settings: Settings): void {
    this.nextSettings = structuredClone(settings);
  }

  startRound(mode: 'guided' | 'freePlay'): void {
    if (mode === 'guided') throw new Error('Guided mode is not implemented yet; start a free-play round.');
    this.settings = structuredClone(this.nextSettings);
    const seed = deriveSeed(this.baseSeed, ++this.roundIndex);
    const side = this.nextSide;
    this.nextSide = side === 'left' ? 'right' : 'left';
    this.enemyRng = createRng(deriveSeed(seed, 2));
    this.enemyShotIndex = 0;
    this.phaseBeforePause = null;
    this.set(createRound(this.settings, seed, side, mode));
  }

  setAim(angleDeg: number, power: number): void {
    if (this.state.phase !== 'aiming') return;
    this.set({ ...this.state, aim: { angleDeg: clamp(angleDeg, 0, 180), power: clamp(power, 0, 100) } });
  }

  /** Computes the whole flight; the renderer replays it and then calls shotAnimationDone. */
  fire(): void {
    if (this.state.phase !== 'aiming') return;
    const s = this.state;
    const shot = this.computeShot('player', s.player, s.aim.angleDeg, s.aim.power, blastRadiusFor(s.charged));
    this.set({ ...s, phase: 'playerShot', shot });
  }

  shotAnimationDone(): void {
    if (this.state.phase !== 'playerShot' || !this.state.shot) return;
    const shot = this.state.shot;
    const s = this.impact(shot);
    const next: RoundState = { ...s, turn: s.turn + 1, charged: false, lastPlayerPath: shot.path, shot: null };
    const outcome = deadOutcome(next);
    if (outcome) {
      this.set({ ...next, phase: 'roundOver', outcome });
      return;
    }
    this.set({ ...next, phase: 'enemyTurn', shot: this.nextEnemyShot(next) });
  }

  enemyShotAnimationDone(): void {
    if (this.state.phase !== 'enemyTurn' || !this.state.shot) return;
    const s = { ...this.impact(this.state.shot), shot: null };
    const outcome = deadOutcome(s) ?? (s.turn >= this.settings.roundLength ? 'turnsUsed' : null);
    this.set(outcome ? { ...s, phase: 'roundOver', outcome } : { ...s, phase: 'aiming' });
  }

  pause(): void {
    const phase = this.state.phase;
    if (phase === 'paused' || phase === 'roundOver') return;
    this.phaseBeforePause = phase;
    this.set({ ...this.state, phase: 'paused' });
  }

  resume(): void {
    if (this.state.phase !== 'paused' || this.phaseBeforePause === null) return;
    const phase = this.phaseBeforePause;
    this.phaseBeforePause = null;
    this.set({ ...this.state, phase });
  }

  private nextEnemyShot(s: RoundState): ShotInFlight {
    const origin = muzzle(s.enemy);
    const aim = enemyShot({
      difficulty: this.settings.enemyDifficulty,
      rng: this.enemyRng,
      shotIndexInRound: this.enemyShotIndex++,
      origin,
      target: tankCenter(s.player),
      terrain: s.terrain,
      worldWidth: WORLD_WIDTH,
      worldHeight: WORLD_HEIGHT,
    });
    return this.computeShot('enemy', s.enemy, aim.angleDeg, aim.power, BLAST_RADIUS);
  }

  private computeShot(shooter: ShotInFlight['shooter'], from: TankState, angleDeg: number, power: number, blastRadius: number): ShotInFlight {
    const s = this.state;
    // The shooter is not a target: its shell starts inside its own hit circle.
    const targets = [s.player, s.enemy, ...s.decoys]
      .filter((t) => t.alive && t.id !== from.id)
      .map((t) => ({ id: t.id, ...tankCenter(t), radius: TANK_HIT_RADIUS }));
    const r = simulateShot({ origin: muzzle(from), angleDeg, power, terrain: s.terrain, targets, worldWidth: WORLD_WIDTH, worldHeight: WORLD_HEIGHT });
    return { shooter, path: r.path, impact: r.impact, hitTargetId: r.hitTargetId, outOfBounds: r.outOfBounds, blastRadius };
  }

  private impact(shot: ShotInFlight): RoundState {
    const rules: DamageRules = { enemyDamageFactor: enemyDamageFactor(this.settings.enemyDifficulty), noDamage: this.settings.noDamage };
    return applyImpact(this.state, { point: shot.impact, hitTargetId: shot.hitTargetId, outOfBounds: shot.outOfBounds, shooter: shot.shooter }, shot.blastRadius, rules);
  }

  private set(next: RoundState): void {
    this.state = next;
    for (const listener of [...this.listeners]) listener(next);
  }
}

/** A destroyed enemy wins the round for the player, even if both tanks are destroyed by the same shell. */
function deadOutcome(s: RoundState): RoundState['outcome'] {
  if (!s.enemy.alive) return 'playerWon';
  if (!s.player.alive) return 'enemyWon';
  return null;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

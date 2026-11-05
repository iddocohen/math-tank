/**
 * BattleController (research R4, contracts/core-api.md core/battle): the single state machine for a round.
 * React and Phaser subscribe to it and call its methods; neither changes state directly.
 * Each change produces a new RoundState object, so `useSyncExternalStore` sees it.
 *
 * Amendment 01: the player aims by choosing a number. The cannon is fixed and solveArcToX computes the arc,
 * so the shell always lands at the chosen number. This phase covers free play; guided mode arrives later.
 */
import { createRng, deriveSeed, type Rng } from '../rng';
import type { RoundState, Settings, ShotInFlight, TankState } from '../types';
import { simulateShot } from '../physics/ballistics';
import { solveArcToX } from '../physics/arc';
import { BLAST_RADIUS } from '../physics/damage';
import { DEFAULT_LAYOUT, numberToX, xToNumber } from '../numberline/mapping';
import { enemyDamageFactor, enemyShot } from '../ai/enemy';
import type { ProgressStore, Speaker } from './ports';
import { applyKey, emptyEntry, type Digit, type EntryKey } from './entry';
import {
  applyImpact,
  createRound,
  enemyPositionFor,
  moveTank,
  muzzle,
  tankCenter,
  TANK_HIT_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type DamageRules,
  type Impact,
} from './round';

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
  /** The number of the player's shell in flight. */
  private firedNumber: number | null = null;

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

  /** The settings snapshot of the current round (range and label level for the views). */
  getRoundSettings(): Readonly<Settings> {
    return this.settings;
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
    this.firedNumber = null;
    this.set(createRound(this.settings, seed, side, mode));
  }

  /**
   * "Neue Landschaft" button (amendment 03, FR-070): a new round in the same mode at once. Ignored while a shell
   * is in flight or the game is paused. An unfinished challenge is dropped without recording an attempt.
   */
  newScene(): void {
    const { phase, mode } = this.state;
    if (phase === 'playerShot' || phase === 'enemyTurn' || phase === 'paused') return;
    this.startRound(mode);
  }

  /** Pointer preview: clears typed digits and never fires. */
  selectNumber(n: number): void {
    if (!this.acceptsInput()) return;
    const { min, max } = this.settings.range;
    this.set({ ...this.state, selection: clamp(Math.round(n), min, max), entry: emptyEntry() });
  }

  /** +1 / -1 buttons and arrow keys; starts from the player tank's number when nothing is selected. */
  nudge(delta: 1 | -1 | 10 | -10): void {
    if (!this.acceptsInput()) return;
    const { min, max } = this.settings.range;
    const from = this.state.selection ?? this.state.player.position;
    this.set({ ...this.state, selection: clamp(from + delta, min, max), entry: emptyEntry() });
  }

  typeDigit(d: Digit): void {
    this.applyEntryKey({ digit: d });
  }

  typeMinus(): void {
    this.applyEntryKey('minus');
  }

  backspace(): void {
    this.applyEntryKey('backspace');
  }

  /** Enter or the fire button: fires at the selection; an out-of-range entry fires nothing (FR-063). */
  confirm(): void {
    if (!this.acceptsInput()) return;
    const { selection, entry } = this.state;
    if (selection === null || entry.outOfRange) return;
    this.fireAt(selection);
  }

  /** Fires at n with the fixed cannon (FR-065); the renderer replays the path and then calls shotAnimationDone. */
  fireAt(n: number): void {
    if (!this.acceptsInput()) return;
    const { min, max } = this.settings.range;
    if (!Number.isInteger(n) || n < min || n > max) return;
    const answerableAt = this.state.answerableAt;
    if (answerableAt !== null && this.deps.clock() < answerableAt) return;

    const s = this.state;
    const origin = muzzle(s.player);
    const arc = solveArcToX({
      origin,
      targetX: numberToX(n, min, max),
      towardRight: s.playerSide === 'left',
      terrain: s.terrain,
      worldWidth: WORLD_WIDTH,
      worldHeight: WORLD_HEIGHT,
      tolerance: 0.25 * ((DEFAULT_LAYOUT.right - DEFAULT_LAYOUT.left) / (max - min)),
    });
    const shot: ShotInFlight = { shooter: 'player', path: arc.path, impact: arc.impact, hitTargetId: null, outOfBounds: false, blastRadius: BLAST_RADIUS };
    this.firedNumber = n;
    this.set({ ...s, phase: 'playerShot', shot, entry: emptyEntry() });
  }

  shotAnimationDone(): void {
    if (this.state.phase !== 'playerShot' || !this.state.shot) return;
    const shot = this.state.shot;
    const { min, max } = this.settings.range;
    const fired = this.firedNumber ?? xToNumber(shot.impact.x, min, max);
    this.firedNumber = null;
    const s = this.impact({ point: shot.impact, hitTargetId: null, outOfBounds: false, shooter: 'player', fired, landed: xToNumber(shot.impact.x, min, max) }, shot.blastRadius);
    const next: RoundState = { ...s, turn: s.turn + 1, lastPlayerPath: shot.path, shot: null };
    const outcome = deadOutcome(next);
    if (outcome) {
      this.set({ ...next, phase: 'roundOver', outcome });
      return;
    }
    this.set({ ...next, phase: 'enemyTurn', shot: this.nextEnemyShot(next) });
  }

  enemyShotAnimationDone(): void {
    if (this.state.phase !== 'enemyTurn' || !this.state.shot) return;
    const shot = this.state.shot;
    const s = { ...this.impact({ point: shot.impact, hitTargetId: shot.hitTargetId, outOfBounds: shot.outOfBounds, shooter: 'enemy' }, shot.blastRadius), shot: null };
    const outcome = deadOutcome(s) ?? (s.turn >= this.settings.roundLength ? 'turnsUsed' : null);
    if (outcome) {
      this.set({ ...s, phase: 'roundOver', outcome });
      return;
    }
    this.set({ ...s, phase: 'aiming', enemy: s.lastShot?.hit ? this.movedEnemy(s) : s.enemy });
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

  /** Digits, Enter, arrows and pointer selection work only while the player chooses a number. */
  private acceptsInput(): boolean {
    const phase = this.state.phase;
    return phase === 'aiming' || phase === 'challenge';
  }

  private applyEntryKey(key: EntryKey): void {
    if (!this.acceptsInput()) return;
    const r = applyKey(this.state.entry, key, this.settings.range);
    this.set({ ...this.state, entry: r.entry, selection: r.selection ?? this.state.selection });
  }

  /** Free play: after a hit the enemy moves to a new visible position (decision D12). */
  private movedEnemy(s: RoundState): TankState {
    const rng = createRng(deriveSeed(s.seed, 3, s.turn));
    return moveTank(s.enemy, enemyPositionFor(this.settings, s.playerSide, rng, s.enemy.position), this.settings, s.terrain);
  }

  /** The enemy's shell on the state after the player's impact (enemy aiming, research R18). */
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
    // The enemy is not a target: its shell starts inside its own hit circle.
    const targets = [s.player, ...s.decoys].filter((t) => t.alive).map((t) => ({ id: t.id, ...tankCenter(t), radius: TANK_HIT_RADIUS }));
    const r = simulateShot({ ...aim, origin, terrain: s.terrain, targets, worldWidth: WORLD_WIDTH, worldHeight: WORLD_HEIGHT });
    return { shooter: 'enemy', path: r.path, impact: r.impact, hitTargetId: r.hitTargetId, outOfBounds: r.outOfBounds, blastRadius: BLAST_RADIUS };
  }

  private impact(impact: Impact, blastRadius: number): RoundState {
    const rules: DamageRules = { enemyDamageFactor: enemyDamageFactor(this.settings.enemyDifficulty), noDamage: this.settings.noDamage };
    return applyImpact(this.state, impact, blastRadius, rules);
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

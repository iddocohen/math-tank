/**
 * BattleController (research R4, contracts/core-api.md core/battle): the single state machine for a round.
 * React and Phaser subscribe to it and call its methods; neither changes state directly.
 * Each change produces a new RoundState object, so `useSyncExternalStore` sees it.
 *
 * Amendment 01: the player aims by choosing a number. The cannon is fixed and solveArcToX computes the arc,
 * so the shell always lands at the chosen number.
 *
 * Guided mode (US2, guided.ts): every fire is an answer to the search's challenge. During a position search the enemy
 * hides: getState() reports it without number or coordinates. A miss raises the help step; the exact number reveals
 * and destroys the enemy, records an Attempt and starts a new search with a new hidden enemy.
 *
 * Amendment 06: only the exact number destroys the enemy; then a new enemy appears and the round's score goes up.
 * The enemy fires once after every ENEMY_FIRE_EVERY shots of the child at the same enemy; each enemy hit costs one
 * of the child's LIVES hearts. The round ends when the hearts are gone, or with roundType 'enemyCount' after
 * roundLength destroyed enemies. The controller measures the time played; it stops while paused and at the end.
 */
import { createRng, deriveSeed, type Rng } from '../rng';
import type { BattleState, InputMethod, RoundState, Settings, ShotInFlight, TankState } from '../types';
import { simulateShot } from '../physics/ballistics';
import { solveArcToX } from '../physics/arc';
import { BLAST_RADIUS } from '../physics/damage';
import { DEFAULT_LAYOUT, numberToX, xToNumber } from '../numberline/mapping';
import { enemyShot } from '../ai/enemy';
import { ENEMY_FIRE_EVERY } from './hitRule';
import type { ProgressStore, Speaker } from './ports';
import { applyKey, emptyEntry, type Digit, type EntryKey } from './entry';
import { afterHelpRequest, afterMiss, startSearch } from './guided';
import { buildAttempt } from './attempt';
import { hiddenShellEntryX, hiddenShellPath } from './hiddenShell';
import {
  applyImpact,
  createRound,
  freePlayChallenge,
  moveTank,
  muzzle,
  publicState,
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
  /** Session id stored with each attempt (FR-035). Defaults to one derived from the clock at construction. */
  sessionId?: string;
}

type Listener = (s: RoundState) => void;

export class BattleController {
  private readonly deps: BattleDeps;
  private readonly baseSeed: number;
  private nextSettings: Settings;
  /** Settings snapshot for the current round (FR-049). */
  private settings: Settings;
  /** The full state; `view` is what getState() and subscribers receive. */
  private state: BattleState;
  private view: RoundState;
  private readonly sessionId: string;
  /** Clock time of the player's shot in flight, for the attempt's response time. */
  private firedAt = 0;
  private readonly listeners = new Set<Listener>();
  private roundIndex = 0;
  private nextSide: 'left' | 'right';
  private enemyRng: Rng = createRng(0);
  private enemyShotIndex = 0;
  private phaseBeforePause: RoundState['phase'] | null = null;
  /** The number of the player's shell in flight. */
  private firedNumber: number | null = null;
  /** Clock time since which the round's time is running, or null while it is stopped (FR-084). */
  private runningSince: number | null = null;

  constructor(deps: BattleDeps) {
    this.deps = deps;
    this.baseSeed = (deps.seed ?? Math.floor(deps.clock())) >>> 0;
    this.nextSettings = structuredClone(deps.settings);
    this.settings = this.nextSettings;
    this.nextSide = createRng(deriveSeed(this.baseSeed, 0)).next() < 0.5 ? 'left' : 'right';
    // A placeholder round until startRound; it is never shown.
    this.state = { ...createRound(this.settings, this.baseSeed, this.nextSide), phase: 'roundOver' };
    this.view = publicState(this.state);
    this.sessionId = deps.sessionId ?? `session-${Math.floor(deps.clock())}`;
  }

  /** Time played this round in milliseconds: stopped while paused and once the round is over (FR-084). */
  elapsedMs(): number {
    const running = this.runningSince === null ? 0 : Math.max(0, this.deps.clock() - this.runningSince);
    return this.state.elapsedMs + running;
  }

  /** Milliseconds until the current challenge accepts answers; 0 when it does already or there is none (T068). */
  answerableIn(): number {
    const at = this.state.answerableAt;
    return at === null ? 0 : Math.max(0, at - this.deps.clock());
  }

  getState(): RoundState {
    return this.view;
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

  /**
   * Stores new settings as pending; the current round keeps its snapshot (range, ruler level, enemy difficulty,
   * challenge types) and the next startRound uses the latest pending settings (FR-049, US6 scenario 6).
   */
  updateSettings(settings: Settings): void {
    this.nextSettings = structuredClone(settings);
  }

  startRound(mode: 'guided' | 'freePlay'): void {
    this.settings = structuredClone(this.nextSettings);
    const seed = deriveSeed(this.baseSeed, ++this.roundIndex);
    const side = this.nextSide;
    this.nextSide = side === 'left' ? 'right' : 'left';
    this.enemyRng = createRng(deriveSeed(seed, 2));
    this.enemyShotIndex = 0;
    this.phaseBeforePause = null;
    this.firedNumber = null;
    this.runningSince = this.deps.clock();
    // The latest input method carries into the new round, so a keyboard player keeps getting no findNumber (FR-076).
    const round: BattleState = { ...createRound(this.settings, seed, side, mode), inputMethod: this.state.inputMethod };
    this.set(mode === 'guided' ? startSearch(round, this.settings, this.deps.clock(), null) : round);
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

  /**
   * Pointer preview: clears typed digits and never fires. There is no way to step the preview by 1 or 10
   * (amendment 05: no shortcut toward the answer).
   */
  selectNumber(n: number): void {
    if (!this.acceptsInput()) return;
    const { min, max } = this.settings.range;
    this.set({ ...this.state, selection: clamp(Math.round(n), min, max), entry: emptyEntry(), inputMethod: 'pointer' });
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

  /**
   * Enter (method 'keyboard') or the fire button ('pointer'): fires at the selection; an out-of-range entry fires
   * nothing (FR-063). A fired shot records the method (FR-076).
   */
  confirm(method: InputMethod = 'keyboard'): void {
    if (!this.acceptsInput()) return;
    const { selection, entry } = this.state;
    if (selection === null || entry.outOfRange) return;
    this.shoot(selection, method);
  }

  /** Fires at n with the fixed cannon (FR-065); the renderer replays the path and then calls shotAnimationDone. */
  fireAt(n: number): void {
    this.shoot(n, this.state.inputMethod);
  }

  private shoot(n: number, inputMethod: InputMethod | null): void {
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
    this.firedAt = this.deps.clock();
    this.set({ ...s, phase: 'playerShot', shot, entry: emptyEntry(), inputMethod });
  }

  /**
   * Help button or H (FR-030): the next help step during a guided search. It is not a shot and costs no heart, so
   * lives, turn and shotsSinceEnemyFire stay (FR-081). Addition and subtraction get the step animation (FR-024);
   * the help steps of the other kinds come with US5 (Phase 19).
   */
  requestHelp(): void {
    if (this.state.mode !== 'guided' || this.state.phase !== 'challenge') return;
    const next = afterHelpRequest(this.state, this.settings);
    if (next !== this.state) this.set(next);
  }

  shotAnimationDone(): void {
    if (this.state.phase !== 'playerShot' || !this.state.shot) return;
    const shot = this.state.shot;
    const { min, max } = this.settings.range;
    const fired = this.firedNumber ?? xToNumber(shot.impact.x, min, max);
    this.firedNumber = null;
    const s = this.impact({ point: shot.impact, hitTargetId: null, outOfBounds: false, shooter: 'player', fired, landed: xToNumber(shot.impact.x, min, max) }, shot.blastRadius);
    const next: BattleState = { ...s, turn: s.turn + 1, lastPlayerPath: shot.path, shot: null };
    const guided = next.mode === 'guided';
    if (next.lastShot?.hit) {
      // One hit, one destroyed enemy; the count for the enemy's fire starts again for the new enemy (FR-066, FR-081).
      // In a guided search the hit reveals the enemy where it stood, so the renderer can show it explode.
      const destroyed: BattleState = { ...next, enemiesDestroyed: next.enemiesDestroyed + 1, shotsSinceEnemyFire: 0, enemyFound: true };
      if (guided) this.recordAttempt(destroyed);
      if (this.settings.roundType === 'enemyCount' && destroyed.enemiesDestroyed >= this.settings.roundLength) {
        this.endRound(destroyed, 'goalReached');
        return;
      }
      if (guided) {
        this.set(destroyed);
        this.set(startSearch(destroyed, this.settings, this.deps.clock(), destroyed.enemy.position));
        return;
      }
      this.set(this.nextReadPosition(destroyed));
      return;
    }
    const missed = guided ? afterMiss(next, this.deps.clock()) : next;
    const shots = missed.shotsSinceEnemyFire + 1;
    if (shots >= ENEMY_FIRE_EVERY) {
      const firing: BattleState = { ...missed, shotsSinceEnemyFire: 0 };
      this.set({ ...firing, phase: 'enemyTurn', shot: this.nextEnemyShot(firing) });
      return;
    }
    this.set({ ...missed, shotsSinceEnemyFire: shots, phase: this.choosingPhase() });
  }

  enemyShotAnimationDone(): void {
    if (this.state.phase !== 'enemyTurn' || !this.state.shot) return;
    const shot = this.state.shot;
    const s = { ...this.impact({ point: shot.impact, hitTargetId: shot.hitTargetId, outOfBounds: shot.outOfBounds, shooter: 'enemy' }, shot.blastRadius), shot: null };
    if (s.lives <= 0) {
      this.endRound(s, 'heartsGone');
      return;
    }
    this.set({ ...s, phase: this.choosingPhase() });
  }

  /** The phase in which the child chooses a number: a guided search or free-play aiming. */
  private choosingPhase(): 'challenge' | 'aiming' {
    return this.state.mode === 'guided' ? 'challenge' : 'aiming';
  }

  /**
   * Stores the finished search through the ProgressStore (FR-035). Called after the shot animation, between turns,
   * never while a shell is in flight. Free play records nothing (decision D14).
   */
  private recordAttempt(s: BattleState): void {
    if (!s.challenge || s.answerableAt === null) return;
    const attempt = buildAttempt({
      challenge: s.challenge,
      help: s.help,
      answerableAt: s.answerableAt,
      answeredAt: this.firedAt,
      range: this.settings.range,
      sessionId: this.sessionId,
      at: this.deps.clock(),
    });
    this.deps.progress.record(attempt);
  }

  pause(): void {
    const phase = this.state.phase;
    if (phase === 'paused' || phase === 'roundOver') return;
    this.phaseBeforePause = phase;
    const elapsedMs = this.elapsedMs();
    this.runningSince = null;
    this.set({ ...this.state, phase: 'paused', elapsedMs });
  }

  resume(): void {
    if (this.state.phase !== 'paused' || this.phaseBeforePause === null) return;
    const phase = this.phaseBeforePause;
    this.phaseBeforePause = null;
    this.runningSince = this.deps.clock();
    this.set({ ...this.state, phase });
  }

  /** Stops the time for good and ends the round (FR-008, FR-084). */
  private endRound(s: BattleState, outcome: NonNullable<RoundState['outcome']>): void {
    const elapsedMs = this.elapsedMs();
    this.runningSince = null;
    this.set({ ...s, elapsedMs, phase: 'roundOver', outcome });
  }

  /** Digits, Enter and pointer selection work only while the player chooses a number. */
  private acceptsInput(): boolean {
    const phase = this.state.phase;
    return phase === 'aiming' || phase === 'challenge';
  }

  private applyEntryKey(key: EntryKey): void {
    if (!this.acceptsInput()) return;
    const r = applyKey(this.state.entry, key, this.settings.range);
    this.set({ ...this.state, entry: r.entry, selection: r.selection ?? this.state.selection, inputMethod: 'keyboard' });
  }

  /**
   * Free play: after a hit a new "read the ruler" challenge follows and a new enemy stands at its answer, a new
   * visible position (decision D12, FR-066, FR-067). After a miss the challenge stays. No attempt is recorded (D14).
   */
  private nextReadPosition(s: BattleState): BattleState {
    const challenge = freePlayChallenge(this.settings, s.seed, s.turn, s.player.position, s.rulerLevel, s.enemy.position);
    const enemy: TankState = { ...moveTank(s.enemy, challenge.answer, this.settings, s.terrain), alive: true };
    return { ...s, phase: 'aiming', challenge, enemy };
  }

  /** The enemy's shell on the state after the player's impact (enemy aiming, research R18). */
  private nextEnemyShot(s: BattleState): ShotInFlight {
    const origin = muzzle(s.enemy);
    const shotIndex = this.enemyShotIndex++;
    const aim = enemyShot({
      difficulty: this.settings.enemyDifficulty,
      rng: this.enemyRng,
      shotIndexInRound: shotIndex,
      origin,
      target: tankCenter(s.player),
      terrain: s.terrain,
      worldWidth: WORLD_WIDTH,
      worldHeight: WORLD_HEIGHT,
    });
    // The enemy is not a target: its shell starts inside its own hit circle.
    const targets = [s.player, ...s.decoys].filter((t) => t.alive).map((t) => ({ id: t.id, ...tankCenter(t), radius: TANK_HIT_RADIUS }));
    const r = simulateShot({ ...aim, origin, terrain: s.terrain, targets, worldWidth: WORLD_WIDTH, worldHeight: WORLD_HEIGHT });
    // A hidden enemy's shell falls from the top edge, so its path does not show where the enemy is (FR-010, T215).
    const path = s.enemyFound
      ? r.path
      : hiddenShellPath({ impact: r.impact, entryX: hiddenShellEntryX(s.seed, shotIndex, s.player.x), terrain: s.terrain, worldHeight: WORLD_HEIGHT });
    return { shooter: 'enemy', path, impact: r.impact, hitTargetId: r.hitTargetId, outOfBounds: r.outOfBounds, blastRadius: BLAST_RADIUS };
  }

  private impact(impact: Impact, blastRadius: number): BattleState {
    const rules: DamageRules = { noDamage: this.settings.noDamage, range: this.settings.range };
    return applyImpact(this.state, impact, blastRadius, rules);
  }

  private set(next: BattleState): void {
    this.state = next;
    const view = publicState(next);
    this.view = view;
    for (const listener of [...this.listeners]) listener(view);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

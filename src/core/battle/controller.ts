/**
 * BattleController (research R4, contracts/core-api.md core/battle): the single state machine for a round.
 * React and Phaser subscribe to it and call its methods; neither changes state directly.
 * Each change produces a new RoundState object, so `useSyncExternalStore` sees it.
 *
 * Amendment 01: the player aims by choosing a number. The cannon is fixed and solveArcToX computes the arc,
 * so the shell always lands at the chosen number.
 *
 * Guided mode (US2, guided.ts): every fire is an answer to the search's challenge. The enemy is visible in every
 * challenge kind (amendment 07). A miss raises the help step; the exact number destroys the enemy, records an Attempt
 * and starts a new search with a new enemy.
 *
 * Amendment 06: only the exact number destroys the enemy; then a new enemy appears and the round's score goes up.
 * Amendment 07: the enemy fires once right after every shot of the child that does not destroy it; a seeded draw
 * decides whether its shell hits (ai/enemy.ts). Each enemy hit costs one of the child's LIVES hearts. The round ends when the hearts are gone, or with roundType 'enemyCount' after
 * roundLength destroyed enemies. The controller measures the time played; it stops while paused and at the end.
 */
import { createRng, deriveSeed } from '../rng';
import type { BattleState, InputMethod, RoundState, Settings, ShotInFlight, TankState } from '../types';
import { solveArcToX } from '../physics/arc';
import { BLAST_RADIUS } from '../physics/damage';
import { DEFAULT_LAYOUT, numberToX, xToNumber } from '../numberline/mapping';
import { enemyShot } from '../ai/enemy';
import type { ProgressStore, Speaker } from './ports';
import { applyKey, emptyEntry, type Digit, type EntryKey } from './entry';
import { afterHelpRequest, afterMiss, SOLUTION_HELP_LEVEL, startSearch } from './guided';
import { buildAttempt, rangeKeyOf } from './attempt';
import { rulerLevelFor, skillStepsFor } from '../progress/ladders';
import { topShellEntryX, topShellPath } from './topShell';
import {
  applyImpact,
  createRound,
  type Difficulty,
  freePlayChallenge,
  moveTank,
  muzzle,
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
  private state: BattleState;
  /** Clock time of the player's shot in flight, for the attempt's response time. */
  private firedAt = 0;
  private readonly listeners = new Set<Listener>();
  private roundIndex = 0;
  private nextSide: 'left' | 'right';
  private enemyShotIndex = 0;
  private phaseBeforePause: RoundState['phase'] | null = null;
  /** The number of the player's shell in flight. */
  private firedNumber: number | null = null;
  /** Clock time since which the round's time is running, or null while it is stopped (FR-084). */
  private runningSince: number | null = null;
  /** Time-limit wait (FR-034, D1): time spent in 'challenge' since the latest help change, and since when it runs. */
  private helpWaitMs = 0;
  private helpWaitSince: number | null = null;

  constructor(deps: BattleDeps) {
    this.deps = deps;
    this.baseSeed = (deps.seed ?? Math.floor(deps.clock())) >>> 0;
    this.nextSettings = structuredClone(deps.settings);
    this.settings = this.nextSettings;
    this.nextSide = createRng(deriveSeed(this.baseSeed, 0)).next() < 0.5 ? 'left' : 'right';
    // A placeholder round until startRound; it is never shown.
    this.state = { ...createRound(this.settings, this.baseSeed, this.nextSide), phase: 'roundOver' };
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
    this.enemyShotIndex = 0;
    this.phaseBeforePause = null;
    this.firedNumber = null;
    this.runningSince = this.deps.clock();
    // The latest input method carries into the new round, so a keyboard player keeps getting no findNumber (FR-076).
    const difficulty = this.difficulty();
    const round: BattleState = { ...createRound(this.settings, seed, side, mode, difficulty), inputMethod: this.state.inputMethod };
    this.set(mode === 'guided' ? startSearch(round, this.settings, this.deps.clock(), null, difficulty) : round);
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
    this.set({ ...this.state, selection: clamp(Math.round(n), min, max), entry: emptyEntry(), inputMethod: 'pointer', notOnTank: false });
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
    const { selection, entry, challenge, help } = this.state;
    if (selection === null || entry.outOfRange) return;
    if (this.state.mode === 'guided' && challenge?.kind === 'order3') {
      // At the solution step Enter or the fire button fires at the enemy, the largest number (FR-013).
      if (help.level === SOLUTION_HELP_LEVEL && entry.typed === '' && selection === challenge.answer) {
        this.shoot(selection, method);
        return;
      }
      // A number on a tank places its badge; any other number places none and shows a hint (decision D15).
      const tank = this.numberedTanks().find((t) => t.label === selection);
      if (tank) this.placeBadge(tank, method);
      else this.set({ ...this.state, entry: emptyEntry(), notOnTank: true, inputMethod: method });
      return;
    }
    // Single choice: a number on a tank fires at that tank, like tapTank; any other number is fired like any number.
    this.shoot(selection, method);
  }

  /**
   * Comparison (US4, FR-026, FR-027): a tap on a numbered tank. In a single-choice comparison it fires at the tank's
   * number: the enemy is destroyed, a decoy is destroyed as a miss. In order3 it places the next order badge without
   * firing; a wrong order resets the badges and counts as a miss, and the correct third badge fires at the enemy.
   * Ignored outside comparison searches, for destroyed tanks and before the challenge is answerable.
   */
  tapTank(tankId: string): void {
    if (!this.acceptsInput() || this.state.mode !== 'guided' || !this.state.challenge?.options) return;
    const tank = this.numberedTanks().find((t) => t.id === tankId);
    if (!tank) return;
    if (this.state.challenge.kind === 'order3') this.placeBadge(tank, 'pointer');
    else this.shoot(tank.position, 'pointer');
  }

  /** The labeled tanks still standing in a comparison search: the enemy and the decoys. */
  private numberedTanks(): TankState[] {
    const s = this.state;
    return [s.enemy, ...s.decoys].filter((t) => t.alive && t.label !== undefined);
  }

  /** order3: the next badge, a reset after a wrong order, or the shot at the enemy after the third (FR-026). */
  private placeBadge(tank: TankState, method: InputMethod): void {
    const s = this.state;
    const order = s.challenge?.orderAnswer;
    const answerableAt = s.answerableAt;
    if (!order || (answerableAt !== null && this.deps.clock() < answerableAt)) return;
    if (s.orderTaps.includes(tank.id)) return;
    const taps = [...s.orderTaps, tank.id];
    const labels = new Map(this.numberedTanks().map((t) => [t.id, t.label]));
    const inOrder = taps.every((id, i) => labels.get(id) === order[i]);
    const base: BattleState = { ...s, entry: emptyEntry(), notOnTank: false, inputMethod: method };
    if (!inOrder) {
      // A wrong order is a wrong answer for the help steps, but not a shot (FR-081).
      this.set(afterMiss({ ...base, orderTaps: [] }, this.deps.clock(), this.settings));
      return;
    }
    this.set({ ...base, orderTaps: taps });
    if (taps.length === order.length) this.shoot(s.challenge!.answer, method);
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
    this.set({ ...s, phase: 'playerShot', shot, entry: emptyEntry(), inputMethod, notOnTank: false });
  }

  /**
   * Help button or H (FR-030): the next help step during a guided search, for every challenge kind (help.ts). It is
   * not a shot and costs no heart, so lives and turn stay and the enemy does not fire (FR-081).
   */
  requestHelp(): void {
    if (this.state.mode !== 'guided' || this.state.phase !== 'challenge') return;
    const next = afterHelpRequest(this.state, this.settings);
    if (next !== this.state) this.set(next);
  }

  /**
   * Called by the renderer about once a second (decision D1, FR-034). With a parent-set time limit, a search that
   * waited that long in 'challenge' since its latest help change gets the next help step, with no penalty. Without a
   * limit there is no timer and nothing changes.
   */
  tick(): void {
    const left = this.helpTimeLeftMs();
    if (left === null || left > 0 || this.state.phase !== 'challenge') return;
    this.requestHelp();
  }

  /**
   * Milliseconds until the time limit shows the next help step, or null when there is no limit, no guided search or
   * the solution is already shown. The wait stops while paused and while a shell is in flight.
   */
  helpTimeLeftMs(): number | null {
    const limit = this.settings.timeLimitSeconds;
    const s = this.state;
    if (limit === null || s.mode !== 'guided' || !s.challenge || s.help.level >= SOLUTION_HELP_LEVEL) return null;
    return Math.max(0, limit * 1000 - this.helpWaitElapsed());
  }

  private helpWaitElapsed(): number {
    return this.helpWaitMs + (this.helpWaitSince === null ? 0 : this.deps.clock() - this.helpWaitSince);
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
      // One hit, one destroyed enemy; the destroyed enemy does not fire and the child shoots next (FR-066, FR-081).
      const destroyed: BattleState = { ...next, enemiesDestroyed: next.enemiesDestroyed + 1 };
      if (guided) this.recordAttempt(destroyed);
      if (this.settings.roundType === 'enemyCount' && destroyed.enemiesDestroyed >= this.settings.roundLength) {
        this.endRound(destroyed, 'goalReached');
        return;
      }
      if (guided) {
        this.set(destroyed);
        // The difficulty is read after the attempt was recorded, so a step change applies to this next search.
        this.set(startSearch(destroyed, this.settings, this.deps.clock(), destroyed.enemy.position, this.difficulty()));
        return;
      }
      this.set(this.nextReadPosition(destroyed));
      return;
    }
    // Every shot that does not destroy the enemy is answered at once (amendment 07, FR-081).
    const missed = guided ? afterMiss(next, this.deps.clock(), this.settings, next.lastShot?.nearMiss === true) : next;
    this.set({ ...missed, phase: 'enemyTurn', shot: this.nextEnemyShot(missed) });
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
      at: this.deps.clock(),
    });
    this.deps.progress.record(attempt, this.settings);
  }

  /**
   * Skill steps and ruler level from the stored progress for the round's range (US7, FR-018, FR-037): with adaptive
   * difficulty the stored steps and the ruler level of the positions skill, otherwise the parent settings.
   */
  private difficulty(): Difficulty {
    const progress = this.deps.progress.getProgress();
    const rangeKey = rangeKeyOf(this.settings.range);
    return { skillSteps: skillStepsFor(progress, rangeKey, this.settings), rulerLevel: rulerLevelFor(progress, rangeKey, this.settings) };
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
    this.set({ ...this.state, entry: r.entry, selection: r.selection ?? this.state.selection, inputMethod: 'keyboard', notOnTank: false });
  }

  /**
   * Free play: after a hit a new "read the ruler" challenge follows and a new enemy stands at its answer, a new
   * visible position (decision D12, FR-066, FR-067). After a miss the challenge stays. No attempt is recorded (D14).
   */
  private nextReadPosition(s: BattleState): BattleState {
    const challenge = freePlayChallenge(this.settings, s.seed, s.turn, s.player.position, s.rulerLevel, s.enemy.position, this.difficulty().skillSteps);
    const enemy: TankState = { ...moveTank(s.enemy, challenge.answer, this.settings, s.terrain), alive: true };
    return { ...s, phase: 'aiming', challenge, enemy };
  }

  /**
   * The enemy's shell on the state after the player's impact (amendment 07, FR-041 to FR-043a): the seeded draw of
   * enemyShot decides hit or deliberate near miss. The shell flies from the enemy's muzzle; in a comparison turn it
   * falls from the top edge, so it does not show which tank is the enemy.
   */
  private nextEnemyShot(s: BattleState): ShotInFlight {
    const shotIndex = this.enemyShotIndex++;
    const shot = enemyShot({
      difficulty: this.settings.enemyDifficulty,
      roundSeed: s.seed,
      shotIndexInRound: shotIndex,
      origin: muzzle(s.enemy),
      playerX: s.player.x,
      terrain: s.terrain,
      worldWidth: WORLD_WIDTH,
      worldHeight: WORLD_HEIGHT,
    });
    const path = s.decoys.length === 0
      ? shot.path
      : topShellPath({ impact: shot.impact, entryX: topShellEntryX(s.seed, shotIndex, s.player.x), terrain: s.terrain, worldHeight: WORLD_HEIGHT });
    return { shooter: 'enemy', path, impact: shot.impact, hitTargetId: shot.hits ? s.player.id : null, outOfBounds: false, blastRadius: BLAST_RADIUS };
  }

  private impact(impact: Impact, blastRadius: number): BattleState {
    const rules: DamageRules = { noDamage: this.settings.noDamage, range: this.settings.range };
    return applyImpact(this.state, impact, blastRadius, rules);
  }

  private set(next: BattleState): void {
    const prev = this.state;
    // The time-limit wait starts again with every help change and every new search, and runs only in 'challenge'.
    if (next.help !== prev.help || next.challenge !== prev.challenge) this.helpWaitMs = 0;
    else this.helpWaitMs = this.helpWaitElapsed();
    this.helpWaitSince = next.phase === 'challenge' ? this.deps.clock() : null;
    this.state = next;
    for (const listener of [...this.listeners]) listener(next);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

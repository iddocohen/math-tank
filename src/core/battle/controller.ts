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
 * and starts a new search with a new enemy. Amendment 17: every play mode ("Gemischt", "Nur Zahlenstrahl", "Nur
 * Rechnen") is such a search and records attempts; the mode only decides the challenge kinds and the help content.
 *
 * Amendment 06: only the exact number destroys the enemy; then a new enemy appears and the round's score goes up.
 * Amendment 07: the enemy fires once right after every shot of the child that does not destroy it. Amendment 13: there
 * is no random hit chance; the enemy zeroes in on the child's misses in a row and hits once the streak reaches the
 * difficulty's limit (RoundState.missStreak, ai/enemy.ts, FR-098, FR-099), and every destroyed enemy brings new hills
 * (renewTerrain, FR-101). Each enemy hit costs one of the child's LIVES hearts. The round ends when the hearts are
 * gone, or with roundType 'enemyCount' after roundLength destroyed enemies. The controller measures the time played; it stops while paused and at the end.
 */
import { clamp } from '../util';
import { createRng, deriveSeed } from '../rng';
import type { InputMethod, PlayMode, RoundState, Settings, ShotInFlight } from '../types';
import { solveArcToX } from '../physics/arc';
import { DEFAULT_LAYOUT, numberToX, xToNumber } from '../numberline/mapping';
import { decoyShot, enemyShot } from '../ai/enemy';
import { isFastGuess } from '../progress/classify';
import type { ProgressStore, Speaker } from './ports';
import { applyKey, emptyEntry, type Digit, type EntryKey } from './entry';
import { afterHelpRequest, afterMiss, SOLUTION_HELP_LEVEL, startSearch } from './guided';
import { buildAttempt, rangeKeyOf } from './attempt';
import { rulerLevelFor, skillStepsFor } from '../progress/ladders';
import {
  acceptsInput,
  applyImpact,
  createRound,
  type Difficulty,
  muzzle,
  renewTerrain,
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

  startRound(mode: PlayMode): void {
    this.settings = structuredClone(this.nextSettings);
    this.enemyShotIndex = 0;
    this.phaseBeforePause = null;
    this.runningSince = this.deps.clock();
    const { fresh, difficulty } = this.nextScene(mode);
    // The latest input method carries into the new round, so a keyboard player keeps getting no findNumber (FR-076).
    const round: RoundState = { ...fresh, inputMethod: this.state.inputMethod };
    this.set(startSearch(round, this.settings, this.deps.clock(), null, difficulty));
  }

  /**
   * "Neue Landschaft" button (amendment 03, amendment 08, FR-070): a new landscape in the same round. New terrain from a
   * new seed, the child's tank on the other side, exactly one enemy at a new position with a new challenge that is not
   * a comparison (amendment 10 item 10 restores amendment 08 item 1, so no decoys stand on the field right after the
   * press). Hearts, destroyed enemies, turn, the round time and the enemy's shot count stay; the enemy
   * does not fire. An unfinished challenge is dropped without recording an attempt. Ignored while a shell is in
   * flight, while paused and once the round is over (a new round starts from the round-end screen).
   */
  newScene(): void {
    const prev = this.state;
    if (!acceptsInput(prev.phase)) return;
    const { fresh, difficulty } = this.nextScene(prev.mode);
    const scene: RoundState = {
      ...fresh,
      turn: prev.turn,
      lives: prev.lives,
      enemiesDestroyed: prev.enemiesDestroyed,
      // A new landscape is no way around the misses in a row (amendment 13, FR-098).
      missStreak: prev.missStreak,
      elapsedMs: prev.elapsedMs,
      inputMethod: prev.inputMethod,
    };
    this.set(startSearch(scene, this.settings, this.deps.clock(), null, difficulty, true));
  }

  /** New ground and tanks from the next seed, the child's tank on the other side; no shell in flight. */
  private nextScene(mode: PlayMode): { fresh: RoundState; difficulty: Difficulty } {
    const seed = deriveSeed(this.baseSeed, ++this.roundIndex);
    const side = this.nextSide;
    this.nextSide = side === 'left' ? 'right' : 'left';
    this.firedNumber = null;
    const difficulty = this.difficulty();
    return { fresh: createRound(this.settings, seed, side, mode, difficulty), difficulty };
  }

  /**
   * Pointer preview: clears typed digits and never fires. There is no way to step the preview by 1 or 10
   * (amendment 05: no shortcut toward the answer).
   */
  selectNumber(n: number): void {
    if (!acceptsInput(this.state.phase)) return;
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
    if (!acceptsInput(this.state.phase)) return;
    const { selection, entry } = this.state;
    if (selection === null || entry.outOfRange) return;
    this.shoot(selection, method);
  }

  /**
   * Comparison (amendment 10, FR-026, FR-064): a tap on a standing tank, the enemy or a decoy, fires at its number like
   * the fire button. Ignored outside comparison searches, for burst decoys and before the challenge is answerable.
   */
  tapTank(tankId: string): void {
    const s = this.state;
    if (s.phase !== 'challenge' || s.decoys.length === 0) return;
    const tank = [s.enemy, ...s.decoys].find((t) => t.id === tankId && t.alive);
    if (tank) this.shoot(tank.position, 'pointer');
  }

  /** Fires at n with the fixed cannon (FR-065); the renderer replays the path and then calls shotAnimationDone. */
  fireAt(n: number): void {
    this.shoot(n, this.state.inputMethod);
  }

  private shoot(n: number, inputMethod: InputMethod | null): void {
    if (!acceptsInput(this.state.phase)) return;
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
    const shot: ShotInFlight = { shooter: 'player', path: arc.path, impact: arc.impact, hits: false, decoyShells: [] };
    this.firedNumber = n;
    this.firedAt = this.deps.clock();
    this.set({ ...s, phase: 'playerShot', shot, entry: emptyEntry(), inputMethod });
  }

  /**
   * Help button or H (FR-030): the next help step during a search, in every mode and challenge kind (help.ts). It is
   * not a shot and costs no heart, so lives and turn stay and the enemy does not fire (FR-081).
   */
  requestHelp(): void {
    if (this.state.phase !== 'challenge') return;
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
   * Milliseconds until the time limit shows the next help step, or null when there is no limit, no search or
   * the solution is already shown. The wait stops while paused and while a shell is in flight.
   */
  helpTimeLeftMs(): number | null {
    const limit = this.settings.timeLimitSeconds;
    const s = this.state;
    if (limit === null || !s.challenge || s.help.level >= SOLUTION_HELP_LEVEL) return null;
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
    const s = this.impact({ point: shot.impact, shooter: 'player', fired, landed: xToNumber(shot.impact.x, min, max) });
    const next: RoundState = { ...s, turn: s.turn + 1, lastPlayerPath: shot.path, shot: null };
    if (next.lastShot?.hit) {
      // One hit, one destroyed enemy; the destroyed enemy does not fire and the child shoots next (FR-066, FR-081).
      // The remaining decoys fold away with it (amendment 10).
      // A shot that destroys the enemy, the shot at the shown solution included, resets the misses in a row (FR-098).
      const destroyed: RoundState = { ...next, enemiesDestroyed: next.enemiesDestroyed + 1, missStreak: 0, decoys: next.decoys.map((d) => ({ ...d, alive: false })) };
      this.recordAttempt(destroyed);
      if (this.settings.roundType === 'enemyCount' && destroyed.enemiesDestroyed >= this.settings.roundLength) {
        this.endRound(destroyed, 'goalReached');
        return;
      }
      this.set(destroyed);
      // The difficulty is read after the attempt was recorded, so a step change applies to this next search, also within
      // the round (amendment 17). New hills before the next enemy is placed on them (amendment 13, FR-101).
      this.set(startSearch(renewTerrain(destroyed, this.settings), this.settings, this.deps.clock(), destroyed.enemy.position, this.difficulty()));
      return;
    }
    // Every shot that does not destroy the enemy is answered at once (amendment 07, FR-081) and adds to the misses in
    // a row, 2 for a fast guess (amendment 13, FR-098). The guess rule reads the misses before this one.
    const step = this.isFastGuessMiss(next) ? 2 : 1;
    const missed = afterMiss(next, this.deps.clock(), this.settings, next.lastShot?.nearMiss === true);
    const streaked: RoundState = { ...missed, missStreak: missed.missStreak + step };
    this.set({ ...streaked, phase: 'enemyTurn', shot: this.nextEnemyShot(streaked) });
  }

  enemyShotAnimationDone(): void {
    if (this.state.phase !== 'enemyTurn' || !this.state.shot) return;
    const shot = this.state.shot;
    const landed = this.impact({ point: shot.impact, shooter: 'enemy', hits: shot.hits });
    // After the enemy's hit the misses in a row start again, in no-damage mode too (amendment 13, FR-099).
    const s = { ...landed, shot: null, missStreak: shot.hits ? 0 : landed.missStreak };
    if (s.lives <= 0) {
      this.endRound(s, 'heartsGone');
      return;
    }
    this.set({ ...s, phase: 'challenge' });
  }

  /**
   * The FR-038 guess rule for the miss that just landed (amendment 13, FR-098): fired less than 1.5 s after
   * answers became possible, or after 3 misses within the 5 seconds before it.
   */
  private isFastGuessMiss(s: RoundState): boolean {
    if (s.answerableAt === null) return false;
    return isFastGuess({ responseMs: Math.max(0, this.firedAt - s.answerableAt), wrongAnswerTimes: s.help.wrongAnswerTimes, submittedAt: this.firedAt });
  }

  /**
   * Stores the finished search through the ProgressStore (FR-035). Called after the shot animation, between turns,
   * never while a shell is in flight. Every play mode records its attempts (amendment 17, FR-124).
   */
  private recordAttempt(s: RoundState): void {
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
  private endRound(s: RoundState, outcome: NonNullable<RoundState['outcome']>): void {
    const elapsedMs = this.elapsedMs();
    this.runningSince = null;
    this.set({ ...s, elapsedMs, phase: 'roundOver', outcome });
  }

  private applyEntryKey(key: EntryKey): void {
    if (!acceptsInput(this.state.phase)) return;
    const r = applyKey(this.state.entry, key, this.settings.range);
    this.set({ ...this.state, entry: r.entry, selection: r.selection ?? this.state.selection, inputMethod: 'keyboard' });
  }

  /**
   * The enemy's shell on the state after the player's impact (amendments 07 and 13, FR-041 to FR-043a, FR-099):
   * enemyShot decides hit or deliberate near miss from the misses in a row and the difficulty. The shell flies from
   * the enemy's muzzle. In a comparison turn every standing decoy fires at the same time from its own muzzle (bug
   * report B2), so the volley does not show which tank is the enemy; the decoys' shells land farther from the child's
   * tank than the enemy's and never hit.
   */
  private nextEnemyShot(s: RoundState): ShotInFlight {
    const shotIndex = this.enemyShotIndex++;
    const shot = enemyShot({
      difficulty: this.settings.enemyDifficulty,
      roundSeed: s.seed,
      shotIndexInRound: shotIndex,
      missStreak: s.missStreak,
      origin: muzzle(s.enemy),
      playerX: s.player.x,
      terrain: s.terrain,
      worldWidth: WORLD_WIDTH,
      worldHeight: WORLD_HEIGHT,
    });
    const decoyShells = s.decoys
      .filter((d) => d.alive)
      .map((d, decoyIndex) => ({
        shooterId: d.id,
        ...decoyShot({
          roundSeed: s.seed,
          shotIndexInRound: shotIndex,
          decoyIndex,
          realImpactX: shot.impact.x,
          playerX: s.player.x,
          origin: muzzle(d),
          terrain: s.terrain,
          worldWidth: WORLD_WIDTH,
          worldHeight: WORLD_HEIGHT,
        }),
      }));
    return { shooter: 'enemy', path: shot.path, impact: shot.impact, hits: shot.hits, decoyShells };
  }

  private impact(impact: Impact): RoundState {
    const rules: DamageRules = { noDamage: this.settings.noDamage, range: this.settings.range };
    return applyImpact(this.state, impact, rules);
  }

  private set(next: RoundState): void {
    const prev = this.state;
    // The time-limit wait starts again with every help change and every new search, and runs only in 'challenge'.
    if (next.help !== prev.help || next.challenge !== prev.challenge) this.helpWaitMs = 0;
    else this.helpWaitMs = this.helpWaitElapsed();
    this.helpWaitSince = next.phase === 'challenge' ? this.deps.clock() : null;
    this.state = next;
    for (const listener of [...this.listeners]) listener(next);
  }
}


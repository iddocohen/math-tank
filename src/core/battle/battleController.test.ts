import { describe, expect, it } from 'vitest';
import { BattleController } from './controller';
import { memoryProgressStore } from './ports';
import type { Digit } from './entry';
import { enemyHitsPlayer, LIVES } from './hitRule';
import { applyImpact, createRound, muzzle, tankCenter, TANK_HIT_RADIUS, WORLD_HEIGHT, WORLD_WIDTH } from './round';
import { TOP_SHELL_SPREAD } from './topShell';
import { NEAR_MISS_MAX, NEAR_MISS_MIN, planEnemyShot } from '../ai/enemy';
import { defaultSettings } from '../settings/defaults';
import type { BattleState, Progress, RoundState, Settings, Skill, TankState } from '../types';
import { emptyProgress } from '../storage/storage';
import { skillKey } from '../progress/ladders';
import { crossesMultiple } from '../math/skills';
import { DEFAULT_LAYOUT, numberToX, xToNumber } from '../numberline/mapping';
import { minEnemyGap } from '../math/gaps';
import { settleY } from '../physics/terrain';
import { BLAST_RADIUS } from '../physics/damage';
import { solveArcToX } from '../physics/arc';
import { COMPARISON_47_74, SUBTRACTION_43_MINUS_7 } from '../math/fixtures';
import { stepPath } from '../math/stepPath';
import { directionTo, nearestMajorTick, nextHelp } from './help';
import { encouragements, messageText } from '../../i18n';

/** Adaptive difficulty off, so challenges follow the parent settings; the adaptive tests turn it on (T129). */
function freePlaySettings(overrides: Partial<Settings> = {}): Settings {
  return { ...defaultSettings(), adaptive: false, freePlay: true, ...overrides };
}

/** The enemy with its number; it is always visible (amendment 07). */
function enemyOf(s: RoundState): TankState {
  return s.enemy;
}

function makeController(overrides: Partial<Settings> = {}, seed = 1234) {
  let now = 1_000;
  const clock = () => now;
  const progress = memoryProgressStore();
  const controller = new BattleController({ settings: freePlaySettings(overrides), progress, clock, seed });
  return { controller, progress, advance: (ms: number) => (now += ms) };
}

/** Fire at the enemy's number: the enemy is destroyed (amendment 06). */
function fireAtEnemy(c: BattleController): void {
  c.fireAt(enemyOf(c.getState()).position);
}

/** Fire 1 away from the enemy, toward the player: a near miss on the body where the body is at least 1 wide. */
function fireNextToEnemy(c: BattleController): void {
  const s = c.getState();
  c.fireAt(enemyOf(s).position + Math.sign(s.player.position - enemyOf(s).position));
}

/** Fire at the player's own number: far from the enemy (at least minEnemyGap), harms nobody. */
function fireAtOwnNumber(c: BattleController): void {
  c.fireAt(c.getState().player.position);
}

/** Fire halfway between the tanks: away from both, without digging a pit around the player tank. */
function fireBetween(c: BattleController): void {
  const s = c.getState();
  c.fireAt(Math.round((s.player.position + enemyOf(s).position) / 2));
}

/** One player shot and its animation, then the enemy's shot and its animation when the enemy fires (after every shot that does not destroy it). */
function playTurn(c: BattleController, shoot: (c: BattleController) => void): void {
  shoot(c);
  c.shotAnimationDone();
  if (c.getState().phase === 'enemyTurn') c.enemyShotAnimationDone();
}

/** Everything in the state except the given keys. */
function without(s: RoundState, ...keys: Array<keyof RoundState>): Partial<RoundState> {
  const copy: Partial<RoundState> = { ...s };
  for (const k of keys) delete copy[k];
  return copy;
}

describe('BattleController free play (US1, amendment 01)', () => {
  it('getRoundSettings returns the settings snapshot of the current round (FR-049)', () => {
    const { controller } = makeController({ range: { preset: '0-20', min: 0, max: 20 } });
    controller.startRound('freePlay');
    controller.updateSettings(freePlaySettings({ range: { preset: '0-50', min: 0, max: 50 } }));
    expect(controller.getRoundSettings().range).toEqual({ preset: '0-20', min: 0, max: 20 });
    controller.startRound('freePlay');
    expect(controller.getRoundSettings().range.max).toBe(50);
  });

  it('starts a free-play round with terrain, both tanks and the aiming phase', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    const s = controller.getState();
    const { min, max } = defaultSettings().range;
    expect(s.mode).toBe('freePlay');
    expect(s.phase).toBe('aiming');
    expect(s.turn).toBe(0);
    expect(s.terrain.length).toBe(WORLD_WIDTH);
    expect(s.player.position).toBe(s.playerSide === 'left' ? min : max);
    expect(s.player.x).toBe(numberToX(s.player.position, min, max));
    expect(s.player.y).toBeCloseTo(settleY(s.terrain, s.player.x), 6);
    expect(enemyOf(s).x).toBe(numberToX(enemyOf(s).position, min, max));
    expect(s.lives).toBe(LIVES);
    expect(s.enemiesDestroyed).toBe(0);
    expect(s.elapsedMs).toBe(0);
    expect(s.lastEnemyHit).toBe(false);
    expect('health' in s.player).toBe(false);
    expect('health' in s.enemy).toBe(false);
    expect(s.enemy.alive).toBe(true);
    expect(s.selection).toBeNull();
    expect(s.entry).toEqual({ typed: '', outOfRange: false });
    expect(s.orderTaps).toEqual([]);
    expect([1, 2, 3, 4, 5]).toContain(s.rulerLevel);
    expect(s.lastShot).toBeNull();
    expect(s.lastPlayerPath).toBeNull();
    expect(s.shot).toBeNull();
    expect(s.outcome).toBeNull();
    // Exactly the fields of data-model.md RoundState: the angle, power and charge fields of the old aiming are gone.
    expect(Object.keys(s).sort()).toEqual(
      [
        'seed', 'mode', 'turn', 'phase', 'terrain', 'player', 'enemy', 'decoys', 'playerSide', 'challenge', 'answerableAt',
        'help', 'selection', 'entry', 'orderTaps', 'inputMethod', 'rulerLevel', 'lastShot', 'lastPlayerPath', 'shot', 'outcome',
        'lives', 'enemiesDestroyed', 'elapsedMs', 'lastEnemyHit', 'stepAnimation', 'notOnTank', 'message',
      ].sort(),
    );
  });

  it('alternates the player side between rounds and keeps the enemy at least minEnemyGap away', () => {
    for (const [min, max] of [
      [0, 10],
      [0, 100],
      [-20, 30],
      [0, 1000],
    ] as const) {
      const { controller } = makeController({ range: { preset: 'custom', min, max } }, min * 7 + max);
      let previousSide: RoundState['playerSide'] | null = null;
      for (let round = 0; round < 20; round++) {
        controller.startRound('freePlay');
        const s = controller.getState();
        if (previousSide) expect(s.playerSide).not.toBe(previousSide);
        previousSide = s.playerSide;
        expect(s.player.position).toBe(s.playerSide === 'left' ? min : max);
        expect(Number.isInteger(enemyOf(s).position)).toBe(true);
        expect(enemyOf(s).position).toBeGreaterThanOrEqual(min);
        expect(enemyOf(s).position).toBeLessThanOrEqual(max);
        expect(Math.abs(enemyOf(s).position - s.player.position)).toBeGreaterThanOrEqual(minEnemyGap(min, max));
      }
    }
  });

  it('uses a new terrain seed for each new round', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    const first = controller.getState();
    controller.startRound('freePlay');
    const second = controller.getState();
    expect(second.seed).not.toBe(first.seed);
    expect(Array.from(second.terrain)).not.toEqual(Array.from(first.terrain));
  });

  it('fireAt(n) moves to playerShot with the solveArcToX path that lands at numberToX(n)', () => {
    for (const n of [0, 37, 63, 100]) {
      const { controller } = makeController();
      controller.startRound('freePlay');
      const before = controller.getState();
      controller.fireAt(n);
      const s = controller.getState();
      const { min, max } = defaultSettings().range;
      const expected = solveArcToX({
        origin: muzzle(before.player),
        targetX: numberToX(n, min, max),
        towardRight: before.playerSide === 'left',
        terrain: before.terrain,
        worldWidth: WORLD_WIDTH,
        worldHeight: WORLD_HEIGHT,
        tolerance: 0.25 * ((DEFAULT_LAYOUT.right - DEFAULT_LAYOUT.left) / (max - min)),
      });
      expect(s.phase).toBe('playerShot');
      expect(s.shot?.shooter).toBe('player');
      expect(s.shot?.path).toEqual(expected.path);
      expect(s.shot?.impact).toEqual(expected.impact);
      expect(s.shot?.path[0]).toEqual(muzzle(s.player));
      expect(s.shot?.blastRadius).toBe(BLAST_RADIUS);
      expect(s.shot?.outOfBounds).toBe(false);
      expect(xToNumber(s.shot!.impact.x, min, max)).toBe(n);
    }
  });

  it('ignores fireAt outside the range, for non-integers, and outside the aiming phase', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    const s0 = controller.getState();
    controller.fireAt(101);
    controller.fireAt(-1);
    controller.fireAt(12.5);
    expect(controller.getState()).toBe(s0);
    controller.fireAt(40);
    const shot = controller.getState().shot;
    controller.fireAt(50);
    expect(controller.getState().shot).toBe(shot);
  });

  it('typeDigit, backspace and selectNumber change only selection, entry and inputMethod', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    const base = without(controller.getState(), 'selection', 'entry', 'inputMethod');
    const check = (selection: number | null, typed: string, outOfRange = false) => {
      const s = controller.getState();
      expect(s.selection).toBe(selection);
      expect(s.entry).toEqual({ typed, outOfRange });
      expect(without(s, 'selection', 'entry', 'inputMethod')).toEqual(base);
    };

    controller.typeDigit(3);
    check(3, '3');
    controller.typeDigit(7);
    check(37, '37');
    controller.backspace();
    check(3, '3');
    controller.backspace();
    check(3, ''); // an empty entry keeps the last selection
    controller.typeDigit(5);
    check(5, '5');
    controller.selectNumber(98);
    check(98, '');
    controller.selectNumber(140);
    check(100, '');
    controller.typeDigit(4);
    controller.selectNumber(55);
    check(55, '');
    controller.typeMinus(); // range 0-100 has no negative numbers
    check(55, '');
    controller.typeDigit(1);
    controller.typeDigit(5);
    controller.typeDigit(0);
    check(100, '150', true);
  });

  it('has no nudge: there is no way to step the preview by 1 or 10 (amendment 05, FR-019)', () => {
    const { controller } = makeController();
    expect((controller as unknown as Record<string, unknown>).nudge).toBeUndefined();
  });

  it('accepts a minus key only when the range has negative numbers', () => {
    const { controller } = makeController({ range: { preset: 'custom', min: -20, max: 30 } });
    controller.startRound('freePlay');
    controller.typeMinus();
    controller.typeDigit(7);
    expect(controller.getState().selection).toBe(-7);
    expect(controller.getState().entry).toEqual({ typed: '-7', outOfRange: false });
  });

  it('confirm fires at the selection and clears the typed digits', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    controller.typeDigit(4);
    controller.typeDigit(2);
    controller.confirm();
    const s = controller.getState();
    expect(s.phase).toBe('playerShot');
    expect(xToNumber(s.shot!.impact.x, 0, 100)).toBe(42);
    expect(s.entry).toEqual({ typed: '', outOfRange: false });
  });

  it('confirm does nothing without a selection or when the entry is out of range', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    const s0 = controller.getState();
    controller.confirm();
    expect(controller.getState()).toBe(s0);
    controller.typeDigit(1);
    controller.typeDigit(5);
    controller.typeDigit(0);
    const s1 = controller.getState();
    controller.confirm();
    expect(controller.getState()).toBe(s1);
    expect(controller.getState().phase).toBe('aiming');
  });

  it('ignores digits, Backspace, selections and confirm in playerShot and enemyTurn', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    // The enemy fires after every shot that does not destroy it (amendment 07).
    controller.selectNumber(controller.getState().player.position);
    controller.confirm();
    for (const phase of ['playerShot', 'enemyTurn'] as const) {
      const s = controller.getState();
      expect(s.phase).toBe(phase);
      controller.typeDigit(5);
      controller.typeMinus();
      controller.backspace();
      controller.selectNumber(70);
      controller.confirm();
      controller.fireAt(70);
      expect(controller.getState()).toBe(s);
      if (phase === 'playerShot') controller.shotAnimationDone();
    }
  });

  it('the exact number destroys the enemy: crater, score + 1, a new enemy at a new number, no enemy turn (amendment 06, FR-066)', () => {
    const { controller } = makeController({ enemyDifficulty: 'normal' });
    controller.startRound('freePlay');
    const n = enemyOf(controller.getState()).position;
    controller.fireAt(n);
    const before = controller.getState();
    controller.shotAnimationDone();
    const after = controller.getState();
    const x = numberToX(n, 0, 100);
    expect(after.terrain).not.toBe(before.terrain);
    expect(after.terrain[Math.round(x)]).toBeLessThan(before.terrain[Math.round(x)] as number);
    expect(after.lastShot).toEqual({ fired: n, landed: n, hit: true, nearMiss: false, hitTankId: before.enemy.id, distance: 0, enemyNumber: n });
    expect(after.enemiesDestroyed).toBe(1);
    expect(after.phase).toBe('aiming');
    expect(after.shot).toBeNull();
    expect(after.enemy.alive).toBe(true);
    expect(enemyOf(after).position).not.toBe(n);
    expect(after.challenge?.answer).toBe(enemyOf(after).position);
    expect(after.lives).toBe(LIVES);
    expect(after.player.y).toBeCloseTo(settleY(after.terrain, after.player.x), 6);
    expect(enemyOf(after).y).toBeCloseTo(settleY(after.terrain, enemyOf(after).x), 6);
    expect(after.lastPlayerPath).toEqual(before.shot!.path);
    expect(after.turn).toBe(1);
  });

  it('a shot 1 away lands on the tank body: a near miss, the enemy stays and nothing is destroyed (amendment 06, FR-066)', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    const s = controller.getState();
    const n = enemyOf(s).position + (enemyOf(s).position < 100 ? 1 : -1);
    controller.fireAt(n);
    controller.shotAnimationDone();
    const after = controller.getState();
    expect(after.lastShot).toEqual({ fired: n, landed: n, hit: false, nearMiss: true, hitTankId: null, distance: 1, enemyNumber: enemyOf(s).position });
    expect(enemyOf(after).position).toBe(enemyOf(s).position);
    expect(after.enemy.alive).toBe(true);
    expect(after.challenge).toBe(s.challenge);
    expect(after.enemiesDestroyed).toBe(0);
    expect(after.phase).toBe('enemyTurn');
  });

  it('a shot 3 away is off the tank body: a plain miss, no near miss', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    const s = controller.getState();
    const n = enemyOf(s).position + (enemyOf(s).position < 97 ? 3 : -3);
    controller.fireAt(n);
    controller.shotAnimationDone();
    expect(controller.getState().lastShot).toEqual({ fired: n, landed: n, hit: false, nearMiss: false, hitTankId: null, distance: 3, enemyNumber: enemyOf(s).position });
  });

  it('the body width follows the range: 4 away is a near miss in 550 to 780, 1 away a plain miss in 0 to 10', () => {
    const wide = makeController({ range: { preset: 'custom', min: 550, max: 780 }, rulerLevelStart: 2 }, 99).controller;
    wide.startRound('freePlay');
    const e = enemyOf(wide.getState()).position;
    wide.fireAt(e + (e <= 776 ? 4 : -4));
    wide.shotAnimationDone();
    expect(wide.getState().lastShot).toMatchObject({ hit: false, nearMiss: true, distance: 4 });
    expect(wide.getState().enemiesDestroyed).toBe(0);

    const narrow = makeController({ range: { preset: '0-10', min: 0, max: 10 } }, 7).controller;
    narrow.startRound('freePlay');
    const m = enemyOf(narrow.getState()).position;
    narrow.fireAt(m + (m < 10 ? 1 : -1));
    narrow.shotAnimationDone();
    expect(narrow.getState().lastShot).toMatchObject({ hit: false, nearMiss: false });
  });

  it('the own shell never costs the player a heart', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    const s = controller.getState();
    controller.fireAt(s.player.position);
    controller.shotAnimationDone();
    const after = controller.getState();
    expect(after.lives).toBe(LIVES);
    expect(after.lastShot).toEqual({ fired: s.player.position, landed: s.player.position, hit: false, nearMiss: false, hitTankId: null, distance: Math.abs(s.player.position - enemyOf(s).position), enemyNumber: enemyOf(s).position });
  });

  it('the enemy fires from its own tank right after every shot that does not destroy it, miss or near miss (amendment 07, FR-081)', () => {
    const { controller } = makeController({ noDamage: true });
    controller.startRound('freePlay');
    for (const shoot of [fireAtOwnNumber, fireNextToEnemy, fireBetween, fireAtOwnNumber]) {
      shoot(controller);
      controller.shotAnimationDone();
      const s = controller.getState();
      expect(s.phase).toBe('enemyTurn');
      expect(s.shot?.shooter).toBe('enemy');
      expect(s.shot?.path[0]).toEqual(muzzle(enemyOf(s)));
      controller.enemyShotAnimationDone();
      expect(controller.getState().phase).toBe('aiming');
      expect(controller.getState().shot).toBeNull();
    }
    expect(controller.getState().turn).toBe(4);
    expect('shotsSinceEnemyFire' in controller.getState()).toBe(false);
  });

  it('a shot that destroys the enemy is not answered: the new enemy appears and the child shoots next (FR-081)', () => {
    const { controller } = makeController({ noDamage: true });
    controller.startRound('freePlay');
    playTurn(controller, fireAtOwnNumber);
    fireAtEnemy(controller);
    controller.shotAnimationDone();
    expect(controller.getState().phase).toBe('aiming');
    fireAtOwnNumber(controller);
    controller.shotAnimationDone();
    expect(controller.getState().phase).toBe('enemyTurn');
  });

  it('the enemy shell lands where the seeded draw aimed: on the child tank for a hit, 40 to 100 units beside it otherwise (FR-041)', () => {
    let hits = 0;
    let misses = 0;
    for (let seed = 0; seed < 12; seed++) {
      const { controller } = makeController({ noDamage: true, enemyDifficulty: 'challenging', roundType: 'enemyCount', roundLength: 20 }, seed);
      controller.startRound('freePlay');
      for (let i = 0; i < 5; i++) {
        fireBetween(controller);
        controller.shotAnimationDone();
        const s = controller.getState();
        const plan = planEnemyShot({ difficulty: 'challenging', roundSeed: s.seed, shotIndexInRound: i, playerX: s.player.x, worldWidth: WORLD_WIDTH });
        expect(Math.abs(s.shot!.impact.x - plan.targetX)).toBeLessThanOrEqual(0.5);
        const d = Math.abs(s.shot!.impact.x - s.player.x);
        if (plan.hits) {
          hits++;
          expect(enemyHitsPlayer(s.shot!.impact, s.shot!.hitTargetId, s.player)).toBe(true);
        } else {
          misses++;
          expect(d).toBeGreaterThanOrEqual(NEAR_MISS_MIN - 0.5);
          expect(d).toBeLessThanOrEqual(NEAR_MISS_MAX + 0.5);
          expect(enemyHitsPlayer(s.shot!.impact, s.shot!.hitTargetId, s.player)).toBe(false);
        }
        controller.enemyShotAnimationDone();
      }
    }
    expect(hits).toBeGreaterThan(0);
    expect(misses).toBeGreaterThan(hits);
  });

  it('the first enemy shot of a round never costs a heart, on every difficulty (FR-043)', () => {
    for (const enemyDifficulty of ['easy', 'normal', 'challenging'] as const) {
      for (let seed = 0; seed < 20; seed++) {
        const { controller } = makeController({ enemyDifficulty }, seed);
        controller.startRound('freePlay');
        playTurn(controller, fireBetween);
        expect(controller.getState().lives).toBe(LIVES);
        expect(controller.getState().lastEnemyHit).toBe(false);
      }
    }
  });

  it('after each hit a new enemy appears at a new visible position at least minEnemyGap from the player', () => {
    for (const [min, max, seed] of [
      [0, 10, 1],
      [0, 100, 2],
      [-20, 30, 3],
      [0, 1000, 4],
    ] as const) {
      const { controller } = makeController({ range: { preset: 'custom', min, max }, noDamage: true }, seed);
      controller.startRound('freePlay');
      for (let i = 0; i < 3; i++) {
        const old = enemyOf(controller.getState()).position;
        playTurn(controller, fireAtEnemy);
        const s = controller.getState();
        expect(s.phase).toBe('aiming');
        expect(enemyOf(s).position).not.toBe(old);
        expect(s.enemy.alive).toBe(true);
        expect(Number.isInteger(enemyOf(s).position)).toBe(true);
        expect(Math.abs(enemyOf(s).position - s.player.position)).toBeGreaterThanOrEqual(minEnemyGap(min, max));
        expect(enemyOf(s).x).toBe(numberToX(enemyOf(s).position, min, max));
        expect(enemyOf(s).y).toBeCloseTo(settleY(s.terrain, enemyOf(s).x), 6);
        expect(s.enemiesDestroyed).toBe(i + 1);
      }
      // After a miss the enemy stays.
      const old = enemyOf(controller.getState()).position;
      playTurn(controller, fireAtOwnNumber);
      expect(enemyOf(controller.getState()).position).toBe(old);
    }
  });

  it('a scripted round fired with typeDigit plus confirm: "Gegner pro Runde" 2 ends after the second hit with goalReached (FR-082)', () => {
    const { controller } = makeController({ roundType: 'enemyCount', roundLength: 2 }, 77);
    controller.startRound('freePlay');
    for (const ch of String(enemyOf(controller.getState()).position)) controller.typeDigit(Number(ch) as Digit);
    controller.confirm();
    controller.shotAnimationDone();
    expect(controller.getState().enemiesDestroyed).toBe(1);
    expect(controller.getState().phase).toBe('aiming');
    fireAtEnemy(controller);
    controller.shotAnimationDone();
    const s = controller.getState();
    expect(s.phase).toBe('roundOver');
    expect(s.outcome).toBe('goalReached');
    expect(s.enemiesDestroyed).toBe(2);
    expect(s.shot).toBeNull();
    expect(s.turn).toBe(2);
  });

  it('"Bis alle Herzen weg": ten destroyed enemies do not end the round (FR-082)', () => {
    const { controller } = makeController({ roundType: 'untilHearts', roundLength: 2 });
    controller.startRound('freePlay');
    for (let i = 0; i < 10; i++) playTurn(controller, fireAtEnemy);
    expect(controller.getState().phase).toBe('aiming');
    expect(controller.getState().enemiesDestroyed).toBe(10);
  });

  it('each enemy hit removes one heart; when the 3 hearts are gone the round ends with heartsGone (FR-080)', () => {
    const { controller } = makeController({ enemyDifficulty: 'challenging' });
    controller.startRound('freePlay');
    let lives = controller.getState().lives;
    expect(lives).toBe(3);
    let hits = 0;
    for (let i = 0; i < 200 && controller.getState().phase !== 'roundOver'; i++) {
      playTurn(controller, fireAtOwnNumber);
      const s = controller.getState();
      expect(lives - s.lives).toBeLessThanOrEqual(1);
      if (s.lives < lives) {
        hits++;
        expect(s.lastEnemyHit).toBe(true);
      }
      lives = s.lives;
    }
    const s = controller.getState();
    expect(s.outcome).toBe('heartsGone');
    expect(s.lives).toBe(0);
    expect(hits).toBe(3);
  });

  it('keeps 3 hearts in noDamage mode', () => {
    const { controller } = makeController({ noDamage: true, enemyDifficulty: 'challenging', roundType: 'enemyCount', roundLength: 20 });
    controller.startRound('freePlay');
    for (let i = 0; i < 40; i++) {
      playTurn(controller, fireAtOwnNumber);
      expect(controller.getState().lives).toBe(LIVES);
    }
    expect(controller.getState().phase).toBe('aiming');
  });


  it('applyImpact: an enemy shell on the player removes one heart unless noDamage; one next to the player does nothing', () => {
    const s = createRound(freePlaySettings(), 99, 'left');
    const rules = { noDamage: false, range: { min: 0, max: 100 } };
    const onPlayer = { point: tankCenter(s.player), hitTargetId: s.player.id, outOfBounds: false, shooter: 'enemy' as const };
    expect(applyImpact(s, onPlayer, BLAST_RADIUS, rules)).toMatchObject({ lives: LIVES - 1, lastEnemyHit: true });
    expect(applyImpact(s, onPlayer, BLAST_RADIUS, { ...rules, noDamage: true })).toMatchObject({ lives: LIVES, lastEnemyHit: false });
    const beside = { point: { x: s.player.x + 31, y: s.player.y }, hitTargetId: null, outOfBounds: false, shooter: 'enemy' as const };
    expect(applyImpact(s, beside, BLAST_RADIUS, rules)).toMatchObject({ lives: LIVES, lastEnemyHit: false });
    expect(enemyHitsPlayer(beside.point, null, s.player)).toBe(false);
    // An enemy shell does not touch lastShot.
    expect(applyImpact(s, onPlayer, BLAST_RADIUS, rules).lastShot).toBeNull();

    const n = enemyOf(s).position;
    const atEnemy = { point: { x: enemyOf(s).x, y: enemyOf(s).y }, hitTargetId: null, outOfBounds: false, shooter: 'player' as const, fired: n, landed: n };
    expect(applyImpact(s, atEnemy, BLAST_RADIUS, rules).enemy.alive).toBe(false);
    expect(applyImpact(s, { ...atEnemy, fired: n + 1, landed: n + 1 }, BLAST_RADIUS, rules).enemy.alive).toBe(true);
    // The player's shell at the player's own number never harms the player.
    const atPlayer = { point: { x: s.player.x, y: s.player.y }, hitTargetId: null, outOfBounds: false, shooter: 'player' as const, fired: s.player.position, landed: s.player.position };
    expect(applyImpact(s, atPlayer, BLAST_RADIUS, rules).lives).toBe(LIVES);
  });

  it('applyImpact destroys a decoy at the fired number and leaves other decoys alone', () => {
    const base = createRound(freePlaySettings(), 21, 'left');
    const decoyAt = (id: string, position: number) => {
      const x = numberToX(position, 0, 100);
      return { id, kind: 'decoy' as const, position, x, y: settleY(base.terrain, x), label: position, alive: true };
    };
    const s: BattleState = { ...base, decoys: [decoyAt('d1', 30), decoyAt('d2', 32)] };
    const impact = { point: { x: s.decoys[0]!.x, y: s.decoys[0]!.y }, hitTargetId: null, outOfBounds: false, shooter: 'player' as const, fired: 30, landed: 30 };
    const next = applyImpact(s, impact, BLAST_RADIUS, { noDamage: false, range: { min: 0, max: 100 } });
    expect(next.decoys[0]).toMatchObject({ alive: false });
    expect(next.decoys[1]).toMatchObject({ alive: true });
    expect(next.lastShot?.hitTankId).toBe('d1');
    expect(next.lastShot?.hit).toBe(false);
  });

  it('leaves the terrain and the hearts unchanged for an enemy shell that leaves the battlefield', () => {
    const s = createRound(freePlaySettings(), 5, 'left');
    const impact = { point: { x: 0, y: 500 }, hitTargetId: null, outOfBounds: true, shooter: 'enemy' as const };
    const next = applyImpact(s, impact, BLAST_RADIUS, { noDamage: false, range: { min: 0, max: 100 } });
    expect(next.terrain).toBe(s.terrain);
    expect(next.lives).toBe(LIVES);
  });

  it('measures the time played: it stops while paused, continues after resume and is frozen once the round is over (FR-084)', () => {
    const { controller, advance } = makeController({ roundType: 'enemyCount', roundLength: 1 });
    controller.startRound('freePlay');
    expect(controller.elapsedMs()).toBe(0);
    expect(controller.getState().elapsedMs).toBe(0);
    advance(5_000);
    expect(controller.elapsedMs()).toBe(5_000);
    controller.pause();
    expect(controller.getState().elapsedMs).toBe(5_000);
    advance(3_000);
    expect(controller.elapsedMs()).toBe(5_000);
    controller.resume();
    advance(1_000);
    expect(controller.elapsedMs()).toBe(6_000);
    fireAtEnemy(controller);
    advance(500);
    controller.shotAnimationDone();
    expect(controller.getState().phase).toBe('roundOver');
    expect(controller.getState().elapsedMs).toBe(6_500);
    advance(10_000);
    expect(controller.elapsedMs()).toBe(6_500);
    controller.startRound('freePlay');
    expect(controller.elapsedMs()).toBe(0);
  });

  it('startRound resets the hearts, the score and the time', () => {
    const { controller, advance } = makeController({ enemyDifficulty: 'challenging' });
    controller.startRound('freePlay');
    playTurn(controller, fireAtEnemy);
    for (let i = 0; i < 40 && controller.getState().lives === LIVES; i++) playTurn(controller, fireAtOwnNumber);
    fireAtOwnNumber(controller);
    controller.shotAnimationDone();
    advance(4_000);
    const before = controller.getState();
    expect(before.enemiesDestroyed).toBe(1);
    expect(before.lives).toBeLessThan(LIVES);
    controller.startRound('freePlay');
    const after = controller.getState();
    expect(after).toMatchObject({ lives: LIVES, enemiesDestroyed: 0, elapsedMs: 0, lastEnemyHit: false });
    expect(controller.elapsedMs()).toBe(0);
  });

  it('pause freezes the phase and resume returns to it', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    controller.pause();
    expect(controller.getState().phase).toBe('paused');
    controller.fireAt(30);
    controller.typeDigit(3);
    expect(controller.getState().phase).toBe('paused');
    expect(controller.getState().selection).toBeNull();
    controller.resume();
    expect(controller.getState().phase).toBe('aiming');

    fireAtOwnNumber(controller);
    controller.pause();
    controller.shotAnimationDone();
    expect(controller.getState().phase).toBe('paused');
    expect(controller.getState().turn).toBe(0);
    controller.resume();
    expect(controller.getState().phase).toBe('playerShot');
    controller.shotAnimationDone();
    expect(controller.getState().phase).toBe('enemyTurn');
    controller.enemyShotAnimationDone();
    expect(controller.getState().phase).toBe('aiming');
  });

  it('does not pause a finished round', () => {
    const { controller } = makeController({ roundType: 'enemyCount', roundLength: 1 });
    controller.startRound('freePlay');
    playTurn(controller, fireAtEnemy);
    controller.pause();
    expect(controller.getState().phase).toBe('roundOver');
  });

  it('calls subscribers on every change and stops after unsubscribe', () => {
    const { controller } = makeController();
    const seen: RoundState[] = [];
    const unsubscribe = controller.subscribe((s) => seen.push(s));
    controller.startRound('freePlay');
    controller.typeDigit(3);
    controller.confirm();
    controller.shotAnimationDone();
    controller.enemyShotAnimationDone();
    controller.pause();
    controller.resume();
    expect(seen.map((s) => s.phase)).toEqual(['aiming', 'aiming', 'playerShot', 'enemyTurn', 'aiming', 'paused', 'aiming']);
    expect(seen.at(-1)).toBe(controller.getState());
    unsubscribe();
    controller.typeDigit(4);
    expect(seen).toHaveLength(7);
  });

  it('gives each change a new state object', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    const a = controller.getState();
    controller.selectNumber(30);
    expect(controller.getState()).not.toBe(a);
    expect(a.selection).toBeNull();
    expect(controller.getState().selection).toBe(30);
  });

  it('takes a settings snapshot at startRound; new settings apply from the next round (FR-049)', () => {
    const settings = freePlaySettings({ roundType: 'enemyCount', roundLength: 1 });
    const controller = new BattleController({ settings, progress: memoryProgressStore(), clock: () => 0, seed: 3 });
    controller.startRound('freePlay');
    settings.roundLength = 20;
    controller.updateSettings(freePlaySettings({ roundType: 'enemyCount', roundLength: 2 }));
    playTurn(controller, fireAtEnemy);
    expect(controller.getState().outcome).toBe('goalReached');

    controller.startRound('freePlay');
    playTurn(controller, fireAtEnemy);
    expect(controller.getState().phase).toBe('aiming');
    playTurn(controller, fireAtEnemy);
    expect(controller.getState().outcome).toBe('goalReached');
  });

  it('gives the same rounds for the same seed', () => {
    const run = () => {
      const { controller } = makeController({ enemyDifficulty: 'normal' }, 42);
      controller.startRound('freePlay');
      playTurn(controller, fireAtEnemy);
      playTurn(controller, fireAtOwnNumber);
      playTurn(controller, fireAtOwnNumber);
      return controller.getState();
    };
    const a = run();
    const b = run();
    expect(b.seed).toBe(a.seed);
    expect(enemyOf(b).position).toBe(enemyOf(a).position);
    expect(b.lives).toBe(a.lives);
    expect(b.lastShot).toEqual(a.lastShot);
    expect(Array.from(b.terrain)).toEqual(Array.from(a.terrain));
  });

  it('records no attempts in free play', () => {
    const { controller, progress } = makeController({ noDamage: true });
    controller.startRound('freePlay');
    for (let i = 0; i < 3; i++) playTurn(controller, fireAtEnemy);
    for (let i = 0; i < 3; i++) playTurn(controller, fireAtOwnNumber);
    expect(progress.getProgress().attempts).toHaveLength(0);
  });
});

describe('BattleController newScene (amendment 03, FR-070)', () => {
  it('starts a fresh round in the same mode with new terrain, 3 hearts, score 0, turn 0 and the other side', () => {
    const { controller, progress } = makeController();
    controller.startRound('freePlay');
    playTurn(controller, fireBetween);
    playTurn(controller, fireAtEnemy);
    const before = controller.getState();
    expect(before.turn).toBeGreaterThan(0);
    expect(before.enemiesDestroyed).toBe(1);
    // An unfinished choice is pending when the scene is replaced.
    controller.selectNumber(enemyOf(before).position);

    controller.newScene();
    const after = controller.getState();
    expect(after.mode).toBe('freePlay');
    expect(after.phase).toBe('aiming');
    expect(after.seed).not.toBe(before.seed);
    expect(Array.from(after.terrain)).not.toEqual(Array.from(before.terrain));
    expect(after.turn).toBe(0);
    expect(after).toMatchObject({ lives: LIVES, enemiesDestroyed: 0, elapsedMs: 0 });
    expect(after.playerSide).not.toBe(before.playerSide);
    expect(after.selection).toBeNull();
    expect(after.lastShot).toBeNull();
    expect(after.outcome).toBeNull();
    expect(progress.getProgress().attempts).toEqual([]);
  });

  it('is ignored while a shell is in flight or the game is paused', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');

    fireBetween(controller);
    expect(controller.getState().phase).toBe('playerShot');
    const inFlight = controller.getState();
    controller.newScene();
    expect(controller.getState()).toBe(inFlight);

    controller.shotAnimationDone();
    expect(controller.getState().phase).toBe('enemyTurn');
    const enemyTurn = controller.getState();
    controller.newScene();
    expect(controller.getState()).toBe(enemyTurn);
    controller.enemyShotAnimationDone();

    controller.pause();
    const paused = controller.getState();
    expect(paused.phase).toBe('paused');
    controller.newScene();
    expect(controller.getState()).toBe(paused);
    controller.resume();
    controller.newScene();
    expect(controller.getState().seed).not.toBe(paused.seed);
  });

  it('also works after the round is over', () => {
    const { controller } = makeController({ roundType: 'enemyCount', roundLength: 1 });
    controller.startRound('freePlay');
    playTurn(controller, fireAtEnemy);
    expect(controller.getState().phase).toBe('roundOver');
    const over = controller.getState();
    controller.newScene();
    expect(controller.getState().phase).toBe('aiming');
    expect(controller.getState().seed).not.toBe(over.seed);
  });
});

describe('BattleController free play reads the ruler (US9, amendment 02, T180)', () => {
  it('each free-play turn has a readPosition challenge with the visible enemy standing at its answer (FR-014, FR-067)', () => {
    const { controller } = makeController({ noDamage: true }, 4242);
    controller.startRound('freePlay');
    // Hits on turns 0, 3 and 6, misses and near misses between them.
    for (let i = 0; i < 7; i++) {
      const s = controller.getState();
      expect(s.phase).toBe('aiming');
      expect(s.challenge?.kind).toBe('readPosition');
      expect(s.challenge?.answer).toBe(enemyOf(s).position);
      expect(s.challenge?.rulerLevel).toBe(s.rulerLevel);
      // After a miss the challenge stays; after a hit a new one follows.
      playTurn(controller, i % 3 === 0 ? fireAtEnemy : i % 3 === 1 ? fireNextToEnemy : fireAtOwnNumber);
    }
  });

  it('a near miss keeps the enemy; the exact number destroys it, and lastShot keeps the number it stood at (FR-066, FR-068)', () => {
    const { controller } = makeController({ range: { preset: 'custom', min: 550, max: 780 }, rulerLevelStart: 2, noDamage: true }, 99);
    controller.startRound('freePlay');
    const answer = controller.getState().challenge!.answer;
    const near = answer + (answer < 780 ? 1 : -1);
    controller.fireAt(near);
    controller.shotAnimationDone();
    expect(controller.getState().lastShot).toMatchObject({ fired: near, hit: false, nearMiss: true, enemyNumber: answer, distance: 1 });
    expect(enemyOf(controller.getState()).position).toBe(answer);
    controller.enemyShotAnimationDone();
    controller.fireAt(answer);
    controller.shotAnimationDone();
    // The destroyed enemy is replaced, but the feedback keeps the number it stood at.
    const next = controller.getState();
    expect(next.lastShot).toMatchObject({ fired: answer, hit: true, enemyNumber: answer });
    expect(enemyOf(next).position).not.toBe(answer);
    expect(next.challenge!.answer).toBe(enemyOf(next).position);
    expect(next.challenge).not.toHaveProperty('hitTolerance');
  });

  it('records no attempt in read-the-ruler free play', () => {
    const { controller, progress } = makeController({ noDamage: true }, 5);
    controller.startRound('freePlay');
    for (let i = 0; i < 6; i++) playTurn(controller, i % 2 === 0 ? fireAtEnemy : fireBetween);
    expect(progress.getProgress().attempts).toHaveLength(0);
  });

  it('uses rulerLevelStart as the round ruler level', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      const { controller } = makeController({ rulerLevelStart: level, rulerLevelMax: 5 }, 10 + level);
      controller.startRound('freePlay');
      expect(controller.getState().rulerLevel).toBe(level);
      expect(controller.getState().challenge?.rulerLevel).toBe(level);
    }
  });

  it('range 550 to 780 on level 2: the player stands at 550 or 780 and the enemy on a multiple of 10 (US9 scenarios 4 and 5, D14)', () => {
    for (let seed = 0; seed < 60; seed++) {
      const { controller } = makeController({ range: { preset: 'custom', min: 550, max: 780 }, rulerLevelStart: 2, noDamage: true }, seed);
      controller.startRound('freePlay');
      for (let turn = 0; turn < 3; turn++) {
        const s = controller.getState();
        expect([550, 780]).toContain(s.player.position);
        expect(s.player.position).toBe(s.playerSide === 'left' ? 550 : 780);
        expect(enemyOf(s).position % 10).toBe(0);
        expect(enemyOf(s).position).toBeGreaterThanOrEqual(550);
        expect(enemyOf(s).position).toBeLessThanOrEqual(780);
        playTurn(controller, fireAtEnemy);
      }
    }
  });
});

describe('BattleController any number range (US9, T145)', () => {
  it('range 0 to 1000: typing 4, 3, 7 and confirm fires at 437 and the shell lands at 437 (FR-020, FR-064)', () => {
    const { controller } = makeController({ range: { preset: '0-1000', min: 0, max: 1000 } }, 31);
    controller.startRound('freePlay');
    for (const d of [4, 3, 7] as const) controller.typeDigit(d);
    expect(controller.getState().selection).toBe(437);
    controller.confirm();
    const s = controller.getState();
    expect(s.phase).toBe('playerShot');
    expect(xToNumber(s.shot!.impact.x, 0, 1000)).toBe(437);
    controller.shotAnimationDone();
    expect(controller.getState().lastShot).toMatchObject({ fired: 437, landed: 437 });
  });

  it('range 0 to 1000: selectNumber(437) after typing 436 selects 437 and clears the typed digits', () => {
    const { controller } = makeController({ range: { preset: '0-1000', min: 0, max: 1000 } });
    controller.startRound('freePlay');
    for (const d of [4, 3, 6] as const) controller.typeDigit(d);
    controller.selectNumber(437);
    expect(controller.getState().selection).toBe(437);
    expect(controller.getState().entry.typed).toBe('');
  });

  it('range 0 to 1000: selectNumber from a pointer x snaps to the nearest whole number', () => {
    const { controller } = makeController({ range: { preset: '0-1000', min: 0, max: 1000 } });
    controller.startRound('freePlay');
    const unit = (DEFAULT_LAYOUT.right - DEFAULT_LAYOUT.left) / 1000;
    controller.selectNumber(xToNumber(numberToX(437, 0, 1000) + 0.4 * unit, 0, 1000));
    expect(controller.getState().selection).toBe(437);
    controller.selectNumber(xToNumber(numberToX(437, 0, 1000) - 0.6 * unit, 0, 1000));
    expect(controller.getState().selection).toBe(436);
    controller.selectNumber(436.6);
    expect(controller.getState().selection).toBe(437);
  });

  it('range -20 to 30: typeMinus then 5 gives -5; range 0 to 100 ignores typeMinus (FR-060)', () => {
    const neg = makeController({ range: { preset: 'custom', min: -20, max: 30 } }).controller;
    neg.startRound('freePlay');
    neg.typeMinus();
    neg.typeDigit(5);
    expect(neg.getState().selection).toBe(-5);
    expect(neg.getState().entry.typed).toBe('-5');

    const pos = makeController({ range: { preset: '0-100', min: 0, max: 100 } }).controller;
    pos.startRound('freePlay');
    pos.typeMinus();
    expect(pos.getState().entry.typed).toBe('');
    pos.typeDigit(5);
    expect(pos.getState().selection).toBe(5);
  });
});

describe('BattleController input method (amendment 05, FR-076)', () => {
  it('is null before any input in the first round', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    expect(controller.getState().inputMethod).toBeNull();
  });

  it('typeDigit, typeMinus and backspace set keyboard; selectNumber sets pointer', () => {
    const { controller } = makeController({ range: { preset: 'custom', min: -20, max: 30 } });
    controller.startRound('freePlay');
    controller.selectNumber(5);
    expect(controller.getState().inputMethod).toBe('pointer');
    controller.typeMinus();
    expect(controller.getState().inputMethod).toBe('keyboard');
    controller.selectNumber(5);
    controller.typeDigit(3);
    expect(controller.getState().inputMethod).toBe('keyboard');
    controller.selectNumber(5);
    controller.backspace();
    expect(controller.getState().inputMethod).toBe('keyboard');
  });

  it('confirm() fires and sets keyboard; confirm(pointer) fires at the same number and sets pointer', () => {
    const a = makeController();
    a.controller.startRound('freePlay');
    a.controller.selectNumber(42);
    a.controller.confirm();
    expect(a.controller.getState().phase).toBe('playerShot');
    expect(a.controller.getState().inputMethod).toBe('keyboard');

    const b = makeController();
    b.controller.startRound('freePlay');
    b.controller.typeDigit(4);
    b.controller.typeDigit(2);
    b.controller.confirm('pointer');
    const s = b.controller.getState();
    expect(s.phase).toBe('playerShot');
    expect(xToNumber(s.shot!.impact.x, 0, 100)).toBe(42);
    expect(s.inputMethod).toBe('pointer');
  });

  it('ignored calls in playerShot, enemyTurn and paused do not change it', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    // The enemy fires after every shot that does not destroy it (amendment 07).
    controller.selectNumber(controller.getState().player.position);
    controller.confirm('pointer');
    expect(controller.getState().inputMethod).toBe('pointer');
    controller.typeDigit(5);
    controller.confirm();
    expect(controller.getState().inputMethod).toBe('pointer');
    controller.shotAnimationDone();
    expect(controller.getState().phase).toBe('enemyTurn');
    controller.typeDigit(5);
    expect(controller.getState().inputMethod).toBe('pointer');
    controller.enemyShotAnimationDone();
    controller.pause();
    controller.typeDigit(5);
    controller.backspace();
    controller.confirm();
    expect(controller.getState().inputMethod).toBe('pointer');
  });

  it('is kept by startRound and newScene', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    controller.typeDigit(5);
    controller.newScene();
    expect(controller.getState().inputMethod).toBe('keyboard');
    controller.selectNumber(50);
    controller.startRound('freePlay');
    expect(controller.getState().inputMethod).toBe('pointer');
  });
});

describe('BattleController updateSettings (US6, FR-049, T105)', () => {
  it('keeps the current round unchanged and applies new settings at the next startRound', () => {
    const { controller } = makeController({
      range: { preset: '0-20', min: 0, max: 20 },
      rulerLevelStart: 1,
      enemyDifficulty: 'easy',
      challengeTypes: { numberLine: true, addition: true, subtraction: true, comparison: true },
    });
    controller.startRound('freePlay');
    const before = controller.getState();
    const roundSettingsBefore = structuredClone(controller.getRoundSettings());

    const next = freePlaySettings({
      range: { preset: '0-100', min: 0, max: 100 },
      rulerLevelStart: 3,
      enemyDifficulty: 'challenging',
      challengeTypes: { numberLine: true, addition: false, subtraction: false, comparison: false },
    });
    controller.updateSettings(next);
    // A change to the caller's object after the call must not reach the controller.
    next.enemyDifficulty = 'normal';

    // Mid-round: state and the round snapshot are untouched.
    expect(controller.getState()).toBe(before);
    expect(controller.getRoundSettings()).toEqual(roundSettingsBefore);
    playTurn(controller, fireAtEnemy);
    const mid = controller.getState();
    expect(mid.rulerLevel).toBe(1);
    expect(mid.challenge?.answer).toBeLessThanOrEqual(20);
    expect(enemyOf(mid).position).toBeLessThanOrEqual(20);
    expect(controller.getRoundSettings().range).toEqual({ preset: '0-20', min: 0, max: 20 });
    expect(controller.getRoundSettings().enemyDifficulty).toBe('easy');
    expect(controller.getRoundSettings().challengeTypes.addition).toBe(true);

    controller.startRound('freePlay');
    const after = controller.getState();
    expect(after.rulerLevel).toBe(3);
    expect(controller.getRoundSettings().range).toEqual({ preset: '0-100', min: 0, max: 100 });
    expect(controller.getRoundSettings().enemyDifficulty).toBe('challenging');
    expect(controller.getRoundSettings().challengeTypes).toEqual({ numberLine: true, addition: false, subtraction: false, comparison: false });
    expect(after.challenge?.rulerLevel).toBe(3);
  });

  it('applies the latest of several updates during one round', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    controller.updateSettings(freePlaySettings({ enemyDifficulty: 'normal' }));
    controller.updateSettings(freePlaySettings({ enemyDifficulty: 'challenging' }));
    controller.startRound('freePlay');
    expect(controller.getRoundSettings().enemyDifficulty).toBe('challenging');
  });
});

function guidedController(overrides: Partial<Settings> = {}, seed = 1234) {
  let now = 1_000;
  const clock = () => now;
  const progress = memoryProgressStore();
  const controller = new BattleController({ settings: { ...defaultSettings(), adaptive: false, ...overrides }, progress, clock, seed });
  return { controller, progress, advance: (ms: number) => (now += ms), now: () => now };
}

/** The first seeded guided round whose first search matches `accept`. */
function guidedRoundWhere(accept: (s: RoundState) => boolean, overrides: Partial<Settings> = {}) {
  for (let seed = 1; seed < 400; seed++) {
    const g = guidedController(overrides, seed);
    g.controller.startRound('guided');
    if (accept(g.controller.getState())) return g;
  }
  throw new Error('no seed found');
}

const positionSearch = (s: RoundState) => s.challenge !== null && s.challenge.kind !== 'readPosition';

type Guided = ReturnType<typeof guidedController>;

/** Waits until the challenge is answerable, fires at n and plays the animations; the enemy's shot too when it fires. */
function answer(g: Guided, n: number): void {
  g.advance(1_000);
  g.controller.fireAt(n);
  g.controller.shotAnimationDone();
  if (g.controller.getState().phase === 'enemyTurn') g.controller.enemyShotAnimationDone();
}

/** A number halfway between the player and the answer: off the enemy's body and away from the player. */
function missNumber(s: RoundState): number {
  return Math.round((s.player.position + s.challenge!.answer) / 2);
}

/** 1 away from the answer, toward the player: on the enemy's body in 0 to 100. */
function nearNumber(s: RoundState): number {
  const a = s.challenge!.answer;
  return a + Math.sign(s.player.position - a);
}

function typeNumber(c: BattleController, n: number): void {
  for (const ch of String(n)) c.typeDigit(Number(ch) as Digit);
}

describe('BattleController guided turn flow (US2, T060)', () => {
  it("startRound('guided') begins in challenge with the enemy visible at the answer, 3 hearts and score 0 (amendment 07)", () => {
    const g = guidedRoundWhere(positionSearch);
    const s = g.controller.getState();
    expect(s.mode).toBe('guided');
    expect(s.phase).toBe('challenge');
    expect(s.enemy).toMatchObject({ position: s.challenge!.answer, x: numberToX(s.challenge!.answer, 0, 100), alive: true });
    expect(s.lives).toBe(LIVES);
    expect(s.enemiesDestroyed).toBe(0);
    expect(s.help).toEqual({ level: 0, wrongAnswers: 0, wrongAnswerTimes: [], content: null });
    expect(Math.abs(s.challenge!.answer - s.player.position)).toBeGreaterThanOrEqual(minEnemyGap(0, 100));
  });

  it('getState() and subscribers get the enemy with its number and coordinates in every challenge kind (amendment 07, FR-010)', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 80; seed++) {
      const g = guidedController({ noDamage: true, challengeTypes: { numberLine: true, addition: true, subtraction: true, comparison: true } }, seed);
      const seen: RoundState[] = [];
      g.controller.subscribe((s) => seen.push(s));
      g.controller.startRound('guided');
      g.controller.selectNumber(40);
      for (const s of [g.controller.getState(), ...seen]) {
        if (s.phase !== 'challenge') continue;
        expect(s.enemy).toMatchObject({ kind: 'enemy', position: s.challenge!.answer, alive: true });
        expect(s.enemy.x).toBe(numberToX(s.enemy.position, 0, 100));
        if (s.challenge!.options) expect(s.decoys.length).toBe(s.challenge!.options.length - 1);
      }
      kinds.add(g.controller.getState().challenge!.kind);
    }
    for (const kind of ['readPosition', 'addition', 'subtraction', 'greater']) expect(kinds.has(kind)).toBe(true);
  });

  it('ignores fires before answerableAt, 1 second after the challenge appears (edge case "Rapid tapping or typing")', () => {
    const g = guidedRoundWhere(positionSearch);
    const s = g.controller.getState();
    expect(s.answerableAt).toBe(g.now() + 1_000);
    g.controller.fireAt(missNumber(s));
    g.controller.selectNumber(missNumber(s));
    g.controller.confirm('pointer');
    g.advance(999);
    g.controller.confirm('pointer');
    expect(g.controller.getState().phase).toBe('challenge');
    expect(g.controller.getState().turn).toBe(0);
    expect(g.controller.getState().help.wrongAnswers).toBe(0);
    g.advance(1);
    g.controller.confirm('pointer');
    expect(g.controller.getState().phase).toBe('playerShot');
  });

  it('selectNumber and typeDigit change only selection, entry and inputMethod', () => {
    const g = guidedRoundWhere(positionSearch);
    const before = g.controller.getState();
    g.controller.selectNumber(42);
    const a = g.controller.getState();
    expect(without(a, 'selection', 'entry', 'inputMethod')).toEqual(without(before, 'selection', 'entry', 'inputMethod'));
    expect(a.selection).toBe(42);
    expect(a.inputMethod).toBe('pointer');
    g.controller.typeDigit(7);
    const b = g.controller.getState();
    expect(without(b, 'selection', 'entry', 'inputMethod')).toEqual(without(before, 'selection', 'entry', 'inputMethod'));
    expect(b.selection).toBe(7);
    expect(b.entry.typed).toBe('7');
    expect(b.inputMethod).toBe('keyboard');
  });

  it('with no input yet or keyboard input no search is findNumber; after pointer answers findNumber follows (FR-076)', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const g = guidedController({}, seed);
      g.controller.startRound('guided');
      expect(g.controller.getState().challenge!.kind).not.toBe('findNumber');
    }
    const keyboard = guidedController({ noDamage: true }, 7);
    keyboard.controller.startRound('guided');
    for (let i = 0; i < 40; i++) {
      keyboard.advance(1_000);
      typeNumber(keyboard.controller, keyboard.controller.getState().challenge!.answer);
      keyboard.controller.confirm();
      keyboard.controller.shotAnimationDone();
      expect(keyboard.controller.getState().challenge!.kind).not.toBe('findNumber');
    }
    const pointer = guidedController({ noDamage: true }, 7);
    pointer.controller.startRound('guided');
    const kinds = new Set<string>();
    for (let i = 0; i < 40; i++) {
      pointer.advance(1_000);
      pointer.controller.selectNumber(pointer.controller.getState().challenge!.answer);
      pointer.controller.confirm('pointer');
      pointer.controller.shotAnimationDone();
      kinds.add(pointer.controller.getState().challenge!.kind);
    }
    expect(kinds.has('findNumber')).toBe(true);
  });

  it('confirm fires at the selection and moves to playerShot', () => {
    const g = guidedRoundWhere(positionSearch);
    g.advance(1_000);
    g.controller.selectNumber(50);
    g.controller.confirm('pointer');
    const s = g.controller.getState();
    expect(s.phase).toBe('playerShot');
    expect(s.shot!.shooter).toBe('player');
    expect(xToNumber(s.shot!.impact.x, 0, 100)).toBe(50);
  });

  it('a first miss returns to challenge with the landing number, the step count to the enemy and help level 1; no heart is lost', () => {
    const g = guidedRoundWhere(positionSearch);
    const s0 = g.controller.getState();
    const n = missNumber(s0);
    answer(g, n);
    const s = g.controller.getState();
    expect(s.phase).toBe('challenge');
    expect(s.challenge!.id).toBe(s0.challenge!.id);
    expect(s.lastShot).toMatchObject({ landed: n, hit: false, nearMiss: false, distance: Math.abs(n - s0.challenge!.answer), enemyNumber: s0.challenge!.answer });
    expect(s.help.level).toBe(1);
    expect(s.help.wrongAnswers).toBe(1);
    // The first enemy shot of a round always misses (FR-043).
    expect(s.lives).toBe(LIVES);
    expect(s.enemy.position).toBe(s0.challenge!.answer);
  });

  it('a near miss on the body counts as a miss and sets lastShot.nearMiss (FR-066)', () => {
    const g = guidedRoundWhere(positionSearch);
    answer(g, nearNumber(g.controller.getState()));
    const s = g.controller.getState();
    expect(s.phase).toBe('challenge');
    expect(s.lastShot!.nearMiss).toBe(true);
    expect(s.lastShot!.hit).toBe(false);
    expect(s.help.level).toBe(1);
    expect(s.help.wrongAnswers).toBe(1);
    expect(s.lastShot!.distance).toBe(1);
    expect(s.enemiesDestroyed).toBe(0);
  });

  it('every shot that is not a hit goes to enemyTurn, from the enemy tank, and then back to challenge in the same search (amendment 07, FR-081)', () => {
    const g = guidedRoundWhere(positionSearch);
    const id = g.controller.getState().challenge!.id;
    g.advance(1_000);
    g.controller.fireAt(missNumber(g.controller.getState()));
    g.controller.shotAnimationDone();
    expect(g.controller.getState().phase).toBe('enemyTurn');
    g.controller.enemyShotAnimationDone();
    g.advance(1_000);
    g.controller.fireAt(nearNumber(g.controller.getState()));
    g.controller.shotAnimationDone();
    const firing = g.controller.getState();
    expect(firing.phase).toBe('enemyTurn');
    expect(firing.shot!.shooter).toBe('enemy');
    expect(firing.shot!.path[0]).toEqual(muzzle(firing.enemy));
    g.controller.enemyShotAnimationDone();
    const s = g.controller.getState();
    expect(s.phase).toBe('challenge');
    expect(s.challenge!.id).toBe(id);
    expect(s.help.wrongAnswers).toBe(2);
  });

  it('the exact number destroys the enemy, then a new search starts with a new visible enemy and no enemy turn', () => {
    const g = guidedRoundWhere(positionSearch);
    const s0 = g.controller.getState();
    const target = s0.challenge!.answer;
    const seen: RoundState[] = [];
    g.controller.subscribe((s) => seen.push(s));
    answer(g, missNumber(s0));
    seen.length = 0;
    g.advance(1_000);
    g.controller.fireAt(target);
    g.controller.shotAnimationDone();
    expect(seen.some((s) => s.phase === 'enemyTurn')).toBe(false);
    const destroyed = seen.find((s) => !s.enemy.alive);
    expect(destroyed).toBeDefined();
    expect(destroyed!.enemy).toMatchObject({ position: target, alive: false });
    expect(destroyed!.lastShot).toMatchObject({ fired: target, hit: true, enemyNumber: target });
    const s = g.controller.getState();
    expect(s.phase).toBe('challenge');
    expect(s.enemiesDestroyed).toBe(1);
    expect(s.help).toEqual({ level: 0, wrongAnswers: 0, wrongAnswerTimes: [], content: null });
    expect(s.challenge!.id).not.toBe(s0.challenge!.id);
    expect(Math.abs(s.challenge!.answer - s.player.position)).toBeGreaterThanOrEqual(minEnemyGap(0, 100));
    expect(s.answerableAt).toBe(g.now() + 1_000);
    expect(s.enemy).toMatchObject({ position: s.challenge!.answer, alive: true });
  });
});

describe('BattleController guided misses, help and round end (US2, T061)', () => {
  it('three misses in one search: the enemy fires after each, help reaches 3, the selection is the answer and confirm destroys the enemy', () => {
    const g = guidedRoundWhere(positionSearch);
    let enemyTurns = 0;
    g.controller.subscribe((s) => {
      if (s.phase === 'enemyTurn') enemyTurns++;
    });
    const s0 = g.controller.getState();
    for (let i = 0; i < 3; i++) answer(g, missNumber(s0));
    const s = g.controller.getState();
    expect(enemyTurns).toBe(3);
    expect(s.help.level).toBe(3);
    expect(s.help.wrongAnswers).toBe(3);
    expect(s.selection).toBe(s0.challenge!.answer);
    expect(s.challenge!.id).toBe(s0.challenge!.id);
    g.advance(1_000);
    g.controller.confirm();
    g.controller.shotAnimationDone();
    expect(g.controller.getState().enemiesDestroyed).toBe(1);
    expect(enemyTurns).toBe(3);
  });

  it("'Gegner pro Runde' 3 ends the round with goalReached after the third destroyed enemy (FR-082)", () => {
    const g = guidedController({ roundType: 'enemyCount', roundLength: 3 });
    g.controller.startRound('guided');
    for (let i = 0; i < 3; i++) {
      expect(g.controller.getState().phase).toBe('challenge');
      answer(g, g.controller.getState().challenge!.answer);
    }
    const s = g.controller.getState();
    expect(s.phase).toBe('roundOver');
    expect(s.outcome).toBe('goalReached');
    expect(s.enemiesDestroyed).toBe(3);
  });

  it("'Bis alle Herzen weg' ends only when the hearts are gone", () => {
    const g = guidedController({ enemyDifficulty: 'challenging' });
    g.controller.startRound('guided');
    for (let i = 0; i < 8; i++) answer(g, g.controller.getState().challenge!.answer);
    expect(g.controller.getState().phase).toBe('challenge');
    expect(g.controller.getState().enemiesDestroyed).toBe(8);
    for (let i = 0; i < 300 && g.controller.getState().phase !== 'roundOver'; i++) {
      // Away from the enemy: the player's own shell never costs a heart, so only enemy shells end the round.
      answer(g, missNumber(g.controller.getState()));
    }
    const s = g.controller.getState();
    expect(s.outcome).toBe('heartsGone');
    expect(s.lives).toBe(0);
    expect(s.enemiesDestroyed).toBe(8);
  });

  it('a guided readPosition search starts with the enemy visible at the answer; a near miss does not hit, only the exact number', () => {
    const g = guidedRoundWhere((s) => s.challenge?.kind === 'readPosition');
    const s0 = g.controller.getState();
    expect(s0.phase).toBe('challenge');
    expect(s0.enemy).toMatchObject({ position: s0.challenge!.answer, alive: true });
    answer(g, nearNumber(s0));
    expect(g.controller.getState().lastShot!.nearMiss).toBe(true);
    expect(g.controller.getState().enemiesDestroyed).toBe(0);
    answer(g, s0.challenge!.answer);
    expect(g.controller.getState().enemiesDestroyed).toBe(1);
  });

  it('has no bonus challenge method or state (amendment 01)', () => {
    const g = guidedRoundWhere(positionSearch);
    expect('requestBonusChallenge' in g.controller).toBe(false);
    expect(g.controller.getState()).not.toHaveProperty('challengePurpose');
  });
});

describe('BattleController attempts (US2, T063; classifyAttempt since T130)', () => {
  it('records one attempt per finished search', () => {
    const g = guidedController({ noDamage: true });
    g.controller.startRound('guided');
    const challenges: string[] = [];
    for (let i = 0; i < 4; i++) {
      const s = g.controller.getState();
      challenges.push(s.challenge!.id);
      answer(g, missNumber(s));
      answer(g, s.challenge!.answer);
    }
    const { attempts, sessions } = g.progress.getProgress();
    expect(attempts.map((a) => a.challengeId)).toEqual(challenges);
    expect(sessions).toHaveLength(1);
    expect(attempts.every((a) => a.sessionId === sessions[0]!.id && a.rangeKey === '0-100' && a.exact)).toBe(true);
  });

  it('records nothing while a shot is in flight; a hit on the first shot without help is independent', () => {
    const g = guidedRoundWhere(positionSearch);
    const s0 = g.controller.getState();
    // 1.6 s after answers became possible: not a guess (FR-038).
    g.advance(2_600);
    g.controller.fireAt(s0.challenge!.answer);
    expect(g.progress.getProgress().attempts).toHaveLength(0);
    g.controller.shotAnimationDone();
    expect(g.progress.getProgress().attempts).toEqual([
      expect.objectContaining({
        challengeId: s0.challenge!.id,
        seed: s0.challenge!.seed,
        kind: s0.challenge!.kind,
        skills: s0.challenge!.skills,
        difficultyStep: s0.challenge!.difficultyStep,
        solved: true,
        independent: true,
        exact: true,
        helpLevel: 0,
        wrongAnswers: 0,
        responseMs: 1_600,
        guess: false,
      }),
    ]);
  });

  it('a near miss on the body followed by the exact number is stored with wrongAnswers 1 and independent false (FR-075)', () => {
    const g = guidedRoundWhere(positionSearch);
    const s0 = g.controller.getState();
    answer(g, nearNumber(s0));
    answer(g, s0.challenge!.answer);
    const [a] = g.progress.getProgress().attempts;
    expect(a).toMatchObject({ solved: true, independent: false, wrongAnswers: 1, helpLevel: 1, exact: true });
  });

  it('a shot at the shown solution is stored as not solved with help level 3', () => {
    const g = guidedRoundWhere(positionSearch, { noDamage: true });
    const s0 = g.controller.getState();
    for (let i = 0; i < 3; i++) answer(g, missNumber(s0));
    g.advance(1_000);
    g.controller.confirm();
    g.controller.shotAnimationDone();
    const [a] = g.progress.getProgress().attempts;
    expect(a).toMatchObject({ solved: false, independent: false, helpLevel: 3, wrongAnswers: 3 });
  });

  it('records no attempt in free play and none for a search dropped by newScene', () => {
    const g = guidedRoundWhere(positionSearch);
    answer(g, missNumber(g.controller.getState()));
    g.controller.newScene();
    g.controller.startRound('freePlay');
    g.advance(1_000);
    g.controller.fireAt(g.controller.getState().challenge!.answer);
    g.controller.shotAnimationDone();
    expect(g.progress.getProgress().attempts).toHaveLength(0);
  });
});

describe('BattleController round ruler level (T064, FR-018)', () => {
  it('rulerLevelStart 3 gives state.rulerLevel 3 in both modes', () => {
    const g = guidedController({ rulerLevelStart: 3, freePlay: true });
    g.controller.startRound('guided');
    expect(g.controller.getState().rulerLevel).toBe(3);
    g.controller.startRound('freePlay');
    expect(g.controller.getState().rulerLevel).toBe(3);
  });
});

describe('BattleController visible enemy and return fire (amendment 07, T222)', () => {
  /** Every state the subscribers receive from now on. */
  function record(g: Guided): RoundState[] {
    const seen: RoundState[] = [];
    g.controller.subscribe((s) => seen.push(s));
    return seen;
  }

  it('in a position search the enemy is visible and fires from its own tank after each miss (FR-043a)', () => {
    const g = guidedRoundWhere(positionSearch, { noDamage: true });
    const s0 = g.controller.getState();
    const seen = record(g);
    answer(g, missNumber(s0));
    answer(g, nearNumber(s0));
    const firing = seen.filter((s) => s.phase === 'enemyTurn');
    expect(firing).toHaveLength(2);
    for (const s of firing) {
      expect(s.enemy).toMatchObject({ position: s0.challenge!.answer, alive: true });
      expect(s.shot!.path[0]).toEqual(muzzle(s.enemy));
      expect(s.shot!.path.at(-1)).toEqual(s.shot!.impact);
    }
    for (const s of seen) if (s.lastShot) expect(s.lastShot.enemyNumber).toBe(s0.challenge!.answer);
  });

  it('in a comparison turn the enemy shell enters from the top edge above the child, not from the enemy (FR-043a)', () => {
    const g = guidedController(COMPARISON_47_74.settings, COMPARISON_47_74.seed);
    g.controller.startRound('guided');
    const s0 = g.controller.getState();
    const seen = record(g);
    g.advance(1_000);
    g.controller.tapTank(s0.decoys[0]!.id);
    g.controller.shotAnimationDone();
    const firing = seen.find((s) => s.phase === 'enemyTurn')!;
    const path = firing.shot!.path;
    expect(path[0]!.y).toBe(WORLD_HEIGHT);
    expect(Math.abs(path[0]!.x - s0.player.x)).toBeLessThanOrEqual(TOP_SHELL_SPREAD);
    expect(path.at(-1)).toEqual(firing.shot!.impact);
    for (const t of [s0.enemy, ...s0.decoys]) expect(Math.abs(path[0]!.x - t.x)).toBeGreaterThan(TANK_HIT_RADIUS);
  });

  it('a help request is not a shot: no enemy turn follows (FR-081)', () => {
    const g = guidedController(SUBTRACTION_43_MINUS_7.settings, SUBTRACTION_43_MINUS_7.seed);
    g.controller.startRound('guided');
    g.controller.requestHelp();
    g.controller.requestHelp();
    expect(g.controller.getState().phase).toBe('challenge');
    expect(g.controller.getState().shot).toBeNull();
  });

  it("the enemy's hits never depend on the child's answers, help or mistakes (FR-042)", () => {
    /** Whether each enemy shot of the first `shots` enemy turns hits the child's tank. */
    function enemyHits(play: (g: Guided, s: RoundState) => void): boolean[] {
      const g = guidedController({ noDamage: true, enemyDifficulty: 'challenging' }, 31);
      g.controller.startRound('guided');
      const hits: boolean[] = [];
      for (let i = 0; i < 12; i++) {
        play(g, g.controller.getState());
        g.advance(1_000);
        g.controller.shotAnimationDone();
        const s = g.controller.getState();
        if (s.phase !== 'enemyTurn') continue;
        hits.push(enemyHitsPlayer(s.shot!.impact, s.shot!.hitTargetId, s.player));
        g.controller.enemyShotAnimationDone();
      }
      return hits;
    }
    const plainMisses = enemyHits((g, s) => {
      g.advance(1_000);
      g.controller.fireAt(missNumber(s));
    });
    const withHelpAndNearMisses = enemyHits((g, s) => {
      g.controller.requestHelp();
      g.advance(1_000);
      g.controller.fireAt(s.turn % 2 === 0 ? nearNumber(s) : s.player.position);
    });
    expect(plainMisses).toHaveLength(12);
    expect(withHelpAndNearMisses).toEqual(plainMisses);
    expect(plainMisses[0]).toBe(false);
    expect(plainMisses.some(Boolean)).toBe(true);
  });
});

describe('BattleController step animation for addition and subtraction (US3, T080)', () => {
  const onlySubtraction = SUBTRACTION_43_MINUS_7.settings;
  const onlyAddition: Partial<Settings> = { challengeTypes: { numberLine: false, addition: true, subtraction: false, comparison: false } };

  function fixtureRound(beginnerAssist = true) {
    const g = guidedController({ ...onlySubtraction, beginnerAssist }, SUBTRACTION_43_MINUS_7.seed);
    g.controller.startRound('guided');
    return g;
  }

  it('the fixture seed starts with 43 − 7 and no step animation', () => {
    const s = fixtureRound().controller.getState();
    expect(s.challenge!.operands).toEqual([43, 7]);
    expect(s.stepAnimation).toBeNull();
  });

  it('requestHelp on 43 − 7 sets the step path 43, 40, 36 and changes no heart, turn or shot count (FR-024, FR-030, FR-081)', () => {
    const g = fixtureRound();
    const before = g.controller.getState();
    g.controller.requestHelp();
    const s = g.controller.getState();
    expect(s.stepAnimation).toEqual([43, 40, 36]);
    expect(s.stepAnimation).toEqual(stepPath(s.challenge!, true));
    expect(s.lives).toBe(before.lives);
    expect(s.turn).toBe(before.turn);
    expect(s.shot).toBeNull();
    expect(s.phase).toBe('challenge');
    // Help use is recorded: the search is no longer independent (D5).
    expect(s.help.level).toBe(1);
    expect(s.help.wrongAnswers).toBe(0);
  });

  it('without beginner assistance the step path has no stop at the ten: 43, 36', () => {
    const g = fixtureRound(false);
    g.controller.requestHelp();
    expect(g.controller.getState().stepAnimation).toEqual([43, 36]);
  });

  it('for an addition the step path is stepPath(challenge, beginnerAssist)', () => {
    const g = guidedRoundWhere((s) => s.challenge?.kind === 'addition', onlyAddition);
    g.controller.requestHelp();
    const s = g.controller.getState();
    expect(s.stepAnimation).toEqual(stepPath(s.challenge!, true));
    expect(s.stepAnimation![0]).toBe(s.challenge!.operands[0]);
    expect(s.stepAnimation!.at(-1)).toBe(s.challenge!.answer);
  });

  it('after the help, firing at 36 destroys the enemy and the new search has no step animation', () => {
    const g = fixtureRound();
    g.controller.requestHelp();
    answer(g, 36);
    const s = g.controller.getState();
    expect(s.enemiesDestroyed).toBe(1);
    expect(s.phase).toBe('challenge');
    expect(s.stepAnimation).toBeNull();
  });

  it('requestHelp is ignored while a shell is in flight and in free play', () => {
    const g = fixtureRound();
    g.advance(1_000);
    g.controller.fireAt(50);
    g.controller.requestHelp();
    expect(g.controller.getState().stepAnimation).toBeNull();
    const { controller } = makeController();
    controller.startRound('freePlay');
    controller.requestHelp();
    expect(controller.getState().stepAnimation).toBeNull();
    expect(controller.getState().help.level).toBe(0);
  });
});

describe('BattleController comparison with decoy tanks (US4, T087, decision D15)', () => {
  const onlyComparison = COMPARISON_47_74.settings;

  /** The fixture round: "Welche Zahl ist größer?" with 47 and 74, answerable. */
  function fixtureRound() {
    const g = guidedController(onlyComparison, COMPARISON_47_74.seed);
    g.controller.startRound('guided');
    g.advance(1_000);
    return g;
  }

  function order3Round() {
    const g = guidedRoundWhere((s) => s.challenge?.kind === 'order3', onlyComparison);
    g.advance(1_000);
    return g;
  }

  /** The tank ids of an order3 search, from the smallest number to the largest. */
  function ascendingIds(s: RoundState): string[] {
    return [enemyOf(s), ...s.decoys].sort((a, b) => a.position - b.position).map((t) => t.id);
  }

  it('a comparison search shows the enemy at the answer and a decoy at its own number, both labeled (FR-026, FR-027)', () => {
    const s = fixtureRound().controller.getState();
    const { min, max } = onlyComparison.range;
    expect(s.challenge!.kind).toBe('greater');
    expect(enemyOf(s).position).toBe(74);
    expect(enemyOf(s).label).toBe(74);
    expect(s.decoys).toHaveLength(1);
    const decoy = s.decoys[0]!;
    expect(decoy.kind).toBe('decoy');
    expect(decoy.position).toBe(47);
    expect(decoy.label).toBe(47);
    expect(decoy.alive).toBe(true);
    expect(decoy.x).toBe(numberToX(47, min, max));
    expect(new Set([s.player.id, s.enemy.id, decoy.id]).size).toBe(3);
  });

  it('every comparison search has one tank per option, the enemy at the answer and the decoys at the other options', () => {
    for (let seed = 1; seed < 60; seed++) {
      const g = guidedController(onlyComparison, seed);
      g.controller.startRound('guided');
      const s = g.controller.getState();
      const c = s.challenge!;
      expect(enemyOf(s).position).toBe(c.answer);
      expect([enemyOf(s), ...s.decoys].map((t) => t.label).sort((a, b) => a! - b!)).toEqual(c.options);
      for (const d of s.decoys) expect(d.position).toBe(d.label);
    }
  });

  it('tapTank on the correct tank fires at its number and destroys the enemy (US4 scenario 1, amendment 06)', () => {
    const g = fixtureRound();
    const enemy = enemyOf(g.controller.getState());
    g.controller.tapTank(enemy.id);
    expect(g.controller.getState().phase).toBe('playerShot');
    expect(g.controller.getState().inputMethod).toBe('pointer');
    g.controller.shotAnimationDone();
    const s = g.controller.getState();
    expect(s.lastShot).toMatchObject({ fired: 74, hit: true, hitTankId: enemy.id });
    expect(s.enemiesDestroyed).toBe(1);
    expect(s.phase).toBe('challenge');
  });

  it('tapTank on a decoy destroys only the decoy and counts as a miss with help level 1 (US4 scenario 2, FR-027, FR-083)', () => {
    const g = fixtureRound();
    const decoy = g.controller.getState().decoys[0]!;
    g.controller.tapTank(decoy.id);
    g.controller.shotAnimationDone();
    const s = g.controller.getState();
    expect(s.lastShot).toMatchObject({ fired: 47, hit: false, nearMiss: false, hitTankId: decoy.id });
    expect(s.decoys[0]!.alive).toBe(false);
    expect(s.enemy.alive).toBe(true);
    expect(s.enemiesDestroyed).toBe(0);
    expect(s.help.level).toBe(1);
    expect(s.help.wrongAnswers).toBe(1);
    // A decoy hit is a miss, so the enemy fires back (amendment 07, FR-081).
    expect(s.phase).toBe('enemyTurn');
    g.controller.enemyShotAnimationDone();
    expect(g.controller.getState().phase).toBe('challenge');
    // A destroyed decoy cannot be tapped again.
    g.controller.tapTank(decoy.id);
    expect(g.controller.getState().phase).toBe('challenge');
  });

  it('typing a tank number and confirm acts like tapTank on it (FR-064, decision D15)', () => {
    const g = fixtureRound();
    typeNumber(g.controller, 47);
    g.controller.confirm();
    g.controller.shotAnimationDone();
    let s = g.controller.getState();
    expect(s.decoys[0]!.alive).toBe(false);
    expect(s.lastShot!.hitTankId).toBe(s.decoys[0]!.id);
    expect(s.inputMethod).toBe('keyboard');
    g.controller.enemyShotAnimationDone();
    typeNumber(g.controller, 74);
    g.controller.confirm();
    g.controller.shotAnimationDone();
    if (g.controller.getState().phase === 'enemyTurn') g.controller.enemyShotAnimationDone();
    s = g.controller.getState();
    expect(s.enemiesDestroyed).toBe(1);
  });

  it('typing another number fires at it: a miss, and a near miss on the enemy tank body (edge case "typed number not on any tank")', () => {
    const g = fixtureRound();
    typeNumber(g.controller, 60);
    g.controller.confirm();
    expect(g.controller.getState().phase).toBe('playerShot');
    g.controller.shotAnimationDone();
    let s = g.controller.getState();
    expect(s.lastShot).toMatchObject({ fired: 60, hit: false, nearMiss: false, hitTankId: null });
    expect(s.decoys[0]!.alive).toBe(true);
    expect(s.help.level).toBe(1);
    const g2 = fixtureRound();
    typeNumber(g2.controller, 73);
    g2.controller.confirm();
    g2.controller.shotAnimationDone();
    s = g2.controller.getState();
    expect(s.lastShot).toMatchObject({ fired: 73, hit: false, nearMiss: true });
    expect(s.enemiesDestroyed).toBe(0);
  });

  it('the destroyed enemy is replaced by a new search with new tanks', () => {
    const g = fixtureRound();
    g.controller.tapTank(enemyOf(g.controller.getState()).id);
    g.controller.shotAnimationDone();
    const s = g.controller.getState();
    expect(s.challenge!.options).toBeDefined();
    expect(s.decoys.every((d) => d.alive)).toBe(true);
    expect(s.decoys).toHaveLength(s.challenge!.options!.length - 1);
    expect(enemyOf(s).position).toBe(s.challenge!.answer);
  });

  it('tapTank is ignored before the challenge is answerable, outside comparisons and for the player tank', () => {
    const g = guidedController(onlyComparison, COMPARISON_47_74.seed);
    g.controller.startRound('guided');
    g.controller.tapTank(enemyOf(g.controller.getState()).id);
    expect(g.controller.getState().phase).toBe('challenge');
    g.advance(1_000);
    g.controller.tapTank(g.controller.getState().player.id);
    expect(g.controller.getState().phase).toBe('challenge');
    const { controller } = makeController();
    controller.startRound('freePlay');
    controller.tapTank(enemyOf(controller.getState()).id);
    expect(controller.getState().phase).toBe('aiming');
  });

  it('order3: taps place badges without firing; the correct third badge fires at the enemy (US4 scenario 3)', () => {
    const g = order3Round();
    const s0 = g.controller.getState();
    expect(s0.decoys).toHaveLength(2);
    expect(enemyOf(s0).position).toBe(Math.max(...s0.challenge!.options!));
    const [a, b, c] = ascendingIds(s0);
    g.controller.tapTank(a!);
    g.controller.tapTank(b!);
    let s = g.controller.getState();
    expect(s.orderTaps).toEqual([a, b]);
    expect(s.phase).toBe('challenge');
    expect(s.shot).toBeNull();
    expect(s.turn).toBe(0);
    // Tapping a badged tank again changes nothing.
    g.controller.tapTank(b!);
    expect(g.controller.getState().orderTaps).toEqual([a, b]);
    g.controller.tapTank(c!);
    s = g.controller.getState();
    expect(s.phase).toBe('playerShot');
    g.controller.shotAnimationDone();
    s = g.controller.getState();
    expect(s.lastShot).toMatchObject({ fired: enemyOf(s0).position, hit: true });
    expect(s.enemiesDestroyed).toBe(1);
  });

  it('order3: typed numbers with confirm place badges; a typed number on no tank places none and shows the hint', () => {
    const g = order3Round();
    const s0 = g.controller.getState();
    const sorted = [...s0.challenge!.options!];
    const ids = ascendingIds(s0);
    const offTank = sorted[0]! + 1;
    typeNumber(g.controller, offTank);
    g.controller.confirm();
    let s = g.controller.getState();
    expect(s.orderTaps).toEqual([]);
    expect(s.notOnTank).toBe(true);
    expect(s.phase).toBe('challenge');
    expect(s.turn).toBe(0);
    expect(s.entry.typed).toBe('');
    typeNumber(g.controller, sorted[0]!);
    s = g.controller.getState();
    expect(s.notOnTank).toBe(false);
    g.controller.confirm();
    s = g.controller.getState();
    expect(s.orderTaps).toEqual([ids[0]]);
    expect(s.inputMethod).toBe('keyboard');
    typeNumber(g.controller, sorted[1]!);
    g.controller.confirm();
    typeNumber(g.controller, sorted[2]!);
    g.controller.confirm();
    expect(g.controller.getState().phase).toBe('playerShot');
    g.controller.shotAnimationDone();
    expect(g.controller.getState().enemiesDestroyed).toBe(1);
  });

  it('order3: a wrong order resets the badges and counts as a miss, not as a shot', () => {
    const g = order3Round();
    const [a, b, c] = ascendingIds(g.controller.getState());
    g.controller.tapTank(a!);
    g.controller.tapTank(c!);
    const s = g.controller.getState();
    expect(s.orderTaps).toEqual([]);
    expect(s.help.level).toBe(1);
    expect(s.help.wrongAnswers).toBe(1);
    expect(s.phase).toBe('challenge');
    expect(s.turn).toBe(0);
    expect(s.lastShot).toBeNull();
    // Starting again in the right order still works.
    g.controller.tapTank(a!);
    g.controller.tapTank(b!);
    g.controller.tapTank(c!);
    expect(g.controller.getState().phase).toBe('playerShot');
  });
});

describe('BattleController help escalation (US5, T095)', () => {
  it('each miss raises help.level by one and sets an encouraging message; the content follows nextHelp (FR-030, FR-031)', () => {
    const g = guidedRoundWhere(positionSearch);
    const s0 = g.controller.getState();
    const target = s0.challenge!.answer;
    const n = missNumber(s0);
    answer(g, n);
    const s1 = g.controller.getState();
    expect(s1.help.level).toBe(1);
    expect(s1.message).toMatchObject({ key: 'encouragement' });
    expect(encouragements).toContain(messageText(s1.message!));
    expect(s1.help.content).toEqual(nextHelp(s1.challenge!, 1, n, s1RoundSettings(g)));
    expect(s1.help.content).toMatchObject({ step: 1, direction: directionTo(n, target) });
    answer(g, n);
    const s2 = g.controller.getState();
    expect(s2.help.level).toBe(2);
    expect(s2.help.content).toMatchObject({ step: 2, count: { from: n, to: target } });
    expect(encouragements).toContain(messageText(s2.message!));
  });

  it('requestHelp before firing shows the next step at once; it is not a shot and the enemy does not fire (FR-030, FR-081)', () => {
    const g = guidedRoundWhere(positionSearch);
    const phases: string[] = [];
    g.controller.subscribe((s) => phases.push(s.phase));
    const before = g.controller.getState();
    g.controller.requestHelp();
    const s = g.controller.getState();
    expect(s.help.level).toBe(1);
    expect(s.help.content).toMatchObject({ step: 1, direction: null, nearestMajor: nearestMajorTick(s.challenge!.answer, 0, 100) });
    expect(s.help.wrongAnswers).toBe(0);
    expect(s.turn).toBe(before.turn);
    expect(s.lives).toBe(before.lives);
    expect(s.shot).toBeNull();
    expect(s.phase).toBe('challenge');
    g.controller.requestHelp();
    expect(g.controller.getState().help.content).toMatchObject({ step: 2, count: { from: nearestMajorTick(s.challenge!.answer, 0, 100) } });
    expect(phases).not.toContain('enemyTurn');
  });

  it('requestHelp works for every kind: a comparison gets the tens digits, then the markers, then the correct tank', () => {
    const g = guidedController(COMPARISON_47_74.settings, COMPARISON_47_74.seed);
    g.controller.startRound('guided');
    g.controller.requestHelp();
    expect(g.controller.getState().help.content).toMatchObject({ step: 1, tensDigits: true });
    g.controller.requestHelp();
    expect(g.controller.getState().help.content).toMatchObject({ step: 2, optionMarkers: [47, 74] });
    g.controller.requestHelp();
    const s = g.controller.getState();
    expect(s.help.level).toBe(3);
    expect(s.help.content).toMatchObject({ step: 3, solution: 74 });
    expect(s.selection).toBe(74);
    g.controller.requestHelp();
    expect(g.controller.getState()).toBe(s);
  });

  it('a help request at level 2 shows the solution and sets the selection to the answer', () => {
    const g = guidedRoundWhere(positionSearch);
    const s0 = g.controller.getState();
    answer(g, missNumber(s0));
    g.controller.requestHelp();
    expect(g.controller.getState().help.level).toBe(2);
    g.controller.requestHelp();
    const s = g.controller.getState();
    expect(s.help.level).toBe(3);
    expect(s.selection).toBe(s0.challenge!.answer);
    expect(s.help.content).toMatchObject({ step: 3, solution: s0.challenge!.answer });
  });

  it('three misses: the enemy fires after each, a miss never changes lives, the solution is selected and confirm destroys the enemy (SC-005)', () => {
    const g = guidedRoundWhere(positionSearch, { enemyDifficulty: 'challenging' });
    const s0 = g.controller.getState();
    let enemyTurns = 0;
    for (let i = 0; i < 3; i++) {
      g.advance(1_000);
      g.controller.fireAt(missNumber(s0));
      const livesBefore = g.controller.getState().lives;
      g.controller.shotAnimationDone();
      const firing = g.controller.getState();
      // The miss itself leaves the hearts as they were.
      expect(firing.lives).toBe(livesBefore);
      expect(firing.phase).toBe('enemyTurn');
      enemyTurns++;
      const hits = firing.shot!.hitTargetId !== null;
      g.controller.enemyShotAnimationDone();
      if (g.controller.getState().phase === 'roundOver') return;
      expect(g.controller.getState().lives).toBe(hits ? livesBefore - 1 : livesBefore);
    }
    const s = g.controller.getState();
    expect(enemyTurns).toBe(3);
    expect(s.help).toMatchObject({ level: 3, wrongAnswers: 3, content: { step: 3, solution: s0.challenge!.answer } });
    expect(s.selection).toBe(s0.challenge!.answer);
    g.advance(1_000);
    g.controller.confirm();
    g.controller.shotAnimationDone();
    expect(g.controller.getState().enemiesDestroyed).toBe(1);
    expect(g.progress.getProgress().attempts[0]).toMatchObject({ helpLevel: 3, solved: false, independent: false, wrongAnswers: 3 });
    // The new search starts without help and without a message.
    expect(g.controller.getState().help).toEqual({ level: 0, wrongAnswers: 0, wrongAnswerTimes: [], content: null });
    expect(g.controller.getState().message).toBeNull();
  });

  it('a near miss on the body raises help.level like a miss and sets "Ganz knapp! Triff die Linie." (FR-066)', () => {
    const g = guidedRoundWhere(positionSearch);
    answer(g, nearNumber(g.controller.getState()));
    const s = g.controller.getState();
    expect(s.help.level).toBe(1);
    expect(s.message).toEqual({ key: 'near' });
    expect(messageText(s.message!)).toBe('Ganz knapp! Triff die Linie.');
  });

  it('a miss after a help request goes on from the requested step', () => {
    const g = guidedRoundWhere(positionSearch);
    g.controller.requestHelp();
    answer(g, missNumber(g.controller.getState()));
    expect(g.controller.getState().help.level).toBe(2);
  });

  it('with every help type off, a help request shows the solution at once (FR-032)', () => {
    const g = guidedRoundWhere(positionSearch, { help: { nearestTen: false, countSteps: false, zoom: false, stepAnimation: false } });
    g.controller.requestHelp();
    const s = g.controller.getState();
    expect(s.help.level).toBe(3);
    expect(s.selection).toBe(s.challenge!.answer);
  });

  it('with timeLimitSeconds 10, tick() after 10 s shows the next help step with no penalty (FR-034, decision D1)', () => {
    const g = guidedRoundWhere(positionSearch, { timeLimitSeconds: 10 });
    const before = g.controller.getState();
    g.advance(9_999);
    g.controller.tick();
    expect(g.controller.getState()).toBe(before);
    g.advance(1);
    g.controller.tick();
    const s = g.controller.getState();
    expect(s.help.level).toBe(1);
    expect(s.help.wrongAnswers).toBe(0);
    expect(s.lives).toBe(before.lives);
    expect(s.turn).toBe(before.turn);
    expect(s.phase).toBe('challenge');
    // The next period starts with the step just shown.
    g.advance(9_000);
    g.controller.tick();
    expect(g.controller.getState().help.level).toBe(1);
    g.advance(1_000);
    g.controller.tick();
    expect(g.controller.getState().help.level).toBe(2);
    expect(g.controller.helpTimeLeftMs()).toBe(10_000);
  });

  it('without a time limit no timer exists: tick() never changes the state', () => {
    const g = guidedRoundWhere(positionSearch);
    const before = g.controller.getState();
    g.advance(600_000);
    g.controller.tick();
    expect(g.controller.getState()).toBe(before);
    expect(g.controller.helpTimeLeftMs()).toBeNull();
  });

  it('the time limit stops while paused and while a shell is in flight', () => {
    const g = guidedRoundWhere(positionSearch, { timeLimitSeconds: 10 });
    g.advance(5_000);
    g.controller.pause();
    g.advance(60_000);
    g.controller.tick();
    g.controller.resume();
    g.controller.tick();
    expect(g.controller.getState().help.level).toBe(0);
    expect(g.controller.helpTimeLeftMs()).toBe(5_000);
    g.controller.fireAt(missNumber(g.controller.getState()));
    g.advance(60_000);
    g.controller.tick();
    expect(g.controller.getState().phase).toBe('playerShot');
    expect(g.controller.getState().help.level).toBe(0);
  });
});

function s1RoundSettings(g: Guided): Settings {
  return g.controller.getRoundSettings() as Settings;
}

function adaptiveController(overrides: Partial<Settings> = {}, initial: Progress = emptyProgress(), seed = 1234) {
  let now = 1_000;
  const clock = () => now;
  const progress = memoryProgressStore(initial);
  const controller = new BattleController({ settings: { ...defaultSettings(), adaptive: true, noDamage: true, roundType: 'enemyCount', roundLength: 20, ...overrides }, progress, clock, seed });
  return { controller, progress, advance: (ms: number) => (now += ms), now: () => now };
}

/** Progress with the given skill steps in the range 0 to 100. */
function progressWithSteps(steps: Partial<Record<Skill, number>>): Progress {
  const p = emptyProgress();
  for (const [skill, step] of Object.entries(steps)) {
    p.skills[skillKey(skill as Skill, '0-100')] = { step: step!, recent: [], masteryWindow: [], guesses: 0, attempts: 0, independentCorrect: 0, assisted: 0 };
  }
  return p;
}

/** Waits 2.5 s after answers become possible (not a guess) and fires at the answer. */
function answerCalmly(g: { controller: BattleController; advance: (ms: number) => number }): void {
  g.advance(1_000 + 2_500);
  g.controller.fireAt(g.controller.getState().challenge!.answer);
  g.controller.shotAnimationDone();
}

const onlyNumberLine = { challengeTypes: { numberLine: true, addition: false, subtraction: false, comparison: false } };
const onlyAddition = { challengeTypes: { numberLine: false, addition: true, subtraction: false, comparison: false } };

describe('BattleController adaptive difficulty (US7, T129)', () => {
  it('with adaptive on and every skill at step 0, challenges use the step 0 limits (FR-037)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const g = adaptiveController(onlyNumberLine, emptyProgress(), seed);
      g.controller.startRound('guided');
      const s = g.controller.getState();
      const c = s.challenge!;
      // Step 0 of the number-line ladders: a fifth of the range, from the smallest answer allowed at minEnemyGap.
      const lowest = s.player.position === 0 ? 15 : 0;
      expect(c.answer, `seed ${seed} ${c.kind}`).toBeLessThanOrEqual(lowest + 20);
      expect(c.difficultyStep).toBe(0);
    }
    for (let seed = 1; seed <= 40; seed++) {
      const g = adaptiveController(onlyAddition, emptyProgress(), seed);
      g.controller.startRound('guided');
      const s = g.controller.getState();
      const c = s.challenge!;
      // Addition step 0: half the range, added numbers up to 5, no crossing of a ten.
      expect(c.kind).toBe('addition');
      expect(c.answer, `seed ${seed}`).toBeLessThanOrEqual((s.player.position === 0 ? 15 : 0) + 50);
      expect(c.operands.slice(1).every((k) => k >= 1 && k <= 5), `seed ${seed} ${c.operands}`).toBe(true);
      const path = c.steps ?? [c.operands[0]!, c.answer];
      expect(path.some((n, i) => i > 0 && crossesMultiple(path[i - 1]!, n, 10)), `seed ${seed} ${path}`).toBe(false);
    }
  });

  it('with adaptive off, challenges use the parent settings as before (FR-037, US7 scenario 6)', () => {
    const answers = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const g = adaptiveController({ ...onlyNumberLine, adaptive: false }, emptyProgress(), seed);
      g.controller.startRound('guided');
      answers.add(g.controller.getState().challenge!.answer);
    }
    expect([...answers].some((n) => n > 50)).toBe(true);
  });

  it('after 5 independent attempts in a skill the next challenge in that skill uses step 1 (FR-037, US7 scenario 1)', () => {
    const g = adaptiveController({ ...onlyAddition, roundLength: 20 });
    g.controller.startRound('guided');
    for (let i = 0; i < 4; i++) {
      answerCalmly(g);
      expect(g.controller.getState().challenge!.difficultyStep, `search ${i + 2}`).toBe(0);
    }
    answerCalmly(g);
    expect(g.progress.getProgress().skills[skillKey('addition', '0-100')]!.step).toBe(1);
    const c = g.controller.getState().challenge!;
    expect(c.difficultyStep).toBe(1);
    expect(g.progress.getProgress().attempts.every((a) => a.independent && !a.guess)).toBe(true);
  });

  it('classifies attempts with classifyAttempt: a hit 1 s after answerable is stored as a guess (FR-038)', () => {
    const g = adaptiveController(onlyAddition);
    g.controller.startRound('guided');
    g.advance(1_000 + 1_000);
    g.controller.fireAt(g.controller.getState().challenge!.answer);
    g.controller.shotAnimationDone();
    const [a] = g.progress.getProgress().attempts;
    expect(a).toMatchObject({ solved: true, independent: true, guess: true, responseMs: 1_000 });
    // A guess is counted, but does not enter the adaptive window.
    expect(g.progress.getProgress().skills[skillKey('addition', '0-100')]).toMatchObject({ attempts: 1, guesses: 1, recent: [] });
  });

  it('a shot at the shown solution after 3 quick misses is stored as unsolved, not as a guess (FR-038)', () => {
    const g = adaptiveController(onlyAddition);
    g.controller.startRound('guided');
    const s0 = g.controller.getState();
    g.advance(1_000);
    for (let i = 0; i < 3; i++) {
      g.advance(1_000);
      g.controller.fireAt(missNumber(s0));
      g.controller.shotAnimationDone();
      g.controller.enemyShotAnimationDone();
    }
    g.advance(1_000);
    // After 3 misses the solution is shown: fire at it.
    g.controller.fireAt(s0.challenge!.answer);
    g.controller.shotAnimationDone();
    const [a] = g.progress.getProgress().attempts;
    expect(a).toMatchObject({ solved: false, independent: false, guess: false, wrongAnswers: 3 });
  });

  it('records attempts in the current session of the progress store (start or continue the session)', () => {
    const g = adaptiveController(onlyAddition);
    g.controller.startRound('guided');
    answerCalmly(g);
    answerCalmly(g);
    const p = g.progress.getProgress();
    expect(p.sessions).toHaveLength(1);
    expect(p.sessions[0]).toMatchObject({ attempts: 2, independentCorrect: 2 });
    expect(p.attempts.every((a) => a.sessionId === p.sessions[0]!.id)).toBe(true);
  });

  it('state.rulerLevel follows the positions skill only (FR-018, AC-09)', () => {
    // Positions step 3 is ruler level 2; a high addition step changes nothing.
    const g = adaptiveController({ rulerLevelStart: 1, rulerLevelMax: 5 }, progressWithSteps({ positions: 3, addition: 3, comparison: 2 }));
    g.controller.startRound('guided');
    expect(g.controller.getState().rulerLevel).toBe(2);
    g.controller.startRound('freePlay');
    expect(g.controller.getState().rulerLevel).toBe(2);
    const h = adaptiveController({ rulerLevelStart: 1, rulerLevelMax: 5 }, progressWithSteps({ addition: 3, comparison: 2 }));
    h.controller.startRound('guided');
    expect(h.controller.getState().rulerLevel).toBe(1);
  });

  it('state.rulerLevel stays within the parent limits; with adaptive off it is the starting level (FR-018)', () => {
    const top = adaptiveController({ rulerLevelStart: 2, rulerLevelMax: 4 }, progressWithSteps({ positions: 6 }));
    top.controller.startRound('guided');
    expect(top.controller.getState().rulerLevel).toBe(4);
    const bottom = adaptiveController({ rulerLevelStart: 2, rulerLevelMax: 4 }, progressWithSteps({ positions: 0 }));
    bottom.controller.startRound('guided');
    expect(bottom.controller.getState().rulerLevel).toBe(2);
    const off = adaptiveController({ adaptive: false, rulerLevelStart: 2, rulerLevelMax: 4 }, progressWithSteps({ positions: 6 }));
    off.controller.startRound('guided');
    expect(off.controller.getState().rulerLevel).toBe(2);
  });
});

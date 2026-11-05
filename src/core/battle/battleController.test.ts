import { describe, expect, it } from 'vitest';
import { BattleController } from './controller';
import { memoryProgressStore } from './ports';
import type { Digit } from './entry';
import { enemyHitsPlayer, LIVES } from './hitRule';
import { applyImpact, createRound, muzzle, tankCenter, WORLD_HEIGHT, WORLD_WIDTH } from './round';
import { defaultSettings } from '../settings/defaults';
import type { RoundState, Settings } from '../types';
import { DEFAULT_LAYOUT, numberToX, xToNumber } from '../numberline/mapping';
import { minEnemyGap } from '../math/gaps';
import { settleY } from '../physics/terrain';
import { BLAST_RADIUS } from '../physics/damage';
import { solveArcToX } from '../physics/arc';

function freePlaySettings(overrides: Partial<Settings> = {}): Settings {
  return { ...defaultSettings(), freePlay: true, ...overrides };
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
  c.fireAt(c.getState().enemy.position);
}

/** Fire 1 away from the enemy, toward the player: a near miss on the body where the body is at least 1 wide. */
function fireNextToEnemy(c: BattleController): void {
  const s = c.getState();
  c.fireAt(s.enemy.position + Math.sign(s.player.position - s.enemy.position));
}

/** Fire at the player's own number: far from the enemy (at least minEnemyGap), harms nobody. */
function fireAtOwnNumber(c: BattleController): void {
  c.fireAt(c.getState().player.position);
}

/** Fire halfway between the tanks: away from both, without digging a pit around the player tank. */
function fireBetween(c: BattleController): void {
  const s = c.getState();
  c.fireAt(Math.round((s.player.position + s.enemy.position) / 2));
}

/** One player shot and its animation, then the enemy's shot and its animation when the enemy fires (every 2nd shot). */
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
    expect(s.enemy.x).toBe(numberToX(s.enemy.position, min, max));
    expect(s.lives).toBe(LIVES);
    expect(s.enemiesDestroyed).toBe(0);
    expect(s.shotsSinceEnemyFire).toBe(0);
    expect(s.elapsedMs).toBe(0);
    expect(s.lastEnemyHit).toBe(false);
    expect('health' in s.player).toBe(false);
    expect('health' in s.enemy).toBe(false);
    expect(s.enemyFound).toBe(true);
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
        'seed', 'mode', 'turn', 'phase', 'terrain', 'player', 'enemy', 'decoys', 'playerSide', 'enemyFound', 'challenge', 'answerableAt',
        'help', 'selection', 'entry', 'orderTaps', 'inputMethod', 'rulerLevel', 'lastShot', 'lastPlayerPath', 'shot', 'outcome',
        'lives', 'enemiesDestroyed', 'shotsSinceEnemyFire', 'elapsedMs', 'lastEnemyHit',
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
        expect(Number.isInteger(s.enemy.position)).toBe(true);
        expect(s.enemy.position).toBeGreaterThanOrEqual(min);
        expect(s.enemy.position).toBeLessThanOrEqual(max);
        expect(Math.abs(s.enemy.position - s.player.position)).toBeGreaterThanOrEqual(minEnemyGap(min, max));
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
    // The enemy fires after the second shot (amendment 06).
    fireAtOwnNumber(controller);
    controller.shotAnimationDone();
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
    const n = controller.getState().enemy.position;
    controller.fireAt(n);
    const before = controller.getState();
    controller.shotAnimationDone();
    const after = controller.getState();
    const x = numberToX(n, 0, 100);
    expect(after.terrain).not.toBe(before.terrain);
    expect(after.terrain[Math.round(x)]).toBeLessThan(before.terrain[Math.round(x)] as number);
    expect(after.lastShot).toEqual({ fired: n, landed: n, hit: true, nearMiss: false, hitTankId: before.enemy.id, distance: 0, enemyNumber: n });
    expect(after.enemiesDestroyed).toBe(1);
    expect(after.shotsSinceEnemyFire).toBe(0);
    expect(after.phase).toBe('aiming');
    expect(after.shot).toBeNull();
    expect(after.enemy.alive).toBe(true);
    expect(after.enemy.position).not.toBe(n);
    expect(after.challenge?.answer).toBe(after.enemy.position);
    expect(after.lives).toBe(LIVES);
    expect(after.player.y).toBeCloseTo(settleY(after.terrain, after.player.x), 6);
    expect(after.enemy.y).toBeCloseTo(settleY(after.terrain, after.enemy.x), 6);
    expect(after.lastPlayerPath).toEqual(before.shot!.path);
    expect(after.turn).toBe(1);
  });

  it('a shot 1 away lands on the tank body: a near miss, the enemy stays and nothing is destroyed (amendment 06, FR-066)', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    const s = controller.getState();
    const n = s.enemy.position + (s.enemy.position < 100 ? 1 : -1);
    controller.fireAt(n);
    controller.shotAnimationDone();
    const after = controller.getState();
    expect(after.lastShot).toEqual({ fired: n, landed: n, hit: false, nearMiss: true, hitTankId: null, distance: 1, enemyNumber: s.enemy.position });
    expect(after.enemy.position).toBe(s.enemy.position);
    expect(after.enemy.alive).toBe(true);
    expect(after.challenge).toBe(s.challenge);
    expect(after.enemiesDestroyed).toBe(0);
    expect(after.shotsSinceEnemyFire).toBe(1);
    expect(after.phase).toBe('aiming');
  });

  it('a shot 3 away is off the tank body: a plain miss, no near miss', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    const s = controller.getState();
    const n = s.enemy.position + (s.enemy.position < 97 ? 3 : -3);
    controller.fireAt(n);
    controller.shotAnimationDone();
    expect(controller.getState().lastShot).toEqual({ fired: n, landed: n, hit: false, nearMiss: false, hitTankId: null, distance: 3, enemyNumber: s.enemy.position });
  });

  it('the body width follows the range: 4 away is a near miss in 550 to 780, 1 away a plain miss in 0 to 10', () => {
    const wide = makeController({ range: { preset: 'custom', min: 550, max: 780 }, rulerLevelStart: 2 }, 99).controller;
    wide.startRound('freePlay');
    const e = wide.getState().enemy.position;
    wide.fireAt(e + (e <= 776 ? 4 : -4));
    wide.shotAnimationDone();
    expect(wide.getState().lastShot).toMatchObject({ hit: false, nearMiss: true, distance: 4 });
    expect(wide.getState().enemiesDestroyed).toBe(0);

    const narrow = makeController({ range: { preset: '0-10', min: 0, max: 10 } }, 7).controller;
    narrow.startRound('freePlay');
    const m = narrow.getState().enemy.position;
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
    expect(after.lastShot).toEqual({ fired: s.player.position, landed: s.player.position, hit: false, nearMiss: false, hitTankId: null, distance: Math.abs(s.player.position - s.enemy.position), enemyNumber: s.enemy.position });
  });

  it('the enemy fires once after every 2 shots that do not destroy it, hit or miss (FR-081)', () => {
    const { controller } = makeController({ noDamage: true });
    controller.startRound('freePlay');
    fireAtOwnNumber(controller);
    controller.shotAnimationDone();
    expect(controller.getState().phase).toBe('aiming');
    expect(controller.getState().shotsSinceEnemyFire).toBe(1);
    fireNextToEnemy(controller);
    controller.shotAnimationDone();
    let s = controller.getState();
    expect(s.phase).toBe('enemyTurn');
    expect(s.shotsSinceEnemyFire).toBe(0);
    expect(s.shot?.shooter).toBe('enemy');
    expect(s.shot?.path[0]).toEqual(muzzle(s.enemy));
    controller.enemyShotAnimationDone();
    s = controller.getState();
    expect(s.phase).toBe('aiming');
    expect(s.shot).toBeNull();
    fireAtOwnNumber(controller);
    controller.shotAnimationDone();
    expect(controller.getState().phase).toBe('aiming');
    fireAtOwnNumber(controller);
    controller.shotAnimationDone();
    expect(controller.getState().phase).toBe('enemyTurn');
    expect(controller.getState().turn).toBe(4);
  });

  it('destroying an enemy restarts the count for the new enemy, so the destroyed enemy never fires (FR-081)', () => {
    const { controller } = makeController({ noDamage: true });
    controller.startRound('freePlay');
    fireAtOwnNumber(controller);
    controller.shotAnimationDone();
    expect(controller.getState().shotsSinceEnemyFire).toBe(1);
    fireAtEnemy(controller);
    controller.shotAnimationDone();
    expect(controller.getState().phase).toBe('aiming');
    expect(controller.getState().shotsSinceEnemyFire).toBe(0);
    fireAtOwnNumber(controller);
    controller.shotAnimationDone();
    expect(controller.getState().phase).toBe('aiming');
    expect(controller.getState().shotsSinceEnemyFire).toBe(1);
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
        const old = controller.getState().enemy.position;
        playTurn(controller, fireAtEnemy);
        const s = controller.getState();
        expect(s.phase).toBe('aiming');
        expect(s.enemy.position).not.toBe(old);
        expect(s.enemy.alive).toBe(true);
        expect(Number.isInteger(s.enemy.position)).toBe(true);
        expect(Math.abs(s.enemy.position - s.player.position)).toBeGreaterThanOrEqual(minEnemyGap(min, max));
        expect(s.enemy.x).toBe(numberToX(s.enemy.position, min, max));
        expect(s.enemy.y).toBeCloseTo(settleY(s.terrain, s.enemy.x), 6);
        expect(s.enemyFound).toBe(true);
        expect(s.enemiesDestroyed).toBe(i + 1);
      }
      // After a miss the enemy stays.
      const old = controller.getState().enemy.position;
      playTurn(controller, fireAtOwnNumber);
      expect(controller.getState().enemy.position).toBe(old);
    }
  });

  it('a scripted round fired with typeDigit plus confirm: "Gegner pro Runde" 2 ends after the second hit with goalReached (FR-082)', () => {
    const { controller } = makeController({ roundType: 'enemyCount', roundLength: 2 }, 77);
    controller.startRound('freePlay');
    for (const ch of String(controller.getState().enemy.position)) controller.typeDigit(Number(ch) as Digit);
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

  it("on 'easy' the first enemy shot of a round misses", () => {
    for (let seed = 0; seed < 10; seed++) {
      const { controller } = makeController({ enemyDifficulty: 'easy' }, seed);
      controller.startRound('freePlay');
      playTurn(controller, fireBetween);
      playTurn(controller, fireBetween);
      expect(controller.getState().lives).toBe(LIVES);
      expect(controller.getState().lastEnemyHit).toBe(false);
    }
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

    const n = s.enemy.position;
    const atEnemy = { point: { x: s.enemy.x, y: s.enemy.y }, hitTargetId: null, outOfBounds: false, shooter: 'player' as const, fired: n, landed: n };
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
    const s: RoundState = { ...base, decoys: [decoyAt('d1', 30), decoyAt('d2', 32)] };
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

  it('startRound resets the hearts, the score, the shot count and the time', () => {
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
    expect(after).toMatchObject({ lives: LIVES, enemiesDestroyed: 0, shotsSinceEnemyFire: 0, elapsedMs: 0, lastEnemyHit: false });
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
    controller.pause();
    controller.resume();
    expect(seen.map((s) => s.phase)).toEqual(['aiming', 'aiming', 'playerShot', 'aiming', 'paused', 'aiming']);
    expect(seen.at(-1)).toBe(controller.getState());
    unsubscribe();
    controller.typeDigit(4);
    expect(seen).toHaveLength(6);
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
    expect(b.enemy.position).toBe(a.enemy.position);
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
    controller.selectNumber(before.enemy.position);

    controller.newScene();
    const after = controller.getState();
    expect(after.mode).toBe('freePlay');
    expect(after.phase).toBe('aiming');
    expect(after.seed).not.toBe(before.seed);
    expect(Array.from(after.terrain)).not.toEqual(Array.from(before.terrain));
    expect(after.turn).toBe(0);
    expect(after).toMatchObject({ lives: LIVES, enemiesDestroyed: 0, shotsSinceEnemyFire: 0, elapsedMs: 0 });
    expect(after.playerSide).not.toBe(before.playerSide);
    expect(after.selection).toBeNull();
    expect(after.lastShot).toBeNull();
    expect(after.outcome).toBeNull();
    expect(progress.getProgress().attempts).toEqual([]);
  });

  it('is ignored while a shell is in flight or the game is paused', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    fireAtOwnNumber(controller);
    controller.shotAnimationDone();

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
      expect(s.challenge?.answer).toBe(s.enemy.position);
      expect(s.challenge?.rulerLevel).toBe(s.rulerLevel);
      expect(s.enemyFound).toBe(true);
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
    expect(controller.getState().enemy.position).toBe(answer);
    controller.fireAt(answer);
    controller.shotAnimationDone();
    // The destroyed enemy is replaced, but the feedback keeps the number it stood at.
    const next = controller.getState();
    expect(next.lastShot).toMatchObject({ fired: answer, hit: true, enemyNumber: answer });
    expect(next.enemy.position).not.toBe(answer);
    expect(next.challenge!.answer).toBe(next.enemy.position);
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
        expect(s.enemy.position % 10).toBe(0);
        expect(s.enemy.position).toBeGreaterThanOrEqual(550);
        expect(s.enemy.position).toBeLessThanOrEqual(780);
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
    // The enemy fires after the second shot (amendment 06).
    fireAtOwnNumber(controller);
    controller.shotAnimationDone();
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
    expect(mid.enemy.position).toBeLessThanOrEqual(20);
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

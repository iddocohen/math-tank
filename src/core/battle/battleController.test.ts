import { describe, expect, it } from 'vitest';
import { BattleController } from './controller';
import { memoryProgressStore } from './ports';
import type { Digit } from './entry';
import { applyImpact, createRound, muzzle, tankCenter, WORLD_HEIGHT, WORLD_WIDTH } from './round';
import { defaultSettings } from '../settings/defaults';
import type { RoundState, Settings } from '../types';
import { DEFAULT_LAYOUT, numberToX, xToNumber } from '../numberline/mapping';
import { minEnemyGap } from '../math/gaps';
import { settleY } from '../physics/terrain';
import { BLAST_RADIUS, MAX_DAMAGE } from '../physics/damage';
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

/** Fire at the enemy's number: an exact hit. */
function fireAtEnemy(c: BattleController): void {
  c.fireAt(c.getState().enemy.position);
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

/** One full turn: player shot, its animation, enemy shot, its animation (if the round goes on). */
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
    controller.setSettings(freePlaySettings({ range: { preset: '0-50', min: 0, max: 50 } }));
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
    expect(s.player.health).toBe(100);
    expect(s.enemy.health).toBe(100);
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
        'help', 'selection', 'entry', 'orderTaps', 'rulerLevel', 'lastShot', 'lastPlayerPath', 'shot', 'outcome',
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

  it('typeDigit, backspace, nudge and selectNumber change only selection and entry', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    const base = without(controller.getState(), 'selection', 'entry');
    const check = (selection: number | null, typed: string, outOfRange = false) => {
      const s = controller.getState();
      expect(s.selection).toBe(selection);
      expect(s.entry).toEqual({ typed, outOfRange });
      expect(without(s, 'selection', 'entry')).toEqual(base);
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
    controller.nudge(1);
    check(6, '');
    controller.nudge(10);
    check(16, '');
    controller.nudge(-10);
    controller.nudge(-10);
    check(0, '');
    controller.nudge(-1);
    check(0, '');
    controller.selectNumber(98);
    check(98, '');
    controller.nudge(10);
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

  it('nudge without a selection starts from the player tank number', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    const s = controller.getState();
    controller.nudge(s.playerSide === 'left' ? 10 : -10);
    expect(controller.getState().selection).toBe(s.playerSide === 'left' ? 10 : 90);
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

  it('ignores digits, Backspace, nudges, selections and confirm in playerShot and enemyTurn', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    controller.selectNumber(20);
    controller.confirm();
    for (const phase of ['playerShot', 'enemyTurn'] as const) {
      const s = controller.getState();
      expect(s.phase).toBe(phase);
      controller.typeDigit(5);
      controller.typeMinus();
      controller.backspace();
      controller.nudge(1);
      controller.selectNumber(70);
      controller.confirm();
      controller.fireAt(70);
      expect(controller.getState()).toBe(s);
      if (phase === 'playerShot') controller.shotAnimationDone();
    }
  });

  it('a hit at the enemy number: crater at the chosen x, MAX_DAMAGE, lastShot.hit', () => {
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
    expect(after.enemy.health).toBe(100 - MAX_DAMAGE);
    expect(after.player.health).toBe(100);
    expect(after.player.y).toBeCloseTo(settleY(after.terrain, after.player.x), 6);
    expect(after.enemy.y).toBeCloseTo(settleY(after.terrain, after.enemy.x), 6);
    expect(after.lastShot).toEqual({ fired: n, landed: n, hit: true, nearMiss: false, hitTankId: after.enemy.id, distance: 0 });
    expect(after.lastPlayerPath).toEqual(before.shot!.path);
    expect(after.turn).toBe(1);
  });

  it('a shot inside the blast radius but not at the enemy number is a near miss with no damage', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    const s = controller.getState();
    const n = s.enemy.position + (s.enemy.position < 100 ? 1 : -1);
    controller.fireAt(n);
    controller.shotAnimationDone();
    const after = controller.getState();
    expect(after.enemy.health).toBe(100);
    expect(after.lastShot).toEqual({ fired: n, landed: n, hit: false, nearMiss: true, hitTankId: null, distance: 1 });
  });

  it('a far miss sets neither hit nor nearMiss, and the own shell never changes the player health', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    const s = controller.getState();
    const n = s.player.position;
    controller.fireAt(n);
    controller.shotAnimationDone();
    const after = controller.getState();
    expect(after.player.health).toBe(100);
    expect(after.enemy.health).toBe(100);
    expect(after.lastShot).toEqual({ fired: n, landed: n, hit: false, nearMiss: false, hitTankId: null, distance: Math.abs(n - s.enemy.position) });
  });

  it('follows every free-play shot with an enemy turn, then returns to aiming', () => {
    const { controller } = makeController({ noDamage: true, roundLength: 10 });
    controller.startRound('freePlay');
    for (const shoot of [fireAtOwnNumber, fireAtEnemy, fireAtOwnNumber]) {
      shoot(controller);
      controller.shotAnimationDone();
      let s = controller.getState();
      expect(s.phase).toBe('enemyTurn');
      expect(s.shot?.shooter).toBe('enemy');
      expect(s.shot?.path[0]).toEqual(muzzle(s.enemy));
      controller.enemyShotAnimationDone();
      s = controller.getState();
      expect(s.phase).toBe('aiming');
      expect(s.shot).toBeNull();
    }
    expect(controller.getState().turn).toBe(3);
  });

  it('after a hit the enemy moves to a new visible position at least minEnemyGap from the player', () => {
    for (const [min, max, seed] of [
      [0, 10, 1],
      [0, 100, 2],
      [-20, 30, 3],
      [0, 1000, 4],
    ] as const) {
      const { controller } = makeController({ range: { preset: 'custom', min, max }, noDamage: true, roundLength: 30 }, seed);
      controller.startRound('freePlay');
      for (let i = 0; i < 2; i++) {
        const old = controller.getState().enemy.position;
        playTurn(controller, fireAtEnemy);
        const s = controller.getState();
        expect(s.phase).toBe('aiming');
        expect(s.enemy.position).not.toBe(old);
        expect(Number.isInteger(s.enemy.position)).toBe(true);
        expect(Math.abs(s.enemy.position - s.player.position)).toBeGreaterThanOrEqual(minEnemyGap(min, max));
        expect(s.enemy.x).toBe(numberToX(s.enemy.position, min, max));
        expect(s.enemy.y).toBeCloseTo(settleY(s.terrain, s.enemy.x), 6);
        expect(s.enemyFound).toBe(true);
      }
      // After a miss the enemy stays.
      const old = controller.getState().enemy.position;
      playTurn(controller, fireAtOwnNumber);
      expect(controller.getState().enemy.position).toBe(old);
    }
  });

  it('a scripted free-play round fired only with fireAt and typeDigit plus confirm', () => {
    const { controller } = makeController({ noDamage: true, roundLength: 10 }, 77);
    controller.startRound('freePlay');
    // First shot by typing the enemy number.
    for (const ch of String(controller.getState().enemy.position)) controller.typeDigit(Number(ch) as Digit);
    controller.confirm();
    controller.shotAnimationDone();
    expect(controller.getState().enemy.health).toBe(100 - MAX_DAMAGE);
    controller.enemyShotAnimationDone();
    playTurn(controller, fireAtEnemy);
    playTurn(controller, fireAtEnemy);
    const s = controller.getState();
    expect(s.phase).toBe('roundOver');
    expect(s.outcome).toBe('playerWon');
    expect(s.enemy.health).toBe(0);
    expect(s.enemy.alive).toBe(false);
    expect(s.turn).toBe(3);
  });

  it('ends with enemyWon when the player health reaches 0', () => {
    const { controller } = makeController({ enemyDifficulty: 'challenging', roundLength: 30 });
    controller.startRound('freePlay');
    for (let i = 0; i < 30 && controller.getState().phase !== 'roundOver'; i++) playTurn(controller, fireAtOwnNumber);
    const s = controller.getState();
    expect(s.outcome).toBe('enemyWon');
    expect(s.player.health).toBe(0);
    expect(s.player.alive).toBe(false);
  });

  it('ends with turnsUsed after roundLength player turns', () => {
    const { controller } = makeController({ noDamage: true, roundLength: 3 });
    controller.startRound('freePlay');
    playTurn(controller, fireAtOwnNumber);
    playTurn(controller, fireAtOwnNumber);
    expect(controller.getState().phase).toBe('aiming');
    playTurn(controller, fireAtOwnNumber);
    const s = controller.getState();
    expect(s.phase).toBe('roundOver');
    expect(s.outcome).toBe('turnsUsed');
    expect(s.turn).toBe(3);
  });

  it('keeps the player health at 100 in noDamage mode', () => {
    const { controller } = makeController({ noDamage: true, enemyDifficulty: 'challenging', roundLength: 10 });
    controller.startRound('freePlay');
    while (controller.getState().phase !== 'roundOver') {
      playTurn(controller, fireAtOwnNumber);
      expect(controller.getState().player.health).toBe(100);
    }
    expect(controller.getState().outcome).toBe('turnsUsed');
  });

  it("on 'easy' the first enemy shot misses and enemy hits do at most half damage", () => {
    const { controller } = makeController({ enemyDifficulty: 'easy', roundLength: 30 });
    controller.startRound('freePlay');
    playTurn(controller, fireBetween);
    expect(controller.getState().player.health).toBe(100);
    let health = 100;
    let damaged = false;
    while (controller.getState().phase !== 'roundOver') {
      playTurn(controller, fireBetween);
      const now = controller.getState().player.health;
      expect(health - now).toBeLessThanOrEqual(MAX_DAMAGE / 2);
      if (now < health) damaged = true;
      health = now;
    }
    expect(damaged).toBe(true);
  });

  it('applyImpact: enemy shells use the distance rule and the easy factor; the player shell follows the number', () => {
    const settings = freePlaySettings();
    const s = createRound(settings, 99, 'left');
    const rules = { enemyDamageFactor: 0.5, noDamage: false };
    const onPlayer = { point: tankCenter(s.player), hitTargetId: s.player.id, outOfBounds: false, shooter: 'enemy' as const };
    expect(applyImpact(s, onPlayer, BLAST_RADIUS, rules).player.health).toBe(100 - MAX_DAMAGE / 2);
    expect(applyImpact(s, onPlayer, BLAST_RADIUS, { enemyDamageFactor: 1, noDamage: true }).player.health).toBe(100);
    // An enemy shell does not touch lastShot.
    expect(applyImpact(s, onPlayer, BLAST_RADIUS, rules).lastShot).toBeNull();

    const n = s.enemy.position;
    const atEnemy = { point: { x: s.enemy.x, y: s.enemy.y }, hitTargetId: null, outOfBounds: false, shooter: 'player' as const, fired: n, landed: n };
    expect(applyImpact(s, atEnemy, BLAST_RADIUS, rules).enemy.health).toBe(100 - MAX_DAMAGE);
    // The player's shell at the player's own number never harms the player.
    const atPlayer = { point: { x: s.player.x, y: s.player.y }, hitTargetId: null, outOfBounds: false, shooter: 'player' as const, fired: s.player.position, landed: s.player.position };
    expect(applyImpact(s, atPlayer, BLAST_RADIUS, rules).player.health).toBe(100);
  });

  it('applyImpact destroys a decoy at the fired number and leaves other decoys alone', () => {
    const base = createRound(freePlaySettings(), 21, 'left');
    const decoyAt = (id: string, position: number) => {
      const x = numberToX(position, 0, 100);
      return { id, kind: 'decoy' as const, position, x, y: settleY(base.terrain, x), health: 100, label: position, alive: true };
    };
    const s: RoundState = { ...base, decoys: [decoyAt('d1', 30), decoyAt('d2', 32)] };
    const impact = { point: { x: s.decoys[0]!.x, y: s.decoys[0]!.y }, hitTargetId: null, outOfBounds: false, shooter: 'player' as const, fired: 30, landed: 30 };
    const next = applyImpact(s, impact, BLAST_RADIUS, { enemyDamageFactor: 1, noDamage: false });
    expect(next.decoys[0]).toMatchObject({ health: 0, alive: false });
    expect(next.decoys[1]).toMatchObject({ health: 100, alive: true });
    expect(next.lastShot?.hitTankId).toBe('d1');
    expect(next.lastShot?.hit).toBe(false);
  });

  it('leaves the terrain and health unchanged for an enemy shell that leaves the battlefield', () => {
    const s = createRound(freePlaySettings(), 5, 'left');
    const impact = { point: { x: 0, y: 500 }, hitTargetId: null, outOfBounds: true, shooter: 'enemy' as const };
    const next = applyImpact(s, impact, BLAST_RADIUS, { enemyDamageFactor: 1, noDamage: false });
    expect(next.terrain).toBe(s.terrain);
    expect(next.player.health).toBe(100);
    expect(next.enemy.health).toBe(100);
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

    controller.fireAt(30);
    controller.pause();
    controller.shotAnimationDone();
    expect(controller.getState().phase).toBe('paused');
    expect(controller.getState().turn).toBe(0);
    controller.resume();
    expect(controller.getState().phase).toBe('playerShot');
    controller.shotAnimationDone();
    expect(controller.getState().phase).toBe('enemyTurn');
  });

  it('does not pause a finished round', () => {
    const { controller } = makeController({ noDamage: true, roundLength: 3 });
    controller.startRound('freePlay');
    for (let i = 0; i < 3; i++) playTurn(controller, fireAtOwnNumber);
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
    const settings = freePlaySettings({ noDamage: true, roundLength: 3 });
    const controller = new BattleController({ settings, progress: memoryProgressStore(), clock: () => 0, seed: 3 });
    controller.startRound('freePlay');
    settings.roundLength = 30;
    controller.setSettings(freePlaySettings({ noDamage: true, roundLength: 5 }));
    for (let i = 0; i < 3; i++) playTurn(controller, fireAtOwnNumber);
    expect(controller.getState().outcome).toBe('turnsUsed');

    controller.startRound('freePlay');
    for (let i = 0; i < 4; i++) playTurn(controller, fireAtOwnNumber);
    expect(controller.getState().phase).toBe('aiming');
    playTurn(controller, fireAtOwnNumber);
    expect(controller.getState().outcome).toBe('turnsUsed');
  });

  it('gives the same rounds for the same seed', () => {
    const run = () => {
      const { controller } = makeController({ enemyDifficulty: 'normal' }, 42);
      controller.startRound('freePlay');
      playTurn(controller, fireAtEnemy);
      playTurn(controller, fireAtOwnNumber);
      return controller.getState();
    };
    const a = run();
    const b = run();
    expect(b.seed).toBe(a.seed);
    expect(b.enemy.position).toBe(a.enemy.position);
    expect(b.player.health).toBe(a.player.health);
    expect(b.lastShot).toEqual(a.lastShot);
    expect(Array.from(b.terrain)).toEqual(Array.from(a.terrain));
  });

  it('records no attempts in free play', () => {
    const { controller, progress } = makeController({ noDamage: true, roundLength: 3 });
    controller.startRound('freePlay');
    for (let i = 0; i < 3; i++) playTurn(controller, fireAtEnemy);
    expect(progress.getProgress().attempts).toHaveLength(0);
  });
});

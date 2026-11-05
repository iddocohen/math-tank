import { describe, expect, it } from 'vitest';
import { BattleController } from './controller';
import { memoryProgressStore } from './ports';
import { applyImpact, blastRadiusFor, createRound, muzzle, tankCenter, WORLD_HEIGHT, WORLD_WIDTH } from './round';
import { defaultSettings } from '../settings/defaults';
import type { RoundState, Settings } from '../types';
import { numberToX } from '../numberline/mapping';
import { minEnemyGap } from '../math/gaps';
import { settleY } from '../physics/terrain';
import { BLAST_RADIUS, CHARGED_BLAST_RADIUS, damageAt, MAX_DAMAGE } from '../physics/damage';
import { solveAim } from '../physics/aim';

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

/** Aim straight at the enemy with the aim solver. */
function aimAtEnemy(c: BattleController): void {
  const s = c.getState();
  const aim = solveAim({ origin: muzzle(s.player), target: tankCenter(s.enemy), terrain: s.terrain, worldWidth: WORLD_WIDTH, worldHeight: WORLD_HEIGHT });
  c.setAim(aim.angleDeg, aim.power);
}

/** Fire away from the battlefield: the shell leaves over the near edge and harms nobody. */
function aimAway(c: BattleController): void {
  const s = c.getState();
  c.setAim(s.playerSide === 'left' ? 170 : 10, 100);
}

/** One full turn: player shot, its animation, enemy shot, its animation (if the round goes on). */
function playTurn(c: BattleController, aim: (c: BattleController) => void): void {
  aim(c);
  c.fire();
  c.shotAnimationDone();
  if (c.getState().phase === 'enemyTurn') c.enemyShotAnimationDone();
}

describe('BattleController free play (US1)', () => {
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
    expect(s.lastPlayerPath).toBeNull();
    expect(s.shot).toBeNull();
    expect(s.outcome).toBeNull();
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

  it('fires: setAim then fire moves to playerShot and stores the path', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    controller.setAim(45, 60);
    expect(controller.getState().aim).toEqual({ angleDeg: 45, power: 60 });
    controller.fire();
    const s = controller.getState();
    expect(s.phase).toBe('playerShot');
    expect(s.shot?.shooter).toBe('player');
    expect(s.shot?.path.length).toBeGreaterThan(1);
    expect(s.shot?.blastRadius).toBe(BLAST_RADIUS);
    expect(s.shot?.path[0]).toEqual(muzzle(s.player));
  });

  it('clamps the aim to 0..180 degrees and 0..100 power', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    controller.setAim(-10, 150);
    expect(controller.getState().aim).toEqual({ angleDeg: 0, power: 100 });
    controller.setAim(200, -5);
    expect(controller.getState().aim).toEqual({ angleDeg: 180, power: 0 });
  });

  it('ignores fire outside the aiming phase', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    controller.fire();
    const shot = controller.getState().shot;
    controller.fire();
    expect(controller.getState().shot).toBe(shot);
  });

  it('applies the impact after the shot animation: crater, settling, damage, trail', () => {
    const { controller } = makeController({ enemyDifficulty: 'normal' });
    controller.startRound('freePlay');
    aimAtEnemy(controller);
    controller.fire();
    const before = controller.getState();
    const shot = before.shot!;
    expect(shot.outOfBounds).toBe(false);
    const expectedEnemyDamage = Math.round(damageAt(shot.impact, tankCenter(before.enemy), BLAST_RADIUS, shot.hitTargetId === before.enemy.id));
    expect(expectedEnemyDamage).toBeGreaterThan(0);

    controller.shotAnimationDone();
    const after = controller.getState();
    expect(after.terrain).not.toBe(before.terrain);
    const cx = Math.round(shot.impact.x);
    expect(after.terrain[cx]).toBeLessThan(before.terrain[cx] as number);
    expect(after.player.y).toBeCloseTo(settleY(after.terrain, after.player.x), 6);
    expect(after.enemy.y).toBeCloseTo(settleY(after.terrain, after.enemy.x), 6);
    expect(after.enemy.health).toBe(100 - expectedEnemyDamage);
    expect(after.lastPlayerPath).toEqual(shot.path);
    expect(after.turn).toBe(1);
    expect(after.charged).toBe(false);
  });

  it('alternates turns: enemy turn with its own shot, then the next player turn', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    aimAway(controller);
    controller.fire();
    controller.shotAnimationDone();
    let s = controller.getState();
    expect(s.phase).toBe('enemyTurn');
    expect(s.shot?.shooter).toBe('enemy');
    expect(s.shot?.path[0]).toEqual(muzzle(s.enemy));
    controller.enemyShotAnimationDone();
    s = controller.getState();
    expect(s.phase).toBe('aiming');
    expect(s.shot).toBeNull();
    expect(s.turn).toBe(1);
    expect(s.lastPlayerPath).not.toBeNull();

    playTurn(controller, aimAway);
    expect(controller.getState().turn).toBe(2);
    expect(controller.getState().phase).toBe('aiming');
  });

  it('ends with playerWon when the enemy health reaches 0', () => {
    const { controller } = makeController({ noDamage: true, roundLength: 30 });
    controller.startRound('freePlay');
    for (let i = 0; i < 30 && controller.getState().phase !== 'roundOver'; i++) playTurn(controller, aimAtEnemy);
    const s = controller.getState();
    expect(s.phase).toBe('roundOver');
    expect(s.outcome).toBe('playerWon');
    expect(s.enemy.health).toBe(0);
    expect(s.enemy.alive).toBe(false);
  });

  it('ends with enemyWon when the player health reaches 0', () => {
    const { controller } = makeController({ enemyDifficulty: 'challenging', roundLength: 30 });
    controller.startRound('freePlay');
    for (let i = 0; i < 30 && controller.getState().phase !== 'roundOver'; i++) playTurn(controller, aimAway);
    const s = controller.getState();
    expect(s.outcome).toBe('enemyWon');
    expect(s.player.health).toBe(0);
    expect(s.player.alive).toBe(false);
  });

  it('ends with turnsUsed after roundLength player turns', () => {
    const { controller } = makeController({ noDamage: true, roundLength: 3 });
    controller.startRound('freePlay');
    playTurn(controller, aimAway);
    playTurn(controller, aimAway);
    expect(controller.getState().phase).toBe('aiming');
    playTurn(controller, aimAway);
    const s = controller.getState();
    expect(s.phase).toBe('roundOver');
    expect(s.outcome).toBe('turnsUsed');
    expect(s.turn).toBe(3);
  });

  it('keeps the player health at 100 in noDamage mode', () => {
    const { controller } = makeController({ noDamage: true, enemyDifficulty: 'challenging', roundLength: 10 });
    controller.startRound('freePlay');
    while (controller.getState().phase !== 'roundOver') {
      playTurn(controller, aimAway);
      expect(controller.getState().player.health).toBe(100);
    }
    expect(controller.getState().outcome).toBe('turnsUsed');
  });

  it("on 'easy' the first enemy shot misses and enemy hits do at most half damage", () => {
    const { controller } = makeController({ enemyDifficulty: 'easy', roundLength: 30 });
    controller.startRound('freePlay');
    playTurn(controller, aimAway);
    expect(controller.getState().player.health).toBe(100);
    let health = 100;
    let damaged = false;
    while (controller.getState().phase !== 'roundOver') {
      playTurn(controller, aimAway);
      const now = controller.getState().player.health;
      expect(health - now).toBeLessThanOrEqual(MAX_DAMAGE / 2);
      if (now < health) damaged = true;
      health = now;
    }
    expect(damaged).toBe(true);
  });

  it('halves enemy damage in applyImpact with the easy factor, not player damage', () => {
    const settings = freePlaySettings();
    const s = createRound(settings, 99, 'left');
    const onPlayer = { point: tankCenter(s.player), hitTargetId: s.player.id, outOfBounds: false };
    const onEnemy = { point: tankCenter(s.enemy), hitTargetId: s.enemy.id, outOfBounds: false };
    const rules = { enemyDamageFactor: 0.5, noDamage: false };
    expect(applyImpact(s, { ...onPlayer, shooter: 'enemy' }, BLAST_RADIUS, rules).player.health).toBe(100 - MAX_DAMAGE / 2);
    expect(applyImpact(s, { ...onEnemy, shooter: 'player' }, BLAST_RADIUS, rules).enemy.health).toBe(100 - MAX_DAMAGE);
    expect(applyImpact(s, { ...onPlayer, shooter: 'enemy' }, BLAST_RADIUS, { enemyDamageFactor: 1, noDamage: true }).player.health).toBe(100);
  });

  it('uses the larger blast radius for a charged shot', () => {
    expect(blastRadiusFor(false)).toBe(BLAST_RADIUS);
    expect(blastRadiusFor(true)).toBe(CHARGED_BLAST_RADIUS);
    const s = createRound(freePlaySettings(), 7, 'left');
    const x = 800;
    const point = { x, y: settleY(s.terrain, x) };
    const impact = { point, hitTargetId: null, outOfBounds: false, shooter: 'player' as const };
    const rules = { enemyDamageFactor: 1, noDamage: false };
    const normal = applyImpact(s, impact, BLAST_RADIUS, rules).terrain;
    const charged = applyImpact(s, impact, CHARGED_BLAST_RADIUS, rules).terrain;
    const probe = x + 75;
    expect(normal[probe]).toBe(s.terrain[probe]);
    expect(charged[probe]).toBeLessThan(s.terrain[probe] as number);
  });

  it('leaves the terrain and health unchanged for a shell that leaves the battlefield', () => {
    const s = createRound(freePlaySettings(), 5, 'left');
    const impact = { point: { x: 0, y: 500 }, hitTargetId: null, outOfBounds: true, shooter: 'player' as const };
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
    controller.fire();
    expect(controller.getState().phase).toBe('paused');
    controller.resume();
    expect(controller.getState().phase).toBe('aiming');

    controller.fire();
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
    for (let i = 0; i < 3; i++) playTurn(controller, aimAway);
    controller.pause();
    expect(controller.getState().phase).toBe('roundOver');
  });

  it('calls subscribers on every change and stops after unsubscribe', () => {
    const { controller } = makeController();
    const seen: RoundState[] = [];
    const unsubscribe = controller.subscribe((s) => seen.push(s));
    controller.startRound('freePlay');
    controller.setAim(30, 50);
    controller.fire();
    controller.shotAnimationDone();
    controller.enemyShotAnimationDone();
    controller.pause();
    controller.resume();
    expect(seen.map((s) => s.phase)).toEqual(['aiming', 'aiming', 'playerShot', 'enemyTurn', 'aiming', 'paused', 'aiming']);
    expect(seen.at(-1)).toBe(controller.getState());
    unsubscribe();
    controller.setAim(40, 50);
    expect(seen).toHaveLength(7);
  });

  it('gives each change a new state object', () => {
    const { controller } = makeController();
    controller.startRound('freePlay');
    const a = controller.getState();
    controller.setAim(30, 50);
    expect(controller.getState()).not.toBe(a);
    expect(a.aim).not.toEqual(controller.getState().aim);
  });

  it('takes a settings snapshot at startRound; new settings apply from the next round (FR-049)', () => {
    const settings = freePlaySettings({ noDamage: true, roundLength: 3 });
    const controller = new BattleController({ settings, progress: memoryProgressStore(), clock: () => 0, seed: 3 });
    controller.startRound('freePlay');
    settings.roundLength = 30;
    controller.setSettings(freePlaySettings({ noDamage: true, roundLength: 5 }));
    for (let i = 0; i < 3; i++) playTurn(controller, aimAway);
    expect(controller.getState().outcome).toBe('turnsUsed');

    controller.startRound('freePlay');
    for (let i = 0; i < 4; i++) playTurn(controller, aimAway);
    expect(controller.getState().phase).toBe('aiming');
    playTurn(controller, aimAway);
    expect(controller.getState().outcome).toBe('turnsUsed');
  });

  it('gives the same rounds for the same seed', () => {
    const run = () => {
      const { controller } = makeController({ enemyDifficulty: 'normal' }, 42);
      controller.startRound('freePlay');
      playTurn(controller, aimAway);
      playTurn(controller, aimAway);
      return controller.getState();
    };
    const a = run();
    const b = run();
    expect(b.seed).toBe(a.seed);
    expect(b.enemy.position).toBe(a.enemy.position);
    expect(b.player.health).toBe(a.player.health);
    expect(Array.from(b.terrain)).toEqual(Array.from(a.terrain));
  });

  it('records no attempts in free play without challenges', () => {
    const { controller, progress } = makeController({ noDamage: true, roundLength: 3 });
    controller.startRound('freePlay');
    for (let i = 0; i < 3; i++) playTurn(controller, aimAway);
    expect(progress.getProgress().attempts).toHaveLength(0);
  });
});

/**
 * Building a round and applying explosions (FR-001, FR-005 to FR-007, FR-010a, FR-044, FR-066, FR-080; amendment 06).
 * Pure functions: each returns a new RoundState and never changes its input.
 */
import { createRng, deriveSeed, type Rng } from '../rng';
import type { BattleState, Challenge, LastShot, Point, RoundState, RulerLevel, Settings, Skill, TankState } from '../types';
import { numberToX } from '../numberline/mapping';
import { minEnemyGap } from '../math/gaps';
import { generateChallenge } from '../math/generate';
import { carveCrater, FLOOR, generateTerrain, settleY } from '../physics/terrain';
import { enemyHitsPlayer, LIVES, shotKind } from './hitRule';
import { emptyEntry } from './entry';

/** Logical world size (research R5). */
export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 900;
/** Height of the tank body above the ground; the hit circle sits on its center. */
export const TANK_HEIGHT = 24;
/** Radius of the circle a shell must enter to hit a tank directly. */
export const TANK_HIT_RADIUS = 30;
/** The shell starts this far above the tank base. */
const MUZZLE_HEIGHT = TANK_HEIGHT + 4;

export const PLAYER_ID = 'player';
export const ENEMY_ID = 'enemy';

export function tankCenter(tank: TankState): Point {
  return { x: tank.x, y: tank.y + TANK_HEIGHT / 2 };
}

/** The enemy with its number and coordinates, or null while getState() hides them during a guided search. */
export function placedEnemy(s: RoundState): TankState | null {
  return 'position' in s.enemy ? s.enemy : null;
}

/** The enemy when it is drawn: found (or free play, or readPosition), alive and placed; otherwise null (FR-073). */
export function visibleEnemy(s: RoundState): TankState | null {
  return s.enemyFound && s.enemy.alive ? placedEnemy(s) : null;
}

/**
 * What getState() reports: while the enemy is hidden it has only its id, kind and alive, and the last shot of a miss
 * carries neither the enemy's number nor the distance to it (FR-010, T215). A hit keeps the number of the enemy it
 * destroyed, which the hit has revealed.
 */
export function publicState(s: BattleState): RoundState {
  if (s.enemyFound) return s;
  const { id, alive } = s.enemy;
  const lastShot = s.lastShot && !s.lastShot.hit ? { ...s.lastShot, enemyNumber: null, distance: null } : s.lastShot;
  return { ...s, enemy: { id, kind: 'enemy', alive }, lastShot };
}

/** Where shells leave the cannon. */
export function muzzle(tank: TankState): Point {
  return { x: tank.x, y: tank.y + MUZZLE_HEIGHT };
}

export function makeTank(id: string, kind: TankState['kind'], position: number, settings: Settings, terrain: BattleState['terrain']): TankState {
  const x = numberToX(position, settings.range.min, settings.range.max);
  return { id, kind, position, x, y: settleY(terrain, x), alive: true };
}

/** Until the difficulty ladders exist (Phase 21), every skill is on step 0. */
export const FIRST_STEPS: Record<Skill, number> = {
  positions: 0,
  countForward: 0,
  countBackward: 0,
  tens: 0,
  crossTens: 0,
  addition: 0,
  subtraction: 0,
  comparison: 0,
};

/** Tries for a new enemy number after a hit before the same number is accepted again. */
const MOVE_TRIES = 8;

/**
 * Free play (amendment 02, FR-014, FR-067, decision D14): a "read the ruler" challenge for the round's ruler
 * level; the enemy stands at its answer. With `avoid`, another answer is chosen whenever the generator finds one.
 */
export function freePlayChallenge(
  settings: Settings,
  roundSeed: number,
  turn: number,
  playerPosition: number,
  rulerLevel: RulerLevel,
  avoid: number | null = null,
): Challenge {
  let challenge: Challenge | null = null;
  for (let i = 0; i < MOVE_TRIES; i++) {
    challenge = generateChallenge({
      settings,
      skillSteps: FIRST_STEPS,
      roundSeed: i === 0 ? roundSeed : deriveSeed(roundSeed, 3, i),
      turn,
      playerPosition,
      rulerLevel,
      kindsAllowed: ['readPosition'],
    });
    if (challenge.answer !== avoid) break;
  }
  return challenge!;
}

/**
 * A new round: terrain from the seed, the player at range.min (left) or range.max (right),
 * the enemy at a seeded position at least minEnemyGap away. Free play starts in 'aiming' with the enemy visible
 * and standing at the answer of a "read the ruler" challenge.
 */
export function createRound(settings: Settings, seed: number, side: 'left' | 'right', mode: RoundState['mode'] = 'freePlay'): BattleState {
  const { min, max } = settings.range;
  const terrain = generateTerrain(deriveSeed(seed, 0), WORLD_WIDTH, WORLD_HEIGHT);
  const playerPosition = side === 'left' ? min : max;
  // The parent's starting level (FR-018); following the positions skill comes with the difficulty ladders.
  const rulerLevel = settings.rulerLevelStart;
  const challenge = mode === 'freePlay' ? freePlayChallenge(settings, seed, 0, playerPosition, rulerLevel) : null;
  const enemyPosition = challenge ? challenge.answer : enemyPositionFor(settings, side, createRng(deriveSeed(seed, 1)), null);

  return {
    seed,
    mode,
    turn: 0,
    lives: LIVES,
    enemiesDestroyed: 0,
    shotsSinceEnemyFire: 0,
    elapsedMs: 0,
    lastEnemyHit: false,
    stepAnimation: null,
    notOnTank: false,
    phase: 'aiming',
    terrain,
    player: makeTank(PLAYER_ID, 'player', playerPosition, settings, terrain),
    enemy: makeTank(ENEMY_ID, 'enemy', enemyPosition, settings, terrain),
    decoys: [],
    playerSide: side,
    enemyFound: true,
    challenge,
    answerableAt: null,
    help: { level: 0, wrongAnswers: 0, wrongAnswerTimes: [] },
    selection: null,
    entry: emptyEntry(),
    orderTaps: [],
    inputMethod: null,
    rulerLevel,
    lastShot: null,
    lastPlayerPath: null,
    shot: null,
    outcome: null,
  };
}

/**
 * A seeded enemy position at least minEnemyGap from the player's end of the range.
 * With `avoid`, a different position is chosen whenever the range allows one.
 */
export function enemyPositionFor(settings: Settings, side: 'left' | 'right', rng: Rng, avoid: number | null): number {
  const { min, max } = settings.range;
  const gap = minEnemyGap(min, max);
  // Positions reachable from the player's end: the far end always qualifies because gap < max - min.
  const [lo, hi] = side === 'left' ? [Math.ceil(min + gap), max] : [min, Math.floor(max - gap)];
  if (avoid === null || avoid < lo || avoid > hi || lo === hi) return rng.int(lo, hi);
  // Pick among the other positions, then skip over the avoided one.
  const n = rng.int(lo, hi - 1);
  return n >= avoid ? n + 1 : n;
}

/** Moves a tank to a new number and settles it on the surface. */
export function moveTank(tank: TankState, position: number, settings: Settings, terrain: BattleState['terrain']): TankState {
  const x = numberToX(position, settings.range.min, settings.range.max);
  return { ...tank, position, x, y: settleY(terrain, x) };
}

export type Impact =
  | { point: Point; hitTargetId: string | null; outOfBounds: boolean; shooter: 'enemy' }
  | {
      point: Point;
      hitTargetId: string | null;
      outOfBounds: boolean;
      shooter: 'player';
      /** The number the player fired at. */
      fired: number;
      /** The number under the impact point. */
      landed: number;
    };

export interface DamageRules {
  /** FR-044: the player's hearts never go down. */
  noDamage: boolean;
  /** The round's number range: the tank body's width in numbers follows from it. */
  range: { min: number; max: number };
}

/**
 * Carves the crater, applies the hit rule and settles the tanks onto the new surface.
 * A shell that left the battlefield changes nothing.
 *
 * An enemy shell that hits the player's tank costs one heart unless noDamage (FR-006, FR-080); one next to it does
 * nothing. The player's shell follows the amendment 06 rule (FR-066): the exact number destroys the enemy (the
 * controller then brings a new one), a shell on the body but not exact is a near miss (the enemy shakes), and a decoy
 * at the fired number is destroyed. The player's own shell never harms the player. Sets lastShot for player shells
 * and lastEnemyHit for enemy shells.
 */
export function applyImpact(state: BattleState, impact: Impact, blastRadius: number, rules: DamageRules): BattleState {
  if (impact.outOfBounds) return impact.shooter === 'enemy' ? { ...state, lastEnemyHit: false } : state;
  const terrain = carveCrater(state.terrain, impact.point.x, impact.point.y, blastRadius, FLOOR);
  const settle = (tank: TankState, destroyed = false): TankState => ({
    ...tank,
    y: settleY(terrain, tank.x),
    alive: tank.alive && !destroyed,
  });

  if (impact.shooter === 'enemy') {
    const hit = state.player.alive && enemyHitsPlayer(impact.point, impact.hitTargetId, state.player);
    const lostHeart = hit && !rules.noDamage;
    return {
      ...state,
      terrain,
      player: settle(state.player),
      enemy: settle(state.enemy),
      decoys: state.decoys.map((d) => settle(d)),
      lives: lostHeart ? Math.max(0, state.lives - 1) : state.lives,
      lastEnemyHit: lostHeart,
    };
  }

  const { fired, landed } = impact;
  const enemy = state.enemy;
  const kind = enemy.alive ? shotKind(fired, enemy.position, rules.range) : 'miss';
  const hit = kind === 'hit';
  const decoyHit = state.decoys.find((d) => d.alive && d.position === fired) ?? null;
  const lastShot: LastShot = {
    fired,
    landed,
    hit,
    nearMiss: kind === 'near',
    hitTankId: hit ? enemy.id : (decoyHit?.id ?? null),
    distance: Math.abs(landed - enemy.position),
    enemyNumber: enemy.position,
  };
  return {
    ...state,
    terrain,
    player: settle(state.player),
    enemy: settle(enemy, hit),
    decoys: state.decoys.map((d) => settle(d, d === decoyHit)),
    lastShot,
  };
}

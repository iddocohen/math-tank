/**
 * Building a round and applying explosions (FR-001, FR-005 to FR-007, FR-010a, FR-043, FR-044, FR-066, FR-071, FR-074).
 * Pure functions: each returns a new RoundState and never changes its input.
 */
import { createRng, deriveSeed, type Rng } from '../rng';
import type { Challenge, LastShot, Point, RoundState, RulerLevel, Settings, Skill, TankState } from '../types';
import { numberToX } from '../numberline/mapping';
import { minEnemyGap } from '../math/gaps';
import { generateChallenge } from '../math/generate';
import { carveCrater, FLOOR, generateTerrain, settleY } from '../physics/terrain';
import { damageAt } from '../physics/damage';
import { enemyDamage, shotKind } from './hitRule';
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

/** Where shells leave the cannon. */
export function muzzle(tank: TankState): Point {
  return { x: tank.x, y: tank.y + MUZZLE_HEIGHT };
}

function makeTank(id: string, kind: TankState['kind'], position: number, settings: Settings, terrain: RoundState['terrain']): TankState {
  const x = numberToX(position, settings.range.min, settings.range.max);
  return { id, kind, position, x, y: settleY(terrain, x), health: 100, alive: true };
}

/** Until the difficulty ladders exist (Phase 21), every skill is on step 0. */
const FIRST_STEPS: Record<Skill, number> = {
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
export function createRound(settings: Settings, seed: number, side: 'left' | 'right', mode: RoundState['mode'] = 'freePlay'): RoundState {
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
export function moveTank(tank: TankState, position: number, settings: Settings, terrain: RoundState['terrain']): TankState {
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
  /** enemyDamageFactor(settings.enemyDifficulty): 0.5 on easy (FR-043). */
  enemyDamageFactor: number;
  /** FR-044: the player tank takes no damage. */
  noDamage: boolean;
  /** "Genau treffen" (FR-074): only the exact number damages the enemy. */
  exactHit: boolean;
  /** The round's number range: the tank body's width in numbers follows from it. */
  range: { min: number; max: number };
}

/**
 * Carves the crater, applies damage and settles the tanks onto the new surface.
 * A shell that left the battlefield changes nothing.
 *
 * Enemy shells damage every tank in the blast by distance (FR-006), measured where the tanks stood.
 * The player's shell follows the tank-body rule (amendment 04, decision D10, FR-066, FR-071, FR-074): a shell on
 * the enemy's body costs it MAX_DAMAGE, the exact number twice that, and with exactHit only the exact number
 * counts. A decoy at the fired number is destroyed. A shell inside the enemy's blast radius that does no damage
 * is a near miss (the enemy shakes). The player's own shell never damages the player. Sets lastShot.
 */
export function applyImpact(state: RoundState, impact: Impact, blastRadius: number, rules: DamageRules): RoundState {
  if (impact.outOfBounds) return state;
  const terrain = carveCrater(state.terrain, impact.point.x, impact.point.y, blastRadius, FLOOR);
  const settle = (tank: TankState, damage: number): TankState => {
    const health = Math.max(0, tank.health - damage);
    return { ...tank, y: settleY(terrain, tank.x), health, alive: health > 0 };
  };

  if (impact.shooter === 'enemy') {
    const damageOf = (tank: TankState): number => {
      if (!tank.alive || (tank.kind === 'player' && rules.noDamage)) return 0;
      return Math.round(damageAt(impact.point, tankCenter(tank), blastRadius, impact.hitTargetId === tank.id) * rules.enemyDamageFactor);
    };
    const update = (tank: TankState) => settle(tank, damageOf(tank));
    return { ...state, terrain, player: update(state.player), enemy: update(state.enemy), decoys: state.decoys.map(update) };
  }

  const { fired, landed } = impact;
  const enemy = state.enemy;
  const kind = enemy.alive ? shotKind(fired, enemy.position, rules.range) : 'miss';
  const damage = enemyDamage(kind, rules.exactHit);
  const hit = damage > 0;
  const decoyHit = state.decoys.find((d) => d.alive && d.position === fired) ?? null;
  const nearMiss = !hit && enemy.alive && Math.hypot(tankCenter(enemy).x - impact.point.x, tankCenter(enemy).y - impact.point.y) < blastRadius;
  const lastShot: LastShot = {
    fired,
    landed,
    hit,
    bodyHit: kind !== 'miss',
    bullseye: kind === 'bullseye',
    nearMiss,
    hitTankId: hit ? enemy.id : (decoyHit?.id ?? null),
    distance: Math.abs(landed - enemy.position),
    enemyNumber: enemy.position,
  };
  return {
    ...state,
    terrain,
    player: settle(state.player, 0),
    enemy: settle(enemy, damage),
    decoys: state.decoys.map((d) => settle(d, d === decoyHit ? d.health : 0)),
    lastShot,
  };
}

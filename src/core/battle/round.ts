/**
 * Building a round and applying explosions (FR-001, FR-005 to FR-007, FR-010a, FR-011, FR-043, FR-044).
 * Pure functions: each returns a new RoundState and never changes its input.
 */
import { createRng, deriveSeed } from '../rng';
import type { Point, RoundState, Settings, TankState } from '../types';
import { numberToX } from '../numberline/mapping';
import { minEnemyGap } from '../math/gaps';
import { carveCrater, FLOOR, generateTerrain, settleY } from '../physics/terrain';
import { BLAST_RADIUS, CHARGED_BLAST_RADIUS, damageAt } from '../physics/damage';

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

export function blastRadiusFor(charged: boolean): number {
  return charged ? CHARGED_BLAST_RADIUS : BLAST_RADIUS;
}

function makeTank(id: string, kind: TankState['kind'], position: number, settings: Settings, terrain: RoundState['terrain']): TankState {
  const x = numberToX(position, settings.range.min, settings.range.max);
  return { id, kind, position, x, y: settleY(terrain, x), health: 100, alive: true };
}

/**
 * A new round: terrain from the seed, the player at range.min (left) or range.max (right),
 * the enemy at a seeded position at least minEnemyGap away. Free play starts in 'aiming' with the enemy visible.
 */
export function createRound(settings: Settings, seed: number, side: 'left' | 'right', mode: RoundState['mode'] = 'freePlay'): RoundState {
  const { min, max } = settings.range;
  const terrain = generateTerrain(deriveSeed(seed, 0), WORLD_WIDTH, WORLD_HEIGHT);
  const playerPosition = side === 'left' ? min : max;
  const gap = minEnemyGap(min, max);
  // Positions reachable from the player's end: the far end always qualifies because gap < max - min.
  const [lo, hi] = side === 'left' ? [Math.ceil(min + gap), max] : [min, Math.floor(max - gap)];
  const enemyPosition = createRng(deriveSeed(seed, 1)).int(lo, hi);

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
    shotsAtEnemy: 0,
    challenge: null,
    challengePurpose: null,
    answerableAt: null,
    help: { level: 0, wrongAnswers: 0, wrongAnswerTimes: [] },
    selection: null,
    charged: false,
    aim: { angleDeg: side === 'left' ? 45 : 135, power: 60 },
    lastPlayerPath: null,
    shot: null,
    outcome: null,
  };
}

export interface Impact {
  point: Point;
  hitTargetId: string | null;
  outOfBounds: boolean;
  shooter: 'player' | 'enemy';
}

export interface DamageRules {
  /** enemyDamageFactor(settings.enemyDifficulty): 0.5 on easy (FR-043). */
  enemyDamageFactor: number;
  /** FR-044: the player tank takes no damage. */
  noDamage: boolean;
}

/**
 * Damages every tank in the blast (measured where the tanks stood at the explosion),
 * carves the crater and settles the tanks onto the new surface.
 * A shell that left the battlefield changes nothing.
 */
export function applyImpact(state: RoundState, impact: Impact, blastRadius: number, rules: DamageRules): RoundState {
  if (impact.outOfBounds) return state;
  const factor = impact.shooter === 'enemy' ? rules.enemyDamageFactor : 1;
  const terrain = carveCrater(state.terrain, impact.point.x, impact.point.y, blastRadius, FLOOR);

  const update = (tank: TankState): TankState => {
    const protectedTank = tank.kind === 'player' && rules.noDamage;
    const damage = protectedTank || !tank.alive ? 0 : Math.round(damageAt(impact.point, tankCenter(tank), blastRadius, impact.hitTargetId === tank.id) * factor);
    const health = Math.max(0, tank.health - damage);
    return { ...tank, y: settleY(terrain, tank.x), health, alive: health > 0 };
  };

  return { ...state, terrain, player: update(state.player), enemy: update(state.enemy), decoys: state.decoys.map(update) };
}

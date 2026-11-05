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
import { LAST_STEPS } from '../progress/ladders';

/** Logical world size (research R5). */
export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 900;
/** Height of the tank body above the ground. */
export const TANK_HEIGHT = 24;
/** The shell starts this far above the tank base. */
const MUZZLE_HEIGHT = TANK_HEIGHT + 4;

export const PLAYER_ID = 'player';
export const ENEMY_ID = 'enemy';

export function tankCenter(tank: TankState): Point {
  return { x: tank.x, y: tank.y + TANK_HEIGHT / 2 };
}

/** The enemy while it is alive; it is always visible, in every mode and challenge kind (amendment 07, FR-073). */
export function visibleEnemy(s: RoundState): TankState | null {
  return s.enemy.alive ? s.enemy : null;
}

/** Where shells leave the cannon. */
export function muzzle(tank: TankState): Point {
  return { x: tank.x, y: tank.y + MUZZLE_HEIGHT };
}

export function makeTank(id: string, kind: TankState['kind'], position: number, settings: Settings, terrain: BattleState['terrain']): TankState {
  const x = numberToX(position, settings.range.min, settings.range.max);
  return { id, kind, position, x, y: settleY(terrain, x), alive: true };
}

/**
 * What the generator gets from the progress (FR-018, FR-037): the ladder step per skill and the ruler level, which
 * follows the positions skill only. The controller computes it before each search from the stored progress.
 */
export interface Difficulty {
  skillSteps: Record<Skill, number>;
  rulerLevel: RulerLevel;
}

/** The parent settings unchanged: every skill on its top step and the starting ruler level (adaptive off). */
export function parentDifficulty(settings: Settings): Difficulty {
  return { skillSteps: LAST_STEPS, rulerLevel: settings.rulerLevelStart };
}

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
  skillSteps: Record<Skill, number> = LAST_STEPS,
): Challenge {
  let challenge: Challenge | null = null;
  for (let i = 0; i < MOVE_TRIES; i++) {
    challenge = generateChallenge({
      settings,
      skillSteps,
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
export function createRound(
  settings: Settings,
  seed: number,
  side: 'left' | 'right',
  mode: RoundState['mode'] = 'freePlay',
  difficulty: Difficulty = parentDifficulty(settings),
): BattleState {
  const { min, max } = settings.range;
  const terrainSeed = deriveSeed(seed, 0);
  const terrain = generateTerrain(terrainSeed, WORLD_WIDTH, WORLD_HEIGHT);
  const playerPosition = side === 'left' ? min : max;
  // The parent's starting level, or with adaptive difficulty the level of the positions skill (FR-018).
  const rulerLevel = difficulty.rulerLevel;
  const challenge = mode === 'freePlay' ? freePlayChallenge(settings, seed, 0, playerPosition, rulerLevel, null, difficulty.skillSteps) : null;
  const enemyPosition = challenge ? challenge.answer : enemyPositionFor(settings, side, createRng(deriveSeed(seed, 1)), null);

  return {
    seed,
    mode,
    turn: 0,
    lives: LIVES,
    enemiesDestroyed: 0,
    elapsedMs: 0,
    lastEnemyHit: false,
    missStreak: 0,
    stepAnimation: null,
    phase: 'aiming',
    terrainSeed,
    terrain,
    player: makeTank(PLAYER_ID, 'player', playerPosition, settings, terrain),
    enemy: makeTank(ENEMY_ID, 'enemy', enemyPosition, settings, terrain),
    decoys: [],
    playerSide: side,
    challenge,
    answerableAt: null,
    help: { level: 0, wrongAnswers: 0, wrongAnswerTimes: [], content: null },
    message: null,
    selection: null,
    entry: emptyEntry(),
    inputMethod: null,
    rulerLevel,
    lastShot: null,
    lastPlayerPath: null,
    shot: null,
    outcome: null,
  };
}

/**
 * New hills after a destroyed enemy (amendment 13, FR-101): a new terrain seed from the round seed and the number of
 * destroyed enemies, new ground from it, and every tank moved to its number on the new ground. The round seed and every
 * other field stay, so the challenges are the same as without the new ground.
 */
export function renewTerrain(s: BattleState, settings: Settings): BattleState {
  const terrainSeed = deriveSeed(s.seed, 8, s.enemiesDestroyed);
  const terrain = generateTerrain(terrainSeed, WORLD_WIDTH, WORLD_HEIGHT);
  const settle = (tank: TankState): TankState => moveTank(tank, tank.position, settings, terrain);
  // The trail of the last shot belongs to the old ground and goes with it (bug report B1, FR-004).
  return { ...s, terrainSeed, terrain, lastPlayerPath: null, player: settle(s.player), enemy: settle(s.enemy), decoys: s.decoys.map(settle) };
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
 * controller then brings a new one) and a shell on the body but not exact is a near miss (the enemy shakes). In
 * comparison turns (amendment 10) a decoy at the exact fired number bursts as a miss, and a near miss shakes whichever
 * standing tank's body the shell landed on. The player's own shell never harms the player. Sets lastShot for player shells
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
  const hit = enemy.alive && shotKind(fired, enemy.position, rules.range) === 'hit';
  // Comparison (amendment 10): a decoy at the exact fired number bursts; it is a miss.
  const decoyHit = hit ? null : (state.decoys.find((d) => d.alive && d.position === fired) ?? null);
  const decoys = state.decoys.map((d) => settle(d, d === decoyHit));
  // A near miss shakes the standing tank whose body the shell landed on (enemy or decoy).
  const standingBefore = [enemy, ...state.decoys].filter((t) => t.alive);
  const nearTank = hit || decoyHit ? null : (standingBefore.find((t) => shotKind(fired, t.position, rules.range) === 'near') ?? null);
  // The step count refers to the enemy, or in comparison turns to the nearest tank still standing (FR-072).
  const standingAfter = [enemy, ...decoys].filter((t) => t.alive || t === enemy);
  const target = state.decoys.length === 0 ? enemy : nearestTo(landed, standingAfter);
  const lastShot: LastShot = {
    fired,
    landed,
    hit,
    nearMiss: nearTank !== null,
    nearTankId: nearTank?.id ?? null,
    hitTankId: hit ? enemy.id : (decoyHit?.id ?? null),
    decoyHit: decoyHit !== null,
    targetNumber: target.position,
    distance: Math.abs(landed - target.position),
    enemyNumber: enemy.position,
  };
  return {
    ...state,
    terrain,
    player: settle(state.player),
    enemy: settle(enemy, hit),
    decoys,
    lastShot,
  };
}

/** The tank whose number is nearest to n; on a tie the first one. */
function nearestTo(n: number, tanks: TankState[]): TankState {
  return tanks.reduce((best, t) => (Math.abs(t.position - n) < Math.abs(best.position - n) ? t : best));
}

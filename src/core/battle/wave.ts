/**
 * Enemy waves (amendment 21, FR-137 to FR-143, data-model.md "Enemy wave"). In "Nur Zahlenstrahl", and in the
 * "read the ruler" searches of "Gemischt", a search places up to `enemiesAtOnce` enemies at once. `RoundState.enemy`
 * is always the help target, whose number is the challenge's answer; `RoundState.wave` holds the other enemies of the
 * wave (a destroyed one stays with alive false until the wave ends). A wave of one is the round state from before.
 * Pure functions: each returns a new state.
 */
import type { Rng } from '../rng';
import type { Challenge, PlayMode, RoundState, RulerLevel, Settings, TankState } from '../types';
import { minTankGap } from '../math/gaps';
import { readPositionAnswers } from '../math/readPosition';
import { MODE_TRAITS } from '../modes';
import { nextHelp } from './help';
import { landedOf } from './guided';

/** The banner while 2 or more enemies of the wave stand ("Wo stehen die Gegner?", FR-139). */
export const WAVE_PROMPT_KEY = 'readPositionWave';

/** The size of the wave for a search: enemiesAtOnce for the read-the-ruler searches of the ruler modes, else 1. */
export function waveSize(mode: PlayMode, settings: Settings, challenge: Challenge): number {
  if (challenge.kind !== 'readPosition') return 1;
  const ruler = MODE_TRAITS[mode].kinds === 'readPosition' || mode === 'mixed';
  return ruler ? settings.enemiesAtOnce : 1;
}

export interface WavePositionsInput {
  settings: Settings;
  rulerLevel: RulerLevel;
  /** The first enemy's number: the generated challenge's answer. */
  first: number;
  /** The child's number. */
  player: number;
  size: number;
  rng: Rng;
}

/**
 * [first, ...others]: drawn lines of the minor grid, each at least minTankGap from the child's tank and from every
 * other enemy. Fewer when the range is full, never fewer than [first].
 */
export function wavePositions({ settings, rulerLevel, first, player, size, rng }: WavePositionsInput): number[] {
  const { min, max } = settings.range;
  const gap = minTankGap(min, max);
  const placed = [first];
  const fits = (n: number) => Math.abs(n - player) >= gap && placed.every((p) => Math.abs(n - p) >= gap);
  let free = readPositionAnswers(settings, rulerLevel).filter(fits);
  while (placed.length < size && free.length > 0) {
    const n = free[rng.int(0, free.length - 1)]!;
    placed.push(n);
    free = free.filter(fits);
  }
  return placed;
}

/** The enemies of the wave that stand, help target included, sorted by number. */
export function standingEnemies(s: RoundState): TankState[] {
  return [s.enemy, ...s.wave].filter((t) => t.alive).sort((a, b) => a.position - b.position);
}

/** The tank whose number is nearest to n; on a tie the leftmost. */
export function nearestEnemy(n: number, tanks: readonly TankState[]): TankState {
  const sorted = [...tanks].sort((a, b) => a.position - b.position);
  return sorted.reduce((best, t) => (Math.abs(t.position - n) < Math.abs(best.position - n) ? t : best));
}

/** The root id of a wave's challenges: the first enemy's challenge id. */
function rootOf(id: string): string {
  return id.split('/')[0]!;
}

/** The challenge of `target` in the wave: its number, its own id and the banner for the enemies still standing. */
export function challengeFor(challenge: Challenge, target: TankState, standing: number): Challenge {
  const root = rootOf(challenge.id);
  // Wave enemy i has the id `wave-<root>-<i>` (startSearch) and the challenge id `<root>/<i>`; the first enemy has the root.
  const id = target.id.startsWith('wave-') ? `${root}/${target.id.slice(target.id.lastIndexOf('-') + 1)}` : root;
  const key = standing >= 2 ? WAVE_PROMPT_KEY : 'readPosition';
  return { ...challenge, id, answer: target.position, prompt: { key, params: {} } };
}

/**
 * Makes `target` the help target (FR-141): it moves into `enemy`, the old target into `wave`, and the challenge becomes
 * target's. `keepHelp` keeps the help level and the wrong answers (a miss nearer another enemy) and rebuilds the help
 * content for the new target; otherwise the help starts at step 0 (after a destroyed enemy).
 */
export function retarget(s: RoundState, target: TankState, settings: Settings, keepHelp: boolean): RoundState {
  if (!s.challenge) return s;
  const all = [s.enemy, ...s.wave];
  const enemy = all.find((t) => t.id === target.id) ?? target;
  const wave = all.filter((t) => t.id !== enemy.id);
  const standing = all.filter((t) => t.alive).length;
  const challenge = challengeFor(s.challenge, enemy, standing);
  const swapped: RoundState = { ...s, enemy, wave, challenge };
  if (!keepHelp) return { ...swapped, help: { level: 0, wrongAnswers: 0, wrongAnswerTimes: [], content: null } };
  const level = s.help.level;
  const content = level === 0 || enemy.id === s.enemy.id ? s.help.content : nextHelp(challenge, level, landedOf(swapped), settings, MODE_TRAITS[s.mode].showsRuler);
  return { ...swapped, help: { ...s.help, content } };
}

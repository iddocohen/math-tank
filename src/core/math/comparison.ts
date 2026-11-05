/**
 * Comparison challenges, answer first (FR-026, FR-027, amendments 09 and 10, data-model.md "Gaps" and "Comparison
 * ladder"). The banner names 2 or 3 options; exactly one answers the question, and the enemy stands at it. A decoy tank
 * stands at each other option (amendment 10), so every two options are at least minOptionGap apart (which is at least
 * minTankGap) and every option is at least minTankGap from the player tank. The prompt carries the options in banner
 * order as o1, o2 and o3. Every option stands on a drawn line of the minor grid (amendment 20): where the minor step is
 * 10 or more, only its multiples.
 */
import { isMultiple, stepsFor } from '../numberline/ticks';
import type { Rng } from '../rng';
import type { Challenge, DifficultyStep, Settings } from '../types';
import { minOptionGap, minTankGap } from './gaps';
import type { Builder, ChallengeDraft } from './numberLine';

export const COMPARISON_KINDS = ['greater', 'smaller', 'largest3', 'smallest3', 'closestTo', 'between', 'middle3'] as const;

export type ComparisonKind = (typeof COMPARISON_KINDS)[number];

export function isComparisonKind(kind: string): kind is ComparisonKind {
  return (COMPARISON_KINDS as readonly string[]).includes(kind);
}

/** Options named in the banner: two for greater, smaller and closestTo, three for the others. */
export function optionCount(kind: ComparisonKind): 2 | 3 {
  return kind === 'greater' || kind === 'smaller' || kind === 'closestTo' ? 2 : 3;
}

/** The option keys of the prompt, in banner order. */
const OPTION_KEYS = ['o1', 'o2', 'o3'] as const;

/** The options a prompt names, in banner order. */
export function optionParams(params: Record<string, number>): number[] {
  return OPTION_KEYS.map((k) => params[k]).filter((v): v is number => v !== undefined);
}

/** Whether a tank may stand at n: at least minTankGap from the player tank (amendment 10, FR-027). */
function clearOfPlayer(n: number, settings: Settings, playerPosition: number | undefined): boolean {
  const { min, max } = settings.range;
  return playerPosition === undefined || Math.abs(n - playerPosition) >= minTankGap(min, max);
}

/** Whether a tank may stand at n on the ruler: on a drawn line of the minor grid (amendment 20, FR-027). */
export function onRulerLine(n: number, settings: Settings): boolean {
  return isMultiple(n, stepsFor(settings.range).minorStep);
}

/** The numbers where the enemy of a comparison may stand: the minor grid inside the range (amendment 20). */
export function comparisonAnswers(settings: Settings): number[] {
  const { min, max } = settings.range;
  const out: number[] = [];
  for (let n = min; n <= max; n++) if (onRulerLine(n, settings)) out.push(n);
  return out;
}

/**
 * Whether the kind's options fit: whole numbers of the range at least minTankGap from the player, every two at least
 * minOptionGap apart (greedy from the left). When they do not, the generator skips the kind (edge case "Comparison
 * options too close together").
 */
export function comparisonFits(kind: ComparisonKind, settings: Settings, playerPosition?: number): boolean {
  const { min, max } = settings.range;
  const gap = minOptionGap(min, max);
  let taken = 0;
  let last = -Infinity;
  for (let n = min; n <= max; n++) {
    if (!onRulerLine(n, settings) || !clearOfPlayer(n, settings, playerPosition) || n - last < gap) continue;
    taken++;
    last = n;
    if (taken >= optionCount(kind)) return true;
  }
  return false;
}

/** Where each other option may stand relative to the answer, in the order they are picked. */
function sides(kind: ComparisonKind): Array<'below' | 'above' | 'any'> {
  switch (kind) {
    case 'greater':
      return ['below'];
    case 'largest3':
      return ['below', 'below'];
    case 'smaller':
      return ['above'];
    case 'smallest3':
      return ['above', 'above'];
    case 'middle3':
      return ['below', 'above'];
    case 'closestTo':
      return ['any'];
    case 'between':
      return ['any', 'any'];
  }
}

/**
 * How far the other options may stand from the answer: the step's share of the range width (easy steps ask about
 * nearby numbers, amendment 09 item 7), but always room for the other options at minOptionGap.
 */
function spreadOf(kind: ComparisonKind, settings: Settings, step: DifficultyStep): number {
  const { min, max } = settings.range;
  if (step.maxNumberFraction >= 1) return max - min;
  return Math.max(step.maxNumberFraction * (max - min), (optionCount(kind) - 1) * minOptionGap(min, max));
}

/** Picks the other options at random, each clear of the player tank; null when they do not fit. */
function pickOthers(
  kind: ComparisonKind,
  answer: number,
  settings: Settings,
  step: DifficultyStep,
  rng: Rng,
  playerPosition: number | undefined,
): number[] | null {
  const { min, max } = settings.range;
  const gap = minOptionGap(min, max);
  const spread = spreadOf(kind, settings, step);
  const taken = [answer];
  for (const side of sides(kind)) {
    const free: number[] = [];
    for (let n = Math.max(min, answer - spread); n <= Math.min(max, answer + spread); n++) {
      if (side === 'below' && n >= answer) continue;
      if (side === 'above' && n <= answer) continue;
      if (!onRulerLine(n, settings) || !clearOfPlayer(n, settings, playerPosition)) continue;
      if (taken.every((t) => Math.abs(n - t) >= gap)) free.push(n);
    }
    if (free.length === 0) return null;
    taken.push(rng.pick(free));
  }
  return taken.slice(1);
}

/**
 * Builds one comparison of `kind` whose enemy stands at `answer`, or null when the range does not allow it. With
 * `playerPosition`, every option keeps minTankGap from the player tank (amendment 10).
 */
export function buildComparison(
  kind: ComparisonKind,
  answer: number,
  settings: Settings,
  step: DifficultyStep,
  rng: Rng,
  playerPosition?: number,
): ChallengeDraft | null {
  const { min, max } = settings.range;
  if (!Number.isInteger(answer) || answer < min || answer > max || !onRulerLine(answer, settings) || !clearOfPlayer(answer, settings, playerPosition)) return null;
  const others = pickOthers(kind, answer, settings, step, rng, playerPosition);
  if (!others) return null;
  const options = rng.shuffled([answer, ...others]);
  const draft = (extra: Record<string, number>): ChallengeDraft => {
    const params: Record<string, number> = {};
    options.forEach((o, i) => (params[OPTION_KEYS[i]!] = o));
    Object.assign(params, extra);
    return { kind, prompt: { key: kind, params }, operands: [...options, ...Object.values(extra)], answer, options };
  };

  switch (kind) {
    case 'greater':
    case 'smaller':
    case 'largest3':
    case 'smallest3':
    case 'middle3':
      return draft({});
    case 'closestTo': {
      // A reference number strictly closer to the answer than to the other option, and not the answer itself.
      const other = others[0]!;
      const refs: number[] = [];
      for (let n = min; n <= max; n++) if (n !== answer && Math.abs(n - answer) < Math.abs(n - other)) refs.push(n);
      if (refs.length === 0) return null;
      return draft({ n: rng.pick(refs) });
    }
    case 'between': {
      // a < answer < b, with every other option below a or above b.
      const below = others.filter((o) => o < answer);
      const above = others.filter((o) => o > answer);
      const aLo = below.length > 0 ? Math.max(...below) + 1 : min;
      const bHi = above.length > 0 ? Math.min(...above) - 1 : max;
      if (aLo > answer - 1 || answer + 1 > bHi) return null;
      return draft({ a: rng.int(aLo, answer - 1), b: rng.int(answer + 1, bHi) });
    }
  }
}

/** One builder per comparison kind. */
export const comparisonBuilders: Record<ComparisonKind, Builder> = Object.fromEntries(
  COMPARISON_KINDS.map((kind) => [kind, ((answer, settings, step, rng, playerPosition) => buildComparison(kind, answer, settings, step, rng, playerPosition)) as Builder]),
) as Record<ComparisonKind, Builder>;

/** The options that answer the question, worked out from the options and the prompt alone. */
export function correctOptions(c: Pick<Challenge, 'kind' | 'options' | 'prompt'>): number[] {
  const options = c.options ?? [];
  const p = c.prompt.params;
  switch (c.kind) {
    case 'greater':
    case 'largest3':
      return options.filter((o) => o === Math.max(...options));
    case 'smaller':
    case 'smallest3':
      return options.filter((o) => o === Math.min(...options));
    case 'middle3': {
      if (options.length !== 3) return [];
      return [[...options].sort((a, b) => a - b)[1]!];
    }
    case 'closestTo': {
      if (p.n === undefined) return [];
      const n = p.n;
      const best = Math.min(...options.map((o) => Math.abs(o - n)));
      return options.filter((o) => Math.abs(o - n) === best);
    }
    case 'between':
      return p.a === undefined || p.b === undefined ? [] : options.filter((o) => o > p.a! && o < p.b!);
    default:
      return [];
  }
}

/** The comparison rules of validateChallenge (FR-027, amendments 09 and 10, data-model.md "Validation"). */
export function comparisonErrors(c: Challenge, settings: Settings, playerPosition?: number): string[] {
  const errors: string[] = [];
  if ((c as { orderAnswer?: unknown }).orderAnswer !== undefined) errors.push(`${c.kind}: no kind has an order answer since amendment 09`);
  if (!isComparisonKind(c.kind)) return errors;
  const options = c.options;
  if (!options) return [...errors, `${c.kind}: no options`];
  if (options.length !== optionCount(c.kind)) errors.push(`${c.kind}: ${options.length} options instead of ${optionCount(c.kind)}`);
  const named = optionParams(c.prompt.params);
  if (named.length !== options.length || named.some((n, i) => n !== options[i])) errors.push(`${c.kind}: the prompt names other options than the challenge`);
  const gap = minOptionGap(settings.range.min, settings.range.max);
  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) {
      if (Math.abs(options[i]! - options[j]!) < gap) errors.push(`options ${options[i]} and ${options[j]} are closer than ${gap}`);
    }
  }
  for (const o of options) {
    if (!onRulerLine(o, settings)) errors.push(`option ${o} is not on a line of the minor grid`);
    if (!clearOfPlayer(o, settings, playerPosition)) errors.push(`option ${o} is closer than ${minTankGap(settings.range.min, settings.range.max)} to the player at ${playerPosition}`);
  }
  const correct = correctOptions(c);
  if (correct.length !== 1 || correct[0] !== c.answer) errors.push(`${c.kind}: the answer is not the one correct option`);
  return errors;
}

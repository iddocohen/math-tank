/**
 * Comparison challenges, answer first (FR-026, FR-027, research R10, data-model.md "Gaps").
 * Each option stands on a tank at its own number. The answer is the real enemy's number; the other options are
 * decoys. Every option is at least minTankGap from every other option and from the player tank, and exactly one
 * option answers the question. `order3` asks for the ascending order; its enemy is the largest number.
 */
import { DEFAULT_LAYOUT, type Layout } from '../numberline/mapping';
import type { Rng } from '../rng';
import type { Challenge, ChallengeKind, DifficultyStep, Settings } from '../types';
import { minTankGap } from './gaps';
import type { Builder, ChallengeDraft } from './numberLine';

export const COMPARISON_KINDS = ['greater', 'smaller', 'equal', 'order3', 'largest3', 'smallest3', 'closestTo', 'between'] as const;

export type ComparisonKind = (typeof COMPARISON_KINDS)[number];

export function isComparisonKind(kind: ChallengeKind): kind is ComparisonKind {
  return (COMPARISON_KINDS as readonly string[]).includes(kind);
}

/** Tanks in the challenge: the enemy and one decoy, or the enemy and two decoys for the kinds about three numbers. */
export function optionCount(kind: ComparisonKind): 2 | 3 {
  return kind === 'order3' || kind === 'largest3' || kind === 'smallest3' ? 3 : 2;
}

/** Whole numbers in the range at least minTankGap from the player tank: where a numbered tank may stand. */
export function comparisonSlots(settings: Settings, playerPosition: number | undefined, layout: Layout = DEFAULT_LAYOUT): number[] {
  const { min, max } = settings.range;
  const gap = minTankGap(min, max, layout);
  const out: number[] = [];
  for (let n = min; n <= max; n++) if (playerPosition === undefined || Math.abs(n - playerPosition) >= gap) out.push(n);
  return out;
}

/** Whether `count` of the sorted slots can be chosen with every two at least `gap` apart (greedy from the left). */
export function fitsOptions(slots: readonly number[], count: number, gap: number): boolean {
  let taken = 0;
  let last = -Infinity;
  for (const s of slots) {
    if (s - last >= gap) {
      taken++;
      last = s;
      if (taken >= count) return true;
    }
  }
  return false;
}

/**
 * Whether the range fits the options of `kind` at minTankGap on the side away from the player. When it does not,
 * the generator skips the kind (edge case "Comparison options too close together").
 */
export function comparisonFits(kind: ComparisonKind, settings: Settings, playerPosition: number, layout: Layout = DEFAULT_LAYOUT): boolean {
  const { min, max } = settings.range;
  return fitsOptions(comparisonSlots(settings, playerPosition, layout), optionCount(kind), minTankGap(min, max, layout));
}

/** Which decoys may stand beside the answer: below it, above it, or on either side. */
function decoySide(kind: ComparisonKind): 'below' | 'above' | 'any' {
  switch (kind) {
    case 'greater':
    case 'largest3':
    case 'order3':
      return 'below';
    case 'smaller':
    case 'smallest3':
      return 'above';
    default:
      return 'any';
  }
}

/** Picks the decoys at random, each at least `gap` from the answer and from each other; null when they do not fit. */
function pickDecoys(kind: ComparisonKind, answer: number, slots: number[], gap: number, rng: Rng): number[] | null {
  const side = decoySide(kind);
  const taken = [answer];
  for (let i = 1; i < optionCount(kind); i++) {
    const free = slots.filter(
      (s) => (side === 'any' || (side === 'below' ? s < answer : s > answer)) && taken.every((t) => Math.abs(s - t) >= gap),
    );
    if (free.length === 0) return null;
    taken.push(rng.pick(free));
  }
  return taken.slice(1);
}

function ints(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let n = lo; n <= hi; n++) out.push(n);
  return out;
}

/** Builds one comparison of `kind` whose enemy stands at `answer`, or null when the range does not allow it. */
export function buildComparison(
  kind: ComparisonKind,
  answer: number,
  settings: Settings,
  _step: DifficultyStep,
  rng: Rng,
  playerPosition?: number,
  layout: Layout = DEFAULT_LAYOUT,
): ChallengeDraft | null {
  const { min, max } = settings.range;
  const gap = minTankGap(min, max, layout);
  const slots = comparisonSlots(settings, playerPosition, layout);
  if (!slots.includes(answer)) return null;
  const decoys = pickDecoys(kind, answer, slots, gap, rng);
  if (!decoys) return null;
  const options = [answer, ...decoys].sort((a, b) => a - b);
  const draft = (params: Record<string, number>, extra: Partial<ChallengeDraft> = {}): ChallengeDraft => ({
    kind,
    prompt: { key: kind, params },
    operands: [...options, ...Object.values(params)],
    answer,
    options,
    ...extra,
  });

  switch (kind) {
    case 'greater':
    case 'smaller':
    case 'largest3':
    case 'smallest3':
      return draft({});
    case 'order3':
      return draft({}, { orderAnswer: [...options] });
    case 'equal':
      return draft({ n: answer });
    case 'closestTo': {
      // A reference number strictly closer to the answer than to the decoy, and not the answer itself.
      const decoy = decoys[0]!;
      const refs = ints(min, max).filter((n) => n !== answer && Math.abs(n - answer) < Math.abs(n - decoy));
      if (refs.length === 0) return null;
      return draft({ n: rng.pick(refs) });
    }
    case 'between': {
      // a < answer < b, with the decoy outside: below a or above b.
      const decoy = decoys[0]!;
      const [aLo, aHi, bLo, bHi] = decoy < answer ? [decoy + 1, answer - 1, answer + 1, max] : [min, answer - 1, answer + 1, decoy - 1];
      if (aLo > aHi || bLo > bHi) return null;
      return draft({ a: rng.int(aLo, aHi), b: rng.int(bLo, bHi) });
    }
  }
}

/** One builder per comparison kind; the generator passes the player's position as the fifth argument. */
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
    case 'order3':
      return options.filter((o) => o === Math.max(...options));
    case 'smaller':
    case 'smallest3':
      return options.filter((o) => o === Math.min(...options));
    case 'equal':
      return options.filter((o) => o === p.n);
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

/** The comparison rules of validateChallenge (FR-027, data-model.md "Validation"). */
export function comparisonErrors(c: Challenge, settings: Settings, playerPosition: number): string[] {
  if (!isComparisonKind(c.kind)) return [];
  const errors: string[] = [];
  const options = c.options;
  if (!options) return [`${c.kind}: no options`];
  if (options.length !== optionCount(c.kind)) errors.push(`${c.kind}: ${options.length} options instead of ${optionCount(c.kind)}`);
  const { min, max } = settings.range;
  const gap = minTankGap(min, max);
  for (const o of options) {
    if (Math.abs(o - playerPosition) < gap) errors.push(`option ${o} is closer than ${gap} to the player at ${playerPosition}`);
  }
  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) {
      if (Math.abs(options[i]! - options[j]!) < gap) errors.push(`options ${options[i]} and ${options[j]} are closer than ${gap}`);
    }
  }
  const correct = correctOptions(c);
  if (correct.length !== 1 || correct[0] !== c.answer) errors.push(`${c.kind}: the answer is not the one correct option`);
  if (c.kind === 'order3') {
    const ascending = [...options].sort((a, b) => a - b);
    const ok = c.orderAnswer !== undefined && c.orderAnswer.length === ascending.length && c.orderAnswer.every((n, i) => n === ascending[i]);
    if (!ok) errors.push('order3: the order answer is not the options from smallest to largest');
  } else if (c.orderAnswer !== undefined) {
    errors.push(`${c.kind}: only order3 has an order answer`);
  }
  return errors;
}

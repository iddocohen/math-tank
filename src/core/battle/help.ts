/**
 * The help ladder of a guided search (US5, FR-031, FR-032). Pure: `nextHelp` describes what the help step shows; the
 * controller decides when a step comes (a miss, the help button or H, a parent-set time limit) and the views draw it.
 *
 * Position challenges (every number line kind, addition and subtraction):
 * - step 1: the direction from the landing number to the answer (none before any miss) and, with `help.nearestTen`,
 *   the nearest major line to the answer;
 * - step 2: with `help.zoom` the ten that contains the answer, with `help.countSteps` a count from the landing number
 *   (or the nearest major line) to the answer; addition and subtraction show the step path instead, with
 *   `help.stepAnimation` (FR-024);
 * - step 3: the solution.
 * Comparison challenges (amendment 09): step 1 highlights the tens digits of the options in the banner
 * (`help.nearestTen`), step 2 puts a marker on the ruler under every option (`help.zoom`), step 3 shows the solution.
 *
 * A step whose help types are all turned off is skipped; the solution step is always on (FR-032).
 *
 * "Nur Rechnen" (amendment 17, FR-123) draws no ruler: step 1 gives only the direction (no ruler line highlighted),
 * step 2 the ten around the answer as a zoomed piece of ruler (with `help.zoom`) and no count; addition and
 * subtraction keep their step path, comparison keeps its option markers and gets no zoom, which would show the answer.
 */
import type { Challenge, HelpContent, PlayMode, Settings } from '../types';
import { stepsFor } from '../numberline/ticks';
import { helpZoomView } from '../numberline/zoom';
import { stepPath } from '../math/stepPath';

/** From `from` toward `to` on the ruler, or null when they are the same number. */
export function directionTo(from: number, to: number): 'right' | 'left' | null {
  if (to > from) return 'right';
  if (to < from) return 'left';
  return null;
}

/** The major line of the range's ruler nearest to n (FR-016 steps), inside the range. */
export function nearestMajorTick(n: number, min: number, max: number): number {
  const { majorStep } = stepsFor({ min, max });
  const nearest = Math.round(n / majorStep) * majorStep;
  if (nearest > max) return nearest - majorStep >= min ? nearest - majorStep + 0 : max;
  if (nearest < min) return nearest + majorStep <= max ? nearest + majorStep + 0 : min;
  return nearest + 0;
}

function isComparison(c: Challenge): boolean {
  return c.options !== undefined;
}

function isArithmetic(c: Challenge): boolean {
  return c.kind === 'addition' || c.kind === 'subtraction';
}

function empty(step: HelpContent['step']): HelpContent {
  return { step, direction: null, nearestMajor: null, zoom: null, count: null, stepPath: null, tensDigits: false, optionMarkers: null, solution: null };
}

/** The content of one step, or null when every help type of that step is turned off. */
function contentOf(c: Challenge, step: 1 | 2, landed: number | null, settings: Settings, mode: PlayMode): HelpContent | null {
  const { min, max } = settings.range;
  const help = settings.help;
  const out = empty(step);
  if (isComparison(c)) {
    if (step === 1) out.tensDigits = help.nearestTen;
    else out.optionMarkers = help.zoom ? [...c.options!].sort((a, b) => a - b) : null;
    return out.tensDigits || out.optionMarkers ? out : null;
  }
  if (step === 1) {
    out.direction = landed === null ? null : directionTo(landed, c.answer);
    out.nearestMajor = help.nearestTen && mode !== 'math' ? nearestMajorTick(c.answer, min, max) : null;
    return out.direction !== null || out.nearestMajor !== null ? out : null;
  }
  if (mode === 'math') {
    out.zoom = help.zoom ? helpZoomView(c.answer, min, max) : null;
    out.stepPath = isArithmetic(c) && help.stepAnimation ? stepPath(c, settings.beginnerAssist) : null;
    return out.zoom || out.stepPath ? out : null;
  }
  if (isArithmetic(c)) {
    out.stepPath = help.stepAnimation ? stepPath(c, settings.beginnerAssist) : null;
    return out.stepPath ? out : null;
  }
  out.zoom = help.zoom ? helpZoomView(c.answer, min, max) : null;
  const from = landed ?? nearestMajorTick(c.answer, min, max);
  out.count = help.countSteps && from !== c.answer ? { from, to: c.answer, steps: Math.abs(c.answer - from) } : null;
  return out.zoom || out.count ? out : null;
}

/**
 * The help shown at `level` (1 to 3; lower values count as 1). `landed` is the landing number of the search's latest
 * miss, or null before any miss. A step whose help types are all off gives the next step instead.
 */
export function nextHelp(challenge: Challenge, level: number, landed: number | null, settings: Settings, mode: PlayMode = 'mixed'): HelpContent {
  for (let step = Math.max(1, level); step < 3; step++) {
    const content = contentOf(challenge, step as 1 | 2, landed, settings, mode);
    if (content) return content;
  }
  const solution = empty(3);
  solution.solution = challenge.answer;
  return solution;
}

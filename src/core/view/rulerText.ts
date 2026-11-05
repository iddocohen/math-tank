/**
 * Where the ruler's texts go (T228, T229, FR-017, FR-024, FR-031): engine-free geometry for src/game/NumberLineView.ts,
 * so it can be unit-tested. Screen coordinates in world units (y grows downward), text sizes estimated from the font
 * size and the digit count as in `labelWidth`.
 *
 * - Chips are numbers on a small rounded plate on the first label row (help chips, the starting number, the stops
 *   of the step animation, the typed number). `layoutChips` keeps the chips that do not overlap a chip of higher
 *   priority and lists the ruler labels under a kept chip, which the view hides while the chip is shown (P1).
 * - `solutionNumberBox` puts the large solution number of help step 3 above the ruler band, beside the enemy's pointer
 *   line, never over a tank, the pointer line or another text (P2).
 * - `stepCountBox` puts the step count beside the walking marker, behind it in the walking direction, inside the
 *   ruler band above the axis, where no tank can stand (P2).
 */
import { numberToX } from '../numberline/mapping';
import { labelFontSize, ticksFor, type RulerLevel } from '../numberline/ticks';
import type { Challenge, HelpContent } from '../types';
import { RULER_TOP } from './layout';

/** Ruler geometry shared with the renderer (world units). */
export const AXIS_Y = 742;
export const LABEL_Y = 772;
/** The second row of level 1 labels (T217). */
export const LABEL_ROW_2_Y = 798;

/**
 * Estimated height of a number's text as a share of its font size: digits have no descenders, so the drawn digits
 * end at the baseline, about one font size below the text's top.
 */
const LINE_HEIGHT = 1.0;

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** True when the two boxes share an area (touching edges do not count). */
export function overlaps(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/** Estimated width and height of a bold number text, with its outline stroke. */
export function textSize(text: string, fontSize: number, stroke = 0): { w: number; h: number } {
  return { w: text.length * 0.56 * fontSize + stroke, h: fontSize * LINE_HEIGHT + stroke };
}

/** A text box centered at cx; `y` is its top (originY 0), its bottom (1) or its middle (0.5). */
export function textBox(cx: number, y: number, text: string, fontSize: number, originY: 0 | 0.5 | 1, stroke = 0): Box {
  const { w, h } = textSize(text, fontSize, stroke);
  const y0 = y - originY * h;
  return { x0: cx - w / 2, y0, x1: cx + w / 2, y1: y0 + h };
}

/** Font size of chip numbers, and the plate's padding around the text. */
export const CHIP_FONT = 26;
export const CHIP_PAD_X = 8;
export const CHIP_PAD_Y = 3;
/** Two kept chips keep this much space between their plates. */
export const CHIP_GAP = 4;

/** The plate of a chip with `text` centered at x on the first label row. */
export function chipBox(x: number, text: string, fontSize = CHIP_FONT): Box {
  const { w, h } = textSize(text, fontSize);
  return { x0: x - w / 2 - CHIP_PAD_X, y0: LABEL_Y - CHIP_PAD_Y, x1: x + w / 2 + CHIP_PAD_X, y1: LABEL_Y + h + CHIP_PAD_Y };
}

export interface RulerLabelBox {
  value: number;
  box: Box;
}

/**
 * The boxes of the ruler's own labels, as NumberLineView draws them. `ruled` is ticksFor(range, level, seed) when the
 * caller has already computed it.
 */
export function rulerLabelBoxes(
  range: { min: number; max: number },
  level: RulerLevel,
  seed: number,
  ruled: Pick<ReturnType<typeof ticksFor>, 'ticks' | 'labelRows'> = ticksFor(range, level, seed),
): RulerLabelBox[] {
  const { ticks, labelRows } = ruled;
  return ticks
    .filter((t) => t.labeled)
    .map((t) => ({
      value: t.value,
      box: textBox(numberToX(t.value, range.min, range.max) + t.shift, t.row === 1 ? LABEL_ROW_2_Y : LABEL_Y, String(t.value), labelFontSize(t, labelRows, range), 0),
    }));
}

export interface Chip {
  key: string;
  x: number;
  text: string;
  /** Higher keeps its place when two chips would overlap. */
  priority: number;
  fontSize?: number;
}

/** Chip priorities: the typed number, the solution, the starting number, the latest stop, the nearest major line. */
export const CHIP_PRIORITY = { typed: 50, solution: 40, start: 30, stop: 20, option: 15, nearestMajor: 10 } as const;

/**
 * The chips to draw and the ruler labels to hide under them. Chips are taken from the highest priority down (later
 * chips first at the same priority); a chip that overlaps a kept chip is left out.
 */
export function layoutChips(labels: readonly RulerLabelBox[], chips: readonly Chip[]): { shown: Chip[]; hiddenLabels: Set<number> } {
  const order = chips.map((c, i) => ({ c, i })).sort((a, b) => b.c.priority - a.c.priority || b.i - a.i);
  const kept: { c: Chip; box: Box }[] = [];
  for (const { c } of order) {
    const box = chipBox(c.x, c.text, c.fontSize);
    const padded = { x0: box.x0 - CHIP_GAP, y0: box.y0, x1: box.x1 + CHIP_GAP, y1: box.y1 };
    if (kept.some((k) => overlaps(padded, k.box))) continue;
    kept.push({ c, box });
  }
  const hiddenLabels = new Set<number>();
  for (const l of labels) if (kept.some((k) => overlaps(l.box, k.box))) hiddenLabels.add(l.value);
  const shown = chips.filter((c) => kept.some((k) => k.c === c));
  return { shown, hiddenLabels };
}

/** The large landing number (56 units, outline 8), its bottom just above the ruler band. */
export const LANDED_FONT = 56;
export const LANDED_STROKE = 8;
export const LANDED_BOTTOM = RULER_TOP - 10;

export function landedNumberBox(x: number, n: number): Box {
  return textBox(x, LANDED_BOTTOM, String(n), LANDED_FONT, 1, LANDED_STROKE);
}

/** The space a tank takes on screen, with its turret, antenna flag and the hearts above it. */
export const TANK_HALF_WIDTH = 44;
export const TANK_DRAWN_HEIGHT = 92;

/** A tank's box from its center x and its ground y on screen. */
export function tankBox(x: number, groundY: number): Box {
  return { x0: x - TANK_HALF_WIDTH, y0: groundY - TANK_DRAWN_HEIGHT, x1: x + TANK_HALF_WIDTH, y1: groundY + 2 };
}

/** The enemy's pointer line from the tank down to the ruler axis, with the help marker's width around it. */
export function pointerLineBox(x: number, topY: number): Box {
  return { x0: x - 20, y0: topY, x1: x + 20, y1: AXIS_Y };
}

/** The large solution number of help step 3 (72 units, outline 7). */
export const SOLUTION_FONT = 72;
export const SOLUTION_STROKE = 7;

/**
 * Where the large solution number goes: its bottom level with the landing number, beside the pointer line at x,
 * moving outward and then one row up until it overlaps no obstacle and stays inside the world. Returns its box; the
 * renderer draws the text centered in it.
 */
export function solutionNumberBox(n: number, x: number, obstacles: readonly Box[], worldWidth: number): Box {
  const { w, h } = textSize(String(n), SOLUTION_FONT, SOLUTION_STROKE);
  // Try the side with more room first.
  const sides = x <= worldWidth / 2 ? [1, -1] : [-1, 1];
  const fits = (b: Box) => b.x0 >= 8 && b.x1 <= worldWidth - 8 && b.y0 >= 8 && !obstacles.some((o) => overlaps(b, o));
  for (let row = 0; row < 6; row++) {
    const bottom = LANDED_BOTTOM - row * (h + 8);
    for (let d = w / 2 + 24; d <= worldWidth; d += 12) {
      for (const side of sides) {
        const cx = x + side * d;
        const b = { x0: cx - w / 2, y0: bottom - h, x1: cx + w / 2, y1: bottom };
        if (fits(b)) return b;
      }
    }
  }
  return { x0: x - w / 2, y0: 8, x1: x + w / 2, y1: 8 + h };
}

/** The step count beside the walking marker (24 units, outline 6), and the marker's half width. */
export const STEP_COUNT_FONT = 24;
export const STEP_COUNT_STROKE = 6;
export const STEP_ICON_HALF = 21;

/**
 * The step count beside a marker at x walking in direction `dir` (+1 right, −1 left): behind the marker, inside the
 * ruler band and above the axis, so it is never over a tank. `besideHalf` is the half width of what it stands beside.
 */
export function stepCountBox(x: number, dir: number, text: string, besideHalf = STEP_ICON_HALF): Box {
  const { w } = textSize(text, STEP_COUNT_FONT, STEP_COUNT_STROKE);
  const cx = x - (dir >= 0 ? 1 : -1) * (besideHalf + 4 + w / 2);
  return textBox(cx, AXIS_Y - 12, text, STEP_COUNT_FONT, 0.5, STEP_COUNT_STROKE);
}

export interface HelpSceneInput {
  range: { min: number; max: number };
  level: RulerLevel;
  seed: number;
  challenge: Challenge | null;
  help: HelpContent | null;
  /** The step animation's path while it is shown (state.stepAnimation). */
  stepPath: number[] | null;
  /** The landing number of the latest miss, or null. */
  landed: number | null;
  /** Tank centers x and ground y on screen. */
  enemy: { x: number; groundY: number } | null;
  player: { x: number; groundY: number };
  worldWidth: number;
  /** The typed number's own label on a crowded level 1 ruler (T203), or null. */
  typed?: number | null;
  /** rulerLabelBoxes(range, level, seed) when the caller has already computed it. */
  labels?: readonly RulerLabelBox[];
}

/** The chips of a help scene: the starting number, the help step's chips and the stops of the step animation. */
export function sceneChips(input: HelpSceneInput): Chip[] {
  const { range, challenge: c, help, stepPath } = input;
  const at = (n: number) => numberToX(n, range.min, range.max);
  const chips: Chip[] = [];
  if (help?.nearestMajor != null) chips.push({ key: 'nearestMajor', x: at(help.nearestMajor), text: String(help.nearestMajor), priority: CHIP_PRIORITY.nearestMajor });
  for (const n of help?.optionMarkers ?? []) chips.push({ key: `option:${n}`, x: at(n), text: String(n), priority: CHIP_PRIORITY.option });
  if (c && (c.kind === 'addition' || c.kind === 'subtraction')) {
    const start = c.operands[0]!;
    chips.push({ key: 'start', x: at(start), text: String(start), priority: CHIP_PRIORITY.start });
  }
  for (const n of stepPath?.slice(1) ?? []) chips.push({ key: `stop:${n}`, x: at(n), text: String(n), priority: CHIP_PRIORITY.stop });
  if (help?.solution != null) chips.push({ key: 'solution', x: at(help.solution), text: String(help.solution), priority: CHIP_PRIORITY.solution });
  if (input.typed != null) chips.push({ key: 'typed', x: at(input.typed), text: String(input.typed), priority: CHIP_PRIORITY.typed, fontSize: 22 });
  return chips;
}

/**
 * Every text the ruler draws for a help scene, at its final place: the ruler labels not hidden under a chip, the
 * kept chips, the landing number, the step count at the end of the step animation or the count, and the solution
 * number. The renderer uses the same functions, so this is what the child sees once the animations have ended.
 */
export function helpTextScene(input: HelpSceneInput): {
  texts: { key: string; box: Box }[];
  chips: Chip[];
  hiddenLabels: Set<number>;
  stepCount: Box | null;
  solution: Box | null;
} {
  const { range, help, stepPath, landed } = input;
  const at = (n: number) => numberToX(n, range.min, range.max);
  const labels = input.labels ?? rulerLabelBoxes(range, input.level, input.seed);
  const { shown, hiddenLabels } = layoutChips(labels, sceneChips(input));
  const texts: { key: string; box: Box }[] = [];
  for (const l of labels) if (!hiddenLabels.has(l.value)) texts.push({ key: `label:${l.value}`, box: l.box });
  for (const c of shown) texts.push({ key: `chip:${c.key}`, box: chipBox(c.x, c.text, c.fontSize) });
  const landedBox = landed === null ? null : landedNumberBox(at(landed), landed);
  if (landedBox) texts.push({ key: 'landed', box: landedBox });

  let stepCount: Box | null = null;
  if (stepPath && stepPath.length >= 2) {
    const first = stepPath[0]!;
    const last = stepPath[stepPath.length - 1]!;
    stepCount = stepCountBox(at(last), Math.sign(last - first), String(Math.abs(last - first)));
  } else if (help?.count) {
    stepCount = stepCountBox(at(help.count.to), Math.sign(help.count.to - help.count.from), String(help.count.steps), COUNT_HEAD_HALF);
  }
  if (stepCount) texts.push({ key: 'stepCount', box: stepCount });

  let solution: Box | null = null;
  if (help?.solution != null) {
    const obstacles = [tankBox(input.player.x, input.player.groundY)];
    if (input.enemy) obstacles.push(tankBox(input.enemy.x, input.enemy.groundY), pointerLineBox(at(help.solution), input.enemy.groundY - TANK_DRAWN_HEIGHT));
    if (landedBox) obstacles.push(landedBox);
    if (stepCount) obstacles.push(stepCount);
    solution = solutionNumberBox(help.solution, at(help.solution), obstacles, input.worldWidth);
    texts.push({ key: 'solution', box: solution });
  }
  return { texts, chips: shown, hiddenLabels, stepCount, solution };
}

/** Half width of the head of the counted stretch, beside which the running count of help step 2 stands. */
export const COUNT_HEAD_HALF = 8;

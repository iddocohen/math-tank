/**
 * T228 and T229 (P1, P2, FR-017, FR-024, FR-031): the ruler's texts never overlap each other, and no help number is
 * drawn over a tank. Help steps 1 to 3 for 43 − 7 (landed at 31) and 24 + 8 (landed at 30) in 0 to 100, at every
 * ruler level, with the enemy on low and high ground.
 */
import { describe, expect, it } from 'vitest';
import { nextHelp } from '../battle/help';
import { stepPath } from '../math/stepPath';
import { numberToX } from '../numberline/mapping';
import { ticksFor } from '../numberline/ticks';
import { defaultSettings } from '../settings/defaults';
import type { Challenge, HelpContent } from '../types';
import { GROUND_ABOVE_RULER_MARGIN, RULER_TOP } from './layout';
import {
  AXIS_Y,
  chipBox,
  helpTextScene,
  landedNumberBox,
  layoutChips,
  overlaps,
  pointerLineBox,
  rulerLabelBoxes,
  solutionNumberBox,
  stepCountBox,
  tankBox,
  type Box,
} from './rulerText';

const range = { min: 0, max: 100 };
const settings = { ...defaultSettings(), range: { preset: '0-100' as const, min: 0, max: 100 } };
const x = (n: number) => numberToX(n, range.min, range.max);

function challenge(kind: 'addition' | 'subtraction', operands: [number, number], answer: number): Challenge {
  return { id: 't-0', seed: 1, kind, difficultyStep: 0, mainSkill: 'countBackward', skills: ['countBackward'], prompt: { key: kind, params: {} }, operands, answer };
}

const cases = [
  { name: '43 − 7', c: challenge('subtraction', [43, 7], 36), landed: 31 },
  { name: '24 + 8', c: challenge('addition', [24, 8], 32), landed: 30 },
];
/** The lowest ground the terrain allows (just above the ruler band) and a hill. */
const grounds = [RULER_TOP - GROUND_ABOVE_RULER_MARGIN, 600, 420];

/** The help content shown at `step` after misses at `landed`, and the step path running since step 2. */
function helpAt(c: Challenge, step: 1 | 2 | 3, landed: number): { help: HelpContent; path: number[] | null } {
  const help = nextHelp(c, step, landed, settings);
  const path = step >= 2 ? stepPath(c, settings.beginnerAssist) : null;
  return { help, path };
}

function expectApart(texts: { key: string; box: Box }[]): void {
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      expect(overlaps(texts[i]!.box, texts[j]!.box), `${texts[i]!.key} overlaps ${texts[j]!.key}`).toBe(false);
    }
  }
}

describe('help texts on the ruler never overlap (T228, P1)', () => {
  for (const { name, c, landed } of cases) {
    for (const level of [1, 2, 3, 4, 5] as const) {
      for (const step of [1, 2, 3] as const) {
        it(`${name}, level ${level}, help step ${step}`, () => {
          for (const ground of grounds) {
            const { help, path } = helpAt(c, step, landed);
            const scene = helpTextScene({
              range,
              level,
              seed: 3,
              challenge: c,
              help,
              stepPath: path,
              landed,
              enemy: { x: x(c.answer), groundY: ground },
              player: { x: x(100), groundY: 500 },
              worldWidth: 1600,
            });
            expect(scene.texts.length).toBeGreaterThan(0);
            expectApart(scene.texts);
            // Help chips are shown: the starting number, and at step 3 the solution.
            expect(scene.texts.some((t) => t.key === `chip:start`)).toBe(true);
            if (step === 3) expect(scene.texts.some((t) => t.key === 'chip:solution')).toBe(true);
          }
        });
      }
    }
  }

  it('gives the same label boxes from precomputed lines as from the range, level and seed', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      expect(rulerLabelBoxes(range, level, 3, ticksFor(range, level, 3))).toEqual(rulerLabelBoxes(range, level, 3));
    }
  });

  it('hides the ruler labels under a chip and keeps the others', () => {
    const labels = rulerLabelBoxes(range, 1, 3);
    const { shown, hiddenLabels } = layoutChips(labels, [{ key: 'start', x: x(43), text: '43', priority: 30 }]);
    expect(shown).toHaveLength(1);
    expect(hiddenLabels.has(43)).toBe(true);
    expect(hiddenLabels.has(42) || hiddenLabels.has(44)).toBe(true);
    expect(hiddenLabels.has(50)).toBe(false);
    for (const l of labels) if (!hiddenLabels.has(l.value)) expect(overlaps(l.box, chipBox(x(43), '43'))).toBe(false);
  });

  it('leaves out a lower-priority chip that would overlap a higher one (stop 40 beside the start 43)', () => {
    const { shown } = layoutChips(
      [],
      [
        { key: 'start', x: x(43), text: '43', priority: 30 },
        { key: 'stop:40', x: x(40), text: '40', priority: 20 },
        { key: 'stop:36', x: x(36), text: '36', priority: 20 },
      ],
    );
    expect(shown.map((c) => c.key)).toEqual(['start', 'stop:36']);
  });
});

describe('the solution number and the step count never cover a tank (T229, P2)', () => {
  it('places the solution number beside the pointer line, never over either tank, the line or the landing number', () => {
    for (let n = 0; n <= 100; n++) {
      for (const ground of grounds) {
        const enemy = tankBox(x(n), ground);
        const player = tankBox(x(n < 50 ? 100 : 0), 500);
        const line = pointerLineBox(x(n), ground - 20);
        const landedAt = Math.max(0, Math.min(100, n + (n % 2 === 0 ? -5 : 5)));
        const landedBox = landedNumberBox(x(landedAt), landedAt);
        const obstacles = [enemy, player, line, landedBox];
        const b = solutionNumberBox(n, x(n), obstacles, 1600);
        for (const o of obstacles) expect(overlaps(b, o), `solution ${n} on ground ${ground}`).toBe(false);
        expect(b.y1).toBeLessThanOrEqual(RULER_TOP);
        expect(b.x0).toBeGreaterThanOrEqual(0);
        expect(b.x1).toBeLessThanOrEqual(1600);
        // It stays near its number: within 300 units.
        expect(Math.abs((b.x0 + b.x1) / 2 - x(n))).toBeLessThan(300);
      }
    }
  });

  it('places the step count beside the walking marker, behind it, inside the ruler band above the axis', () => {
    const icon = (cx: number): Box => ({ x0: cx - 21, y0: AXIS_Y - 30, x1: cx + 21, y1: AXIS_Y });
    for (const [at, dir] of [
      [x(36), -1],
      [x(32), 1],
    ] as const) {
      const b = stepCountBox(at, dir, '7');
      expect(overlaps(b, icon(at))).toBe(false);
      expect(dir < 0 ? b.x0 > at : b.x1 < at).toBe(true);
      expect(b.y0).toBeGreaterThanOrEqual(RULER_TOP - 10);
      expect((b.y0 + b.y1) / 2).toBeLessThan(AXIS_Y);
    }
  });
});

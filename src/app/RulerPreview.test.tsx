/** Ruler preview on the settings page (FR-017, FR-069): the same tick rules as the game. */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ticksFor } from '../core/numberline/ticks';
import { RulerPreview } from './RulerPreview';

afterEach(cleanup);

const labels = () => screen.queryAllByTestId('preview-label').map((el) => Number(el.textContent));
const lines = () => screen.queryAllByTestId('preview-line');

describe('RulerPreview', () => {
  it('550 to 780 at level 2: major labels and both end points, plus minor lines', () => {
    render(<RulerPreview range={{ min: 550, max: 780 }} level={2} />);
    expect(labels()).toEqual([550, 600, 650, 700, 750, 780]);
    const minor = lines().filter((l) => l.dataset.major === 'false');
    expect(minor.length).toBeGreaterThan(10);
  });

  it('level 5 draws every line and labels only the two end points (amendment 20)', () => {
    render(<RulerPreview range={{ min: 550, max: 780 }} level={5} />);
    expect(labels()).toEqual([550, 780]);
    expect(lines()).toHaveLength(24);
  });

  it('levels 1 to 5 at 0 to 100 each draw all 101 lines with the 10 medium lines; labels per level (amendment 20)', () => {
    const expected: Record<2 | 3 | 4 | 5, number[]> = {
      2: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
      3: [0, 20, 40, 60, 80, 100],
      4: [0, 50, 100],
      5: [0, 100],
    };
    for (const level of [1, 2, 3, 4, 5] as const) {
      const { unmount } = render(<RulerPreview range={{ min: 0, max: 100 }} level={level} />);
      expect(lines(), `level ${level}`).toHaveLength(101);
      expect(lines().filter((l) => l.dataset.size === 'medium'), `level ${level}`).toHaveLength(10);
      if (level !== 1) expect(labels(), `level ${level}`).toEqual(expected[level]);
      unmount();
    }
  });

  it('0 to 1000 at level 5 draws 101 lines and labels 0 and 1000 (amendment 20)', () => {
    render(<RulerPreview range={{ min: 0, max: 1000 }} level={5} />);
    expect(lines()).toHaveLength(101);
    expect(labels()).toEqual([0, 1000]);
  });

  it('places the end points at the edges of the preview width and keeps lines in order', () => {
    render(<RulerPreview range={{ min: 0, max: 100 }} level={4} width={300} />);
    const xs = lines().map((l) => Number(l.getAttribute('x1')));
    expect(xs[0]).toBeGreaterThanOrEqual(0);
    expect(xs.at(-1)).toBeLessThanOrEqual(300);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(labels()).toEqual([0, 50, 100]);
  });

  it('updates when the range or level props change', () => {
    const { rerender } = render(<RulerPreview range={{ min: 0, max: 20 }} level={2} />);
    expect(labels()).toEqual([0, 10, 20]);
    rerender(<RulerPreview range={{ min: 550, max: 780 }} level={2} />);
    expect(labels()).toEqual([550, 600, 650, 700, 750, 780]);
    rerender(<RulerPreview range={{ min: 550, max: 780 }} level={5} />);
    expect(labels()).toEqual([550, 780]);
  });

  it('0 to 100 at level 1 labels the numbers in two rows, minor labels smaller, none crowding a large label (T217, T218, T231)', () => {
    render(<RulerPreview range={{ min: 0, max: 100 }} level={1} />);
    expect(labels()).toEqual(ticksFor({ min: 0, max: 100 }, 1).ticks.filter((t) => t.labeled).map((t) => t.value));
    expect(labels()).not.toContain(28);
    expect(lines()).toHaveLength(101);
    const els = screen.getAllByTestId('preview-label');
    const rows = new Set(els.map((el) => el.dataset.row));
    expect(rows).toEqual(new Set(['0', '1']));
    const size = (n: number) => Number(els.find((el) => el.textContent === String(n))!.getAttribute('font-size'));
    expect(size(37)).toBeLessThan(size(40));
    expect(els.find((el) => el.textContent === '40')!.dataset.row).toBe('0');
  });

  it('0 to 100 at level 2 labels only the major lines, in one row', () => {
    render(<RulerPreview range={{ min: 0, max: 100 }} level={2} />);
    expect(labels()).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(screen.getAllByTestId('preview-label').every((el) => el.dataset.row === '0')).toBe(true);
  });

  it('fills the available width', () => {
    render(<RulerPreview range={{ min: 0, max: 100 }} level={1} />);
    expect(screen.getByTestId('ruler-preview').getAttribute('width')).toBe('100%');
  });

  it('names the range and level for screen readers', () => {
    render(<RulerPreview range={{ min: 550, max: 780 }} level={3} />);
    const svg = screen.getByTestId('ruler-preview');
    expect(svg.getAttribute('aria-label')).toContain('550');
    expect(svg.getAttribute('aria-label')).toContain('3');
  });

  it('each line carries its size; the level 1 and level 3 previews of 0 to 100 have the 10 medium lines 5, 15 … 95 (T235)', () => {
    for (const level of [1, 3] as const) {
      const { unmount } = render(<RulerPreview range={{ min: 0, max: 100 }} level={level} />);
      const medium = lines().filter((l) => l.dataset.size === 'medium');
      expect(medium.map((l) => l.dataset.value)).toEqual(['5', '15', '25', '35', '45', '55', '65', '75', '85', '95']);
      expect(lines().filter((l) => l.dataset.size === 'major')).toHaveLength(11);
      // Medium lines are longer than minor lines and shorter than major lines.
      const len = (l: HTMLElement) => Number(l.getAttribute('y2')) - Number(l.getAttribute('y1'));
      const minor = lines().find((l) => l.dataset.size === 'minor')!;
      const major = lines().find((l) => l.dataset.size === 'major')!;
      expect(len(medium[0]!)).toBeGreaterThan(len(minor));
      expect(len(medium[0]!)).toBeLessThan(len(major));
      unmount();
    }
  });

  it('level 4 has the same medium lines as level 1 (amendment 20)', () => {
    render(<RulerPreview range={{ min: 0, max: 100 }} level={4} />);
    expect(lines().filter((l) => l.dataset.size === 'medium')).toHaveLength(10);
  });
});

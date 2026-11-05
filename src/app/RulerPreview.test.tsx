/** Ruler preview on the settings page (FR-017, FR-069): the same tick rules as the game. */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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

  it('level 5 shows only the two end points', () => {
    render(<RulerPreview range={{ min: 550, max: 780 }} level={5} />);
    expect(labels()).toEqual([550, 780]);
    expect(lines()).toHaveLength(2);
  });

  it('places the end points at the edges of the preview width and keeps lines in order', () => {
    render(<RulerPreview range={{ min: 0, max: 100 }} level={4} width={300} />);
    const xs = lines().map((l) => Number(l.getAttribute('x1')));
    expect(xs[0]).toBeGreaterThanOrEqual(0);
    expect(xs.at(-1)).toBeLessThanOrEqual(300);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(labels()).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });

  it('updates when the range or level props change', () => {
    const { rerender } = render(<RulerPreview range={{ min: 0, max: 20 }} level={2} />);
    expect(labels()).toEqual([0, 10, 20]);
    rerender(<RulerPreview range={{ min: 550, max: 780 }} level={2} />);
    expect(labels()).toEqual([550, 600, 650, 700, 750, 780]);
    rerender(<RulerPreview range={{ min: 550, max: 780 }} level={5} />);
    expect(labels()).toEqual([550, 780]);
  });

  it('0 to 100 at level 1 labels all 101 numbers in two rows, minor labels smaller (T217, T218)', () => {
    render(<RulerPreview range={{ min: 0, max: 100 }} level={1} />);
    expect(labels()).toEqual(Array.from({ length: 101 }, (_, i) => i));
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
});

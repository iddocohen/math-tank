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

  it('names the range and level for screen readers', () => {
    render(<RulerPreview range={{ min: 550, max: 780 }} level={3} />);
    const svg = screen.getByTestId('ruler-preview');
    expect(svg.getAttribute('aria-label')).toContain('550');
    expect(svg.getAttribute('aria-label')).toContain('3');
  });
});

/**
 * Amendment 14 (T290, FR-109, FR-110, FR-112): the garage preview draws the tank with the battle's drawing code
 * (src/core/view/tankDrawing.ts): the body shaded from the chosen color, the flag and hat of the look, and thicker
 * trail lines.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TankPreview } from './TankPreview';
import { STANDARD_LOOK, type ColorId, type Look } from '../core/rewards/items';
import { playerTankShapes } from '../core/view/tankDrawing';
import { tankShades } from '../core/view/shade';
import { tankColor } from '../core/rewards/looks';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const COLORS: ColorId[] = ['blue', 'sky', 'teal', 'turquoise', 'navyStripes'];

afterEach(cleanup);

function part(name: string): Element {
  const el = screen.getByTestId('garage-preview').querySelector(`[data-part="${name}"]`);
  if (!el) throw new Error(`no part ${name}`);
  return el;
}

describe('TankPreview', () => {
  it.each(COLORS)('%s: the body has the base, highlight and shadow of the color, shape for shape like the battle', (color) => {
    const look: Look = { ...STANDARD_LOOK, color };
    render(<TankPreview look={look} label="Vorschau" />);
    const s = tankShades(tankColor(color));
    const body = part('body');
    const fills = new Set([...body.querySelectorAll('polygon, circle')].map((e) => e.getAttribute('fill')));
    expect(fills.has(hex(s.base))).toBe(true);
    expect(fills.has(hex(s.highlight))).toBe(true);
    expect(fills.has(hex(s.shadow))).toBe(true);
    expect(body.children.length).toBe(playerTankShapes(look).body.length);
    expect(part('turret').children.length).toBe(playerTankShapes(look).turret.length);
  });

  it('draws the flag and the hat of the look', () => {
    const look: Look = { ...STANDARD_LOOK, flag: 'rocket', hat: 'crown' };
    render(<TankPreview look={look} label="Vorschau" />);
    const shapes = playerTankShapes(look);
    expect(part('flag').children.length).toBe(shapes.flag.length);
    expect(part('hat').children.length).toBe(shapes.hat.length);
    expect(part('antenna').children.length).toBe(1);
  });

  it.each(['plain', 'rainbow'] as const)('draws the %s trail lines at least 4.5 units thick', (trail) => {
    render(<TankPreview look={{ ...STANDARD_LOOK, trail }} label="Vorschau" />);
    const lines = [...part('trail').querySelectorAll('polyline')];
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(Number(l.getAttribute('stroke-width'))).toBeGreaterThanOrEqual(4.5);
  });
});

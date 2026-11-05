/**
 * Tank garage (amendment 11, FR-091, FR-092): every item in four groups with its number, unlocked items chosen with
 * one tap, locked items as grey silhouettes with "noch N Sterne", keyboard choice by typed number and Enter, a preview
 * tank that shows the choice, and "Zurück".
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyGarage, equip, lookKey, type Garage as GarageData } from '../core/rewards/garage';
import { GARAGE_ITEMS } from '../core/rewards/items';
import { t } from '../i18n';
import { Garage } from './Garage';

const m = t();
const G = m.garage;

function setup(stars: number, over: Partial<GarageData> = {}) {
  let garage: GarageData = { ...emptyGarage(), stars, ...over };
  const onEquip = vi.fn((id: string) => {
    garage = equip(garage, id);
    view.rerender(<Garage garage={garage} onEquip={onEquip} onBack={onBack} />);
  });
  const onBack = vi.fn();
  const view = render(<Garage garage={garage} onEquip={onEquip} onBack={onBack} />);
  return { onEquip, onBack, current: () => garage };
}

const item = (id: string) => screen.getByTestId(`garage-item-${id}`);
const press = (key: string) => act(() => void fireEvent.keyDown(window, { key }));

afterEach(cleanup);

describe('Garage (amendment 11)', () => {
  it('shows all 17 items in four groups, numbered 1 to 17 in garage order', () => {
    setup(0);
    for (const kind of ['color', 'flag', 'trail', 'hat'] as const) {
      expect(screen.getByRole('group', { name: G.kinds[kind] }), kind).toBeTruthy();
    }
    GARAGE_ITEMS.forEach((it, i) => {
      expect(within(item(it.id)).getByText(String(i + 1)), it.id).toBeTruthy();
      expect(item(it.id).closest('[role="group"]')?.getAttribute('aria-label')).toBe(G.kinds[it.kind]);
    });
  });

  it('with 14 stars the rocket flag is unlocked and equips on click', () => {
    const { onEquip, current } = setup(14);
    expect(item('rocket').getAttribute('data-locked')).toBe('false');
    expect(within(item('rocket')).getByText(G.items.rocket)).toBeTruthy();
    fireEvent.click(item('rocket'));
    expect(onEquip).toHaveBeenCalledWith('rocket');
    expect(current().look.flag).toBe('rocket');
    expect(item('rocket').getAttribute('data-chosen')).toBe('true');
    expect(item('star').getAttribute('data-chosen')).toBe('false');
  });

  it('with 14 stars sky blue is a grey silhouette with "noch 6 Sterne" and does nothing on click', () => {
    const { onEquip } = setup(14);
    const sky = item('sky');
    expect(sky.getAttribute('data-locked')).toBe('true');
    expect(sky.getAttribute('aria-disabled')).toBe('true');
    expect(within(sky).getByText(G.stillNeeded(6))).toBeTruthy();
    expect(sky.querySelector('.garage-silhouette')).not.toBeNull();
    fireEvent.click(sky);
    expect(onEquip).not.toHaveBeenCalled();
    expect(G.stillNeeded(1)).toBe('noch 1 Stern');
    expect(G.stillNeeded(4)).toBe('noch 4 Sterne');
  });

  it('typing 7 and Enter chooses the rocket flag; the preview follows the choice', () => {
    const { onEquip, current } = setup(14);
    const preview = screen.getByTestId('garage-preview');
    expect(preview.getAttribute('data-look')).toBe(lookKey(emptyGarage().look));
    press('7');
    expect(item('rocket').getAttribute('data-selected')).toBe('true');
    expect(preview.getAttribute('data-look')).toBe(lookKey({ ...emptyGarage().look, flag: 'rocket' }));
    press('Enter');
    expect(onEquip).toHaveBeenCalledWith('rocket');
    expect(current().look.flag).toBe('rocket');
    expect(screen.getByTestId('garage').getAttribute('data-look')).toBe(lookKey({ ...emptyGarage().look, flag: 'rocket' }));
  });

  it('two digits select items above 9; Backspace deletes a digit; Enter on a locked item does nothing', () => {
    const { onEquip } = setup(14);
    press('1');
    press('2');
    expect(item('sparkles').getAttribute('data-selected')).toBe('true');
    press('Backspace');
    expect(item(GARAGE_ITEMS[0]!.id).getAttribute('data-selected')).toBe('true');
    press('2');
    press('Enter');
    expect(onEquip).not.toHaveBeenCalled();
    // Enter clears the typed number.
    press('1');
    press('8');
    // "18" is not an item: nothing is selected.
    expect(screen.queryAllByTestId(/garage-item-/).filter((b) => b.getAttribute('data-selected') === 'true')).toEqual([]);
  });

  it('Escape and "Zurück" call onBack', () => {
    const { onBack } = setup(0);
    press('Escape');
    expect(onBack).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: G.back }));
    expect(onBack).toHaveBeenCalledTimes(2);
  });

  it('shows the star total, and every item button has the large-target class', () => {
    setup(23);
    expect(screen.getByTestId('star-total').textContent).toContain('23');
    for (const it of GARAGE_ITEMS) expect(item(it.id).classList.contains('garage-item')).toBe(true);
  });
});

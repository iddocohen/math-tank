/**
 * Tank garage as a star shop (amendment 11, changed by amendment 19; FR-091, FR-092, FR-130, FR-131): every item in
 * four groups with its number, sorted by price; owned items equipped with one tap; an item not owned shows its price
 * and asks "Für N Sterne kaufen?" when the balance reaches it; items the balance does not reach are grey silhouettes
 * with "noch N Sterne"; "Zurückgeben" asks and refunds; keyboard choice by typed number and Enter, Enter and Escape
 * answer the question; a preview tank shows the choice; "Zurück".
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buy, emptyGarage, equip, lookKey, returnItem, type Garage as GarageData } from '../core/rewards/garage';
import { GARAGE_ITEMS, GARAGE_KINDS, STANDARD_LOOK } from '../core/rewards/items';
import { t } from '../i18n';
import { Garage } from './Garage';

const m = t();
const G = m.garage;

function setup(balance: number, over: Partial<GarageData> = {}) {
  let garage: GarageData = { ...emptyGarage(), balance, totalEarned: balance, ...over };
  const rerender = () => view.rerender(<Garage garage={garage} onEquip={onEquip} onBuy={onBuy} onReturn={onReturn} onBack={onBack} />);
  const onEquip = vi.fn((id: string) => {
    garage = equip(garage, id);
    rerender();
  });
  const onBuy = vi.fn((id: string) => {
    garage = buy(garage, id);
    rerender();
  });
  const onReturn = vi.fn((id: string) => {
    garage = returnItem(garage, id);
    rerender();
  });
  const onBack = vi.fn();
  const view = render(<Garage garage={garage} onEquip={onEquip} onBuy={onBuy} onReturn={onReturn} onBack={onBack} />);
  return { onEquip, onBuy, onReturn, onBack, current: () => garage };
}

const item = (id: string) => screen.getByTestId(`garage-item-${id}`);
const dialog = () => screen.queryByTestId('garage-dialog');
const press = (key: string) => act(() => void fireEvent.keyDown(window, { key }));

afterEach(cleanup);

describe('Garage (amendments 11 and 19)', () => {
  it('shows all 17 items in four groups, numbered 1 to 17 in garage order', () => {
    setup(0);
    for (const kind of GARAGE_KINDS) expect(screen.getByRole('group', { name: G.kinds[kind] }), kind).toBeTruthy();
    GARAGE_ITEMS.forEach((it, i) => {
      expect(within(item(it.id)).getByText(String(i + 1)), it.id).toBeTruthy();
      expect(item(it.id).closest('[role="group"]')?.getAttribute('aria-label')).toBe(G.kinds[it.kind]);
    });
  });

  it('shows the items of each group sorted by price, and the price of every item not owned', () => {
    setup(0);
    for (const kind of GARAGE_KINDS) {
      const group = screen.getByRole('group', { name: G.kinds[kind] });
      const ids = within(group).getAllByTestId(/^garage-item-/).map((b) => b.getAttribute('data-testid')!.slice('garage-item-'.length));
      const prices = ids.map((id) => GARAGE_ITEMS.find((i) => i.id === id)!.price);
      expect(prices, kind).toEqual([...prices].sort((a, b) => a - b));
    }
    expect(within(item('crown')).getByText(G.price(40))).toBeTruthy();
    expect(within(item('rocket')).getByText(G.price(10))).toBeTruthy();
    expect(within(item('star')).queryByText(G.price(0))).toBeNull();
  });

  it('with 14 stars the rocket flag asks "Für 10 Sterne kaufen?"; "Ja" buys and equips it', () => {
    const { onBuy, current } = setup(14);
    expect(item('rocket').getAttribute('data-locked')).toBe('false');
    expect(item('rocket').getAttribute('data-owned')).toBe('false');
    fireEvent.click(item('rocket'));
    expect(within(dialog()!).getByText(G.buyQuestion(10))).toBeTruthy();
    expect(onBuy).not.toHaveBeenCalled();
    fireEvent.click(within(dialog()!).getByRole('button', { name: G.yes }));
    expect(onBuy).toHaveBeenCalledWith('rocket');
    expect(dialog()).toBeNull();
    expect(current()).toMatchObject({ balance: 4, owned: ['rocket'] });
    expect(item('rocket').getAttribute('data-chosen')).toBe('true');
    expect(screen.getByTestId('star-total').textContent).toContain('4');
  });

  it('"Nein" closes the question and changes nothing', () => {
    const { onBuy, current } = setup(14);
    fireEvent.click(item('rocket'));
    fireEvent.click(within(dialog()!).getByRole('button', { name: G.no }));
    expect(dialog()).toBeNull();
    expect(onBuy).not.toHaveBeenCalled();
    expect(current().balance).toBe(14);
  });

  it('with 14 stars blue-green is a grey silhouette with "noch 6 Sterne" and opens nothing on click', () => {
    const { onBuy, onEquip } = setup(14);
    const teal = item('teal');
    expect(teal.getAttribute('data-locked')).toBe('true');
    expect(teal.getAttribute('aria-disabled')).toBe('true');
    expect(within(teal).getByText(G.stillNeeded(6))).toBeTruthy();
    expect(within(teal).getByText(G.price(20))).toBeTruthy();
    expect(teal.querySelector('.garage-silhouette')).not.toBeNull();
    fireEvent.click(teal);
    expect(dialog()).toBeNull();
    expect(onBuy).not.toHaveBeenCalled();
    expect(onEquip).not.toHaveBeenCalled();
  });

  it('typing 7 and Enter opens the question; Enter answers "Ja"', () => {
    const { onBuy, current } = setup(14);
    const preview = screen.getByTestId('garage-preview');
    press('7');
    expect(item('rocket').getAttribute('data-selected')).toBe('true');
    expect(preview.getAttribute('data-look')).toBe(lookKey({ ...STANDARD_LOOK, flag: 'rocket' }));
    press('Enter');
    expect(within(dialog()!).getByText(G.buyQuestion(10))).toBeTruthy();
    press('Enter');
    expect(onBuy).toHaveBeenCalledWith('rocket');
    expect(dialog()).toBeNull();
    expect(current().look.flag).toBe('rocket');
    expect(screen.getByTestId('garage').getAttribute('data-look')).toBe(lookKey({ ...STANDARD_LOOK, flag: 'rocket' }));
  });

  it('Escape answers "Nein"; a second Escape goes back; digits do nothing while the question shows', () => {
    const { onBuy, onBack } = setup(14);
    press('7');
    press('Enter');
    press('1');
    press('6');
    expect(item('rocket').getAttribute('data-selected')).toBe('false');
    press('Escape');
    expect(dialog()).toBeNull();
    expect(onBack).not.toHaveBeenCalled();
    expect(onBuy).not.toHaveBeenCalled();
    press('Escape');
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('Enter on an item the balance does not reach does nothing, and two digits select items above 9', () => {
    const { onBuy } = setup(14);
    press('1');
    press('3');
    expect(item('bubbles').getAttribute('data-selected')).toBe('true');
    press('Enter');
    expect(dialog()).toBeNull();
    expect(onBuy).not.toHaveBeenCalled();
    press('1');
    press('8');
    expect(screen.queryAllByTestId(/garage-item-/).filter((b) => b.getAttribute('data-selected') === 'true')).toEqual([]);
  });

  it('an owned item equips on click and with its number and Enter, with no question', () => {
    const { onEquip, current } = setup(0, { owned: ['rocket'] });
    fireEvent.click(item('rocket'));
    expect(dialog()).toBeNull();
    expect(current().look.flag).toBe('rocket');
    press('6');
    press('Enter');
    expect(dialog()).toBeNull();
    expect(onEquip).toHaveBeenLastCalledWith('star');
    expect(current().look.flag).toBe('star');
  });

  it('only owned items that are not basic have "Zurückgeben"; it asks and refunds the full price', () => {
    const { onReturn, current } = setup(2, { owned: ['crown'], look: { ...STANDARD_LOOK, hat: 'crown' } });
    expect(screen.getAllByRole('button', { name: G.returnItem })).toHaveLength(1);
    expect(screen.getByTestId('garage-return-crown')).toBeTruthy();
    fireEvent.click(screen.getByTestId('garage-return-crown'));
    expect(within(dialog()!).getByText(G.returnQuestion(40))).toBeTruthy();
    press('Enter');
    expect(onReturn).toHaveBeenCalledWith('crown');
    expect(current()).toMatchObject({ balance: 42, owned: [], look: STANDARD_LOOK });
    expect(screen.queryAllByRole('button', { name: G.returnItem })).toHaveLength(0);
  });

  it('the dialog buttons and the return button have their large-target classes', () => {
    setup(14, { owned: ['sky'] });
    expect(screen.getByTestId('garage-return-sky').classList.contains('garage-return')).toBe(true);
    fireEvent.click(item('rocket'));
    for (const name of [G.yes, G.no]) expect(within(dialog()!).getByRole('button', { name }).classList.contains('dialog-button')).toBe(true);
  });

  it('Escape and "Zurück" call onBack', () => {
    const { onBack } = setup(0);
    press('Escape');
    expect(onBack).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: G.back }));
    expect(onBack).toHaveBeenCalledTimes(2);
  });

  it('shows the balance, and every item button has the large-target class', () => {
    setup(23);
    expect(screen.getByTestId('star-total').textContent).toContain('23');
    for (const it of GARAGE_ITEMS) expect(item(it.id).classList.contains('garage-item')).toBe(true);
  });
});

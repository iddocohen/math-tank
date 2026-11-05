import { describe, expect, it } from 'vitest';
import { GARAGE_ITEMS, GARAGE_KINDS, STANDARD_LOOK, isBasic, itemById, itemNumber, type ItemId } from './items';
import {
  addStars,
  buy,
  canBuy,
  emptyGarage,
  equip,
  garageSchema,
  isOwned,
  lookKey,
  migrateGarage,
  newlyAffordable,
  newlyDestroyed,
  parseGarage,
  resetStars,
  returnItem,
  starsNeeded,
  type Garage,
} from './garage';

/** The data-model.md price list (amendment 19), in garage order. */
const PRICE_LIST: Array<[ItemId, number]> = [
  ['blue', 0],
  ['sky', 10],
  ['teal', 20],
  ['turquoise', 20],
  ['navyStripes', 40],
  ['star', 0],
  ['rocket', 10],
  ['football', 10],
  ['dragon', 20],
  ['lightning', 20],
  ['plain', 0],
  ['sparkles', 10],
  ['bubbles', 20],
  ['rainbow', 40],
  ['none', 0],
  ['helmet', 10],
  ['crown', 40],
];

function garage(over: Partial<Garage> = {}): Garage {
  return { ...emptyGarage(), ...over, look: { ...STANDARD_LOOK, ...over.look } };
}

describe('garage items and prices (amendment 19, FR-130)', () => {
  it('lists the 17 items in the price-list order with their prices', () => {
    expect(GARAGE_ITEMS.map((i) => [i.id, i.price])).toEqual(PRICE_LIST);
    expect(new Set(GARAGE_ITEMS.map((i) => i.id)).size).toBe(17);
    expect([...new Set(GARAGE_ITEMS.map((i) => i.kind))]).toEqual(GARAGE_KINDS);
  });

  it('sorts the items of each kind by price, the basic item first at price 0', () => {
    for (const kind of GARAGE_KINDS) {
      const prices = GARAGE_ITEMS.filter((i) => i.kind === kind).map((i) => i.price);
      expect(prices, kind).toEqual([...prices].sort((a, b) => a - b));
      expect(GARAGE_ITEMS.find((i) => i.kind === kind)!.id).toBe(STANDARD_LOOK[kind]);
    }
  });

  it('makes the crown, the rainbow trail and dark blue with stripes the special items at 40', () => {
    expect(GARAGE_ITEMS.filter((i) => i.price === 40).map((i) => i.id).sort()).toEqual(['crown', 'navyStripes', 'rainbow']);
  });

  it('marks only the four basic items as basic', () => {
    expect(GARAGE_ITEMS.filter((i) => isBasic(i.id)).map((i) => i.id)).toEqual(['blue', 'star', 'plain', 'none']);
  });

  it('numbers the items 1 to 17 in garage order', () => {
    expect(itemNumber('blue')).toBe(1);
    expect(itemNumber('rocket')).toBe(7);
    expect(itemNumber('football')).toBe(8);
    expect(itemNumber('crown')).toBe(17);
  });
});

describe('earning stars (FR-089)', () => {
  it('starts empty: version 2, no stars, nothing bought, the basic look', () => {
    expect(emptyGarage()).toEqual({ version: 2, balance: 0, totalEarned: 0, owned: [], look: STANDARD_LOOK });
  });

  it('adds stars to the balance and to the total ever earned', () => {
    expect(addStars(garage({ balance: 4, totalEarned: 30 }), 3)).toMatchObject({ balance: 7, totalEarned: 33 });
  });

  it('ignores 0, negative and fractional amounts', () => {
    const g = garage({ balance: 4, totalEarned: 4 });
    for (const n of [0, -2, 1.5, Number.NaN]) expect(addStars(g, n), String(n)).toBe(g);
  });

  it('newlyDestroyed counts only rises of the destroyed-enemy counter', () => {
    expect(newlyDestroyed(0, 3)).toBe(3);
    expect(newlyDestroyed(3, 3)).toBe(0);
    expect(newlyDestroyed(3, 0)).toBe(0);
  });
});

describe('buying (FR-130)', () => {
  it('owns the basic items from the start', () => {
    for (const id of ['blue', 'star', 'plain', 'none'] as const) expect(isOwned(emptyGarage(), id)).toBe(true);
    expect(isOwned(emptyGarage(), 'rocket')).toBe(false);
  });

  it('deducts the price, adds the item in garage order and equips it', () => {
    const g = buy(garage({ balance: 14, totalEarned: 50, owned: ['crown'] }), 'rocket');
    expect(g).toEqual({ version: 2, balance: 4, totalEarned: 50, owned: ['rocket', 'crown'], look: { ...STANDARD_LOOK, flag: 'rocket' } });
  });

  it('allows buying with exactly the price', () => {
    expect(canBuy(garage({ balance: 40 }), 'crown')).toBe(true);
    expect(buy(garage({ balance: 40 }), 'crown').balance).toBe(0);
  });

  it('refuses when the balance is too low, the item is owned or basic, or the id is unknown', () => {
    const cases: Array<[Garage, string]> = [
      [garage({ balance: 9 }), 'rocket'],
      [garage({ balance: 39 }), 'crown'],
      [garage({ balance: 30, owned: ['rocket'] }), 'rocket'],
      [garage({ balance: 30 }), 'star'],
      [garage({ balance: 30 }), 'tank'],
    ];
    for (const [g, id] of cases) {
      expect(canBuy(g, id), id).toBe(false);
      expect(buy(g, id), id).toBe(g);
    }
  });

  it('starsNeeded is the price minus the balance, at least 0', () => {
    expect(starsNeeded(14, 'teal')).toBe(6);
    expect(starsNeeded(14, 'crown')).toBe(26);
    expect(starsNeeded(14, 'sky')).toBe(0);
  });
});

describe('equipping (FR-091)', () => {
  it('equips owned items at no cost and swaps freely', () => {
    const g = garage({ balance: 3, owned: ['rocket'] });
    const rocket = equip(g, 'rocket');
    expect(rocket.look.flag).toBe('rocket');
    expect(rocket.balance).toBe(3);
    expect(equip(rocket, 'star').look.flag).toBe('star');
  });

  it('ignores items not owned and unknown ids', () => {
    const g = garage({ balance: 100 });
    expect(equip(g, 'crown')).toBe(g);
    expect(equip(g, 'tank')).toBe(g);
  });
});

describe('returning (FR-131)', () => {
  it('refunds the full price and equips the basic item when the item was equipped', () => {
    const g = garage({ balance: 2, totalEarned: 42, owned: ['crown'], look: { ...STANDARD_LOOK, hat: 'crown' } });
    expect(returnItem(g, 'crown')).toEqual({ version: 2, balance: 42, totalEarned: 42, owned: [], look: STANDARD_LOOK });
  });

  it('keeps the look when the returned item was not equipped', () => {
    const g = garage({ balance: 0, owned: ['rocket', 'football'], look: { ...STANDARD_LOOK, flag: 'football' } });
    const r = returnItem(g, 'rocket');
    expect(r.balance).toBe(10);
    expect(r.owned).toEqual(['football']);
    expect(r.look.flag).toBe('football');
  });

  it('ignores basic items, items not owned and unknown ids', () => {
    const g = garage({ balance: 5, owned: ['rocket'] });
    for (const id of ['star', 'crown', 'tank']) expect(returnItem(g, id), id).toBe(g);
  });

  it('buying and returning gives the same balance and owned items back', () => {
    const g = garage({ balance: 25, totalEarned: 25, owned: ['sky'] });
    const back = returnItem(buy(g, 'dragon'), 'dragon');
    expect(back.balance).toBe(g.balance);
    expect(back.owned).toEqual(g.owned);
    expect(back.totalEarned).toBe(25);
  });
});

describe('the end screen item (FR-094)', () => {
  it('names nothing when no price lies between the two balances', () => {
    expect(newlyAffordable(10, 10, [])).toBeNull();
    expect(newlyAffordable(0, 9, [])).toBeNull();
  });

  it('names the most expensive item whose price the round crossed', () => {
    expect(newlyAffordable(38, 41, [])?.id).toBe('navyStripes');
    expect(newlyAffordable(5, 25, [])?.id).toBe('teal');
  });

  it('takes the first item in garage order of equal prices, and skips owned items', () => {
    expect(newlyAffordable(9, 10, [])?.id).toBe('sky');
    expect(newlyAffordable(9, 10, ['sky'])?.id).toBe('rocket');
    expect(newlyAffordable(39, 40, ['navyStripes', 'rainbow'])?.id).toBe('crown');
    expect(newlyAffordable(39, 40, ['navyStripes', 'rainbow', 'crown'])).toBeNull();
  });
});

describe('resetting the stars (FR-096)', () => {
  it('sets the balance to 0, keeps only the basic items and the basic look, and keeps the total ever earned', () => {
    const g = garage({ balance: 12, totalEarned: 90, owned: ['rocket', 'crown'], look: { ...STANDARD_LOOK, hat: 'crown' } });
    expect(resetStars(g)).toEqual({ version: 2, balance: 0, totalEarned: 90, owned: [], look: STANDARD_LOOK });
  });
});

describe('loading and migration (FR-097, FR-133)', () => {
  it('migrates version 0 through version 1 to version 2', () => {
    expect(parseGarage({ stars: 15, look: { flag: 'rocket' } })).toEqual({
      version: 2,
      balance: 5,
      totalEarned: 15,
      owned: ['rocket'],
      look: { ...STANDARD_LOOK, flag: 'rocket' },
    });
  });

  it('keeps the items a version 1 player had unlocked as owned and computes the balance', () => {
    const g = parseGarage({ version: 1, stars: 45, look: { color: 'sky', flag: 'rocket', trail: 'sparkles', hat: 'crown' } });
    expect(g).toEqual({
      version: 2,
      balance: 0,
      totalEarned: 45,
      owned: ['sky', 'rocket', 'sparkles', 'crown'],
      look: { color: 'sky', flag: 'rocket', trail: 'sparkles', hat: 'crown' },
    });
  });

  it('gives a version 1 player below 10 stars the whole total as balance', () => {
    expect(parseGarage({ version: 1, stars: 9, look: STANDARD_LOOK })).toMatchObject({ balance: 9, totalEarned: 9, owned: [] });
  });

  it('gives a version 1 player with 130 stars all 13 items and balance 0', () => {
    const g = parseGarage({ version: 1, stars: 130, look: STANDARD_LOOK })!;
    expect(g.owned).toHaveLength(13);
    expect(g.balance).toBe(0);
    expect(g.totalEarned).toBe(130);
  });

  it('keeps the rest when the total is above the prices: 300 stars give balance 30', () => {
    expect(parseGarage({ version: 1, stars: 300, look: STANDARD_LOOK })?.balance).toBe(30);
  });

  it('rejects an invalid version 1 star total', () => {
    for (const stars of [-1, 2.5, '9', null]) expect(parseGarage({ version: 1, stars, look: STANDARD_LOOK }), String(stars)).toBeNull();
  });

  it('migrateGarage leaves version 2 and unknown values to the schema', () => {
    const v2 = { ...emptyGarage(), balance: 3 };
    expect(migrateGarage(v2)).toBe(v2);
    expect(migrateGarage('x')).toBe('x');
    expect(garageSchema.safeParse({ version: 2, balance: -1, totalEarned: 0, owned: [], look: STANDARD_LOOK }).success).toBe(false);
    expect(parseGarage({ version: 3, balance: 0 })).toBeNull();
  });

  it('drops unknown, basic and duplicate owned ids, puts them in garage order and replaces look parts not owned', () => {
    const g = parseGarage({
      version: 2,
      balance: 5,
      totalEarned: 70,
      owned: ['crown', 'tank', 'star', 'rocket', 'crown'],
      look: { color: 'navyStripes', flag: 'rocket', trail: 'glitter', hat: 'crown' },
    });
    expect(g).toEqual({ version: 2, balance: 5, totalEarned: 70, owned: ['rocket', 'crown'], look: { color: 'blue', flag: 'rocket', trail: 'plain', hat: 'crown' } });
  });

  it('lookKey lists the four parts', () => {
    expect(lookKey({ color: 'sky', flag: 'rocket', trail: 'plain', hat: 'none' })).toBe('color:sky flag:rocket trail:plain hat:none');
    expect(itemById('crown')?.kind).toBe('hat');
  });
});

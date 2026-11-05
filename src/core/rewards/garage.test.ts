import { describe, expect, it } from 'vitest';
import { GARAGE_ITEMS, STANDARD_LOOK, UNLOCK_ORDER, itemById } from './items';
import {
  addStars,
  emptyGarage,
  equip,
  garageSchema,
  isUnlocked,
  lookKey,
  migrateGarage,
  newlyDestroyed,
  resetStars,
  sanitizeLook,
  starsNeeded,
  unlockedBetween,
} from './garage';

describe('garage items (amendment 11, FR-090)', () => {
  it('has 17 items: 5 colors, 5 flags, 4 trails and 3 hats, the standard item first in each kind, unique ids', () => {
    expect(GARAGE_ITEMS).toHaveLength(17);
    const kinds = GARAGE_ITEMS.map((i) => i.kind);
    expect(kinds.filter((k) => k === 'color')).toHaveLength(5);
    expect(kinds.filter((k) => k === 'flag')).toHaveLength(5);
    expect(kinds.filter((k) => k === 'trail')).toHaveLength(4);
    expect(kinds.filter((k) => k === 'hat')).toHaveLength(3);
    // Grouped by kind in garage order.
    expect([...new Set(kinds)]).toEqual(['color', 'flag', 'trail', 'hat']);
    for (const kind of ['color', 'flag', 'trail', 'hat'] as const) {
      const first = GARAGE_ITEMS.find((i) => i.kind === kind)!;
      expect(first.id).toBe(STANDARD_LOOK[kind]);
      expect(first.stars).toBe(0);
    }
    expect(new Set(GARAGE_ITEMS.map((i) => i.id)).size).toBe(17);
  });

  it('unlocks 13 items in a fixed order, every 10 stars', () => {
    expect(UNLOCK_ORDER).toEqual(['rocket', 'sky', 'sparkles', 'crown', 'dragon', 'teal', 'rainbow', 'helmet', 'football', 'turquoise', 'bubbles', 'lightning', 'navyStripes']);
    UNLOCK_ORDER.forEach((id, i) => expect(itemById(id)?.stars, id).toBe(10 * (i + 1)));
    const standard = GARAGE_ITEMS.filter((i) => !UNLOCK_ORDER.includes(i.id));
    expect(standard.map((i) => i.id)).toEqual(['blue', 'star', 'plain', 'none']);
    expect(itemById('nope')).toBeUndefined();
  });
});

describe('stars (FR-089)', () => {
  it('newlyDestroyed counts only increases of the destroyed-enemy counter', () => {
    expect(newlyDestroyed(0, 3)).toBe(3);
    expect(newlyDestroyed(3, 3)).toBe(0);
    // A new round starts at 0: no stars, and nothing is taken away.
    expect(newlyDestroyed(3, 0)).toBe(0);
  });

  it('addStars from 9 by 1 unlocks the rocket flag', () => {
    const r = addStars({ ...emptyGarage(), stars: 9 }, 1);
    expect(r.garage.stars).toBe(10);
    expect(r.unlocked.map((i) => i.id)).toEqual(['rocket']);
  });

  it('addStars from 15 by 30 unlocks three items in unlock order', () => {
    const r = addStars({ ...emptyGarage(), stars: 15 }, 30);
    expect(r.garage.stars).toBe(45);
    expect(r.unlocked.map((i) => i.id)).toEqual(['sky', 'sparkles', 'crown']);
  });

  it('addStars by 0 or a negative number unlocks nothing and never lowers the total', () => {
    const g = { ...emptyGarage(), stars: 12 };
    expect(addStars(g, 0)).toEqual({ garage: g, unlocked: [] });
    expect(addStars(g, -5).garage.stars).toBe(12);
  });

  it('addStars keeps the chosen look and does not change its input', () => {
    const g = equip({ ...emptyGarage(), stars: 10 }, 'rocket');
    const r = addStars(g, 3);
    expect(r.garage.look.flag).toBe('rocket');
    expect(g.stars).toBe(10);
  });

  it('unlockedBetween lists all 13 items from 0 to 130 and none after', () => {
    expect(unlockedBetween(0, 130)).toHaveLength(13);
    expect(unlockedBetween(130, 200)).toEqual([]);
    expect(unlockedBetween(9, 10).map((i) => i.id)).toEqual(['rocket']);
    expect(unlockedBetween(10, 10)).toEqual([]);
  });

  it('isUnlocked and starsNeeded follow the thresholds; standard items are always unlocked', () => {
    expect(isUnlocked(0, 'blue')).toBe(true);
    expect(isUnlocked(9, 'rocket')).toBe(false);
    expect(isUnlocked(10, 'rocket')).toBe(true);
    expect(starsNeeded(14, 'sky')).toBe(6);
    expect(starsNeeded(30, 'sky')).toBe(0);
  });
});

describe('the chosen look (FR-093, FR-096, FR-097)', () => {
  it('equip chooses an unlocked item for its kind', () => {
    const g = equip({ ...emptyGarage(), stars: 25 }, 'sky');
    expect(g.look).toEqual({ ...STANDARD_LOOK, color: 'sky' });
    expect(equip(g, 'blue').look.color).toBe('blue');
  });

  it('equip ignores a locked or unknown item', () => {
    const g = { ...emptyGarage(), stars: 25 };
    expect(equip(g, 'crown')).toEqual(g);
    expect(equip(g, 'nope')).toEqual(g);
  });

  it('resetStars gives 0 stars and the standard look', () => {
    expect(resetStars()).toEqual({ version: 1, stars: 0, look: STANDARD_LOOK });
    expect(emptyGarage()).toEqual(resetStars());
  });

  it('sanitizeLook replaces locked and unknown parts with the standard item of their kind', () => {
    const look = sanitizeLook({ color: 'sky', flag: 'lightning', trail: 'glitter', hat: 'crown' } as never, 45);
    expect(look).toEqual({ color: 'sky', flag: 'star', trail: 'plain', hat: 'crown' });
  });

  it('lookKey names every part', () => {
    expect(lookKey({ color: 'sky', flag: 'rocket', trail: 'plain', hat: 'none' })).toBe('color:sky flag:rocket trail:plain hat:none');
  });
});

describe('garage schema and migration (FR-097)', () => {
  it('accepts a version 1 garage and rejects negative or fractional stars', () => {
    expect(garageSchema.safeParse(emptyGarage()).success).toBe(true);
    expect(garageSchema.safeParse({ ...emptyGarage(), stars: -1 }).success).toBe(false);
    expect(garageSchema.safeParse({ ...emptyGarage(), stars: 1.5 }).success).toBe(false);
  });

  it('migrates data without a version to version 1 with missing look parts from the standard look', () => {
    expect(migrateGarage({ stars: 12, look: { flag: 'rocket' } })).toEqual({ version: 1, stars: 12, look: { ...STANDARD_LOOK, flag: 'rocket' } });
    expect(migrateGarage({ stars: 'x' })).toEqual({ version: 1, stars: 0, look: STANDARD_LOOK });
  });

  it('leaves version 1 data and non-objects unchanged', () => {
    const g = { ...emptyGarage(), stars: 3 };
    expect(migrateGarage(g)).toBe(g);
    expect(migrateGarage('text')).toBe('text');
  });
});

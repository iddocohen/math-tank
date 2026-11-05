/**
 * The tank garage items (amendment 11, FR-090, data-model.md "Garage"). Pure data, no React or Phaser.
 *
 * GARAGE_ITEMS is the garage order: colors, flags, trails, hats, the standard item first in each kind; the garage
 * numbers them 1 to 17 in this order. UNLOCK_ORDER is the fixed unlock order; item i needs 10 * (i + 1) stars.
 * There is no chance and no shop: the star total alone decides what is unlocked.
 */
export type GarageKind = 'color' | 'flag' | 'trail' | 'hat';
export type ColorId = 'blue' | 'sky' | 'teal' | 'turquoise' | 'navyStripes';
export type FlagId = 'star' | 'rocket' | 'dragon' | 'football' | 'lightning';
export type TrailId = 'plain' | 'sparkles' | 'rainbow' | 'bubbles';
export type HatId = 'none' | 'crown' | 'helmet';
export type ItemId = ColorId | FlagId | TrailId | HatId;

export interface Look {
  color: ColorId;
  flag: FlagId;
  trail: TrailId;
  hat: HatId;
}

export interface GarageItem {
  id: ItemId;
  kind: GarageKind;
  /** Stars needed; 0 for the standard item of each kind. */
  stars: number;
}

export const STARS_PER_ITEM = 10;

export const STANDARD_LOOK: Readonly<Look> = Object.freeze({ color: 'blue', flag: 'star', trail: 'plain', hat: 'none' });

export const UNLOCK_ORDER: readonly ItemId[] = [
  'rocket',
  'sky',
  'sparkles',
  'crown',
  'dragon',
  'teal',
  'rainbow',
  'helmet',
  'football',
  'turquoise',
  'bubbles',
  'lightning',
  'navyStripes',
];

const BY_KIND: Record<GarageKind, readonly ItemId[]> = {
  color: ['blue', 'sky', 'teal', 'turquoise', 'navyStripes'],
  flag: ['star', 'rocket', 'dragon', 'football', 'lightning'],
  trail: ['plain', 'sparkles', 'rainbow', 'bubbles'],
  hat: ['none', 'crown', 'helmet'],
};

export const GARAGE_KINDS: readonly GarageKind[] = ['color', 'flag', 'trail', 'hat'];

function starsFor(id: ItemId): number {
  const i = UNLOCK_ORDER.indexOf(id);
  return i < 0 ? 0 : STARS_PER_ITEM * (i + 1);
}

export const GARAGE_ITEMS: readonly GarageItem[] = GARAGE_KINDS.flatMap((kind) => BY_KIND[kind].map((id) => ({ id, kind, stars: starsFor(id) })));

export function itemById(id: string): GarageItem | undefined {
  return GARAGE_ITEMS.find((i) => i.id === id);
}

/** The item's number in the garage, 1 to 17. */
export function itemNumber(id: ItemId): number {
  return GARAGE_ITEMS.findIndex((i) => i.id === id) + 1;
}

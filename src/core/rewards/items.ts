/**
 * The tank garage items (amendment 11, FR-090, data-model.md "Garage"). Pure data, no React or Phaser.
 *
 * GARAGE_ITEMS is the garage order: colors, flags, trails, hats, sorted by price within each kind, the basic item first;
 * the garage numbers them 1 to 17 in this order. Since amendment 19 the child buys items with stars (a star shop with
 * fixed prices, no chance and no money); garage.ts holds the rules.
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
  /** Price in stars (amendment 19, FR-130): 0 for the basic item of each kind, then 10, 20 or 40. */
  price: number;
}

export const STANDARD_LOOK: Readonly<Look> = Object.freeze({ color: 'blue', flag: 'star', trail: 'plain', hat: 'none' });

/**
 * The price list of data-model.md "Garage": per kind, sorted by price; items of equal price keep their amendment 11
 * order. Simple items cost 10, better items 20, special items 40 (the crown, the rainbow trail, dark blue with stripes).
 */
const BY_KIND: Record<GarageKind, ReadonlyArray<readonly [ItemId, number]>> = {
  color: [['blue', 0], ['sky', 10], ['teal', 20], ['turquoise', 20], ['navyStripes', 40]],
  flag: [['star', 0], ['rocket', 10], ['football', 10], ['dragon', 20], ['lightning', 20]],
  trail: [['plain', 0], ['sparkles', 10], ['bubbles', 20], ['rainbow', 40]],
  hat: [['none', 0], ['helmet', 10], ['crown', 40]],
};

export const GARAGE_KINDS: readonly GarageKind[] = ['color', 'flag', 'trail', 'hat'];

export const GARAGE_ITEMS: readonly GarageItem[] = GARAGE_KINDS.flatMap((kind) => BY_KIND[kind].map(([id, price]) => ({ id, kind, price })));

export function itemById(id: string): GarageItem | undefined {
  return GARAGE_ITEMS.find((i) => i.id === id);
}

/** The item's number in the garage, 1 to 17. */
export function itemNumber(id: ItemId): number {
  return GARAGE_ITEMS.findIndex((i) => i.id === id) + 1;
}

/** A basic item: owned from the start, free, never returned (FR-130). */
export function isBasic(id: ItemId): boolean {
  return itemById(id)?.price === 0;
}

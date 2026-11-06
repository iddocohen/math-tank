/**
 * The star shop of the tank garage (amendment 11, changed by amendment 19; FR-089, FR-091 to FR-097, FR-130 to
 * FR-133; data-model.md "Garage"). Pure functions; the app stores the result under `mathtanks.garage.v1`
 * (src/core/storage/storage.ts).
 *
 * Every destroyed enemy that counts gives 1 star; decoys never count, because the app feeds `newlyDestroyed` with
 * `RoundState.enemiesDestroyed`, which counts enemies only (FR-083). Stars go to the balance and to the total ever
 * earned. The child spends the balance on items with fixed prices, can give an item back for its full price, and
 * equips owned items freely. Nothing uses chance (FR-087).
 */
import { z } from 'zod';
import { isRecord } from '../util';
import { GARAGE_ITEMS, STANDARD_LOOK, isBasic, itemById, type GarageItem, type ItemId, type Look } from './items';

const lookSchema = z.object({ color: z.string(), flag: z.string(), trail: z.string(), hat: z.string() });

export const garageSchema = z.object({
  version: z.literal(2),
  balance: z.number().int().min(0),
  totalEarned: z.number().int().min(0),
  owned: z.array(z.string()),
  look: lookSchema,
});

/** The amendment 11 garage (version 1), read only to migrate it. */
const garageV1Schema = z.object({ version: z.literal(1), stars: z.number().int().min(0), look: lookSchema });

export interface Garage {
  version: 2;
  /** Stars the child can spend. */
  balance: number;
  /** Every star ever earned; never goes down (FR-132). */
  totalEarned: number;
  /** Bought items: no basic item, no duplicates, in garage order. */
  owned: ItemId[];
  /** The equipped look; every part is owned or basic. */
  look: Look;
}

export function emptyGarage(): Garage {
  return { version: 2, balance: 0, totalEarned: 0, owned: [], look: { ...STANDARD_LOOK } };
}

/** Stars earned by a change of the destroyed-enemy counter; a new round starting at 0 gives none. */
export function newlyDestroyed(seen: number, current: number): number {
  return current > seen ? current - seen : 0;
}

/** Adds `n` stars to the balance and the total ever earned; anything but a whole number above 0 changes nothing. */
export function addStars(garage: Garage, n: number): Garage {
  if (!Number.isInteger(n) || n <= 0) return garage;
  return { ...garage, owned: [...garage.owned], look: { ...garage.look }, balance: garage.balance + n, totalEarned: garage.totalEarned + n };
}

export function isOwned(garage: Garage, id: ItemId): boolean {
  return isBasic(id) || garage.owned.includes(id);
}

/** Stars still needed for an item not owned ("noch N Sterne"); 0 when the balance reaches its price. */
export function starsNeeded(balance: number, id: ItemId): number {
  const item = itemById(id);
  return item ? Math.max(0, item.price - balance) : 0;
}

export function canBuy(garage: Garage, id: string): boolean {
  const item = itemById(id);
  return item !== undefined && !isOwned(garage, item.id) && item.price <= garage.balance;
}

/** Owned ids in garage order. */
function inGarageOrder(ids: Iterable<string>): ItemId[] {
  const set = new Set(ids);
  return GARAGE_ITEMS.filter((i) => set.has(i.id) && i.price > 0).map((i) => i.id);
}

/** Takes the price from the balance, adds the item and equips it; unchanged when `canBuy` is false (FR-130). */
export function buy(garage: Garage, id: string): Garage {
  if (!canBuy(garage, id)) return garage;
  const item = itemById(id)!;
  return {
    ...garage,
    balance: garage.balance - item.price,
    owned: inGarageOrder([...garage.owned, item.id]),
    look: { ...garage.look, [item.kind]: item.id },
  };
}

/**
 * Gives an owned item that is not basic back for its full price; when it was equipped, the basic item of its kind is
 * equipped. The total ever earned does not change (FR-131).
 */
export function returnItem(garage: Garage, id: string): Garage {
  const item = itemById(id);
  if (!item || item.price === 0 || !garage.owned.includes(item.id)) return garage;
  const equipped = garage.look[item.kind] === item.id;
  return {
    ...garage,
    balance: garage.balance + item.price,
    owned: garage.owned.filter((o) => o !== item.id),
    look: equipped ? { ...garage.look, [item.kind]: STANDARD_LOOK[item.kind] } : { ...garage.look },
  };
}

/** Equips an owned item for its kind; an item not owned or unknown leaves the garage unchanged. */
export function equip(garage: Garage, id: string): Garage {
  const item = itemById(id);
  if (!item || !isOwned(garage, item.id)) return garage;
  return { ...garage, look: { ...garage.look, [item.kind]: item.id } };
}

/**
 * The item for "Genug Sterne für: X" (FR-094): not owned, with a price the balance passed during the round
 * (`before < price <= after`); the most expensive, of equal prices the first in garage order. Null when there is none.
 */
export function newlyAffordable(before: number, after: number, owned: readonly ItemId[]): GarageItem | null {
  let best: GarageItem | null = null;
  for (const item of GARAGE_ITEMS) {
    if (item.price === 0 || owned.includes(item.id) || item.price <= before || item.price > after) continue;
    if (!best || item.price > best.price) best = item;
  }
  return best;
}

/** "Sterne zurücksetzen" (FR-096): balance 0, only the basic items, the basic look; the total ever earned stays. */
export function resetStars(garage: Garage): Garage {
  return { ...emptyGarage(), totalEarned: garage.totalEarned };
}

/** Every look part that is unknown or not owned becomes the basic item of its kind (FR-097). */
function cleanLook(look: Record<keyof Look, string>, owned: readonly ItemId[]): Look {
  const pick = <K extends keyof Look>(kind: K): Look[K] => {
    const item = itemById(look[kind]);
    return item && item.kind === kind && (item.price === 0 || owned.includes(item.id)) ? (item.id as Look[K]) : STANDARD_LOOK[kind];
  };
  return { color: pick('color'), flag: pick('flag'), trail: pick('trail'), hat: pick('hat') };
}

/** `color:<id> flag:<id> trail:<id> hat:<id>`, the canvas attribute `data-player-look` (D4). */
export function lookKey(look: Look): string {
  return `color:${look.color} flag:${look.flag} trail:${look.trail} hat:${look.hat}`;
}

/** The amendment 11 unlock order: item i was unlocked at 10 * (i + 1) stars. Used only to migrate version 1. */
const V1_UNLOCK_ORDER: readonly ItemId[] = [
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

/**
 * Version 0 (no `version` field) becomes version 1: whole-number stars of at least 0 (anything else gives 0) and a full
 * look, missing parts from the standard look. Version 1 becomes version 2 (FR-133): the items the star total had
 * unlocked become owned, the balance is the total minus their prices (at least 0), and the total ever earned is the
 * total. An invalid version 1, version 2 and anything else are returned unchanged for the schema to check.
 */
export function migrateGarage(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  let value: Record<string, unknown> = raw;
  if (value.version === undefined) {
    const stars = Number.isInteger(value.stars) && (value.stars as number) >= 0 ? (value.stars as number) : 0;
    const look = isRecord(value.look) ? value.look : {};
    value = { version: 1, stars, look: { ...STANDARD_LOOK, ...look } };
  }
  if (value.version !== 1) return value;
  const v1 = garageV1Schema.safeParse(value);
  if (!v1.success) return value;
  const { stars, look } = v1.data;
  const owned = V1_UNLOCK_ORDER.filter((_, i) => stars >= 10 * (i + 1));
  const spent = owned.reduce((sum, id) => sum + itemById(id)!.price, 0);
  return { version: 2, balance: Math.max(0, stars - spent), totalEarned: stars, owned: inGarageOrder(owned), look };
}

/** Migration, schema check, then the owned items and the look are cleaned; null when the value is not a valid garage. */
export function parseGarage(raw: unknown): Garage | null {
  const parsed = garageSchema.safeParse(migrateGarage(raw));
  if (!parsed.success) return null;
  const owned = inGarageOrder(parsed.data.owned);
  return {
    version: 2,
    balance: parsed.data.balance,
    totalEarned: parsed.data.totalEarned,
    owned,
    look: cleanLook(parsed.data.look as Record<keyof Look, string>, owned),
  };
}

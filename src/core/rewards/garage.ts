/**
 * Stars, unlocks and the chosen look (amendment 11, FR-089 to FR-097, data-model.md "Garage"). Pure functions; the
 * app stores the result under `mathtanks.garage.v1` (src/core/storage/storage.ts).
 *
 * Every destroyed enemy gives 1 star; decoys never count, because the app feeds `newlyDestroyed` with
 * `RoundState.enemiesDestroyed`, which counts enemies only (FR-083). Stars only go up; `resetStars` is the only way
 * down. Unlocked items are not stored: they follow from the star total, so they cannot disagree with it.
 */
import { z } from 'zod';
import { STANDARD_LOOK, UNLOCK_ORDER, itemById, type GarageItem, type ItemId, type Look } from './items';

export const garageSchema = z.object({
  version: z.literal(1),
  stars: z.number().int().min(0),
  look: z.object({ color: z.string(), flag: z.string(), trail: z.string(), hat: z.string() }),
});

export interface Garage {
  version: 1;
  stars: number;
  look: Look;
}

export function emptyGarage(): Garage {
  return { version: 1, stars: 0, look: { ...STANDARD_LOOK } };
}

/** Same as emptyGarage: 0 stars, every item locked, the standard look ("Sterne zurücksetzen", FR-096). */
export function resetStars(): Garage {
  return emptyGarage();
}

/** Stars earned by a change of the destroyed-enemy counter; a new round starting at 0 gives none. */
export function newlyDestroyed(seen: number, current: number): number {
  return current > seen ? current - seen : 0;
}

/** Items whose threshold lies in (from, to], in unlock order. */
export function unlockedBetween(from: number, to: number): GarageItem[] {
  return UNLOCK_ORDER.map((id) => itemById(id)!).filter((i) => i.stars > from && i.stars <= to);
}

export function addStars(garage: Garage, n: number): { garage: Garage; unlocked: GarageItem[] } {
  if (!(n > 0)) return { garage, unlocked: [] };
  const stars = garage.stars + Math.floor(n);
  return { garage: { ...garage, look: { ...garage.look }, stars }, unlocked: unlockedBetween(garage.stars, stars) };
}

export function isUnlocked(stars: number, id: ItemId): boolean {
  const item = itemById(id);
  return item !== undefined && stars >= item.stars;
}

/** Stars still needed for an item; 0 when it is unlocked ("noch N Sterne"). */
export function starsNeeded(stars: number, id: ItemId): number {
  const item = itemById(id);
  return item ? Math.max(0, item.stars - stars) : 0;
}

/** Chooses an unlocked item for its kind; a locked or unknown id leaves the garage unchanged. */
export function equip(garage: Garage, id: string): Garage {
  const item = itemById(id);
  if (!item || garage.stars < item.stars) return garage;
  return { ...garage, look: { ...garage.look, [item.kind]: item.id } };
}

/** Every part that is unknown or not unlocked for `stars` becomes the standard item of its kind (FR-097). */
export function sanitizeLook(look: Record<keyof Look, string>, stars: number): Look {
  const pick = <K extends keyof Look>(kind: K): Look[K] => {
    const item = itemById(look[kind]);
    return item && item.kind === kind && stars >= item.stars ? (item.id as Look[K]) : STANDARD_LOOK[kind];
  };
  return { color: pick('color'), flag: pick('flag'), trail: pick('trail'), hat: pick('hat') };
}

/** `color:<id> flag:<id> trail:<id> hat:<id>`, the canvas attribute `data-player-look` (D4). */
export function lookKey(look: Look): string {
  return `color:${look.color} flag:${look.flag} trail:${look.trail} hat:${look.hat}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Version 0 (no `version` field) becomes version 1: whole-number stars of at least 0 (anything else gives 0) and a
 * full look, missing parts from the standard look. Anything else is returned unchanged for the schema to check.
 */
export function migrateGarage(raw: unknown): unknown {
  if (!isRecord(raw) || raw.version !== undefined) return raw;
  const stars = Number.isInteger(raw.stars) && (raw.stars as number) >= 0 ? (raw.stars as number) : 0;
  const look = isRecord(raw.look) ? raw.look : {};
  return { version: 1, stars, look: { ...STANDARD_LOOK, ...look } };
}

/** Schema check, then sanitizeLook; null when the value is not a valid garage. */
export function parseGarage(raw: unknown): Garage | null {
  const parsed = garageSchema.safeParse(migrateGarage(raw));
  if (!parsed.success) return null;
  return { version: 1, stars: parsed.data.stars, look: sanitizeLook(parsed.data.look as Record<keyof Look, string>, parsed.data.stars) };
}

/**
 * Screen layout rule (amendment 12, FR-102, FR-104, data-model.md "Screen layout"). Pure, no DOM: the app passes the
 * viewport size in CSS pixels and whether the main pointer is fine (mouse or trackpad).
 *
 * - `wide`: wider than tall (or square) and more than SIDE_HEIGHT_LIMIT tall: an iPad held sideways or a desktop.
 * - `portrait`: taller than wide and at least PHONE_WIDTH_LIMIT wide: an iPad held upright.
 * - `side`: wider than tall (or square) and at most SIDE_HEIGHT_LIMIT tall: a phone held sideways.
 * - `rotate`: taller than wide and narrower than PHONE_WIDTH_LIMIT: a phone held upright ("Bitte dreh das Handy").
 */
import type { Settings } from '../settings/schema';

export type ScreenLayout = 'wide' | 'portrait' | 'side' | 'rotate';
export type NumberPadSetting = Settings['numberPad'];

/** Below this width the number pad shows with the setting "Automatisch" (FR-102). */
export const PAD_WIDTH_LIMIT = 1100;
/** A screen held upright and narrower than this is a phone held upright (FR-104). */
export const PHONE_WIDTH_LIMIT = 600;
/** A screen held sideways and at most this tall is a phone held sideways (FR-104). */
export const SIDE_HEIGHT_LIMIT = 500;

export function screenLayout(width: number, height: number): ScreenLayout {
  if (height > width) return width < PHONE_WIDTH_LIMIT ? 'rotate' : 'portrait';
  return height <= SIDE_HEIGHT_LIMIT ? 'side' : 'wide';
}

/**
 * Whether the number pad shows. `forced` (ModeTraits.forcesPad on the battle screen) makes "Automatisch" show it on
 * every device: "Nur Rechnen" has no ruler to tap (amendment 17).
 */
export function numberPadShown(setting: NumberPadSetting, device: { finePointer: boolean; width: number }, forced = false): boolean {
  if (setting === 'always') return true;
  if (setting === 'never') return false;
  return forced || !device.finePointer || device.width < PAD_WIDTH_LIMIT;
}

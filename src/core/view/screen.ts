/**
 * Screen layout rule (amendment 12, FR-102, FR-104, data-model.md "Screen layout"). Pure, no DOM: the app passes the
 * viewport size in CSS pixels and whether the main pointer is fine (mouse or trackpad).
 *
 * - `wide`: wider than tall and more than SIDE_HEIGHT_LIMIT tall: an iPad held sideways or a desktop.
 * - `portrait`: taller than wide (or square) and at least PHONE_WIDTH_LIMIT wide: an iPad held upright.
 * - `side`: wider than tall and at most SIDE_HEIGHT_LIMIT tall: a phone held sideways.
 * - `rotate`: taller than wide (or square) and narrower than PHONE_WIDTH_LIMIT: a phone held upright ("Bitte dreh das
 *   Handy").
 *
 * Bug "iPhone rotation in Chrome" (Phase 24): the app decides with the CSS media queries of SCREEN_QUERIES, not with
 * `window.innerWidth` and `window.innerHeight`, because Chrome on iOS can report the size from before a turn and send
 * no event afterwards. A square screen counts as upright, as the CSS media feature `orientation` does.
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

/**
 * The media query results the layout and the number pad follow. Each is true when its query in SCREEN_QUERIES matches.
 */
export interface ScreenMedia {
  /** Taller than wide, or square. */
  portrait: boolean;
  /** Narrower than PHONE_WIDTH_LIMIT. */
  phoneWidth: boolean;
  /** At most SIDE_HEIGHT_LIMIT tall. */
  sideHeight: boolean;
  /** Narrower than PAD_WIDTH_LIMIT. */
  padWidth: boolean;
  /** The main pointer is a mouse or a trackpad. */
  finePointer: boolean;
}

/**
 * The CSS media queries for ScreenMedia. "Narrower than" ends 0.02 px below the limit, so a width with a fraction of a
 * pixel (zoom) still counts. src/app/styles.css shows the rotate picture with the same `portrait` and `phoneWidth`
 * queries.
 */
export const SCREEN_QUERIES: Readonly<Record<keyof ScreenMedia, string>> = {
  portrait: '(orientation: portrait)',
  phoneWidth: `(max-width: ${PHONE_WIDTH_LIMIT - 0.02}px)`,
  sideHeight: `(max-height: ${SIDE_HEIGHT_LIMIT}px)`,
  padWidth: `(max-width: ${PAD_WIDTH_LIMIT - 0.02}px)`,
  finePointer: '(pointer: fine)',
};

/** The layout from the media query results. */
export function layoutFromMedia(media: Pick<ScreenMedia, 'portrait' | 'phoneWidth' | 'sideHeight'>): ScreenLayout {
  if (media.portrait) return media.phoneWidth ? 'rotate' : 'portrait';
  return media.sideHeight ? 'side' : 'wide';
}

/** What the media queries of SCREEN_QUERIES report for a size; used where no matchMedia exists. */
export function mediaFromSize(width: number, height: number, finePointer: boolean): ScreenMedia {
  return {
    portrait: height >= width,
    phoneWidth: width < PHONE_WIDTH_LIMIT,
    sideHeight: height <= SIDE_HEIGHT_LIMIT,
    padWidth: width < PAD_WIDTH_LIMIT,
    finePointer,
  };
}

export function screenLayout(width: number, height: number): ScreenLayout {
  return layoutFromMedia(mediaFromSize(width, height, true));
}

/**
 * Whether the number pad shows. `forced` (ModeTraits.forcesPad on the battle screen) makes "Automatisch" show it on
 * every device: "Nur Rechnen" has no ruler to tap (amendment 17).
 */
export function numberPadShown(setting: NumberPadSetting, device: { finePointer: boolean; padWidth: boolean }, forced = false): boolean {
  if (setting === 'always') return true;
  if (setting === 'never') return false;
  return forced || !device.finePointer || device.padWidth;
}

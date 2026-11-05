/**
 * The battle layout and whether the number pad shows (amendment 12, FR-102, FR-104), from the CSS media queries of
 * SCREEN_QUERIES (src/core/view/screen.ts) and the parent's "Zahlenfeld" setting. The rule itself is pure, in
 * src/core/view/screen.ts.
 *
 * Bug "iPhone rotation in Chrome" (Phase 24): on an iPhone in Chrome the "Bitte dreh das Handy" picture stayed when the
 * phone was held sideways. Chrome on iOS can keep reporting `window.innerWidth` and `window.innerHeight` from before a
 * turn, and send no `resize` or `orientationchange` afterwards, so a comparison of the window width and height kept
 * the upright layout. The media queries follow the browser's own layout, and their `change` events fire on every turn,
 * so the hook reads them (`matchMedia`) and listens to their `change` events. The window size is read only when no
 * matchMedia exists.
 *
 * Bug T306 stays as a backup: the hook also measures on `resize`, `orientationchange`, `visualViewport` resize and when
 * the page comes back to the front (`pageshow`, `visibilitychange`), and after each of these on the next animation
 * frame and after REMEASURE_DELAYS_MS.
 *
 * `lastEvent` names what caused the last measurement that changed something (`mount`, `resize`, `media
 * (orientation: portrait)`, ...), for the `?debug=screen` overlay.
 */
import { useEffect, useState } from 'react';
import {
  layoutFromMedia,
  mediaFromSize,
  numberPadShown,
  SCREEN_QUERIES,
  type NumberPadSetting,
  type ScreenLayout,
  type ScreenMedia,
} from '../core/view/screen';

/** Waits after an event (and after mounting) before measuring again (bug T306). */
export const REMEASURE_DELAYS_MS = [100, 300, 700, 1500] as const;

const KEYS = Object.keys(SCREEN_QUERIES) as Array<keyof ScreenMedia>;

function queryList(text: string): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(text) : null;
}

/** The media query results; from the window size only without matchMedia (no matchMedia counts as a fine pointer). */
export function readScreenMedia(): ScreenMedia {
  if (typeof window.matchMedia !== 'function') return mediaFromSize(window.innerWidth, window.innerHeight, true);
  const media = {} as ScreenMedia;
  for (const key of KEYS) media[key] = window.matchMedia(SCREEN_QUERIES[key]).matches;
  return media;
}

function sameMedia(a: ScreenMedia, b: ScreenMedia): boolean {
  return KEYS.every((key) => a[key] === b[key]);
}

interface Measured {
  media: ScreenMedia;
  lastEvent: string;
}

export function useScreen(setting: NumberPadSetting, forcePad = false): { layout: ScreenLayout; numberPad: boolean; lastEvent: string } {
  const [measured, setMeasured] = useState<Measured>(() => ({ media: readScreenMedia(), lastEvent: 'mount' }));

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let frame: number | null = null;
    let cause = 'mount';
    const measure = () => {
      const next = readScreenMedia();
      setMeasured((prev) => (sameMedia(prev.media, next) ? prev : { media: next, lastEvent: cause }));
    };
    const measureSoon = (name: string) => {
      cause = name;
      measure();
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      if (frame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
      frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => ((frame = null), measure())) : null;
      for (const delay of REMEASURE_DELAYS_MS) {
        const timer = setTimeout(() => {
          timers.delete(timer);
          measure();
        }, delay);
        timers.add(timer);
      }
    };
    const onWindow = (event: Event) => measureSoon(event.type);
    const onViewport = () => measureSoon('visualViewport resize');
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') measureSoon('visibilitychange');
    };
    const queries = KEYS.map((key) => {
      const list = queryList(SCREEN_QUERIES[key]);
      const onChange = () => measureSoon(`media ${SCREEN_QUERIES[key]}`);
      list?.addEventListener?.('change', onChange);
      return { list, onChange };
    });
    const windowEvents = ['resize', 'orientationchange', 'pageshow'] as const;
    const viewportApi = window.visualViewport;
    for (const type of windowEvents) window.addEventListener(type, onWindow);
    document.addEventListener('visibilitychange', onVisibility);
    viewportApi?.addEventListener('resize', onViewport);
    // The result read during the first render can be the one from before a turn or a reload (iOS).
    measureSoon('mount');
    return () => {
      for (const type of windowEvents) window.removeEventListener(type, onWindow);
      document.removeEventListener('visibilitychange', onVisibility);
      viewportApi?.removeEventListener('resize', onViewport);
      for (const { list, onChange } of queries) list?.removeEventListener?.('change', onChange);
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      if (frame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
    };
  }, []);

  return {
    layout: layoutFromMedia(measured.media),
    numberPad: numberPadShown(setting, measured.media, forcePad),
    lastEvent: measured.lastEvent,
  };
}

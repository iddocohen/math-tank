/**
 * The battle layout and whether the number pad shows (amendment 12, FR-102, FR-104), from the window size, the main
 * pointer (`matchMedia('(pointer: fine)')`; no matchMedia counts as a fine pointer) and the parent's "Zahlenfeld"
 * setting. The rule itself is pure, in src/core/view/screen.ts.
 *
 * Bug T306 (iPhone rotation): Safari on iOS fires `orientationchange` and `resize` while `window.innerWidth` and
 * `window.innerHeight` still hold the size from before the turn, and often sends no later event with the new size
 * (WebKit bugs 170595 and 231269); the same can happen on page load. So the hook measures on `resize`,
 * `orientationchange`, `visualViewport` resize, a change of the orientation media query or of the main pointer, and
 * when the page comes back to the front (`pageshow`, `visibilitychange`; iOS sends no `resize` to a page in the
 * background), and after each of these measures again on the next animation frame and after REMEASURE_DELAYS_MS.
 */
import { useEffect, useState } from 'react';
import { numberPadShown, screenLayout, type NumberPadSetting, type ScreenLayout } from '../core/view/screen';

/** Waits after an event (and after mounting) before measuring again, until iOS reports the new size. */
export const REMEASURE_DELAYS_MS = [100, 300, 700, 1500] as const;

interface Viewport {
  width: number;
  height: number;
  finePointer: boolean;
}

function query(text: string): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(text) : null;
}

function readViewport(): Viewport {
  return { width: window.innerWidth, height: window.innerHeight, finePointer: query('(pointer: fine)')?.matches ?? true };
}

export function useScreen(setting: NumberPadSetting, forcePad = false): { layout: ScreenLayout; numberPad: boolean } {
  const [viewport, setViewport] = useState(readViewport);

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let frame: number | null = null;
    const measure = () => {
      const next = readViewport();
      setViewport((prev) => (prev.width === next.width && prev.height === next.height && prev.finePointer === next.finePointer ? prev : next));
    };
    const measureSoon = () => {
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
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') measureSoon();
    };
    const queries = [query('(pointer: fine)'), query('(orientation: portrait)')];
    const viewportApi = window.visualViewport;
    window.addEventListener('resize', measureSoon);
    window.addEventListener('orientationchange', measureSoon);
    window.addEventListener('pageshow', measureSoon);
    document.addEventListener('visibilitychange', onVisibility);
    viewportApi?.addEventListener('resize', measureSoon);
    for (const q of queries) q?.addEventListener?.('change', measureSoon);
    // The size read during the first render can be the one from before a turn or a reload (iOS).
    measureSoon();
    return () => {
      window.removeEventListener('resize', measureSoon);
      window.removeEventListener('orientationchange', measureSoon);
      window.removeEventListener('pageshow', measureSoon);
      document.removeEventListener('visibilitychange', onVisibility);
      viewportApi?.removeEventListener('resize', measureSoon);
      for (const q of queries) q?.removeEventListener?.('change', measureSoon);
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      if (frame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
    };
  }, []);

  return {
    layout: screenLayout(viewport.width, viewport.height),
    numberPad: numberPadShown(setting, { finePointer: viewport.finePointer, width: viewport.width }, forcePad),
  };
}

/**
 * The battle layout and whether the number pad shows (amendment 12, FR-102, FR-104), from the window size, the main
 * pointer (`matchMedia('(pointer: fine)')`; no matchMedia counts as a fine pointer) and the parent's "Zahlenfeld"
 * setting. Updated on `resize`, `orientationchange` and a change of the main pointer. The rule itself is pure, in
 * src/core/view/screen.ts.
 */
import { useEffect, useState } from 'react';
import { numberPadShown, screenLayout, type NumberPadSetting, type ScreenLayout } from '../core/view/screen';

interface Viewport {
  width: number;
  height: number;
  finePointer: boolean;
}

function finePointerQuery(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia('(pointer: fine)') : null;
}

function readViewport(): Viewport {
  return { width: window.innerWidth, height: window.innerHeight, finePointer: finePointerQuery()?.matches ?? true };
}

export function useScreen(setting: NumberPadSetting): { layout: ScreenLayout; numberPad: boolean } {
  const [viewport, setViewport] = useState(readViewport);

  useEffect(() => {
    const update = () => {
      const next = readViewport();
      setViewport((prev) => (prev.width === next.width && prev.height === next.height && prev.finePointer === next.finePointer ? prev : next));
    };
    const query = finePointerQuery();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    query?.addEventListener?.('change', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      query?.removeEventListener?.('change', update);
    };
  }, []);

  return {
    layout: screenLayout(viewport.width, viewport.height),
    numberPad: numberPadShown(setting, { finePointer: viewport.finePointer, width: viewport.width }),
  };
}

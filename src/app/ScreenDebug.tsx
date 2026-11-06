/**
 * The `?debug=screen` overlay (bug "iPhone rotation in Chrome", Phase 24): small text in the bottom left corner with
 * the build version, the window size, the visual viewport size, `screen.orientation.type`, the orientation media
 * queries, the chosen layout and the last event that changed it. A parent opens the game with `?debug=screen` on a
 * phone and reports the values. It shows only with the query parameter, reads the values twice a second, and is
 * for adults, so its text is not in src/i18n/de.ts.
 */
import { useEffect, useState } from 'react';
import type { ScreenLayout } from '../core/view/screen';
import { BUILD_DATE, BUILD_VERSION } from './buildInfo';

export function debugScreenRequested(search: string): boolean {
  return new URLSearchParams(search).get('debug') === 'screen';
}

function matches(query: string): string {
  return typeof window.matchMedia === 'function' ? String(window.matchMedia(query).matches) : 'n/a';
}

function lines(layout: ScreenLayout, lastEvent: string): string[] {
  const vv = window.visualViewport;
  return [
    `version ${BUILD_VERSION} ${BUILD_DATE}`,
    `inner ${window.innerWidth}x${window.innerHeight}`,
    `visualViewport ${vv ? `${Math.round(vv.width)}x${Math.round(vv.height)}` : 'n/a'}`,
    `orientation ${typeof screen !== 'undefined' && screen.orientation ? screen.orientation.type : 'n/a'}`,
    `portrait ${matches('(orientation: portrait)')} landscape ${matches('(orientation: landscape)')}`,
    `layout ${layout}`,
    `event ${lastEvent}`,
  ];
}

export function ScreenDebug({ layout, lastEvent }: { layout: ScreenLayout; lastEvent: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(timer);
  }, []);
  return (
    <pre className="screen-debug" data-testid="screen-debug" aria-hidden="true">
      {lines(layout, lastEvent).join('\n')}
    </pre>
  );
}

/**
 * Bug "iPhone rotation in Chrome" (Phase 24; follows bug T306): on an iPhone in Chrome the "Bitte dreh das Handy"
 * picture stayed when the phone was held sideways. Chrome on iOS can report `window.innerWidth` and
 * `window.innerHeight` from before a turn for longer than the re-measures of T306 wait, and send no `resize` or
 * `orientationchange` at all. useScreen therefore reads the CSS media queries of SCREEN_QUERIES (matchMedia), which
 * follow the browser's own layout, and measures again on their `change` events and, as a backup, on the events and
 * delays of T306. The window size is read only when no matchMedia exists.
 */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCREEN_QUERIES, type ScreenMedia } from '../core/view/screen';
import { useScreen } from './useScreen';

type Listener = (event: { matches: boolean }) => void;

const listeners = new Map<string, Set<Listener>>();
let media: ScreenMedia;

const UPRIGHT_PHONE: ScreenMedia = { portrait: true, phoneWidth: true, sideHeight: false, padWidth: true, finePointer: false };
const SIDEWAYS_PHONE: ScreenMedia = { portrait: false, phoneWidth: false, sideHeight: true, padWidth: true, finePointer: false };
const DESKTOP: ScreenMedia = { portrait: false, phoneWidth: false, sideHeight: false, padWidth: false, finePointer: true };

function setSize(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

function keyOf(query: string): keyof ScreenMedia {
  const entry = Object.entries(SCREEN_QUERIES).find(([, q]) => q === query);
  if (!entry) throw new Error(`unexpected media query ${query}`);
  return entry[0] as keyof ScreenMedia;
}

/** Changes the media query results and fires `change` on the queries whose result changed, as a browser does. */
function setMedia(next: ScreenMedia): void {
  const before = media;
  media = next;
  for (const key of Object.keys(next) as Array<keyof ScreenMedia>) {
    if (before[key] === next[key]) continue;
    for (const listener of listeners.get(SCREEN_QUERIES[key]) ?? []) listener({ matches: next[key] });
  }
}

function listenerCount(): number {
  let n = 0;
  for (const set of listeners.values()) n += set.size;
  return n;
}

beforeEach(() => {
  vi.useFakeTimers();
  listeners.clear();
  media = UPRIGHT_PHONE;
  setSize(390, 844);
  // jsdom has no matchMedia: every query of SCREEN_QUERIES answers from `media`.
  window.matchMedia = ((query: string) => ({
    media: query,
    get matches() {
      return media[keyOf(query)];
    },
    addEventListener: (_type: string, listener: Listener) => {
      if (!listeners.has(query)) listeners.set(query, new Set());
      listeners.get(query)!.add(listener);
    },
    removeEventListener: (_type: string, listener: Listener) => listeners.get(query)?.delete(listener),
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useScreen (bug: iPhone rotation in Chrome)', () => {
  it('follows a turn reported only by the media queries, while innerWidth and innerHeight keep the old size', () => {
    const { result } = renderHook(() => useScreen('auto'));
    expect(result.current.layout).toBe('rotate');

    // The phone turns sideways: no resize event, the window size stays 390 by 844, only the media queries change.
    act(() => setMedia(SIDEWAYS_PHONE));
    expect(result.current.layout).toBe('side');
    expect(result.current.numberPad).toBe(true);
    expect(result.current.lastEvent).toBe('media (orientation: portrait)');

    act(() => setMedia(UPRIGHT_PHONE));
    expect(result.current.layout).toBe('rotate');
  });

  it('reads the media queries on mounting, not the window size', () => {
    media = SIDEWAYS_PHONE;
    const { result } = renderHook(() => useScreen('auto'));
    expect(result.current.layout).toBe('side');
    expect(result.current.lastEvent).toBe('mount');
  });

  it('measures the media queries again after an event and after short waits, as a backup (T306)', () => {
    const { result } = renderHook(() => useScreen('auto'));
    // The queries change without a change event; a resize event and the re-measure after it pick it up.
    media = SIDEWAYS_PHONE;
    act(() => {
      window.dispatchEvent(new Event('orientationchange'));
    });
    expect(result.current.layout).toBe('side');
    media = UPRIGHT_PHONE;
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.layout).toBe('rotate');
    expect(result.current.lastEvent).toBe('orientationchange');
  });

  it('measures again when the page comes back to the front', () => {
    const { result } = renderHook(() => useScreen('auto'));
    media = SIDEWAYS_PHONE;
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.layout).toBe('side');
    media = UPRIGHT_PHONE;
    act(() => {
      window.dispatchEvent(new Event('pageshow'));
    });
    expect(result.current.layout).toBe('rotate');
  });

  it('shows the number pad from the pointer and width media queries (FR-102)', () => {
    media = DESKTOP;
    const { result } = renderHook(() => useScreen('auto'));
    expect(result.current.layout).toBe('wide');
    expect(result.current.numberPad).toBe(false);
    act(() => setMedia({ ...DESKTOP, padWidth: true }));
    expect(result.current.numberPad).toBe(true);
  });

  it('uses the window size when no matchMedia exists', () => {
    // @ts-expect-error: a browser without matchMedia
    delete window.matchMedia;
    setSize(844, 390);
    const { result } = renderHook(() => useScreen('auto'));
    expect(result.current.layout).toBe('side');
  });

  it('reads the same media query lists on every measurement instead of asking matchMedia again (code review)', () => {
    const spy = vi.spyOn(window, 'matchMedia');
    const { result } = renderHook(() => useScreen('auto'));
    const afterMount = spy.mock.calls.length;
    media = SIDEWAYS_PHONE;
    act(() => {
      window.dispatchEvent(new Event('resize'));
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.layout).toBe('side');
    expect(spy.mock.calls.length).toBe(afterMount);
  });

  it('stops measuring after unmount', () => {
    const { unmount } = renderHook(() => useScreen('auto'));
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    unmount();
    expect(listenerCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

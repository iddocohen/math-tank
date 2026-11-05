/**
 * Bug T306 (iPhone rotation, product owner report): Safari on iOS fires `orientationchange` and `resize` while
 * `window.innerWidth` and `window.innerHeight` still hold the size from before the turn, and often sends no later
 * event with the new size (WebKit bugs 170595 and 231269). useScreen measures again after each event, on the next
 * animation frame and after short waits, so the layout follows the turn. It also measures again when the page comes
 * back to the front (iOS sends no `resize` to a page in the background) and when the orientation media query changes.
 */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScreen } from './useScreen';

type Listener = (event: { matches: boolean }) => void;

const portraitListeners = new Set<Listener>();
let portrait = true;

function setSize(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

beforeEach(() => {
  vi.useFakeTimers();
  portraitListeners.clear();
  portrait = true;
  setSize(390, 844);
  // jsdom has no matchMedia: a coarse pointer (a phone) and an orientation query that tests can change.
  window.matchMedia = ((query: string) => ({
    media: query,
    get matches() {
      return query.includes('orientation: portrait') ? portrait : false;
    },
    addEventListener: (_type: string, listener: Listener) => {
      if (query.includes('orientation')) portraitListeners.add(listener);
    },
    removeEventListener: (_type: string, listener: Listener) => portraitListeners.delete(listener),
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useScreen (bug T306, iPhone rotation)', () => {
  it('follows a turn when the events come before the new size, as Safari on iOS does', () => {
    const { result } = renderHook(() => useScreen('auto'));
    expect(result.current.layout).toBe('rotate');

    // The phone turns: the events fire with the old size, the size settles 200 ms later without another event.
    act(() => {
      window.dispatchEvent(new Event('orientationchange'));
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current.layout).toBe('rotate');
    act(() => {
      vi.advanceTimersByTime(200);
      setSize(844, 390);
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.layout).toBe('side');
    expect(result.current.numberPad).toBe(true);
  });

  it('measures again when the orientation media query changes', () => {
    const { result } = renderHook(() => useScreen('auto'));
    setSize(844, 390);
    portrait = false;
    act(() => {
      for (const listener of portraitListeners) listener({ matches: false });
    });
    expect(result.current.layout).toBe('side');
  });

  it('measures again when the page comes back to the front', () => {
    const { result } = renderHook(() => useScreen('auto'));
    setSize(844, 390);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.layout).toBe('side');
    setSize(390, 844);
    act(() => {
      window.dispatchEvent(new Event('pageshow'));
    });
    expect(result.current.layout).toBe('rotate');
  });

  it('stops measuring after unmount', () => {
    const { unmount } = renderHook(() => useScreen('auto'));
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    unmount();
    expect(portraitListeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

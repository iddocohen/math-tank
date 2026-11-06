/**
 * Bug "iPhone rotation in Chrome" (Phase 24): `?debug=screen` shows what the app measured, so a parent can report the
 * values from a real phone. Never shown without the query parameter.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BUILD_DATE, BUILD_VERSION } from './buildInfo';
import { debugScreenRequested, ScreenDebug } from './ScreenDebug';

afterEach(cleanup);

describe('debugScreenRequested', () => {
  it('is true only with debug=screen in the query', () => {
    expect(debugScreenRequested('?debug=screen')).toBe(true);
    expect(debugScreenRequested('?seed=5&debug=screen')).toBe(true);
    expect(debugScreenRequested('')).toBe(false);
    expect(debugScreenRequested('?debug=other')).toBe(false);
    expect(debugScreenRequested('?seed=5')).toBe(false);
  });
});

describe('ScreenDebug', () => {
  it('shows the build version, the window and viewport size, the media queries, the layout and the last event', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    window.matchMedia = ((query: string) => ({ media: query, matches: query === '(orientation: landscape)' })) as unknown as typeof window.matchMedia;
    render(<ScreenDebug layout="side" lastEvent="media (orientation: portrait)" />);
    const box = screen.getByTestId('screen-debug');
    expect(box.textContent).toContain(`version ${BUILD_VERSION} ${BUILD_DATE}`);
    expect(box.textContent).toContain('inner 390x844');
    expect(box.textContent).toContain('visualViewport');
    expect(box.textContent).toContain('orientation');
    expect(box.textContent).toContain('portrait false landscape true');
    expect(box.textContent).toContain('layout side');
    expect(box.textContent).toContain('event media (orientation: portrait)');
  });
});

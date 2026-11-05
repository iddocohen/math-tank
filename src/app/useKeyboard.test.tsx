/**
 * The keyboard listener is attached while React commits the screen, before the browser paints it (T393). A key pressed
 * as soon as the start screen is visible then starts the round; with a passive effect the listener came after the
 * paint, and a fast Enter (a quick child, or an end-to-end test under load) was lost.
 */
import { render } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { KeyAction } from './keyboard';
import { useKeyboard } from './useKeyboard';

function Keys({ onAction }: { onAction: (action: KeyAction) => void }) {
  useKeyboard({ screen: 'start', onAction });
  return <button type="button">Spielen</button>;
}

/** Presses Enter during the same commit, after the screen above it is in the DOM and before any passive effect runs. */
function PressAtOnce() {
  useLayoutEffect(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', cancelable: true }));
  }, []);
  return null;
}

describe('useKeyboard (T393)', () => {
  it('handles a key pressed as soon as the screen is committed, before passive effects run', () => {
    const onAction = vi.fn();
    render(
      <>
        <Keys onAction={onAction} />
        <PressAtOnce />
      </>,
    );
    expect(onAction).toHaveBeenCalledWith({ type: 'start' });
  });

  it('stops listening when the screen is gone', () => {
    const onAction = vi.fn();
    const { unmount } = render(<Keys onAction={onAction} />);
    unmount();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', cancelable: true }));
    expect(onAction).not.toHaveBeenCalled();
  });
});

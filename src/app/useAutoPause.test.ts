/**
 * Pausing a running round while the game cannot be played (review P3, R1, R4; FR-045, FR-084, FR-104, FR-119): a
 * parent screen, a hidden tab, or the transfer dialog. The round resumes only when none of them
 * is left, and only when the app paused it, never after the child's own pause.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useAutoPause, useDocumentHidden, type Pausable } from './useAutoPause';

/** A stand-in for the BattleController's pause and resume. */
function fakeController(phase = 'challenge') {
  const c = {
    phase,
    before: null as string | null,
    pauses: 0,
    resumes: 0,
    getState: () => ({ phase: c.phase }),
    pause() {
      if (c.phase === 'paused' || c.phase === 'roundOver') return;
      c.before = c.phase;
      c.phase = 'paused';
      c.pauses++;
    },
    resume() {
      if (c.phase !== 'paused' || c.before === null) return;
      c.phase = c.before;
      c.before = null;
      c.resumes++;
    },
  };
  return c satisfies Pausable;
}

interface Reasons {
  gate?: boolean;
  hidden?: boolean;
  transfer?: boolean;
}

/** Renders the hook; `set` changes the reasons and renders again with the controller's current phase. */
function setup(c = fakeController()) {
  let reasons: Reasons = {};
  const view = renderHook(({ phase, want }: { phase: string; want: boolean }) => useAutoPause(c, phase, want), {
    initialProps: { phase: c.phase, want: false },
  });
  const set = (next: Reasons) => {
    reasons = { ...reasons, ...next };
    const want = Object.values(reasons).some(Boolean);
    view.rerender({ phase: c.phase, want });
    // The controller's phase change renders the app again, as useRoundState does.
    view.rerender({ phase: c.phase, want });
  };
  return { c, set };
}

describe('useAutoPause', () => {
  it('a hidden tab pauses the round and showing it again resumes it (FR-084)', () => {
    const { c, set } = setup();
    set({ hidden: true });
    expect(c.phase).toBe('paused');
    set({ hidden: false });
    expect(c.phase).toBe('challenge');
    expect(c.resumes).toBe(1);
  });

  it('a parent screen opened while the tab was hidden keeps the round paused until it closes (FR-045)', () => {
    const { c, set } = setup();
    set({ hidden: true });
    set({ gate: true });
    set({ hidden: false });
    expect(c.phase).toBe('paused');
    set({ gate: false });
    expect(c.phase).toBe('challenge');
    expect(c.pauses).toBe(1);
  });

  it('the transfer dialog pauses the round and closing it resumes it (review R4)', () => {
    const { c, set } = setup();
    set({ transfer: true });
    expect(c.phase).toBe('paused');
    set({ transfer: false });
    expect(c.phase).toBe('challenge');
  });

  it('never resumes a round the child paused', () => {
    const { c, set } = setup(fakeController('paused'));
    c.before = 'challenge';
    set({ gate: true });
    set({ hidden: true });
    set({ gate: false, hidden: false });
    expect(c.phase).toBe('paused');
    expect(c.resumes).toBe(0);
  });

  it('does nothing at the end of a round', () => {
    const { c, set } = setup(fakeController('roundOver'));
    set({ hidden: true });
    set({ hidden: false });
    expect(c.phase).toBe('roundOver');
    expect(c.pauses + c.resumes).toBe(0);
  });
});

describe('useDocumentHidden', () => {
  const setHidden = (hidden: boolean) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event('visibilitychange'));
  };
  afterEach(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  });

  it('follows visibilitychange', () => {
    const { result } = renderHook(() => useDocumentHidden());
    expect(result.current).toBe(false);
    act(() => setHidden(true));
    expect(result.current).toBe(true);
    act(() => setHidden(false));
    expect(result.current).toBe(false);
  });
});

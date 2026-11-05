/**
 * Pauses a running round while it cannot be played, and resumes only what it paused (FR-045, FR-084, FR-104, FR-119;
 * review P3, R1, R4). The app passes one flag: true while a parent screen is open, the tab is hidden, the phone is
 * held upright or the transfer dialog shows, during a battle. One flag instead of one pause per reason means that
 * the round resumes only when the last reason ends, whatever order they come and go in.
 *
 * The phase is a dependency, so a round that could not pause at once is paused when its phase changes. A round the
 * child paused with the pause button stays paused: the hook resumes only a pause it made itself.
 */
import { useEffect, useRef, useState } from 'react';

/** The parts of the BattleController this hook uses. */
export interface Pausable {
  getState(): { phase: string };
  pause(): void;
  resume(): void;
}

export function useAutoPause(controller: Pausable, phase: string, wantPause: boolean): void {
  const pausedByApp = useRef(false);
  useEffect(() => {
    if (phase === 'roundOver') {
      pausedByApp.current = false;
      return;
    }
    if (wantPause) {
      if (phase === 'paused') return;
      controller.pause();
      pausedByApp.current = controller.getState().phase === 'paused';
    } else if (pausedByApp.current) {
      pausedByApp.current = false;
      controller.resume();
    }
  }, [controller, phase, wantPause]);
}

/** True while the browser tab is hidden (`document.hidden`), updated on visibilitychange. */
export function useDocumentHidden(): boolean {
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  useEffect(() => {
    const onChange = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return hidden;
}

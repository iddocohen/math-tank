/**
 * Start screen (SC-001, FR-014, FR-053, FR-062, T070): one tap on "Spielen", or Enter or Space (handled by the app's
 * keyboard listener), starts a guided round. "Freies Spiel" appears next to it only when the parent allows free play.
 * `?mode=free` (like `?seed=`, tasks.md D4) makes Enter and Space start free play when it is allowed.
 * The gear (`gear`, the ParentGate from the app) sits at the top right; it opens the parent menu after a 2-second
 * press and ignores keys (FR-045).
 * Amendment 11 (FR-091, FR-095, FR-096): with the garage on (`garage` not null) a large "Garage" button and the star
 * total show; G opens the garage through the app's keyboard listener.
 */
import type { ReactNode } from 'react';
import { t } from '../i18n';
import { StarTotal } from './StarTotal';

export type StartMode = 'guided' | 'freePlay';

/** The mode Enter or Space start: free play only with `?mode=free` and the parent's free-play setting. */
export function keyStartMode(search: string, freePlayAllowed: boolean): StartMode {
  return freePlayAllowed && new URLSearchParams(search).get('mode') === 'free' ? 'freePlay' : 'guided';
}

interface Props {
  onPlay: (mode: StartMode) => void;
  /** The parent's free-play setting (FR-014). */
  freePlay: boolean;
  gear?: ReactNode;
  /** The star total, or null when the parent turned the garage off. */
  garage?: { stars: number } | null;
  onGarage?: () => void;
}

export function StartScreen({ onPlay, freePlay, gear, garage = null, onGarage }: Props) {
  const m = t();
  const fullscreen = () => {
    const el = document.documentElement;
    if (document.fullscreenElement || !el.requestFullscreen) return;
    el.requestFullscreen().catch(() => {
      // Some browsers (iPhone Safari) refuse fullscreen; the game still works.
    });
  };
  return (
    <main className="start-screen">
      <div className="top-right">
        {gear}
        <button type="button" className="icon-button" aria-label={m.start.fullscreen} onClick={fullscreen}>
          <span aria-hidden="true">⛶</span>
        </button>
      </div>
      <h1 className="title">{m.appName}</h1>
      {garage && <StarTotal stars={garage.stars} />}
      <div className="play-buttons">
        <button type="button" className="play-button" onClick={() => onPlay('guided')}>
          {m.start.play}
        </button>
        {freePlay && (
          <button type="button" className="play-button free-play-button" onClick={() => onPlay('freePlay')}>
            {m.start.freePlay}
          </button>
        )}
        {garage && (
          <button type="button" className="play-button garage-button" onClick={onGarage}>
            {m.start.garage}
          </button>
        )}
      </div>
    </main>
  );
}

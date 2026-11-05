/**
 * Start screen (SC-001, FR-053, FR-062): one tap on "Spielen", or Enter or Space (handled by the app's keyboard
 * listener), starts a round. Until Phase 15 "Spielen" starts free play (tasks.md D3).
 * The gear (`gear`, the ParentGate from the app) sits at the top right; it opens the parent menu after a 2-second
 * press and ignores keys (FR-045).
 */
import type { ReactNode } from 'react';
import { t } from '../i18n';

interface Props {
  onPlay: () => void;
  gear?: ReactNode;
}

export function StartScreen({ onPlay, gear }: Props) {
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
      <button type="button" className="play-button" onClick={onPlay}>
        {m.start.play}
      </button>
    </main>
  );
}

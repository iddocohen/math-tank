/**
 * Start screen (SC-001, FR-053, FR-062): one tap on "Spielen", or Enter or Space (handled by the app's keyboard
 * listener), starts a round. Until Phase 13 "Spielen" starts free play (tasks.md D3).
 * The gear opens the parent gate in a later phase. It is left out of the tab order and ignores keys,
 * so no key opens the parent gate.
 */
import { t } from '../i18n';

interface Props {
  onPlay: () => void;
}

export function StartScreen({ onPlay }: Props) {
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
        <button
          type="button"
          className="icon-button"
          aria-label={m.start.gear}
          title={m.start.parentHint}
          tabIndex={-1}
          onKeyDown={(e) => e.preventDefault()}
        >
          <span aria-hidden="true">⚙</span>
        </button>
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

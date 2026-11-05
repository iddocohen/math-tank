/**
 * Start screen (SC-001, FR-053): one tap on "Spielen" starts a round.
 * Until Phase 9 "Spielen" starts free play (tasks.md D3).
 * The gear opens the parent gate in a later phase; for now it does nothing.
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
        <button type="button" className="icon-button" aria-label={m.start.gear} title={m.start.parentHint}>
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

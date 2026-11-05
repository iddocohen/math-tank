/**
 * Parent gate (FR-045, FR-062, FR-079, research R22): the gear opens the parent menu only after a 2-second press
 * with mouse or touch. A short tap or any key does nothing: the gear is out of the tab order, ignores keys and has
 * no click handler. While pressed, a ring around the gear fills up.
 *
 * The menu offers "Einstellungen" and "Fortschritt" (FR-040). `onOpen` runs when the menu opens (the app pauses the
 * game), `onClose` when it is closed with "Schließen" (the app resumes), `onSettings` when the parent picks
 * "Einstellungen" and `onProgress` when the parent picks "Fortschritt" (the menu closes and the app shows that page,
 * which resumes the game when it closes).
 */
import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';

export const HOLD_MS = 2000;
const TICK_MS = 50;
const RING_RADIUS = 30;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

interface Props {
  onOpen: () => void;
  onClose: () => void;
  onSettings: () => void;
  onProgress: () => void;
}

export function ParentGate({ onOpen, onClose, onSettings, onProgress }: Props) {
  const m = t();
  const [progress, setProgress] = useState(0);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
    setProgress(0);
  };

  useEffect(() => () => {
    if (timer.current !== null) clearInterval(timer.current);
  }, []);

  const start = (e: React.PointerEvent) => {
    if (e.button !== 0 || open) return;
    stop();
    // Measured with the clock, not by counting ticks: a busy page (the battle canvas) delays interval callbacks.
    const startedAt = Date.now();
    timer.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= HOLD_MS) {
        stop();
        setOpen(true);
        onOpen();
        return;
      }
      setProgress(elapsed / HOLD_MS);
    }, TICK_MS);
  };

  const close = () => {
    setOpen(false);
    onClose();
  };

  const settings = () => {
    setOpen(false);
    onSettings();
  };

  const progressPage = () => {
    setOpen(false);
    onProgress();
  };

  return (
    <>
      <button
        type="button"
        className="icon-button parent-gate"
        data-testid="parent-gate"
        aria-label={m.start.gear}
        title={m.start.parentHint}
        tabIndex={-1}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onContextMenu={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
        onKeyDown={(e) => e.preventDefault()}
        onKeyUp={(e) => e.preventDefault()}
      >
        <svg className="parent-gate-ring" data-testid="parent-gate-ring" data-progress={progress} viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r={RING_RADIUS} strokeDasharray={RING_LENGTH} strokeDashoffset={RING_LENGTH * (1 - progress)} />
        </svg>
        <span aria-hidden="true">⚙</span>
      </button>
      {open && (
        <div className="parent-menu-backdrop">
          <div className="parent-menu" role="dialog" aria-modal="true" aria-label={m.parent.menu}>
            <h2>{m.parent.menu}</h2>
            <button type="button" className="primary-button" onClick={settings}>
              {m.parent.settings}
            </button>
            <button type="button" className="secondary-button" onClick={progressPage}>
              {m.parent.progress}
            </button>
            <button type="button" className="secondary-button" onClick={close}>
              {m.parent.close}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

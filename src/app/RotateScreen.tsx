/**
 * "Bitte dreh das Handy" (amendment 12, FR-104): a phone held upright shows this full-screen picture of a turning
 * phone over the start screen, the garage and the battle. The app pauses a running round while it shows. The gear
 * (the ParentGate from the app) stays at the top right, so the parent can open the settings and progress pages, which
 * open over this picture and work upright.
 */
import type { ReactNode } from 'react';
import { t } from '../i18n';

export function RotateScreen({ gear }: { gear?: ReactNode }) {
  const m = t();
  return (
    <div className="rotate-screen" data-testid="rotate-screen" role="alert">
      {gear && <div className="top-right">{gear}</div>}
      <svg className="rotate-phone" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <rect x="38" y="14" width="44" height="92" rx="9" fill="#2b3a5c" stroke="#f4f6fb" strokeWidth="4" />
        <rect x="45" y="26" width="30" height="64" rx="3" fill="#7ec8ff" />
        <circle cx="60" cy="98" r="3.5" fill="#f4f6fb" />
      </svg>
      <p className="rotate-text">{m.rotate.turnPhone}</p>
    </div>
  );
}

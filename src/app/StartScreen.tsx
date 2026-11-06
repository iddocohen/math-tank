/**
 * Start screen (SC-001, FR-053, FR-062, FR-121, T070): one big picture button per play mode the parent offers
 * (amendment 17): "Gemischt" (ruler and question icons), "Nur Zahlenstrahl" (ruler icon) and "Nur Rechnen" (question-mark
 * icon), in this order; keys 1, 2 and 3 start them and Enter or Space the first offered one (the app's keyboard
 * listener). With only one mode offered a single "Spielen" button starts it. `?mode=mixed|ruler|math` (like `?seed=`,
 * tasks.md D4) makes Enter and Space start that mode when it is offered.
 * The gear (`gear`, the ParentGate from the app) sits at the top right; it opens the parent menu after a 2-second
 * press and ignores keys (FR-045).
 * Amendment 11 (FR-091, FR-095, FR-096): with the garage on (`garage` not null) a large "Garage" button and the star
 * total show; G opens the garage through the app's keyboard listener.
 * Amendment 12 (FR-106): the fullscreen button shows only where the browser lets a web page use fullscreen
 * (`document.fullscreenEnabled`); on iPhone it is hidden and the Home Screen note on the settings page applies.
 * Review H1: while the latest save failed, a small line at the bottom tells the parent; the settings page says which
 * data was not saved.
 */
import type { ReactNode } from 'react';
import { t } from '../i18n';
import { PLAY_MODES, type PlayMode } from '../core/settings/schema';
import { StarTotal } from './StarTotal';

/** The offered play modes in start screen order (FR-121). */
export function offeredModes(playModes: Record<PlayMode, boolean>): PlayMode[] {
  return PLAY_MODES.filter((mode) => playModes[mode]);
}

/** The key that starts a mode on the start screen: 1, 2 or 3 (FR-121). */
export function modeKey(mode: PlayMode): string {
  return String(PLAY_MODES.indexOf(mode) + 1);
}

/** The mode Enter or Space start: the offered mode named by `?mode=`, otherwise the first offered mode. */
export function keyStartMode(search: string, offered: readonly PlayMode[]): PlayMode {
  const wanted = new URLSearchParams(search).get('mode');
  return offered.find((mode) => mode === wanted) ?? offered[0] ?? 'mixed';
}

interface Props {
  onPlay: (mode: PlayMode) => void;
  /** The offered play modes, in start screen order (offeredModes). */
  modes: readonly PlayMode[];
  gear?: ReactNode;
  /** The star total, or null when the parent turned the garage off. */
  garage?: { balance: number } | null;
  onGarage?: () => void;
  /** True while the latest save failed (review H1): a small note for the parent, not a blocking message. */
  saveFailed?: boolean;
}

/** A ruler: a bar with lines, the longer ones every fifth. */
function RulerIcon() {
  return (
    <g>
      <rect x="4" y="30" width="56" height="16" rx="3" fill="#f4f6fb" stroke="#14203a" strokeWidth="2" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
        <line key={i} x1={8 + i * 4.8} y1="30" x2={8 + i * 4.8} y2={i % 5 === 0 ? 42 : 37} stroke="#14203a" strokeWidth="2" />
      ))}
    </g>
  );
}

/** A question mark in a round badge, drawn as a path (no SVG text, so no text below the 18 px minimum). */
function QuestionIcon({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const k = r / 10;
  const hook = `M ${cx - 3.5 * k} ${cy - 2.5 * k} A ${3.6 * k} ${3.6 * k} 0 1 1 ${cx + 1.2 * k} ${cy + 0.8 * k} Q ${cx} ${cy + 1.6 * k} ${cx} ${cy + 3.2 * k}`;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#ffd54a" stroke="#14203a" strokeWidth="2" />
      <path d={hook} fill="none" stroke="#14203a" strokeWidth={2 * k} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={cx} cy={cy + 6 * k} r={1.2 * k} fill="#14203a" />
    </g>
  );
}

/** The picture of a play mode: ruler and question, ruler only, or question only. */
function ModeIcon({ mode }: { mode: PlayMode }) {
  return (
    <svg className="mode-icon" viewBox="0 0 64 52" width="96" height="78" aria-hidden="true" focusable="false">
      {mode === 'mixed' && (
        <>
          <RulerIcon />
          <QuestionIcon cx={44} cy={15} r={13} />
        </>
      )}
      {mode === 'ruler' && <RulerIcon />}
      {mode === 'math' && <QuestionIcon cx={32} cy={26} r={22} />}
    </svg>
  );
}

export function StartScreen({ onPlay, modes, gear, garage = null, onGarage, saveFailed = false }: Props) {
  const m = t();
  const canFullscreen = document.fullscreenEnabled === true;
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
        {canFullscreen && (
          <button type="button" className="icon-button" aria-label={m.start.fullscreen} onClick={fullscreen}>
            <span aria-hidden="true">⛶</span>
          </button>
        )}
      </div>
      <h1 className="title">{m.appName}</h1>
      {garage && <StarTotal stars={garage.balance} />}
      <div className="play-buttons">
        {modes.length === 1 ? (
          <button type="button" className="play-button" onClick={() => onPlay(modes[0]!)}>
            {m.start.play}
          </button>
        ) : (
          modes.map((mode) => (
            <button
              key={mode}
              type="button"
              className={`play-button mode-button mode-${mode}`}
              data-testid="mode-button"
              data-mode={mode}
              aria-keyshortcuts={modeKey(mode)}
              onClick={() => onPlay(mode)}
            >
              <ModeIcon mode={mode} />
              <span className="mode-label">{m.start.modes[mode]}</span>
              <span className="mode-key" aria-hidden="true">
                {modeKey(mode)}
              </span>
            </button>
          ))
        )}
        {garage && (
          <button type="button" className="play-button garage-button" onClick={onGarage}>
            {m.start.garage}
          </button>
        )}
      </div>
      {saveFailed && (
        <p className="save-failed-hint" data-testid="save-failed-hint">
          {m.start.saveFailed}
        </p>
      )}
    </main>
  );
}

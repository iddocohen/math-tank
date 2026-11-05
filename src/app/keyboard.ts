/**
 * Keyboard map (contracts/ui-flows.md, FR-059 to FR-062, research R22).
 * Pure: keyToAction turns one key event into an action for the current screen, or null when the key does nothing.
 * Keys with Ctrl, Alt or Meta stay with the browser, repeated Enter and Space are ignored, and no key opens the parent gate.
 * Amendment 05: the arrow keys do nothing; only digits, Minus, Backspace, Enter, Space, H and Escape act.
 * Amendment 11 (FR-062, FR-092): G on the start screen opens the garage when it is on; in the garage, digits type an
 * item number, Backspace deletes a digit, Enter chooses and Escape goes back.
 * Amendment 17 (FR-062, FR-121): 1, 2 and 3 on the start screen start "Gemischt", "Nur Zahlenstrahl" and "Nur Rechnen"
 * when that mode is offered; Enter and Space start without a mode, and the app starts the first offered one.
 */
import type { Digit } from '../core/battle/entry';
import { PLAY_MODES, type PlayMode } from '../core/settings/schema';

/** The fields of a KeyboardEvent the map reads. */
export interface KeyLike {
  key: string;
  code?: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  shiftKey?: boolean;
  repeat: boolean;
}

/** `battle` covers the phases in which the child chooses a number (`aiming`, `challenge`). */
export type KeyScreen = 'start' | 'battle' | 'paused' | 'roundEnd' | 'garage';

export type KeyAction =
  | { type: 'digit'; digit: Digit }
  | { type: 'minus' }
  | { type: 'backspace' }
  | { type: 'confirm' }
  | { type: 'help' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'start'; mode?: PlayMode }
  | { type: 'newRound' }
  | { type: 'garage' }
  | { type: 'back' };

export interface KeyContext {
  /** Help level of the current challenge; 3 is the solution step. */
  helpLevel?: number;
  /** The parent's "Garage und Sterne" setting: G opens the garage only when it is on. */
  garage?: boolean;
  /** The offered play modes (amendment 17): 1, 2 and 3 start only these. */
  modes?: readonly PlayMode[];
}

export function keyToAction(event: KeyLike, screen: KeyScreen, context: KeyContext = {}): KeyAction | null {
  if (event.ctrlKey || event.altKey || event.metaKey) return null;
  const { key } = event;
  const isEnter = key === 'Enter';
  const isSpace = key === ' ' || key === 'Spacebar';
  if ((isEnter || isSpace) && event.repeat) return null;
  const solutionStep = (context.helpLevel ?? 0) >= 3;

  switch (screen) {
    case 'start':
      if (isEnter || isSpace) return { type: 'start' };
      if (/^[1-3]$/.test(key)) {
        const mode = PLAY_MODES[Number(key) - 1]!;
        return !event.repeat && context.modes?.includes(mode) ? { type: 'start', mode } : null;
      }
      return (key === 'g' || key === 'G') && context.garage === true ? { type: 'garage' } : null;
    case 'garage':
      if (/^[0-9]$/.test(key)) return { type: 'digit', digit: Number(key) as Digit };
      if (key === 'Backspace') return { type: 'backspace' };
      if (isEnter) return { type: 'confirm' };
      return key === 'Escape' ? { type: 'back' } : null;
    case 'roundEnd':
      return isEnter || isSpace ? { type: 'newRound' } : null;
    case 'paused':
      return isEnter || isSpace || key === 'Escape' ? { type: 'resume' } : null;
    case 'battle':
      break;
  }

  if (/^[0-9]$/.test(key)) return { type: 'digit', digit: Number(key) as Digit };
  if (key === '-' || key === 'Subtract') return { type: 'minus' };
  if (key === 'Backspace') return { type: 'backspace' };
  if (isEnter) return { type: 'confirm' };
  if (isSpace) return solutionStep ? { type: 'confirm' } : null;
  if (key === 'h' || key === 'H') return solutionStep ? null : { type: 'help' };
  if (key === 'Escape') return { type: 'pause' };
  return null;
}

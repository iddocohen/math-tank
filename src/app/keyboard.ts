/**
 * Keyboard map (contracts/ui-flows.md, FR-059 to FR-062, research R22).
 * Pure: keyToAction turns one key event into an action for the current screen, or null when the key does nothing.
 * Keys with Ctrl, Alt or Meta stay with the browser, repeated Enter and Space are ignored, and no key opens the parent gate.
 * Amendment 05: the arrow keys do nothing; only digits, Minus, Backspace, Enter, Space, H and Escape act.
 */
import type { Digit } from '../core/battle/entry';

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
export type KeyScreen = 'start' | 'battle' | 'paused' | 'roundEnd';

export type KeyAction =
  | { type: 'digit'; digit: Digit }
  | { type: 'minus' }
  | { type: 'backspace' }
  | { type: 'confirm' }
  | { type: 'help' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'start' }
  | { type: 'newRound' };

export interface KeyContext {
  /** Help level of the current challenge; 3 is the solution step. */
  helpLevel?: number;
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
      return isEnter || isSpace ? { type: 'start' } : null;
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

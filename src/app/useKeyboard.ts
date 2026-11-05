/**
 * One `keydown` listener on window (research R22, FR-059 to FR-062). keyToAction decides what a key does on the
 * current screen; handled keys call preventDefault so the page does not scroll and no focused button is clicked.
 * `screen` null means keys do nothing, for example while a shell is in flight.
 */
import { useEffect, useRef } from 'react';
import type { BattleController } from '../core/battle/controller';
import { keyToAction, type KeyAction, type KeyScreen } from './keyboard';

export interface KeyboardOptions {
  screen: KeyScreen | null;
  helpLevel?: number;
  onAction: (action: KeyAction) => void;
}

export function useKeyboard({ screen, helpLevel = 0, onAction }: KeyboardOptions): void {
  const latest = useRef({ screen, helpLevel, onAction });
  latest.current = { screen, helpLevel, onAction };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { screen: current, helpLevel: level, onAction: handle } = latest.current;
      if (current === null || isTextField(event.target)) return;
      const action = keyToAction(event, current, { helpLevel: level });
      if (action === null) return;
      event.preventDefault();
      handle(action);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

/** Battle actions go to controller methods. Returns false for actions the battle does not handle (start, newRound). */
export function applyBattleAction(controller: BattleController, action: KeyAction): boolean {
  switch (action.type) {
    case 'digit':
      controller.typeDigit(action.digit);
      return true;
    case 'minus':
      controller.typeMinus();
      return true;
    case 'backspace':
      controller.backspace();
      return true;
    case 'confirm':
      controller.confirm();
      return true;
    case 'pause':
      controller.pause();
      return true;
    case 'resume':
      controller.resume();
      return true;
    case 'help':
      // Help steps arrive with guided mode; free play has no help step yet.
      return true;
    case 'start':
    case 'newRound':
      return false;
  }
}

/** Parent screens have text fields later; typing there must not reach the game. */
function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}

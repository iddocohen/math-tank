import { describe, expect, it } from 'vitest';
import { keyToAction, type KeyAction, type KeyLike, type KeyScreen } from './keyboard';

const key = (k: string, extra: Partial<KeyLike> = {}): KeyLike => ({ key: k, code: '', ctrlKey: false, altKey: false, metaKey: false, repeat: false, ...extra });
const SCREENS: KeyScreen[] = ['start', 'battle', 'paused', 'roundEnd'];

describe('keyToAction: digits and entry keys in battle (FR-060)', () => {
  it('maps main-row digits 0 to 9 to digit actions', () => {
    for (let d = 0; d <= 9; d++) {
      expect(keyToAction(key(String(d), { code: `Digit${d}` }), 'battle')).toEqual({ type: 'digit', digit: d });
    }
  });

  it('maps numpad digits 0 to 9 to digit actions', () => {
    for (let d = 0; d <= 9; d++) {
      expect(keyToAction(key(String(d), { code: `Numpad${d}` }), 'battle')).toEqual({ type: 'digit', digit: d });
    }
  });

  it('maps minus (main row and numpad) and Backspace', () => {
    expect(keyToAction(key('-', { code: 'Minus' }), 'battle')).toEqual({ type: 'minus' });
    expect(keyToAction(key('-', { code: 'NumpadSubtract' }), 'battle')).toEqual({ type: 'minus' });
    expect(keyToAction(key('Backspace'), 'battle')).toEqual({ type: 'backspace' });
  });

  it('ignores digits, minus and Backspace outside the battle', () => {
    for (const screen of ['start', 'paused', 'roundEnd'] as const) {
      expect(keyToAction(key('5'), screen)).toBeNull();
      expect(keyToAction(key('-'), screen)).toBeNull();
      expect(keyToAction(key('Backspace'), screen)).toBeNull();
    }
  });
});

describe('keyToAction: Enter and Space (FR-061, FR-062)', () => {
  it('Enter confirms in battle, starts on the start screen, starts a new round at the round end, resumes when paused', () => {
    expect(keyToAction(key('Enter'), 'battle')).toEqual({ type: 'confirm' });
    expect(keyToAction(key('Enter', { code: 'NumpadEnter' }), 'battle')).toEqual({ type: 'confirm' });
    expect(keyToAction(key('Enter'), 'start')).toEqual({ type: 'start' });
    expect(keyToAction(key('Enter'), 'roundEnd')).toEqual({ type: 'newRound' });
    expect(keyToAction(key('Enter'), 'paused')).toEqual({ type: 'resume' });
  });

  it('Space starts, starts a new round and resumes', () => {
    expect(keyToAction(key(' ', { code: 'Space' }), 'start')).toEqual({ type: 'start' });
    expect(keyToAction(key(' ', { code: 'Space' }), 'roundEnd')).toEqual({ type: 'newRound' });
    expect(keyToAction(key(' ', { code: 'Space' }), 'paused')).toEqual({ type: 'resume' });
  });

  it('Space confirms in battle only at help level 3 (the solution step)', () => {
    expect(keyToAction(key(' ', { code: 'Space' }), 'battle')).toBeNull();
    expect(keyToAction(key(' ', { code: 'Space' }), 'battle', { helpLevel: 2 })).toBeNull();
    expect(keyToAction(key(' ', { code: 'Space' }), 'battle', { helpLevel: 3 })).toEqual({ type: 'confirm' });
  });

  it('ignores repeated Enter and Space everywhere', () => {
    for (const screen of SCREENS) {
      expect(keyToAction(key('Enter', { repeat: true }), screen, { helpLevel: 3 })).toBeNull();
      expect(keyToAction(key(' ', { code: 'Space', repeat: true }), screen, { helpLevel: 3 })).toBeNull();
    }
  });
});

describe('keyToAction: arrows, help and pause', () => {
  it('maps arrows to nudges of plus and minus 1 and 10 in battle', () => {
    expect(keyToAction(key('ArrowLeft'), 'battle')).toEqual({ type: 'nudge', delta: -1 });
    expect(keyToAction(key('ArrowRight'), 'battle')).toEqual({ type: 'nudge', delta: 1 });
    expect(keyToAction(key('ArrowUp'), 'battle')).toEqual({ type: 'nudge', delta: 10 });
    expect(keyToAction(key('ArrowDown'), 'battle')).toEqual({ type: 'nudge', delta: -10 });
    expect(keyToAction(key('ArrowLeft'), 'start')).toBeNull();
  });

  it('maps h and H to help in battle, but not at the solution step', () => {
    expect(keyToAction(key('h'), 'battle')).toEqual({ type: 'help' });
    expect(keyToAction(key('H'), 'battle')).toEqual({ type: 'help' });
    expect(keyToAction(key('h'), 'battle', { helpLevel: 3 })).toBeNull();
    expect(keyToAction(key('h'), 'start')).toBeNull();
  });

  it('Escape pauses the battle and resumes a paused round', () => {
    expect(keyToAction(key('Escape'), 'battle')).toEqual({ type: 'pause' });
    expect(keyToAction(key('Escape'), 'paused')).toEqual({ type: 'resume' });
    expect(keyToAction(key('Escape'), 'start')).toBeNull();
    expect(keyToAction(key('Escape'), 'roundEnd')).toBeNull();
  });
});

describe('keyToAction: ignored keys (research R22, FR-045)', () => {
  it('returns null for keys with Ctrl, Alt or Meta', () => {
    for (const mod of ['ctrlKey', 'altKey', 'metaKey'] as const) {
      for (const screen of SCREENS) {
        for (const k of ['5', 'Enter', ' ', 'ArrowLeft', 'h', 'Escape', 'Backspace', '-']) {
          expect(keyToAction(key(k, { [mod]: true }), screen, { helpLevel: 3 })).toBeNull();
        }
      }
    }
  });

  it('returns null for unrelated keys', () => {
    for (const k of ['a', 'Tab', 'Shift', 'F5', '+', 'g']) {
      expect(keyToAction(key(k), 'battle')).toBeNull();
    }
  });

  it('no key returns an action that opens the parent gate', () => {
    const allowed: KeyAction['type'][] = ['digit', 'minus', 'backspace', 'confirm', 'nudge', 'help', 'pause', 'resume', 'start', 'newRound'];
    const keys = ['g', 'G', 'p', 'P', 'e', 's', 'Enter', ' ', 'Escape', 'Tab', 'F1', 'Home', 'End', 'Delete', '1', '-', 'h', 'ArrowUp'];
    for (const screen of SCREENS) {
      for (const k of keys) {
        for (const extra of [{}, { shiftKey: true }, { repeat: true }] as Partial<KeyLike>[]) {
          const action = keyToAction(key(k, extra), screen, { helpLevel: 3 });
          if (action !== null) expect(allowed).toContain(action.type);
        }
      }
    }
  });
});

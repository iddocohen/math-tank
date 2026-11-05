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
  it('arrow keys do nothing on any screen or help level (amendment 05, FR-061)', () => {
    for (const screen of SCREENS) {
      for (const level of [0, 1, 2, 3]) {
        for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
          expect(keyToAction(key(k), screen, { helpLevel: level }), `${screen} ${level} ${k}`).toBeNull();
        }
      }
    }
  });

  it('in battle only digits, minus, Backspace, Enter, Space at the solution step, H and Escape act (amendment 05, FR-062)', () => {
    const acting = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-', 'Backspace', 'Enter', ' ', 'h', 'H', 'Escape']);
    const printable = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i));
    const named = ['Tab', 'Home', 'End', 'PageUp', 'PageDown', 'Delete', 'Insert', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Backspace', 'Enter', 'Escape'];
    const fKeys = Array.from({ length: 12 }, (_, i) => `F${i + 1}`);
    for (const k of [...printable, ...named, ...fKeys]) {
      // Space acts only at the solution step and H only before it, so both levels are asked.
      const action = keyToAction(key(k), 'battle', { helpLevel: 3 }) ?? keyToAction(key(k), 'battle');
      if (acting.has(k)) expect(action, JSON.stringify(k)).not.toBeNull();
      else expect(action, JSON.stringify(k)).toBeNull();
    }
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
    const allowed: KeyAction['type'][] = ['digit', 'minus', 'backspace', 'confirm', 'help', 'pause', 'resume', 'start', 'newRound'];
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

describe('keyToAction: no key starts a new scene (amendment 03, FR-070)', () => {
  it('maps no key to a new round during battle or pause, only Enter and Space at the round end', () => {
    const keys = [
      ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-+=.,/;\'[]\\`'.split(''),
      ' ', 'Enter', 'Escape', 'Tab', 'Backspace', 'Delete', 'Home', 'End', 'PageUp', 'PageDown', 'F5',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    ];
    for (const k of keys) {
      for (const extra of [{}, { shiftKey: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }]) {
        for (const screen of ['battle', 'paused'] as const) {
          expect(keyToAction(key(k, extra), screen)?.type, `${screen} ${JSON.stringify(k)}`).not.toBe('newRound');
        }
        const atEnd = keyToAction(key(k, extra), 'roundEnd');
        if (atEnd?.type === 'newRound') expect(['Enter', ' ']).toContain(k);
      }
    }
  });
});

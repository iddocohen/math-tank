/**
 * Amendment 12 (FR-053, FR-102, FR-103): the on-screen number pad. Its keys act like the keyboard's digits, Minus and
 * Backspace, never take focus, and are at least 48 by 48 CSS pixels through the class `pad-key`.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '../i18n';
import { NumberPad } from './NumberPad';

function setup(over: { negative?: boolean; disabled?: boolean } = {}) {
  const onDigit = vi.fn();
  const onMinus = vi.fn();
  const onBackspace = vi.fn();
  render(<NumberPad negative={over.negative ?? false} disabled={over.disabled ?? false} onDigit={onDigit} onMinus={onMinus} onBackspace={onBackspace} />);
  return { onDigit, onMinus, onBackspace };
}

const key = (k: string) => screen.getByTestId('number-pad').querySelector(`[data-key="${k}"]`) as HTMLButtonElement | null;

afterEach(cleanup);

describe('NumberPad (amendment 12)', () => {
  it('has the keys 0 to 9 and ⌫, and no minus key for a range without negative numbers', () => {
    setup();
    const keys = screen.getAllByTestId('pad-key').map((b) => b.getAttribute('data-key'));
    expect([...keys].sort()).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'backspace'].sort());
    expect(key('minus')).toBeNull();
    expect(key('backspace')!.getAttribute('aria-label')).toBe(t().battle.backspace);
  });

  it('has a minus key when the range has negative numbers', () => {
    const { onMinus } = setup({ negative: true });
    expect(key('minus')).not.toBeNull();
    fireEvent.click(key('minus')!);
    expect(onMinus).toHaveBeenCalledTimes(1);
  });

  it('taps type digits and ⌫ deletes, like the keyboard', () => {
    const { onDigit, onBackspace } = setup();
    fireEvent.click(key('3')!);
    fireEvent.click(key('7')!);
    fireEvent.click(key('backspace')!);
    expect(onDigit.mock.calls).toEqual([[3], [7]]);
    expect(onBackspace).toHaveBeenCalledTimes(1);
  });

  it('keys never take focus and carry the pad-key class (48 by 48 CSS pixels at least)', () => {
    setup({ negative: true });
    for (const b of screen.getAllByTestId('pad-key')) {
      expect(b.getAttribute('tabindex')).toBe('-1');
      expect(b.classList.contains('pad-key')).toBe(true);
      expect(b.getAttribute('type')).toBe('button');
    }
  });

  it('disabled keys do nothing', () => {
    const { onDigit } = setup({ disabled: true });
    const five = key('5')!;
    expect(five.disabled).toBe(true);
    fireEvent.click(five);
    expect(onDigit).not.toHaveBeenCalled();
  });
});

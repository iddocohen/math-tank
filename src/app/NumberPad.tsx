/**
 * On-screen number pad (amendment 12, FR-053, FR-102, FR-103): keys 0 to 9, ⌫ and, only for a range with negative
 * numbers, a minus key. Each key calls the same controller method as the keyboard (typeDigit, backspace, typeMinus),
 * so the pad counts as keyboard input for "Finde N" (FR-076). The fire key is the overlay's fire button.
 *
 * Keys never take focus (tabIndex -1, mousedown default prevented), so a physical keyboard keeps working next to the
 * pad. Each key has a grid area (`d0` to `d9`, `bs`, `mi`), so the stylesheet can order them per layout: two rows in
 * the bottom bar, a phone-style grid (1 2 3 / 4 5 6 / 7 8 9 / minus 0 ⌫) in the portrait and side layouts.
 */
import type { Digit } from '../core/battle/entry';
import { t } from '../i18n';

const DIGITS: Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

interface Props {
  /** True when the range has negative numbers: only then is there a minus key. */
  negative: boolean;
  /** True while the child cannot choose a number (a shell in flight, a pause, the round end). */
  disabled: boolean;
  onDigit: (d: Digit) => void;
  onMinus: () => void;
  onBackspace: () => void;
}

export function NumberPad({ negative, disabled, onDigit, onMinus, onBackspace }: Props) {
  const m = t();
  return (
    <div className="number-pad" data-testid="number-pad" role="group" aria-label={m.battle.numberPad}>
      {DIGITS.map((d) => (
        <PadKey key={d} name={String(d)} area={`d${d}`} disabled={disabled} onPress={() => onDigit(d)}>
          {d}
        </PadKey>
      ))}
      {negative && (
        <PadKey name="minus" area="mi" label={m.battle.minus} disabled={disabled} onPress={onMinus}>
          −
        </PadKey>
      )}
      <PadKey name="backspace" area="bs" label={m.battle.backspace} disabled={disabled} onPress={onBackspace}>
        ⌫
      </PadKey>
    </div>
  );
}

function PadKey({ name, area, label, disabled, onPress, children }: { name: string; area: string; label?: string; disabled: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={`pad-key pad-key-${name}`}
      data-testid="pad-key"
      data-key={name}
      aria-label={label}
      style={{ gridArea: area }}
      tabIndex={-1}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onKeyDown={(e) => e.preventDefault()}
      onClick={onPress}
    >
      {children}
    </button>
  );
}

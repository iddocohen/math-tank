/**
 * The tank garage (amendment 11, FR-091, FR-092, contracts/ui-flows.md "Garage"). Opened from the start screen with
 * the "Garage" button or G. It shows a preview tank, the star total and every item in four groups, numbered 1 to 17.
 * An unlocked item is chosen with one tap or click; a locked item is a grey silhouette with "noch N Sterne" and does
 * nothing. With the keyboard the child types an item's number (two digits for items above 9, like an answer), the
 * item is selected and shown on the preview when it is unlocked, and Enter chooses it; Escape goes back.
 *
 * The garage has its own window key listener (useKeyboard with the 'garage' screen); the app's listener is off while
 * the garage is shown.
 */
import { useState, type ReactElement } from 'react';
import { isUnlocked, starsNeeded, type Garage as GarageData } from '../core/rewards/garage';
import { GARAGE_ITEMS, GARAGE_KINDS, itemNumber, type GarageItem, type Look } from '../core/rewards/items';
import { lookKey } from '../core/rewards/garage';
import { t } from '../i18n';
import { ItemIcon, TankPreview } from './TankPreview';
import { StarTotal } from './StarTotal';
import { useKeyboard } from './useKeyboard';
import type { KeyAction } from './keyboard';

interface Props {
  garage: GarageData;
  onEquip: (id: string) => void;
  onBack: () => void;
}

/** At most two digits: there are 17 items. */
const MAX_DIGITS = 2;

export function Garage({ garage, onEquip, onBack }: Props): ReactElement {
  const m = t();
  const G = m.garage;
  const [typed, setTyped] = useState('');
  const selected: GarageItem | undefined = typed === '' ? undefined : GARAGE_ITEMS[Number(typed) - 1];
  const unlocked = (item: GarageItem) => isUnlocked(garage.stars, item.id);
  const preview: Look = selected && unlocked(selected) ? { ...garage.look, [selected.kind]: selected.id } : garage.look;

  const choose = (item: GarageItem) => {
    if (unlocked(item)) onEquip(item.id);
  };

  useKeyboard({
    screen: 'garage',
    onAction: (action: KeyAction) => {
      switch (action.type) {
        case 'digit':
          setTyped((s) => {
            if (s.length >= MAX_DIGITS) return s;
            return s === '0' ? String(action.digit) : s + String(action.digit);
          });
          return;
        case 'backspace':
          setTyped((s) => s.slice(0, -1));
          return;
        case 'confirm':
          if (selected) choose(selected);
          setTyped('');
          return;
        case 'back':
          onBack();
          return;
        default:
          return;
      }
    },
  });

  return (
    <main className="garage" data-testid="garage" data-look={lookKey(garage.look)} aria-label={G.title}>
      <header className="garage-header">
        <h1 className="title">{G.title}</h1>
        <StarTotal stars={garage.stars} />
        <button type="button" className="secondary-button" onClick={onBack}>
          {G.back}
        </button>
      </header>
      <TankPreview look={preview} label={G.preview} />
      <div className="garage-groups">
        {GARAGE_KINDS.map((kind) => (
          <section key={kind} className="garage-group" role="group" aria-label={G.kinds[kind]}>
            <h2>{G.kinds[kind]}</h2>
            <div className="garage-items">
              {GARAGE_ITEMS.filter((i) => i.kind === kind).map((item) => {
                const open = unlocked(item);
                const chosen = garage.look[item.kind] === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    tabIndex={-1}
                    className="garage-item"
                    data-testid={`garage-item-${item.id}`}
                    data-locked={String(!open)}
                    data-chosen={String(chosen)}
                    data-selected={String(selected === item)}
                    aria-disabled={open ? undefined : 'true'}
                    aria-pressed={open ? chosen : undefined}
                    onClick={() => choose(item)}
                  >
                    <span className="garage-number">{itemNumber(item.id)}</span>
                    <ItemIcon item={item} grey={!open} />
                    <span className="garage-name">{open ? G.items[item.id] : G.stillNeeded(starsNeeded(garage.stars, item.id))}</span>
                    {chosen && <span className="garage-chosen">{G.chosen}</span>}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

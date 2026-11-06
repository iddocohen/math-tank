/**
 * The tank garage as a star shop (amendment 11, changed by amendment 19; FR-091, FR-092, FR-130, FR-131;
 * contracts/ui-flows.md "Garage, star shop and the equipped look"). Opened from the start screen with the "Garage"
 * button or G. It shows a preview tank, the star balance and every item in four groups, sorted by price and numbered
 * 1 to 17.
 *
 * - An owned item is equipped with one tap or click, at no cost.
 * - An item not owned shows its price. When the balance reaches it, a tap opens "Für N Sterne kaufen?" with "Ja" and
 *   "Nein"; otherwise it is a grey silhouette with "noch N Sterne" and does nothing.
 * - An owned item that is not basic has "Zurückgeben", which asks "Zurückgeben? Du bekommst N Sterne.".
 * - Keyboard: the child types an item's number (two digits above 9, like an answer); the preview shows it when it is
 *   owned or can be bought; Enter equips it or opens the buy question. While a question shows, Enter answers "Ja",
 *   Escape answers "Nein", and every other key does nothing. Without a question, Escape goes back.
 *
 * The garage has its own window key listener (useKeyboard with the 'garage' screen); the app's listener is off while
 * the garage is shown.
 */
import { useState, type ReactElement } from 'react';
import { canBuy, isOwned, lookKey, starsNeeded, type Garage as GarageData } from '../core/rewards/garage';
import { GARAGE_ITEMS, GARAGE_KINDS, itemNumber, type GarageItem, type Look } from '../core/rewards/items';
import { t } from '../i18n';
import { ItemIcon, TankPreview } from './TankPreview';
import { StarTotal } from './StarTotal';
import { useKeyboard } from './useKeyboard';
import type { KeyAction } from './keyboard';

interface Props {
  garage: GarageData;
  onEquip: (id: string) => void;
  onBuy: (id: string) => void;
  onReturn: (id: string) => void;
  onBack: () => void;
}

/** At most two digits: there are 17 items. */
const MAX_DIGITS = 2;

/** The open question: buy an item not owned, or give an owned item back. */
type Question = { kind: 'buy' | 'return'; item: GarageItem };

export function Garage({ garage, onEquip, onBuy, onReturn, onBack }: Props): ReactElement {
  const m = t();
  const G = m.garage;
  const [typed, setTyped] = useState('');
  const [question, setQuestion] = useState<Question | null>(null);
  const selected: GarageItem | undefined = typed === '' ? undefined : GARAGE_ITEMS[Number(typed) - 1];
  const owned = (item: GarageItem) => isOwned(garage, item.id);
  const reachable = (item: GarageItem) => owned(item) || canBuy(garage, item.id);
  const preview: Look = selected && reachable(selected) ? { ...garage.look, [selected.kind]: selected.id } : garage.look;

  const choose = (item: GarageItem) => {
    if (owned(item)) onEquip(item.id);
    else if (canBuy(garage, item.id)) setQuestion({ kind: 'buy', item });
  };

  const answer = (yes: boolean) => {
    if (yes && question) (question.kind === 'buy' ? onBuy : onReturn)(question.item.id);
    setQuestion(null);
    setTyped('');
  };

  useKeyboard({
    screen: 'garage',
    onAction: (action: KeyAction) => {
      if (question) {
        if (action.type === 'confirm') answer(true);
        else if (action.type === 'back') answer(false);
        return;
      }
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
        <StarTotal stars={garage.balance} />
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
                const has = owned(item);
                const open = reachable(item);
                const chosen = garage.look[item.kind] === item.id;
                return (
                  <div key={item.id} className="garage-cell">
                    <button
                      type="button"
                      tabIndex={-1}
                      className="garage-item"
                      data-testid={`garage-item-${item.id}`}
                      data-owned={String(has)}
                      data-locked={String(!open)}
                      data-chosen={String(chosen)}
                      data-selected={String(selected === item)}
                      aria-disabled={open ? undefined : 'true'}
                      aria-pressed={has ? chosen : undefined}
                      onClick={() => choose(item)}
                    >
                      <span className="garage-number">{itemNumber(item.id)}</span>
                      <ItemIcon item={item} grey={!open} />
                      <span className="garage-name">{open ? G.items[item.id] : G.stillNeeded(starsNeeded(garage.balance, item.id))}</span>
                      {!has && <span className="garage-price">{G.price(item.price)}</span>}
                      {chosen && <span className="garage-chosen">{G.chosen}</span>}
                    </button>
                    {has && item.price > 0 && (
                      <button
                        type="button"
                        tabIndex={-1}
                        className="garage-return"
                        data-testid={`garage-return-${item.id}`}
                        onClick={() => setQuestion({ kind: 'return', item })}
                      >
                        {G.returnItem}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {question && (
        <div className="garage-dialog-backdrop">
          <div className="garage-dialog" role="dialog" aria-modal="true" data-testid="garage-dialog" data-kind={question.kind} aria-labelledby="garage-dialog-text">
            <p id="garage-dialog-text" className="garage-dialog-text">
              {question.kind === 'buy' ? G.buyQuestion(question.item.price) : G.returnQuestion(question.item.price)}
            </p>
            <div className="garage-dialog-buttons">
              <button type="button" tabIndex={-1} className="primary-button dialog-button" onClick={() => answer(true)}>
                {G.yes}
              </button>
              <button type="button" tabIndex={-1} className="secondary-button dialog-button" onClick={() => answer(false)}>
                {G.no}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

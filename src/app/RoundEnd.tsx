/**
 * Round end (FR-008, FR-085, FR-086, amendment 06, US1 scenarios 7 and 8): an encouraging message chosen by the
 * outcome, the result "9 Panzer getroffen in 6:12", and the personal best: "Neuer Rekord!" with a short pop and
 * sparkle, or the record in small neutral text ("Dein Rekord: 12"). Nothing compares the two numbers, and nothing
 * says "verloren" or "nicht geschafft". `record` is null when the parent turned off "Rekord zeigen".
 * "Nochmal" (or Enter or Space, handled by the app's keyboard listener, FR-062) starts a new round without a page
 * reload; "Zum Start" goes back to the start screen.
 * Amendments 11 and 19 (FR-094, FR-095): with the garage on, the end screen shows the stars of this round ("+3 Sterne"),
 * the balance, and at most one line naming an item the balance now reaches ("Genug Sterne für: Krone"), with sparkles.
 * Nothing says how many stars are missing, and nothing asks the child to buy.
 */
import { formatTime, type BestResult } from '../core/records/records';
import type { RoundState } from '../core/types';
import { t } from '../i18n';
import type { GarageItem } from '../core/rewards/items';
import { StarTotal } from './StarTotal';

export interface RoundRecord {
  newRecord: boolean;
  best: BestResult | null;
}

interface Props {
  outcome: RoundState['outcome'];
  enemiesDestroyed: number;
  elapsedMs: number;
  /** The personal best after this round, or null when records are not shown. */
  record: RoundRecord | null;
  /** The stars of this round, the balance and one item the balance now reaches, or null when the garage is off. */
  garage?: { earned: number; balance: number; affordable: GarageItem | null } | null;
  onAgain: () => void;
  onBackToStart: () => void;
}

export function RoundEnd({ outcome, enemiesDestroyed, elapsedMs, record, garage = null, onAgain, onBackToStart }: Props) {
  const m = t();
  const message = outcome === 'goalReached' ? m.roundEnd.goalReached : m.roundEnd.heartsGone;
  return (
    <div className="round-end" data-testid="round-end" data-outcome={outcome ?? undefined} role="dialog" aria-modal="true" aria-label={message}>
      <p className="round-end-message">{message}</p>
      <p className="round-result" data-testid="round-result">
        {m.roundEnd.result(enemiesDestroyed, formatTime(elapsedMs))}
      </p>
      {record?.newRecord ? (
        // The sparkles are CSS pseudo-elements, so screen readers read only the words.
        <p className="new-record" data-testid="new-record">
          {m.roundEnd.newRecord}
        </p>
      ) : record?.best ? (
        <p className="record" data-testid="record">
          {m.roundEnd.yourRecord(record.best.enemies)}
        </p>
      ) : null}
      {garage && (
        <p className="round-stars" data-testid="round-stars">
          {m.roundEnd.starsEarned(garage.earned)}
        </p>
      )}
      {garage && <StarTotal stars={garage.balance} />}
      {garage?.affordable && (
        <p className="unlocked" data-testid="affordable">
          {m.roundEnd.affordable(m.garage.items[garage.affordable.id])}
        </p>
      )}
      <div className="round-end-buttons">
        <button type="button" className="primary-button" onClick={onAgain}>
          {m.roundEnd.again}
        </button>
        <button type="button" className="secondary-button" onClick={onBackToStart}>
          {m.roundEnd.backToStart}
        </button>
      </div>
    </div>
  );
}

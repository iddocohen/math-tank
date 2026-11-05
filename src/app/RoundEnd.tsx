/**
 * Round end (FR-008, US1 scenarios 7 and 8): an encouraging message chosen by the outcome,
 * "Nochmal" for a new round without a page reload, and a way back to the start screen.
 * A round that ends because all turns are used names no winner.
 */
import type { RoundState } from '../core/types';
import { t } from '../i18n';

interface Props {
  outcome: RoundState['outcome'];
  onAgain: () => void;
  onBackToStart: () => void;
}

export function RoundEnd({ outcome, onAgain, onBackToStart }: Props) {
  const m = t();
  const message = outcome === 'playerWon' ? m.roundEnd.playerWon : outcome === 'enemyWon' ? m.roundEnd.enemyWon : m.roundEnd.turnsUsed;
  return (
    <div className="round-end" data-testid="round-end" role="dialog" aria-modal="true" aria-label={message}>
      <p className="round-end-message">{message}</p>
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

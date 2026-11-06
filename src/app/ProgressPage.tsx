/**
 * Parent progress page (FR-040, FR-087, contracts/ui-flows.md "Progress", US7 scenarios 4, 5 and 8). Opened from the
 * parent menu, so it sits behind the same gate as the settings. It shows per skill and range the attempts, the
 * independent correct answers and the answers with help in separate columns, the current difficulty step and
 * mastered or developing; the skills that needed the most help; the sessions; and the personal bests per range,
 * ruler starting level and round type as a plain list without ranking. "Fortschritt zurücksetzen" asks first and
 * then clears the progress; the personal bests and the stars stay.
 * Amendment 17 (FR-040, FR-086): the column "Bis zur nächsten Stufe" shows how many more correct answers in a row raise
 * each skill, and the bests name the play mode.
 * Amendment 11 (FR-096): the star total of the tank garage and a separate "Sterne zurücksetzen" with its own
 * confirmation, which sets the balance to 0, keeps only the basic items and equips the basic look (amendment 19: the
 * balance and the total stars ever earned show, and the total stays after the reset, FR-132).
 * Amendment 24: "Alles zurücksetzen" asks first, then clears progress, personal bests, stars and the garage; the
 * settings stay.
 */
import { useMemo, useState } from 'react';
import { formatTime } from '../core/records/records';
import { parseRangeKey, summarize } from '../core/progress/summarize';
import { emptyProgress } from '../core/storage/storage';
import { t } from '../i18n';
import type { Persistence } from './persistence';

interface Props {
  persistence: Pick<Persistence, 'progress' | 'records' | 'saveProgress' | 'garage' | 'resetStars' | 'resetAll' | 'settings'>;
  onClose: () => void;
}

const DATE = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function ProgressPage({ persistence, onClose }: Props) {
  const m = t();
  const P = m.progressPage;
  const [progress, setProgress] = useState(() => persistence.progress());
  const [done, setDone] = useState(false);
  const [garage, setGarage] = useState(() => persistence.garage());
  const [starsDone, setStarsDone] = useState(false);
  const [allDone, setAllDone] = useState<'ok' | 'failed' | null>(null);
  const records = persistence.records();
  const settings = persistence.settings();
  const summary = useMemo(() => summarize(progress, records, settings), [progress, records, settings]);

  const rangeText = (rangeKey: string) => {
    const r = parseRangeKey(rangeKey);
    return r ? P.range(r.min, r.max) : rangeKey;
  };

  const reset = () => {
    const empty = emptyProgress();
    persistence.saveProgress(empty);
    setProgress(empty);
    setDone(true);
  };

  const resetStars = () => {
    persistence.resetStars();
    setGarage(persistence.garage());
    setStarsDone(true);
  };

  const resetAll = () => {
    const ok = persistence.resetAll().ok;
    setProgress(persistence.progress());
    setGarage(persistence.garage());
    setAllDone(ok ? 'ok' : 'failed');
  };

  return (
    <div className="settings-page progress-page" role="dialog" aria-modal="true" aria-label={P.title} data-testid="progress-page">
      <header className="settings-header">
        <h2>{P.title}</h2>
        <div className="settings-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            {m.parent.close}
          </button>
        </div>
      </header>

      <div className="settings-notices" role="status" aria-live="polite">
        {done && <p className="notice ok">{P.resetDone}</p>}
        {starsDone && <p className="notice ok">{P.starsResetDone}</p>}
        {allDone === 'ok' && <p className="notice ok">{P.resetAllDone}</p>}
        {allDone === 'failed' && <p className="notice warn">{P.resetAllFailed}</p>}
      </div>

      <section className="settings-group">
        <h3>{P.skillsTitle}</h3>
        {summary.skills.length === 0 ? (
          <p>{P.empty}</p>
        ) : (
          <div className="progress-table-wrap">
            <table className="progress-table" aria-label={P.skillsTitle}>
              <thead>
                <tr>
                  <th scope="col">{P.columns.skill}</th>
                  <th scope="col">{P.columns.range}</th>
                  <th scope="col">{P.columns.attempts}</th>
                  <th scope="col">{P.columns.independent}</th>
                  <th scope="col">{P.columns.withHelp}</th>
                  <th scope="col">{P.columns.step}</th>
                  <th scope="col">{P.columns.toRaise}</th>
                  <th scope="col">{P.columns.status}</th>
                </tr>
              </thead>
              <tbody>
                {summary.skills.map((r) => (
                  <tr key={`${r.skill}|${r.rangeKey}`} data-status={r.status}>
                    <th scope="row">{P.skills[r.skill]}</th>
                    <td data-col="range">{rangeText(r.rangeKey)}</td>
                    <td data-col="attempts">{r.attempts}</td>
                    <td data-col="independent">{r.independentCorrect}</td>
                    <td data-col="withHelp">{r.withHelp}</td>
                    <td data-col="step">{P.step(r.step + 1, r.stepCount)}</td>
                    <td data-col="toRaise">{r.toRaise !== null ? P.toRaise(r.toRaise) : settings.adaptive ? P.topStep : P.adaptiveOff}</td>
                    <td data-col="status">{P.status[r.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {summary.skills.length > 0 && (
        <section className="settings-group">
          <h3>{P.mostHelpTitle}</h3>
          {summary.mostHelp.length === 0 ? (
            <p>{P.noHelp}</p>
          ) : (
            <ol aria-label={P.mostHelpTitle}>
              {summary.mostHelp.map((r) => (
                <li key={`${r.skill}|${r.rangeKey}`}>{P.mostHelpLine(P.skills[r.skill], rangeText(r.rangeKey), r.helpNeeded)}</li>
              ))}
            </ol>
          )}
        </section>
      )}

      {summary.sessions.length > 0 && (
        <section className="settings-group">
          <h3>{P.sessionsTitle}</h3>
          <div className="progress-table-wrap">
            <table className="progress-table" aria-label={P.sessionsTitle}>
              <thead>
                <tr>
                  <th scope="col">{P.sessionColumns.date}</th>
                  <th scope="col">{P.sessionColumns.attempts}</th>
                  <th scope="col">{P.sessionColumns.independent}</th>
                  <th scope="col">{P.sessionColumns.withHelp}</th>
                </tr>
              </thead>
              <tbody>
                {summary.sessions.map((s) => (
                  <tr key={s.id}>
                    <td data-col="date">{DATE.format(s.startedAt)}</td>
                    <td data-col="attempts">{s.attempts}</td>
                    <td data-col="independent">{s.independentCorrect}</td>
                    <td data-col="withHelp">{s.withHelp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="settings-group">
        <h3>{P.bestsTitle}</h3>
        {summary.bests.length === 0 ? (
          <p>{P.noBests}</p>
        ) : (
          <div className="progress-table-wrap">
            <table className="progress-table" aria-label={P.bestsTitle}>
              <thead>
                <tr>
                  <th scope="col">{P.bestColumns.range}</th>
                  <th scope="col">{P.bestColumns.roundType}</th>
                  <th scope="col">{P.bestColumns.level}</th>
                  <th scope="col">{P.bestColumns.mode}</th>
                  <th scope="col">{P.bestColumns.enemies}</th>
                  <th scope="col">{P.bestColumns.time}</th>
                </tr>
              </thead>
              <tbody>
                {summary.bests.map((b) => (
                  <tr key={`${b.min}-${b.max}|${b.rulerLevelStart}|${b.roundType}|${b.mode}`}>
                    <td data-col="range">{P.range(b.min, b.max)}</td>
                    <td data-col="roundType">
                      {b.roundType === 'enemyCount' ? m.settings.labels.roundTypeEnemyCount : m.settings.labels.roundTypeUntilHearts}
                    </td>
                    <td data-col="level">{P.level(b.rulerLevelStart)}</td>
                    <td data-col="mode">{m.start.modes[b.mode]}</td>
                    <td data-col="enemies">{b.enemies}</td>
                    <td data-col="time">{formatTime(b.ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="settings-group">
        <ConfirmReset label={P.reset} question={P.resetConfirm} yes={P.resetYes} no={P.resetNo} onAsk={() => setDone(false)} onConfirm={reset} />
      </section>

      <section className="settings-group">
        <p data-testid="progress-stars">{P.stars(garage.balance)}</p>
        <p data-testid="progress-stars-total">{P.starsTotal(garage.totalEarned)}</p>
        <ConfirmReset label={P.starsReset} question={P.starsResetConfirm} yes={P.starsResetYes} no={P.resetNo} onAsk={() => setStarsDone(false)} onConfirm={resetStars} />
      </section>

      <section className="settings-group">
        <ConfirmReset label={P.resetAll} question={P.resetAllConfirm} yes={P.resetAllYes} no={P.resetNo} onAsk={() => setAllDone(null)} onConfirm={resetAll} />
      </section>
    </div>
  );
}

/**
 * A reset button that asks first: the button opens the question with "yes" and "no", and "yes" calls onConfirm.
 * onAsk runs when the question opens, so an earlier "done" note goes away.
 */
function ConfirmReset({ label, question, yes, no, onAsk, onConfirm }: { label: string; question: string; yes: string; no: string; onAsk: () => void; onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div className="progress-reset" role="alertdialog" aria-label={label}>
        <p>{question}</p>
        <div className="data-buttons">
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              onConfirm();
              setConfirming(false);
            }}
          >
            {yes}
          </button>
          <button type="button" className="secondary-button" onClick={() => setConfirming(false)}>
            {no}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="data-buttons">
      <button
        type="button"
        className="secondary-button"
        onClick={() => {
          onAsk();
          setConfirming(true);
        }}
      >
        {label}
      </button>
    </div>
  );
}

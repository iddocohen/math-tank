/**
 * Settings page for parents (FR-046 to FR-049, FR-069, FR-079, contracts/ui-flows.md "Settings").
 *
 * Every field of FR-046, grouped as Aufgaben, Zahlenraum, Plus und Minus, Zahlenstrahl, Hilfe, Gegner, Ton, Runde.
 * The form is checked with `validateSettings` on every change; errors appear next to their fields and "Speichern"
 * stays disabled while any error exists. A range change goes through `withRange`, starting from the limits the
 * parent last chose, so typing a custom range digit by digit does not shrink the limits for good (FR-047).
 * Saving writes through persistence.ts and hands the settings to the app, which passes them to
 * `controller.updateSettings`, so they apply from the next round (FR-049).
 *
 * Amendment 06 (FR-044, FR-082, FR-084, FR-086): there is no "Genau treffen". The Runde group has "Rundenende" with
 * "Bis alle Herzen weg" and "Gegner pro Runde"; the number of enemies (1 to 20) appears only with the second. With
 * "Ohne Schaden spielen" on, "Bis alle Herzen weg" is not offered and the choice switches to "Gegner pro Runde",
 * because the hearts would never go down. "Uhr beim Spielen zeigen" and "Rekord zeigen" are switches.
 *
 * The data section (FR-048a): "Daten sichern" downloads the export file, "Daten laden" reads one, and a note
 * explains how to add the game to the Home Screen.
 * Amendment 14 (FR-114): a line at the end credits the ground texture and links its OpenGameArt page.
 * Amendment 15 (FR-115, FR-118): "Spielstand übertragen" shows a QR code and "Link kopieren" for the saved data of
 * this browser; the link is built again after "Speichern" and after "Daten laden".
 * Amendment 24: when the browser holds a copy of data an earlier version could not read and this version can,
 * a notice names it and "Kopie wiederherstellen" puts it back, then the page reloads.
 * Amendment 26 (FR-148, FR-152): plus and minus each have "Zahlengröße" (KindSettings). "Zwei Zahlen" shows both number
 * ranges and the carry switch and hides the largest operand and the steps; errors show at their field, and the note
 * that only some exercises fit shows under "Zahlengröße" without blocking "Speichern".
 */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { qrMatrix, qrPath, type QrMatrix } from '../core/transfer/qr';
import { encodeTransfer, type EncodedTransfer } from '../core/transfer/transfer';
import type { RulerLevel } from '../core/numberline/ticks';
import { defaultSettings, RANGE_PRESETS, ROUND_LENGTH_MAX, ROUND_LENGTH_MIN, TWO_NUMBER_MAX, TWO_NUMBER_MIN, twoNumberDefaults } from '../core/settings/defaults';
import type { NumberSpan, RangePreset, RoundType, Settings, SettingsRange } from '../core/settings/schema';
import { isTwoNumbers } from '../core/settings/limits';
import { settingsNotices, validateSettings, withRange, type SettingsNotice } from '../core/settings/validate';
import { t } from '../i18n';
import { BUILD_DATE, BUILD_VERSION } from './buildInfo';
import type { DataKind, Persistence } from './persistence';
import { RulerPreview } from './RulerPreview';

const PRESETS: RangePreset[] = ['0-10', '0-20', '0-50', '0-100', '0-1000', 'custom'];
const LEVELS: RulerLevel[] = [1, 2, 3, 4, 5];

interface Props {
  persistence: Persistence;
  onSaved: (settings: Settings) => void;
  onClose: () => void;
  now?: () => Date;
  /** After "Kopie wiederherstellen" (amendment 24): the page reloads, so every screen uses the restored data. */
  onRestored?: () => void;
}

/** The limits the parent last chose; range changes clamp from these (FR-047). */
type Limits = Pick<Settings, 'range' | 'addition' | 'subtraction'>;

/** A setting that is on or off, as its path: a top-level switch or `group.switch` (A12). */
type FlagGroup = 'challengeTypes' | 'playModes' | 'help' | 'sound';
type FlagPath =
  | { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings]
  | { [G in FlagGroup]: `${G}.${Extract<keyof Settings[G], string>}` }[FlagGroup];

type Notice = { kind: 'ok' | 'warn'; text: string } | null;

const limitsOf = (s: Settings): Limits => ({ range: s.range, addition: s.addition, subtraction: s.subtraction });

/** A whole number from an input's text; NaN for empty or other text. */
function parseWhole(text: string): number {
  return text.trim() === '' ? Number.NaN : Number(text);
}

/** Errors by field path: `validateSettings` plus the checks only the page needs. */
function collectErrors(s: Settings): Map<string, string[]> {
  const m = t();
  const out = new Map<string, string[]>();
  const add = (path: string, text: string) => out.set(path, [...(out.get(path) ?? []), text]);
  const r = validateSettings(s);
  if (!r.ok) {
    for (const e of r.errors) {
      add(e.path, m.settingsErrors[e.key]);
      // Amendment 27 (critique P4): a range change can cause this error and withRange does not fix it, so the
      // range field names it too.
      if (e.key === 'arithmeticModeNoExercise') add('range', m.settingsErrors[e.key]);
    }
  }
  // The largest operand shows with "Kleine Schritte" only; with "Zwei Zahlen" validateSettings checks it (review).
  const wholeNumbers: Array<[string, number]> = [
    ['addition.maxResult', s.addition.maxResult],
    ['timeLimitSeconds', s.timeLimitSeconds ?? 0],
  ];
  for (const kind of ['addition', 'subtraction'] as const) {
    if (!isTwoNumbers(kind, s)) wholeNumbers.push([`${kind}.maxOperand`, s[kind].maxOperand]);
  }
  for (const [path, value] of wholeNumbers) if (!Number.isInteger(value)) add(path, m.settingsErrors.rangeNotInteger);
  return out;
}

/** The German names of kinds of stored data, joined for a notice (review H1, M2, M3). */
function names(kinds: DataKind[]): string {
  return kinds.map((k) => t().parent.dataNames[k]).join(', ');
}

/** The local date as YYYY-MM-DD, the day the parent sees on the device (review R6). */
function today(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** iOS Safari may cancel a download whose address is revoked at once; a minute is long enough to start it (review L3). */
const REVOKE_AFTER_MS = 60_000;

/** The OpenGameArt page of the bundled dirt texture (amendment 14, FR-114). */
const TEXTURE_PAGE = 'https://opengameart.org/node/84103';

export function SettingsPage({ persistence, onSaved, onClose, now = () => new Date(), onRestored = () => window.location.reload() }: Props) {
  const m = t();
  const L = m.settings.labels;
  const [draft, setDraft] = useState<Settings>(() => structuredClone(persistence.settings()));
  const [limits, setLimits] = useState<Limits>(() => limitsOf(persistence.settings()));
  const [notice, setNotice] = useState<Notice>(null);
  const [dataNotice, setDataNotice] = useState<Notice>(null);
  // Counts saves and imports, so the transfer link is built again from the saved data (FR-115).
  const [savedCount, setSavedCount] = useState(0);
  const status = persistence.status();
  // Amendment 24: data kept as a copy that this version can read again.
  const [backups] = useState(() => persistence.backups());
  const [restoreFailed, setRestoreFailed] = useState(false);
  const restore = () => {
    if (persistence.restoreBackups().ok) onRestored();
    else setRestoreFailed(true);
  };

  // Checked once per draft: the rules include the "Zwei Zahlen" pair search (amendment 26).
  const errors = useMemo(() => collectErrors(draft), [draft]);
  const notices = useMemo(() => settingsNotices(draft), [draft]);
  const valid = errors.size === 0;
  const errorsAt = (path: string) => errors.get(path) ?? [];

  const update = (next: Settings) => {
    setDraft(next);
    setNotice(null);
  };
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => update({ ...draft, [key]: value });
  /** The checked state and change handler of the checkbox for one on/off setting, top level or in a group. */
  const bind = (path: FlagPath) => {
    const [key, inner] = path.split('.') as [keyof Settings, string | undefined];
    if (inner === undefined) return { checked: draft[key] as boolean, onChange: (v: boolean) => set(key, v as never) };
    const group = draft[key] as unknown as Record<string, boolean>;
    return { checked: group[inner] === true, onChange: (v: boolean) => set(key, { ...group, [inner]: v } as never) };
  };

  const applyRange = (range: SettingsRange) => {
    const usable = Number.isInteger(range.min) && Number.isInteger(range.max) && range.min < range.max;
    update(usable ? withRange({ ...draft, ...limits }, range) : { ...draft, range });
  };
  const setLimit = (next: Settings) => {
    update(next);
    setLimits(limitsOf(next));
  };

  const choosePreset = (preset: RangePreset) => {
    if (preset === 'custom') applyRange({ preset, min: draft.range.min, max: draft.range.max });
    else applyRange({ preset, ...RANGE_PRESETS[preset] });
  };

  const save = () => {
    if (!valid) return;
    // saveSettings keeps its own copy, and the receiver of onSaved (controller.updateSettings) copies too (E13).
    const r = persistence.saveSettings(draft);
    onSaved(draft);
    setLimits(limitsOf(draft));
    setSavedCount((n) => n + 1);
    setNotice(r.ok ? { kind: 'ok', text: m.settings.saved } : { kind: 'warn', text: m.settings.saveFailed });
  };

  const exportFile = () => {
    try {
      const text = persistence.exportText(now());
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `mathe-panzer-${today(now())}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
    } catch {
      setDataNotice({ kind: 'warn', text: m.settings.data.exportFailed });
    }
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      setDataNotice({ kind: 'warn', text: m.settings.data.readFailed });
      return;
    }
    const r = persistence.importText(text);
    if (!r.ok) {
      setDataNotice({ kind: 'warn', text: m.settings.data.importFailed[r.reason] });
      return;
    }
    setDraft(structuredClone(r.settings));
    setLimits(limitsOf(r.settings));
    // The import stored everything or nothing (review M4), so success never comes with a failed save (review L2).
    setNotice(null);
    onSaved(r.settings);
    setSavedCount((n) => n + 1);
    setDataNotice({ kind: 'ok', text: m.settings.data.imported });
  };

  const custom = draft.range.preset === 'custom';
  const rangeOk = errorsAt('range').length === 0;
  const allTypesOff = !Object.values(draft.challengeTypes).some(Boolean);
  // The crossing switches apply to "Kleine Schritte" only; the page says so once a kind uses "Zwei Zahlen" (amendment 26).
  const twoNumbersUsed = isTwoNumbers('addition', draft) || isTwoNumbers('subtraction', draft);
  const crossingNote = twoNumbersUsed ? m.settings.explanations.crossingSmallSteps : undefined;

  return (
    <div className="settings-page" role="dialog" aria-modal="true" aria-label={m.settings.title} data-testid="settings-page">
      <header className="settings-header">
        <h2>{m.settings.title}</h2>
        <div className="settings-actions">
          <button type="button" className="primary-button" onClick={save} disabled={!valid}>
            {m.settings.save}
          </button>
          <button type="button" className="secondary-button" onClick={onClose}>
            {m.parent.close}
          </button>
        </div>
        <p className="build-version" data-testid="build-version">
          {m.settings.version(BUILD_VERSION, BUILD_DATE)}
        </p>
      </header>

      <div className="settings-notices" role="status" aria-live="polite">
        {status.resetReason === 'unavailable' ? (
          <p className="notice warn">{m.parent.storageUnavailable}</p>
        ) : (
          status.resetData.length > 0 && <p className="notice warn">{m.parent.storageReset(names(status.resetData))}</p>
        )}
        {status.newerData.length > 0 && <p className="notice warn">{m.parent.storageNewer(names(status.newerData))}</p>}
        {backups.length > 0 && (
          <div className="notice" data-testid="backup-notice">
            <p>{m.parent.backupFound(names(backups))}</p>
            <button type="button" className="secondary-button" onClick={restore}>
              {m.parent.restoreBackup}
            </button>
          </div>
        )}
        {restoreFailed && <p className="notice warn">{m.parent.restoreFailed}</p>}
        {status.saveFailed && <p className="notice warn">{m.parent.saveFailedData(names(status.failedData))}</p>}
        {status.persistent === 'denied' && <p className="notice">{m.settings.persistDenied}</p>}
        {!valid && <p className="notice warn">{m.settings.checkFields}</p>}
        {notice && <p className={`notice ${notice.kind}`}>{notice.text}</p>}
      </div>

      <div className="settings-groups">
        <Group title={m.settings.groups.challengeTypes} errors={errorsAt('challengeTypes')}>
          <Check label={L.numberLine} {...bind('challengeTypes.numberLine')} />
          <Check label={L.addition} {...bind('challengeTypes.addition')} />
          <Check label={L.subtraction} {...bind('challengeTypes.subtraction')} />
          <Check label={L.comparison} {...bind('challengeTypes.comparison')} />
          {allTypesOff && (
            <div className="hint">
              <p>{m.settings.guidedNeedsType}</p>
              {(draft.playModes.mixed || draft.playModes.arithmetic || draft.playModes.numbers || !draft.playModes.ruler) && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => set('playModes', { mixed: false, ruler: true, arithmetic: false, numbers: false })}
                >
                  {m.settings.offerRulerOnly}
                </button>
              )}
            </div>
          )}
        </Group>

        {/* Amendment 17 (FR-121) and 27 (FR-158, FR-162): the play modes the start screen offers. */}
        <Group
          title={m.settings.groups.playModes}
          errors={[...errorsAt('playModes'), ...errorsAt('playModes.arithmetic'), ...errorsAt('playModes.numbers')]}
        >
          <Check label={L.playModeMixed} {...bind('playModes.mixed')} />
          <Check label={L.playModeRuler} {...bind('playModes.ruler')} />
          <Check label={L.playModeArithmetic} {...bind('playModes.arithmetic')} />
          <Check label={L.playModeNumbers} {...bind('playModes.numbers')} />
        </Group>

        <Group title={m.settings.groups.range} errors={errorsAt('range')}>
          <Select
            label={L.rangePreset}
            value={draft.range.preset}
            options={PRESETS.map((p) => ({ value: p, label: p === 'custom' ? m.settings.presetCustom : p.replace('-', ' bis ') }))}
            onChange={(v) => choosePreset(v as RangePreset)}
          />
          {custom && (
            <>
              <NumberInput label={L.rangeMin} value={draft.range.min} onChange={(n) => applyRange({ ...draft.range, min: n })} />
              <NumberInput label={L.rangeMax} value={draft.range.max} onChange={(n) => applyRange({ ...draft.range, max: n })} />
            </>
          )}
          {custom && draft.range.min < 0 && (
            <Check label={L.negativeResults} {...bind('negativeResults')} />
          )}
        </Group>

        <Group title={m.settings.groups.arithmetic}>
          {/* Amendment 26 (FR-148, FR-152): "Zahlengröße" per kind; "Zwei Zahlen" replaces the largest operand and the steps. */}
          <KindSettings kind="addition" settings={draft} errorsAt={errorsAt} notices={notices} onChange={setLimit} />
          <KindSettings kind="subtraction" settings={draft} errorsAt={errorsAt} notices={notices} onChange={setLimit} />
          <Check label={L.crossTens} {...bind('crossTens')} />
          <Check label={L.crossHundreds} description={crossingNote} {...bind('crossHundreds')} />
        </Group>

        <Group title={m.settings.groups.numberLine} errors={errorsAt('rulerLevelStart')} wide>
          <Select label={L.rulerLevelStart} value={String(draft.rulerLevelStart)} options={levelOptions()} onChange={(v) => set('rulerLevelStart', Number(v) as RulerLevel)} />
          <Select label={L.rulerLevelMax} value={String(draft.rulerLevelMax)} options={levelOptions()} onChange={(v) => set('rulerLevelMax', Number(v) as RulerLevel)} />
          {rangeOk ? (
            <>
              <figure className="ruler-preview-figure" data-testid="ruler-preview-start">
                <figcaption>{m.settings.previewStart}</figcaption>
                <RulerPreview range={draft.range} level={draft.rulerLevelStart} />
              </figure>
              <figure className="ruler-preview-figure" data-testid="ruler-preview-max">
                <figcaption>{m.settings.previewMax}</figcaption>
                <RulerPreview range={draft.range} level={draft.rulerLevelMax} />
              </figure>
            </>
          ) : (
            <p className="hint">{m.settings.previewUnavailable}</p>
          )}
          {/* Amendment 19 (FR-134): the aiming cross; the level is kept when another choice is made. */}
          <Select
            label={L.aimCross}
            description={m.settings.explanations.aimCross}
            value={draft.aimCross.mode}
            options={[
              { value: 'always', label: L.aimCrossAlways },
              { value: 'upToLevel', label: L.aimCrossUpToLevel },
              { value: 'never', label: L.aimCrossNever },
            ]}
            onChange={(v) => set('aimCross', { ...draft.aimCross, mode: v as Settings['aimCross']['mode'] })}
          />
          {draft.aimCross.mode === 'upToLevel' && (
            <Select
              label={L.aimCrossLevel}
              value={String(draft.aimCross.level)}
              options={levelOptions()}
              onChange={(v) => set('aimCross', { ...draft.aimCross, level: Number(v) as RulerLevel })}
            />
          )}
          {/* Amendment 21 (FR-136, FR-144, FR-147): enemies at once and the pointer line style, "Gerade" or "Keine Linien". */}
          <Select
            label={L.enemiesAtOnce}
            description={m.settings.explanations.enemiesAtOnce}
            value={String(draft.enemiesAtOnce)}
            options={['1', '2', '3', '4'].map((n) => ({ value: n, label: n }))}
            onChange={(v) => set('enemiesAtOnce', Number(v) as Settings['enemiesAtOnce'])}
          />
          <Select
            label={L.lineStyle}
            description={m.settings.explanations.lineStyle}
            value={draft.lineStyle}
            options={[
              { value: 'straight', label: L.lineStyleStraight },
              { value: 'none', label: L.lineStyleNone },
            ]}
            onChange={(v) => set('lineStyle', v as Settings['lineStyle'])}
          />
        </Group>

        <Group title={m.settings.groups.help}>
          <Check label={L.helpNearestTen} {...bind('help.nearestTen')} />
          <Check label={L.helpCountSteps} {...bind('help.countSteps')} />
          <Check label={L.helpZoom} {...bind('help.zoom')} />
          <Check label={L.helpStepAnimation} {...bind('help.stepAnimation')} />
          <Check label={L.beginnerAssist} {...bind('beginnerAssist')} />
          {/* The time limit and the point after the full help stand together, each with one line (amendment 18, FR-129). */}
          <Check
            label={L.timeLimit}
            description={m.settings.explanations.timeLimit}
            checked={draft.timeLimitSeconds !== null}
            onChange={(v) => set('timeLimitSeconds', v ? 30 : null)}
          />
          {draft.timeLimitSeconds !== null && (
            <NumberInput label={L.timeLimitSeconds} value={draft.timeLimitSeconds} min={10} max={120} errors={errorsAt('timeLimitSeconds')} onChange={(n) => set('timeLimitSeconds', n)} />
          )}
          <Check label={L.pointAfterFullHelp} description={m.settings.explanations.pointAfterFullHelp} {...bind('pointAfterFullHelp')} />
        </Group>

        <Group title={m.settings.groups.enemy}>
          <Select
            label={L.enemyDifficulty}
            value={draft.enemyDifficulty}
            options={[
              { value: 'easy', label: L.enemyEasy },
              { value: 'normal', label: L.enemyNormal },
              { value: 'challenging', label: L.enemyChallenging },
            ]}
            onChange={(v) => set('enemyDifficulty', v as Settings['enemyDifficulty'])}
          />
          <Check
            label={L.noDamage}
            checked={draft.noDamage}
            // Without damage the hearts never go down, so the round must end after a number of enemies (FR-082).
            onChange={(v) => update({ ...draft, noDamage: v, roundType: v ? 'enemyCount' : draft.roundType })}
          />
        </Group>

        <Group title={m.settings.groups.sound}>
          <Check label={L.soundEffects} {...bind('sound.effects')} />
          <Check label={L.music} {...bind('sound.music')} />
          <Check label={L.speech} {...bind('sound.speech')} />
        </Group>

        <Group title={m.settings.groups.round}>
          <Select
            label={L.roundType}
            value={draft.roundType}
            options={[
              ...(draft.noDamage ? [] : [{ value: 'untilHearts', label: L.roundTypeUntilHearts }]),
              { value: 'enemyCount', label: L.roundTypeEnemyCount },
            ]}
            onChange={(v) => set('roundType', v as RoundType)}
          />
          <Errors errors={errorsAt('roundType')} />
          {draft.roundType === 'enemyCount' && (
            <NumberInput label={L.roundLength} value={draft.roundLength} min={ROUND_LENGTH_MIN} max={ROUND_LENGTH_MAX} errors={errorsAt('roundLength')} onChange={(n) => set('roundLength', n)} />
          )}
          <Check label={L.showClock} {...bind('showClock')} />
          <Check label={L.showRecords} {...bind('showRecords')} />
          <Check label={L.garage} {...bind('garage')} />
          <Select
            label={L.numberPad}
            value={draft.numberPad}
            options={[
              { value: 'auto', label: L.numberPadAuto },
              { value: 'always', label: L.numberPadAlways },
              { value: 'never', label: L.numberPadNever },
            ]}
            onChange={(v) => set('numberPad', v as Settings['numberPad'])}
          />
          <Check label={L.adaptive} {...bind('adaptive')} />
        </Group>

        <Group title={m.settings.data.title}>
          <p className="hint">{m.settings.data.exportHint}</p>
          <div className="data-buttons">
            <button type="button" className="secondary-button" onClick={exportFile}>
              {m.parent.exportData}
            </button>
            <label className="secondary-button file-button">
              {m.parent.importData}
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => {
                  const input = e.currentTarget;
                  void importFile(input.files?.[0]).finally(() => {
                    input.value = '';
                  });
                }}
              />
            </label>
          </div>
          <div role="status" aria-live="polite">
            {dataNotice && <p className={`notice ${dataNotice.kind}`}>{dataNotice.text}</p>}
          </div>
          <p className="hint">{m.settings.data.homeScreen}</p>
        </Group>

        <TransferGroup persistence={persistence} savedCount={savedCount} />
      </div>
      <p className="hint credits" data-testid="credits">
        {m.settings.credits.text}{' '}
        <a href={TEXTURE_PAGE} target="_blank" rel="noopener noreferrer">
          {m.settings.credits.link}
        </a>
      </p>
    </div>
  );
}

/** The link for the saved data; when the browser's compression fails, the uncompressed link (FR-117). Rejects when both fail. */
async function buildTransfer(persistence: Persistence): Promise<EncodedTransfer> {
  try {
    return await encodeTransfer(persistence.saveData(), window.location.href);
  } catch {
    return encodeTransfer(persistence.saveData(), window.location.href, { codec: null });
  }
}

/** "Spielstand übertragen" (amendment 15, FR-115, FR-118): a QR code of the transfer link and "Link kopieren". */
function TransferGroup({ persistence, savedCount }: { persistence: Persistence; savedCount: number }) {
  const T = t().settings.transfer;
  const [transfer, setTransfer] = useState<EncodedTransfer | null>(null);
  const [buildFailed, setBuildFailed] = useState(false);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [large, setLarge] = useState(false);
  useEffect(() => {
    let live = true;
    buildTransfer(persistence).then(
      (r) => {
        if (!live) return;
        setTransfer(r);
        setBuildFailed(false);
      },
      () => {
        // Review M5: say so instead of leaving the group without a QR code and without a word.
        if (!live) return;
        setTransfer(null);
        setBuildFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [persistence, savedCount]);
  const qr = useMemo(() => (transfer?.fits ? qrMatrix(transfer.link) : null), [transfer]);
  const trimmed = transfer !== null && (transfer.sessionsDropped > 0 || transfer.windowLength < 10);

  const copyLink = async () => {
    if (!transfer) return;
    try {
      await navigator.clipboard.writeText(transfer.link);
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
  };

  return (
    <Group title={T.title}>
      <div className="transfer" data-testid="transfer" data-transfer-link={transfer?.link}>
        <p className="hint">{T.hint}</p>
        {qr && <QrSvg qr={qr} className="transfer-qr" testId="transfer-qr" label={T.qrLabel} />}
        {qr && (
          <button type="button" className="secondary-button" onClick={() => setLarge(true)}>
            {T.showLarge}
          </button>
        )}
        {qr && large && <LargeQr qr={qr} onClose={() => setLarge(false)} />}
        {buildFailed && <p className="notice warn">{T.buildFailed}</p>}
        {transfer && !transfer.fits && <p className="notice warn">{T.tooLarge}</p>}
        {transfer?.fits && trimmed && <p className="notice">{T.trimmed}</p>}
        <button type="button" className="secondary-button" onClick={() => void copyLink()} disabled={!transfer}>
          {T.copy}
        </button>
        <div role="status" aria-live="polite">
          {copy === 'copied' && <p className="notice ok">{T.copied}</p>}
          {copy === 'failed' && <p className="notice warn">{T.copyFailed}</p>}
        </div>
        {copy === 'failed' && transfer && (
          <p className="transfer-link-text" data-testid="transfer-link-text">
            {transfer.link}
          </p>
        )}
      </div>
    </Group>
  );
}

/** A QR code with its white quiet zone (the matrix includes it), drawn with one square per dark module. */
function QrSvg({ qr, className, testId, label }: { qr: QrMatrix; className: string; testId: string; label?: string }) {
  return (
    <svg
      className={className}
      data-testid={testId}
      data-qr-size={qr.size}
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
    >
      <rect width={qr.size} height={qr.size} fill="#fff" />
      <path d={qrPath(qr)} fill="#000" />
    </svg>
  );
}

/**
 * "QR groß anzeigen" (T305): the QR code as large as the screen allows, on white, so a phone or tablet camera can read
 * it from another screen. "Schließen" or Escape closes it.
 */
function LargeQr({ qr, onClose }: { qr: QrMatrix; onClose: () => void }) {
  const T = t().settings.transfer;
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus(), []);
  return (
    <div
      className="qr-fullscreen"
      role="dialog"
      aria-modal="true"
      aria-label={T.qrLabel}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <QrSvg qr={qr} className="qr-fullscreen-code" testId="transfer-qr-large" />
      <button ref={close} type="button" className="secondary-button" onClick={onClose}>
        {T.closeLarge}
      </button>
    </div>
  );
}

/** The fields plus and minus both have (amendment 26, FR-148, FR-152). */
type KindFields = Pick<Settings['subtraction'], 'size' | 'first' | 'second' | 'carry' | 'maxOperand' | 'steps'>;

/**
 * The plus or the minus part of "Plus und Minus" (amendment 26): "Zahlengröße", then with "Kleine Schritte" the
 * largest operand and the steps, with "Zwei Zahlen" both ranges and the carry switch instead; plus also shows
 * "Größtes Ergebnis" with both. Each error shows at its field, and the note that only some exercises fit
 * (`notices`, from settingsNotices) shows under "Zahlengröße" without blocking "Speichern".
 */
function KindSettings({
  kind,
  settings,
  errorsAt,
  notices,
  onChange,
}: {
  kind: 'addition' | 'subtraction';
  settings: Settings;
  errorsAt: (path: string) => string[];
  notices: SettingsNotice[];
  onChange: (next: Settings) => void;
}) {
  const m = t();
  const L = m.settings.labels;
  const k = settings[kind];
  const change = (next: Partial<KindFields>) => onChange({ ...settings, [kind]: { ...k, ...next } });
  const notes = notices.filter((n) => n.path === `${kind}.size`);
  return (
    <fieldset className="settings-subgroup">
      <legend>{m.settings.groups[kind]}</legend>
      <Select
        label={L.numberSize}
        value={k.size}
        options={[
          { value: 'steps', label: L.numberSizeSteps },
          { value: 'twoNumbers', label: L.numberSizeTwoNumbers },
        ]}
        errors={errorsAt(`${kind}.size`)}
        onChange={(v) => change(withSize(k, v === 'twoNumbers' ? 'twoNumbers' : 'steps', settings))}
      />
      {notes.map((n) => (
        <p key={n.key} className="notice" role="note">
          {m.settingsNotes[n.key](n.value)}
        </p>
      ))}
      {k.size === 'steps' ? (
        <>
          <NumberInput label={L[`${kind}MaxOperand`]} value={k.maxOperand} errors={errorsAt(`${kind}.maxOperand`)} onChange={(maxOperand) => change({ maxOperand })} />
          <Select label={L[`${kind}Steps`]} value={String(k.steps)} options={stepOptions()} onChange={(v) => change({ steps: v === '2' ? 2 : 1 })} />
        </>
      ) : (
        <>
          <SpanInput fromLabel={L.firstFrom} toLabel={L.firstTo} value={k.first} errors={errorsAt(`${kind}.first`)} onChange={(first) => change({ first })} />
          <SpanInput fromLabel={L.secondFrom} toLabel={L.secondTo} value={k.second} errors={errorsAt(`${kind}.second`)} onChange={(second) => change({ second })} />
          <Check label={L[`${kind}Carry`]} checked={k.carry} onChange={(carry) => change({ carry })} />
        </>
      )}
      {kind === 'addition' && (
        <NumberInput
          label={L.additionMaxResult}
          value={settings.addition.maxResult}
          errors={errorsAt('addition.maxResult')}
          onChange={(maxResult) => onChange({ ...settings, addition: { ...settings.addition, maxResult } })}
        />
      )}
    </fieldset>
  );
}

/**
 * The fields of a kind after "Zahlengröße" changes (review): a field the new size hides is still saved, and the schema
 * takes whole numbers only. So a range with an empty or broken bound goes back to its default (10 to 99), and an empty
 * or broken largest operand goes back to its default (10), at most the range width. Whole numbers stay as they are,
 * so their errors show again when the parent switches back.
 */
function withSize(k: KindFields, size: KindFields['size'], settings: Settings): Partial<KindFields> {
  const defaults = twoNumberDefaults();
  const whole = (r: NumberSpan) => Number.isInteger(r.min) && Number.isInteger(r.max);
  // The range fields may be empty too (NaN); then 1.
  const span = Math.max(1, settings.range.max - settings.range.min) || 1;
  return {
    size,
    first: whole(k.first) ? k.first : defaults.first,
    second: whole(k.second) ? k.second : defaults.second,
    maxOperand: Number.isInteger(k.maxOperand) ? k.maxOperand : Math.min(defaultSettings().subtraction.maxOperand, span),
  };
}

function stepOptions() {
  return [1, 2].map((n) => ({ value: String(n), label: t().settings.stepsOption(n) }));
}

function levelOptions() {
  return LEVELS.map((n) => ({ value: String(n), label: t().settings.levelOption(n) }));
}

/** A settings group; `wide` spans the full width of the page, for the ruler previews (T218). */
function Group({ title, errors = [], wide = false, children }: { title: string; errors?: string[]; wide?: boolean; children: ReactNode }) {
  return (
    <fieldset className={wide ? 'settings-group settings-group-wide' : 'settings-group'}>
      <legend>{title}</legend>
      {children}
      <Errors errors={errors} />
    </fieldset>
  );
}

function Errors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <ul className="field-errors">
      {errors.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  );
}

/** A switch; `description` is a one-line explanation below it, linked with aria-describedby. */
function Check({ label, checked, onChange, description }: { label: string; checked: boolean; onChange: (v: boolean) => void; description?: string }) {
  const id = useId();
  const descriptionId = `${id}-description`;
  return (
    <>
      <div className="field check-field">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          aria-describedby={description === undefined ? undefined : descriptionId}
          onChange={(e) => onChange(e.currentTarget.checked)}
        />
        <label htmlFor={id}>{label}</label>
      </div>
      {description !== undefined && (
        <p className="hint" id={descriptionId}>
          {description}
        </p>
      )}
    </>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
  description,
  errors = [],
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
  description?: string;
  errors?: string[];
}) {
  const id = useId();
  const descriptionId = `${id}-description`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        aria-describedby={description === undefined ? undefined : descriptionId}
        aria-invalid={errors.length > 0 || undefined}
        onChange={(e) => onChange(e.currentTarget.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {description !== undefined && (
        <p className="hint" id={descriptionId}>
          {description}
        </p>
      )}
      <Errors errors={errors} />
    </div>
  );
}

/**
 * A "Zwei Zahlen" range (amendment 26, FR-148): "Erste Zahl von [ ] bis [ ]" in one row, with the range's errors
 * under it. The "bis" field is named in full ("Erste Zahl bis") for screen readers. Like NumberInput, each field keeps
 * the typed text and reports NaN for text that is not a number.
 */
function SpanInput({
  fromLabel,
  toLabel,
  value,
  errors,
  onChange,
}: {
  fromLabel: string;
  toLabel: string;
  value: NumberSpan;
  errors: string[];
  onChange: (next: NumberSpan) => void;
}) {
  const id = useId();
  const invalid = errors.length > 0 || undefined;
  return (
    <div className="field span-field">
      <label htmlFor={`${id}-min`}>{fromLabel}</label>
      <WholeNumberBox id={`${id}-min`} value={value.min} min={TWO_NUMBER_MIN} max={TWO_NUMBER_MAX} invalid={invalid} onChange={(min) => onChange({ ...value, min })} />
      <label htmlFor={`${id}-max`} className="span-to" aria-hidden="true">
        {t().settings.labels.to}
      </label>
      <WholeNumberBox id={`${id}-max`} label={toLabel} value={value.max} min={TWO_NUMBER_MIN} max={TWO_NUMBER_MAX} invalid={invalid} onChange={(max) => onChange({ ...value, max })} />
      <Errors errors={errors} />
    </div>
  );
}

/**
 * A whole-number input box. It keeps the typed text, so an empty or partial entry stays visible while the parent
 * types, and reports NaN for text that is not a number. A value changed from outside replaces the text.
 */
function WholeNumberBox({
  id,
  label,
  value,
  min,
  max,
  invalid,
  onChange,
}: {
  id: string;
  label?: string;
  value: number;
  min?: number;
  max?: number;
  invalid?: true;
  onChange: (n: number) => void;
}) {
  const [text, setText] = useState(() => String(value));
  const [seen, setSeen] = useState(value);
  if (!Object.is(value, seen)) {
    setSeen(value);
    if (!Object.is(parseWhole(text), value) && !Number.isNaN(value)) setText(String(value));
  }
  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      step={1}
      min={min}
      max={max}
      value={text}
      aria-label={label}
      aria-invalid={invalid}
      onChange={(e) => {
        const next = e.currentTarget.value;
        setText(next);
        setSeen(parseWhole(next));
        onChange(parseWhole(next));
      }}
    />
  );
}

/**
 * A whole-number field with its label and errors. The box keeps the typed text (WholeNumberBox); a value changed from
 * outside (for example by `withRange`) replaces it.
 */
function NumberInput({
  label,
  value,
  min,
  max,
  errors = [],
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  errors?: string[];
  onChange: (n: number) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <WholeNumberBox id={id} value={value} min={min} max={max} invalid={errors.length > 0 || undefined} onChange={onChange} />
      <Errors errors={errors} />
    </div>
  );
}

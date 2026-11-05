/**
 * Settings page for parents (FR-046 to FR-049, FR-069, FR-079, contracts/ui-flows.md "Settings").
 *
 * Every field of FR-046, grouped as Aufgaben, Zahlenraum, Plus und Minus, Zahlenstrahl, Hilfe, Gegner, Ton, Runde.
 * The form is checked with `validateSettings` on every change; errors appear next to their fields and "Speichern"
 * stays disabled while any error exists. A range change goes through `withRange`, starting from the limits the
 * parent last chose, so typing a custom range digit by digit does not shrink the limits for good (FR-047).
 * Fields listed in comingSoon.ts are shown disabled with "kommt bald" and keep their stored values (FR-079).
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
 */
import { useId, useState, type ReactNode } from 'react';
import type { RulerLevel } from '../core/numberline/ticks';
import { RANGE_PRESETS, ROUND_LENGTH_MAX, ROUND_LENGTH_MIN } from '../core/settings/defaults';
import type { RangePreset, RoundType, Settings, SettingsRange } from '../core/settings/schema';
import { validateSettings, withRange } from '../core/settings/validate';
import { t } from '../i18n';
import { isComingSoon, type SettingField } from './comingSoon';
import type { Persistence } from './persistence';
import { RulerPreview } from './RulerPreview';

const PRESETS: RangePreset[] = ['0-10', '0-20', '0-50', '0-100', '0-1000', 'custom'];
const LEVELS: RulerLevel[] = [1, 2, 3, 4, 5];

interface Props {
  persistence: Persistence;
  onSaved: (settings: Settings) => void;
  onClose: () => void;
  now?: () => Date;
}

/** The limits the parent last chose; range changes clamp from these (FR-047). */
type Limits = Pick<Settings, 'range' | 'addition' | 'subtraction'>;

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
    for (const e of r.errors) add(e.path, m.settingsErrors[e.key]);
  }
  const wholeNumbers: Array<[string, number]> = [
    ['addition.maxOperand', s.addition.maxOperand],
    ['addition.maxResult', s.addition.maxResult],
    ['subtraction.maxOperand', s.subtraction.maxOperand],
    ['timeLimitSeconds', s.timeLimitSeconds ?? 0],
  ];
  for (const [path, value] of wholeNumbers) if (!Number.isInteger(value)) add(path, m.settingsErrors.rangeNotInteger);
  return out;
}

function today(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function SettingsPage({ persistence, onSaved, onClose, now = () => new Date() }: Props) {
  const m = t();
  const L = m.settings.labels;
  const [draft, setDraft] = useState<Settings>(() => structuredClone(persistence.settings()));
  const [limits, setLimits] = useState<Limits>(() => limitsOf(persistence.settings()));
  const [notice, setNotice] = useState<Notice>(null);
  const [dataNotice, setDataNotice] = useState<Notice>(null);
  const status = persistence.status();

  const errors = collectErrors(draft);
  const valid = errors.size === 0;
  const errorsAt = (path: string) => errors.get(path) ?? [];

  const update = (next: Settings) => {
    setDraft(next);
    setNotice(null);
  };
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => update({ ...draft, [key]: value });

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
    const r = persistence.saveSettings(draft);
    onSaved(structuredClone(draft));
    setLimits(limitsOf(draft));
    setNotice(r.ok ? { kind: 'ok', text: m.settings.saved } : { kind: 'warn', text: m.settings.saveFailed });
  };

  const exportFile = () => {
    const text = persistence.exportText(now());
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `mathe-panzer-${today(now())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
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
    setNotice(persistence.status().saveFailed ? { kind: 'warn', text: m.settings.saveFailed } : null);
    onSaved(structuredClone(r.settings));
    setDataNotice({ kind: 'ok', text: m.settings.data.imported });
  };

  const custom = draft.range.preset === 'custom';
  const rangeOk = errorsAt('range').length === 0;
  const allTypesOff = !Object.values(draft.challengeTypes).some(Boolean);

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
      </header>

      <div className="settings-notices" role="status" aria-live="polite">
        {status.resetReason === 'invalid' && <p className="notice warn">{m.parent.storageReset}</p>}
        {status.resetReason === 'unavailable' && <p className="notice warn">{m.parent.storageUnavailable}</p>}
        {status.persistent === 'denied' && <p className="notice">{m.settings.persistDenied}</p>}
        {!valid && <p className="notice warn">{m.settings.checkFields}</p>}
        {notice && <p className={`notice ${notice.kind}`}>{notice.text}</p>}
      </div>

      <div className="settings-groups">
        <Group title={m.settings.groups.challengeTypes} errors={errorsAt('challengeTypes')}>
          <Check field="challengeTypes.numberLine" label={L.numberLine} checked={draft.challengeTypes.numberLine} onChange={(v) => set('challengeTypes', { ...draft.challengeTypes, numberLine: v })} />
          <Check field="challengeTypes.addition" label={L.addition} checked={draft.challengeTypes.addition} onChange={(v) => set('challengeTypes', { ...draft.challengeTypes, addition: v })} />
          <Check field="challengeTypes.subtraction" label={L.subtraction} checked={draft.challengeTypes.subtraction} onChange={(v) => set('challengeTypes', { ...draft.challengeTypes, subtraction: v })} />
          <Check field="challengeTypes.comparison" label={L.comparison} checked={draft.challengeTypes.comparison} onChange={(v) => set('challengeTypes', { ...draft.challengeTypes, comparison: v })} />
          <Check field="freePlay" label={L.freePlay} checked={draft.freePlay} onChange={(v) => set('freePlay', v)} />
          {allTypesOff && (
            <div className="hint">
              <p>{m.settings.guidedNeedsType}</p>
              {!draft.freePlay && (
                <button type="button" className="secondary-button" onClick={() => set('freePlay', true)}>
                  {m.settings.offerFreePlay}
                </button>
              )}
            </div>
          )}
        </Group>

        <Group title={m.settings.groups.range} errors={errorsAt('range')}>
          <Select
            field="range"
            label={L.rangePreset}
            value={draft.range.preset}
            options={PRESETS.map((p) => ({ value: p, label: p === 'custom' ? m.settings.presetCustom : p.replace('-', ' bis ') }))}
            onChange={(v) => choosePreset(v as RangePreset)}
          />
          {custom && (
            <>
              <NumberInput field="range" label={L.rangeMin} value={draft.range.min} onChange={(n) => applyRange({ ...draft.range, min: n })} />
              <NumberInput field="range" label={L.rangeMax} value={draft.range.max} onChange={(n) => applyRange({ ...draft.range, max: n })} />
            </>
          )}
          {custom && draft.range.min < 0 && (
            <Check field="negativeResults" label={L.negativeResults} checked={draft.negativeResults} onChange={(v) => set('negativeResults', v)} />
          )}
        </Group>

        <Group title={m.settings.groups.arithmetic}>
          <NumberInput field="addition.maxOperand" label={L.additionMaxOperand} value={draft.addition.maxOperand} errors={errorsAt('addition.maxOperand')} onChange={(n) => setLimit({ ...draft, addition: { ...draft.addition, maxOperand: n } })} />
          <NumberInput field="addition.maxResult" label={L.additionMaxResult} value={draft.addition.maxResult} errors={errorsAt('addition.maxResult')} onChange={(n) => setLimit({ ...draft, addition: { ...draft.addition, maxResult: n } })} />
          <Select field="addition.steps" label={L.additionSteps} value={String(draft.addition.steps)} options={stepOptions()} onChange={(v) => setLimit({ ...draft, addition: { ...draft.addition, steps: v === '2' ? 2 : 1 } })} />
          <NumberInput field="subtraction.maxOperand" label={L.subtractionMaxOperand} value={draft.subtraction.maxOperand} errors={errorsAt('subtraction.maxOperand')} onChange={(n) => setLimit({ ...draft, subtraction: { ...draft.subtraction, maxOperand: n } })} />
          <Select field="subtraction.steps" label={L.subtractionSteps} value={String(draft.subtraction.steps)} options={stepOptions()} onChange={(v) => setLimit({ ...draft, subtraction: { ...draft.subtraction, steps: v === '2' ? 2 : 1 } })} />
          <Check field="crossTens" label={L.crossTens} checked={draft.crossTens} onChange={(v) => set('crossTens', v)} />
          <Check field="crossHundreds" label={L.crossHundreds} checked={draft.crossHundreds} onChange={(v) => set('crossHundreds', v)} />
        </Group>

        <Group title={m.settings.groups.numberLine} errors={errorsAt('rulerLevelStart')} wide>
          <Select field="rulerLevelStart" label={L.rulerLevelStart} value={String(draft.rulerLevelStart)} options={levelOptions()} onChange={(v) => set('rulerLevelStart', Number(v) as RulerLevel)} />
          <Select field="rulerLevelMax" label={L.rulerLevelMax} value={String(draft.rulerLevelMax)} options={levelOptions()} onChange={(v) => set('rulerLevelMax', Number(v) as RulerLevel)} />
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
        </Group>

        <Group title={m.settings.groups.help}>
          <Check field="help.nearestTen" label={L.helpNearestTen} checked={draft.help.nearestTen} onChange={(v) => set('help', { ...draft.help, nearestTen: v })} />
          <Check field="help.countSteps" label={L.helpCountSteps} checked={draft.help.countSteps} onChange={(v) => set('help', { ...draft.help, countSteps: v })} />
          <Check field="help.zoom" label={L.helpZoom} checked={draft.help.zoom} onChange={(v) => set('help', { ...draft.help, zoom: v })} />
          <Check field="help.stepAnimation" label={L.helpStepAnimation} checked={draft.help.stepAnimation} onChange={(v) => set('help', { ...draft.help, stepAnimation: v })} />
          <Check field="beginnerAssist" label={L.beginnerAssist} checked={draft.beginnerAssist} onChange={(v) => set('beginnerAssist', v)} />
        </Group>

        <Group title={m.settings.groups.enemy}>
          <Select
            field="enemyDifficulty"
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
            field="noDamage"
            label={L.noDamage}
            checked={draft.noDamage}
            // Without damage the hearts never go down, so the round must end after a number of enemies (FR-082).
            onChange={(v) => update({ ...draft, noDamage: v, roundType: v ? 'enemyCount' : draft.roundType })}
          />
        </Group>

        <Group title={m.settings.groups.sound}>
          <Check field="sound.effects" label={L.soundEffects} checked={draft.sound.effects} onChange={(v) => set('sound', { ...draft.sound, effects: v })} />
          <Check field="sound.music" label={L.music} checked={draft.sound.music} onChange={(v) => set('sound', { ...draft.sound, music: v })} />
          <Check field="sound.speech" label={L.speech} checked={draft.sound.speech} onChange={(v) => set('sound', { ...draft.sound, speech: v })} />
        </Group>

        <Group title={m.settings.groups.round}>
          <Select
            field="roundType"
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
            <NumberInput field="roundLength" label={L.roundLength} value={draft.roundLength} min={ROUND_LENGTH_MIN} max={ROUND_LENGTH_MAX} errors={errorsAt('roundLength')} onChange={(n) => set('roundLength', n)} />
          )}
          <Check field="showClock" label={L.showClock} checked={draft.showClock} onChange={(v) => set('showClock', v)} />
          <Check field="showRecords" label={L.showRecords} checked={draft.showRecords} onChange={(v) => set('showRecords', v)} />
          <Check field="garage" label={L.garage} checked={draft.garage} onChange={(v) => set('garage', v)} />
          <Check field="adaptive" label={L.adaptive} checked={draft.adaptive} onChange={(v) => set('adaptive', v)} />
          <Check field="timeLimitSeconds" label={L.timeLimit} checked={draft.timeLimitSeconds !== null} onChange={(v) => set('timeLimitSeconds', v ? 30 : null)} />
          {draft.timeLimitSeconds !== null && (
            <NumberInput field="timeLimitSeconds" label={L.timeLimitSeconds} value={draft.timeLimitSeconds} min={10} max={120} errors={errorsAt('timeLimitSeconds')} onChange={(n) => set('timeLimitSeconds', n)} />
          )}
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
      </div>
    </div>
  );
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

/** The "kommt bald" note for a field whose feature is not built yet (FR-079). */
function useSoon(field: SettingField): { disabled: boolean; noteId: string | undefined; note: ReactNode } {
  const id = useId();
  const soon = isComingSoon(field);
  return {
    disabled: soon,
    noteId: soon ? id : undefined,
    note: soon ? (
      <span id={id} className="coming-soon">
        {t().parent.comingSoon}
      </span>
    ) : null,
  };
}

function Check({ field, label, checked, onChange }: { field: SettingField; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  const soon = useSoon(field);
  return (
    <div className="field check-field">
      <input id={id} type="checkbox" checked={checked} disabled={soon.disabled} aria-describedby={soon.noteId} onChange={(e) => onChange(e.currentTarget.checked)} />
      <label htmlFor={id}>{label}</label>
      {soon.note}
    </div>
  );
}

function Select({
  field,
  label,
  value,
  options,
  onChange,
}: {
  field: SettingField;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  const id = useId();
  const soon = useSoon(field);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} disabled={soon.disabled} aria-describedby={soon.noteId} onChange={(e) => onChange(e.currentTarget.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {soon.note}
    </div>
  );
}

/**
 * A whole-number field. It keeps the typed text, so an empty or partial entry stays visible while the parent
 * types, and reports NaN for text that is not a number. A value changed from outside (for example by
 * `withRange`) replaces the text.
 */
function NumberInput({
  field,
  label,
  value,
  min,
  max,
  errors = [],
  onChange,
}: {
  field: SettingField;
  label: string;
  value: number;
  min?: number;
  max?: number;
  errors?: string[];
  onChange: (n: number) => void;
}) {
  const id = useId();
  const soon = useSoon(field);
  const [text, setText] = useState(() => String(value));
  const [seen, setSeen] = useState(value);
  if (!Object.is(value, seen)) {
    setSeen(value);
    if (!Object.is(parseWhole(text), value) && !Number.isNaN(value)) setText(String(value));
  }
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        step={1}
        min={min}
        max={max}
        value={text}
        disabled={soon.disabled}
        aria-describedby={soon.noteId}
        aria-invalid={errors.length > 0 || undefined}
        onChange={(e) => {
          const next = e.currentTarget.value;
          setText(next);
          setSeen(parseWhole(next));
          onChange(parseWhole(next));
        }}
      />
      {soon.note}
      <Errors errors={errors} />
    </div>
  );
}

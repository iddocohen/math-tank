/**
 * Settings page (FR-046 to FR-048a, FR-069, FR-079, US6 scenarios 4 and 5).
 * Amendment 06 (FR-044, FR-082, FR-084, FR-086): no "Genau treffen"; "Rundenende" with "Bis alle Herzen weg" and
 * "Gegner pro Runde" (1 to 20 enemies); "Uhr beim Spielen zeigen" and "Rekord zeigen".
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../core/settings/defaults';
import type { Settings } from '../core/settings/schema';
import { exportData } from '../core/storage/exportImport';
import { memoryKeyValue } from '../core/storage/keyValue';
import { PROGRESS_KEY, SETTINGS_KEY } from '../core/storage/storage';
import { decodeTransfer } from '../core/transfer/transfer';
import { t } from '../i18n';
import { emptyRecords } from '../core/records/records';
import { createPersistence } from './persistence';
import { SettingsPage } from './SettingsPage';
import { BUILD_DATE, BUILD_VERSION } from './buildInfo';

const m = t();
const L = m.settings.labels;

function setup(initial?: Partial<Settings>, kvInit?: Record<string, string>) {
  const kv = memoryKeyValue(kvInit ?? (initial ? { [SETTINGS_KEY]: JSON.stringify({ ...defaultSettings(), ...initial }) } : {}));
  const persistence = createPersistence({ kv, storage: undefined });
  const onSaved = vi.fn();
  const onClose = vi.fn();
  render(<SettingsPage persistence={persistence} onSaved={onSaved} onClose={onClose} now={() => new Date('2026-11-05T10:00:00Z')} />);
  return { kv, persistence, onSaved, onClose };
}

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement & HTMLSelectElement;
const saveButton = () => screen.getByRole('button', { name: m.settings.save }) as HTMLButtonElement;
const setValue = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
const toggle = (label: string) => fireEvent.click(field(label));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SettingsPage', () => {
  it('a custom range with min 50 and max 20 shows an error next to the field and disables "Speichern"', () => {
    setup();
    setValue(L.rangePreset, 'custom');
    setValue(L.rangeMin, '50');
    setValue(L.rangeMax, '20');
    const group = screen.getByRole('group', { name: m.settings.groups.range });
    expect(within(group).getByText(m.settingsErrors.rangeOrder)).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });

  it('accepts the custom range 550 to 780 and saves it', () => {
    const { persistence, onSaved } = setup();
    setValue(L.rangePreset, 'custom');
    setValue(L.rangeMin, '550');
    setValue(L.rangeMax, '780');
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(saveButton());
    expect(persistence.settings().range).toEqual({ preset: 'custom', min: 550, max: 780 });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ range: { preset: 'custom', min: 550, max: 780 } }));
    expect(screen.getByText(m.settings.saved)).toBeTruthy();
  });

  it('turning off all challenge types shows the hint and offers only "Nur Zahlenstrahl" (amendment 17)', () => {
    // Comparison is "kommt bald" and cannot be changed, so it starts off here.
    setup({ challengeTypes: { numberLine: true, addition: true, subtraction: true, comparison: false } });
    toggle(L.numberLine);
    toggle(L.addition);
    toggle(L.subtraction);
    expect(screen.getByText(m.settings.guidedNeedsType)).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: m.settings.offerRulerOnly }));
    expect(field(L.playModeMixed).checked).toBe(false);
    expect(field(L.playModeRuler).checked).toBe(true);
    expect(field(L.playModeMath).checked).toBe(false);
    expect(saveButton().disabled).toBe(false);
  });

  it('shows a switch per play mode, all on by default; all off shows the error and blocks saving (amendment 17, FR-121)', () => {
    const { persistence } = setup();
    for (const label of [L.playModeMixed, L.playModeRuler, L.playModeMath]) expect(field(label).checked).toBe(true);
    toggle(L.playModeMixed);
    toggle(L.playModeMath);
    fireEvent.click(saveButton());
    expect(persistence.settings().playModes).toEqual({ mixed: false, ruler: true, math: false });
    toggle(L.playModeRuler);
    expect(screen.getByText(m.settingsErrors.noPlayMode)).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });

  it('changing the preset from 0-100 to 0-20 clamps addition.maxResult to 20', () => {
    const { persistence } = setup();
    expect(field(L.additionMaxResult).value).toBe('100');
    setValue(L.rangePreset, '0-20');
    expect(field(L.additionMaxResult).value).toBe('20');
    fireEvent.click(saveButton());
    expect(persistence.settings().addition.maxResult).toBe(20);
    expect(persistence.settings().range).toEqual({ preset: '0-20', min: 0, max: 20 });
  });

  it('shows the negative-results switch only when a custom min is below 0', () => {
    setup();
    expect(screen.queryByLabelText(L.negativeResults)).toBeNull();
    setValue(L.rangePreset, 'custom');
    expect(screen.queryByLabelText(L.negativeResults)).toBeNull();
    setValue(L.rangeMin, '-20');
    expect(screen.queryByLabelText(L.negativeResults)).not.toBeNull();
    setValue(L.rangeMin, '0');
    expect(screen.queryByLabelText(L.negativeResults)).toBeNull();
  });

  it('a ruler starting level above the hardest level shows an error', () => {
    setup();
    setValue(L.rulerLevelMax, '2');
    setValue(L.rulerLevelStart, '4');
    expect(screen.getByText(m.settingsErrors.rulerLevelOrder)).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });

  it('two ruler previews show the starting level and the hardest level for the chosen range (FR-069, T218)', () => {
    setup();
    const start = () => screen.getByTestId('ruler-preview-start').querySelector('svg')!;
    const hardest = () => screen.getByTestId('ruler-preview-max').querySelector('svg')!;
    const labelsOf = (svg: SVGSVGElement) => within(svg as unknown as HTMLElement).queryAllByTestId('preview-label').map((el) => Number(el.textContent));
    const linesOf = (svg: SVGSVGElement) => within(svg as unknown as HTMLElement).queryAllByTestId('preview-line').length;
    expect(screen.getByText(m.settings.previewStart)).toBeTruthy();
    expect(screen.getByText(m.settings.previewMax)).toBeTruthy();

    // Defaults: 0 to 100, starting level 1 (every number labeled except the 17 small labels crowding a large one, T231),
    // hardest level 5 (every line, only the end points labeled, amendment 20).
    expect(start().getAttribute('aria-label')).toBe(m.settings.preview(0, 100, 1));
    expect(labelsOf(start())).toHaveLength(84);
    expect(labelsOf(hardest())).toEqual([0, 100]);
    expect(linesOf(hardest())).toBe(101);

    // Starting level 1 -> 4: only the starting preview changes; every line stays, labels 0, 50 and 100 (amendment 20).
    setValue(L.rulerLevelStart, '4');
    expect(labelsOf(start())).toEqual([0, 50, 100]);
    expect(linesOf(start())).toBe(101);
    expect(labelsOf(hardest())).toEqual([0, 100]);

    // Hardest level 5 -> 4: only the hardest preview changes.
    setValue(L.rulerLevelMax, '4');
    expect(linesOf(hardest())).toBe(101);
    expect(labelsOf(hardest())).toEqual([0, 50, 100]);
    expect(hardest().getAttribute('aria-label')).toBe(m.settings.preview(0, 100, 4));

    // Range preset 0 to 100 -> 0 to 20: both previews change.
    setValue(L.rangePreset, '0-20');
    expect(labelsOf(start())).toEqual([0, 10, 20]);
    expect(labelsOf(hardest())).toEqual([0, 10, 20]);

    // Custom minimum and maximum: both previews change with each.
    setValue(L.rangePreset, 'custom');
    setValue(L.rangeMin, '550');
    setValue(L.rangeMax, '780');
    expect(labelsOf(start())).toEqual([550, 650, 780]);
    expect(linesOf(start())).toBe(24);
    expect(start().getAttribute('aria-label')).toBe(m.settings.preview(550, 780, 4));
    setValue(L.rangeMin, '600');
    expect(labelsOf(start())).toEqual([600, 700, 780]);
    expect(labelsOf(hardest())).toEqual([600, 700, 780]);
    setValue(L.rangeMax, '700');
    expect(labelsOf(hardest())).toEqual([600, 650, 700]);
    expect(linesOf(hardest())).toBe(101);
  });

  it('does not show "Genau treffen" (amendment 06), an aim-correction or a label-level field', () => {
    setup();
    expect(screen.queryByLabelText('Genau treffen')).toBeNull();
    expect(screen.queryByText('Genau treffen')).toBeNull();
    expect(screen.queryByLabelText(/Zielhilfe|aim/i)).toBeNull();
    expect(screen.queryByLabelText(/Beschriftung/i)).toBeNull();
  });

  it('drops a stored exactHit: the saved settings have no such field', () => {
    const { persistence, kv } = setup({ exactHit: true } as Partial<Settings>);
    toggle(L.showClock);
    fireEvent.click(saveButton());
    expect('exactHit' in persistence.settings()).toBe(false);
    expect(JSON.parse(kv.get(SETTINGS_KEY) ?? '{}')).not.toHaveProperty('exactHit');
  });

  it('"Rundenende" offers "Bis alle Herzen weg" (default) and "Gegner pro Runde"; the number of enemies shows only with the second', () => {
    const { persistence } = setup();
    const select = field(L.roundType);
    expect(select.value).toBe('untilHearts');
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([L.roundTypeUntilHearts, L.roundTypeEnemyCount]);
    expect(screen.queryByLabelText(L.roundLength)).toBeNull();
    setValue(L.roundType, 'enemyCount');
    expect(field(L.roundLength).value).toBe('5');
    fireEvent.click(saveButton());
    expect(persistence.settings()).toMatchObject({ roundType: 'enemyCount', roundLength: 5 });
  });

  it('accepts 1 to 20 enemies per round and shows an error for 0 and 21', () => {
    setup({ roundType: 'enemyCount' });
    for (const bad of ['0', '21']) {
      setValue(L.roundLength, bad);
      expect(screen.getByText(m.settingsErrors.roundLength)).toBeTruthy();
      expect(saveButton().disabled).toBe(true);
    }
    for (const ok of ['1', '20']) {
      setValue(L.roundLength, ok);
      expect(saveButton().disabled).toBe(false);
    }
  });

  it('turning on "Ohne Schaden spielen" removes "Bis alle Herzen weg" and switches to "Gegner pro Runde" (FR-044, FR-082)', () => {
    const { persistence } = setup();
    toggle(L.noDamage);
    const select = field(L.roundType);
    expect(select.value).toBe('enemyCount');
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['enemyCount']);
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(saveButton());
    expect(persistence.settings()).toMatchObject({ noDamage: true, roundType: 'enemyCount' });
  });

  it('"Uhr beim Spielen zeigen" is off and "Rekord zeigen" is on by default, and both save', () => {
    const { persistence } = setup();
    expect(field(L.showClock).checked).toBe(false);
    expect(field(L.showRecords).checked).toBe(true);
    toggle(L.showClock);
    toggle(L.showRecords);
    fireEvent.click(saveButton());
    expect(persistence.settings()).toMatchObject({ showClock: true, showRecords: false });
  });

  it('"Garage und Sterne" is on by default and saves garage (amendment 11, FR-096)', () => {
    const { persistence } = setup();
    expect(field(L.garage).checked).toBe(true);
    toggle(L.garage);
    fireEvent.click(saveButton());
    expect(persistence.settings().garage).toBe(false);
  });

  it('"Zahlenfeld" offers Automatisch, Immer and Nie, starts at Automatisch and saves numberPad (amendment 12, FR-102)', () => {
    const { persistence } = setup();
    const select = field(L.numberPad);
    expect(select.value).toBe('auto');
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([L.numberPadAuto, L.numberPadAlways, L.numberPadNever]);
    setValue(L.numberPad, 'always');
    fireEvent.click(saveButton());
    expect(persistence.settings().numberPad).toBe('always');
    setValue(L.numberPad, 'never');
    fireEvent.click(saveButton());
    expect(persistence.settings().numberPad).toBe('never');
  });

  it('shows the amendment 06 fields', () => {
    setup({ roundType: 'enemyCount' });
    for (const label of [L.roundType, L.roundLength, L.showClock, L.showRecords]) expect(field(label), label).toBeTruthy();
  });

  it('shows a reset notice that names the data that could not be read (review M3)', () => {
    setup(undefined, { [SETTINGS_KEY]: '{not json', [PROGRESS_KEY]: '[]' });
    expect(screen.getByText(m.parent.storageReset(`${m.parent.dataNames.settings}, ${m.parent.dataNames.progress}`))).toBeTruthy();
  });

  it('tells the parent when stored data comes from a newer version of the game (review M2)', () => {
    setup(undefined, { [PROGRESS_KEY]: JSON.stringify({ version: 2, attempts: [], skills: {}, sessions: [] }) });
    expect(screen.getByText(m.parent.storageNewer(m.parent.dataNames.progress))).toBeTruthy();
  });

  it('shows a save failure that happened during play, naming the data, until that data saves (review H1)', () => {
    const inner = memoryKeyValue();
    const failing = new Set([PROGRESS_KEY]);
    const kv = {
      ...inner,
      set: (k: string, v: string) => {
        if (failing.has(k)) throw new Error('full');
        inner.set(k, v);
      },
    };
    const persistence = createPersistence({ kv, storage: undefined });
    persistence.saveProgress(persistence.progress());
    render(<SettingsPage persistence={persistence} onSaved={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(m.parent.saveFailedData(m.parent.dataNames.progress))).toBeTruthy();
    fireEvent.click(saveButton());
    // A working settings save does not hide the failed progress save.
    expect(screen.getByText(m.parent.saveFailedData(m.parent.dataNames.progress))).toBeTruthy();
  });

  it('shows every field of FR-046', () => {
    setup({ timeLimitSeconds: 30, roundType: 'enemyCount' });
    for (const label of [
      L.numberLine, L.addition, L.subtraction, L.comparison, L.playModeMixed, L.playModeRuler, L.playModeMath,
      L.rangePreset,
      L.additionMaxOperand, L.additionMaxResult, L.additionSteps, L.subtractionMaxOperand, L.subtractionSteps,
      L.crossTens, L.crossHundreds,
      L.rulerLevelStart, L.rulerLevelMax,
      L.helpNearestTen, L.helpCountSteps, L.helpZoom, L.helpStepAnimation, L.beginnerAssist,
      L.enemyDifficulty, L.noDamage,
      L.soundEffects, L.music, L.speech,
      L.roundType, L.roundLength, L.showClock, L.showRecords, L.adaptive, L.timeLimit, L.timeLimitSeconds, L.pointAfterFullHelp, L.garage, L.numberPad, L.aimCross,
    ]) {
      expect(screen.getByLabelText(label), label).toBeTruthy();
    }
    for (const group of Object.values(m.settings.groups)) {
      expect(screen.getByRole('group', { name: group }), group).toBeTruthy();
    }
  });

  it('shows no field as "kommt bald" once every feature is built, and keeps the stored values on save', () => {
    const stored: Partial<Settings> = {
      help: { nearestTen: false, countSteps: true, zoom: false, stepAnimation: true },
      sound: { effects: true, music: true, speech: false },
      adaptive: false,
      beginnerAssist: false,
      timeLimitSeconds: 45,
      addition: { maxOperand: 7, maxResult: 90, steps: 2 },
    };
    const { persistence } = setup(stored);
    // Every feature is built since Phase 23 (T138, T142).
    // Addition and subtraction limits work since Phase 16, beginner assistance since Phase 17; they can be changed.
    for (const label of [L.additionMaxOperand, L.additionMaxResult, L.additionSteps, L.subtractionMaxOperand, L.subtractionSteps, L.beginnerAssist]) {
      expect(field(label).disabled, label).toBe(false);
    }
    // Comparison works since Phase 18; the help switches and the time limit since Phase 20.
    expect(field(L.comparison).disabled).toBe(false);
    // Adaptive difficulty works since Phase 22.
    for (const label of [L.helpNearestTen, L.helpCountSteps, L.helpZoom, L.helpStepAnimation, L.timeLimit, L.timeLimitSeconds, L.adaptive]) {
      expect(field(label).disabled, label).toBe(false);
    }
    // Music and spoken instructions work since Phase 23; nothing shows "kommt bald".
    for (const label of [L.music, L.speech]) expect(field(label).disabled, label).toBe(false);
    expect(screen.queryByText('kommt bald')).toBeNull();
    expect(field(L.rangePreset).disabled).toBe(false);
    expect(field(L.enemyDifficulty).disabled).toBe(false);
    setValue(L.enemyDifficulty, 'normal');
    fireEvent.click(saveButton());
    const saved = persistence.settings();
    expect(saved.enemyDifficulty).toBe('normal');
    expect(saved.help).toEqual(stored.help);
    expect(saved.sound).toEqual(stored.sound);
    expect(saved.adaptive).toBe(false);
    expect(saved.beginnerAssist).toBe(false);
    expect(saved.timeLimitSeconds).toBe(45);
    expect(saved.addition).toEqual(stored.addition);
  });

  it('the group "Hilfe" holds "Zeitlimit", its seconds and "Punkt nach voller Hilfe", each with a one-line explanation (amendment 18)', () => {
    setup({ timeLimitSeconds: 30 });
    const help = within(screen.getByRole('group', { name: m.settings.groups.help }));
    expect(help.getByLabelText(L.timeLimit)).toBeTruthy();
    expect(help.getByLabelText(L.timeLimitSeconds)).toBeTruthy();
    expect(help.getByLabelText(L.pointAfterFullHelp)).toBeTruthy();
    expect(help.getByText(m.settings.explanations.timeLimit)).toBeTruthy();
    expect(help.getByText(m.settings.explanations.pointAfterFullHelp)).toBeTruthy();
    const round = within(screen.getByRole('group', { name: m.settings.groups.round }));
    expect(round.queryByLabelText(L.timeLimit)).toBeNull();
  });

  it('each one-line explanation describes its switch (aria-describedby, code review)', () => {
    setup();
    const help = within(screen.getByRole('group', { name: m.settings.groups.help }));
    expect(help.getByRole('checkbox', { name: L.timeLimit, description: m.settings.explanations.timeLimit })).toBeTruthy();
    expect(help.getByRole('checkbox', { name: L.pointAfterFullHelp, description: m.settings.explanations.pointAfterFullHelp })).toBeTruthy();
  });

  it('"Punkt nach voller Hilfe" is on by default, and turning it off saves pointAfterFullHelp false (amendment 18, FR-129)', () => {
    const { persistence } = setup();
    expect(field(L.pointAfterFullHelp).checked).toBe(true);
    toggle(L.pointAfterFullHelp);
    fireEvent.click(saveButton());
    expect(persistence.settings().pointAfterFullHelp).toBe(false);
  });

  it('"Zielkreuz" offers Immer, Bis Zahlenstrahl-Stufe and Nie with an explanation, starts at Immer (amendment 19, FR-134)', () => {
    setup();
    const select = field(L.aimCross);
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([L.aimCrossAlways, L.aimCrossUpToLevel, L.aimCrossNever]);
    expect(select.value).toBe('always');
    expect(screen.getByRole('combobox', { name: L.aimCross, description: m.settings.explanations.aimCross })).toBeTruthy();
    expect(screen.queryByLabelText(L.aimCrossLevel)).toBeNull();
  });

  it('the level field shows only with "Bis Zahlenstrahl-Stufe", starts at 2 and saves aimCross (amendment 19)', () => {
    const { persistence } = setup();
    setValue(L.aimCross, 'upToLevel');
    const level = field(L.aimCrossLevel);
    expect(level.value).toBe('2');
    setValue(L.aimCrossLevel, '4');
    fireEvent.click(saveButton());
    expect(persistence.settings().aimCross).toEqual({ mode: 'upToLevel', level: 4 });
    setValue(L.aimCross, 'never');
    expect(screen.queryByLabelText(L.aimCrossLevel)).toBeNull();
    fireEvent.click(saveButton());
    // The level is kept, so switching back restores it.
    expect(persistence.settings().aimCross).toEqual({ mode: 'never', level: 4 });
  });

  it('"Schließen" calls onClose', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: m.parent.close }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsPage data section (FR-048a)', () => {
  it('"Daten sichern" names the file with the local date and keeps the address until the download started (review R6, L3)', () => {
    vi.useFakeTimers();
    try {
      const kv = memoryKeyValue();
      const persistence = createPersistence({ kv, storage: undefined });
      // A local time whose UTC date is another day: 23:30 west of UTC, 00:30 on 6 November east of it.
      const west = new Date(2026, 10, 5, 12).getTimezoneOffset() > 0;
      const late = west ? new Date(2026, 10, 5, 23, 30) : new Date(2026, 10, 6, 0, 30);
      const localDay = west ? '2026-11-05' : '2026-11-06';
      render(<SettingsPage persistence={persistence} onSaved={vi.fn()} onClose={vi.fn()} now={() => late} />);
      const revokeObjectURL = vi.fn();
      Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL });
      const names: string[] = [];
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        names.push(this.download);
      });
      fireEvent.click(screen.getByRole('button', { name: m.parent.exportData }));
      expect(names).toEqual([`mathe-panzer-${localDay}.json`]);
      vi.advanceTimersByTime(100);
      expect(revokeObjectURL).not.toHaveBeenCalled();
      vi.advanceTimersByTime(60_000);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
    } finally {
      vi.useRealTimers();
    }
  });

  it('"Daten sichern" says so when the download cannot start (review L3)', () => {
    setup();
    Object.assign(URL, {
      createObjectURL: vi.fn(() => {
        throw new Error('blocked');
      }),
      revokeObjectURL: vi.fn(),
    });
    fireEvent.click(screen.getByRole('button', { name: m.parent.exportData }));
    expect(screen.getByText(m.settings.data.exportFailed)).toBeTruthy();
  });

  it('"Daten sichern" downloads the export as mathe-panzer-<date>.json', () => {
    setup();
    const created: Blob[] = [];
    const createObjectURL = vi.fn((b: Blob) => {
      created.push(b);
      return 'blob:test';
    });
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('mathe-panzer-2026-11-05.json');
      expect(this.href).toBe('blob:test');
    });
    fireEvent.click(screen.getByRole('button', { name: m.parent.exportData }));
    expect(click).toHaveBeenCalledTimes(1);
    expect(created).toHaveLength(1);
  });

  it('"Daten laden" reads a chosen file, applies it and shows the result', async () => {
    const { persistence, onSaved } = setup();
    const other = { ...defaultSettings(), enemyDifficulty: 'challenging' as const, range: { preset: '0-20' as const, min: 0, max: 20 }, addition: { maxOperand: 10, maxResult: 20, steps: 1 as const } };
    const text = exportData(other, persistence.progress(), emptyRecords(), persistence.garage(), new Date('2026-11-01T00:00:00Z'));
    const file = new File([text], 'mathe-panzer.json', { type: 'application/json' });
    await act(async () => {
      fireEvent.change(screen.getByLabelText(m.parent.importData), { target: { files: [file] } });
    });
    expect(await screen.findByText(m.settings.data.imported)).toBeTruthy();
    expect(persistence.settings().enemyDifficulty).toBe('challenging');
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ enemyDifficulty: 'challenging' }));
    expect(field(L.enemyDifficulty).value).toBe('challenging');
    expect(field(L.rangePreset).value).toBe('0-20');
  });

  it('"Daten laden" with a file that is not a backup changes nothing and says so', async () => {
    const { persistence, onSaved } = setup();
    const before = persistence.settings();
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    await act(async () => {
      fireEvent.change(screen.getByLabelText(m.parent.importData), { target: { files: [file] } });
    });
    expect(await screen.findByText(m.settings.data.importFailed.notJson)).toBeTruthy();
    expect(persistence.settings()).toEqual(before);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('"Daten laden" whose save fails says only that nothing changed, never "imported" (review L2, M4)', async () => {
    const inner = memoryKeyValue();
    const kv = {
      ...inner,
      set: (k: string, v: string) => {
        if (k === PROGRESS_KEY) throw new Error('full');
        inner.set(k, v);
      },
    };
    const persistence = createPersistence({ kv, storage: undefined });
    const onSaved = vi.fn();
    render(<SettingsPage persistence={persistence} onSaved={onSaved} onClose={vi.fn()} />);
    const file = new File([exportData({ ...defaultSettings(), rulerLevelStart: 3 }, persistence.progress(), emptyRecords(), persistence.garage())], 'b.json');
    await act(async () => {
      fireEvent.change(screen.getByLabelText(m.parent.importData), { target: { files: [file] } });
    });
    expect(await screen.findByText(m.settings.data.importFailed.notSaved)).toBeTruthy();
    expect(screen.queryByText(m.settings.data.imported)).toBeNull();
    expect(persistence.settings().rulerLevelStart).toBe(1);
    expect(inner.get(SETTINGS_KEY)).toBeNull();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('says so when the transfer code cannot be built, instead of showing no QR code silently (review M5)', async () => {
    const persistence = createPersistence({ kv: memoryKeyValue(), storage: undefined });
    vi.spyOn(persistence, 'saveData').mockImplementation(() => {
      throw new Error('broken');
    });
    render(<SettingsPage persistence={persistence} onSaved={vi.fn()} onClose={vi.fn()} />);
    expect(await screen.findByText(m.settings.transfer.buildFailed)).toBeTruthy();
    expect(screen.queryByTestId('transfer-qr')).toBeNull();
  });

  it('explains how to add the game to the Home Screen', () => {
    setup();
    expect(screen.getByText(m.settings.data.homeScreen)).toBeTruthy();
  });

  it('credits the ground texture: author, license and a link to its page (amendment 14, FR-114)', () => {
    setup();
    const credits = screen.getByTestId('credits');
    expect(credits.textContent).toContain('Drummyfish');
    expect(credits.textContent).toContain('CC0');
    const link = within(credits).getByRole('link') as HTMLAnchorElement;
    expect(link.href).toBe('https://opengameart.org/node/84103');
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
  });
});

/** A clipboard whose writeText resolves or rejects, put on `navigator` for one test. */
function mockClipboard(fails = false) {
  const writeText = fails ? vi.fn().mockRejectedValue(new Error('denied')) : vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return writeText;
}

/** Many sessions with irregular numbers, so even the compressed link is longer than one QR code holds. */
function manySessions(n: number) {
  let x = 12345;
  const next = () => (x = (x * 1103515245 + 12345) % 2147483648);
  return {
    version: 1,
    attempts: [],
    skills: {},
    sessions: Array.from({ length: n }, (_, i) => ({ id: `s${next()}`, startedAt: next(), lastActiveAt: next(), attempts: i, independentCorrect: next() % 50, assisted: next() % 50 })),
  };
}

describe('SettingsPage "Spielstand übertragen" (amendment 15, FR-115, FR-118)', () => {
  const T = m.settings.transfer;

  it('shows a QR code and the link of the saved data', async () => {
    setup({ range: { preset: 'custom', min: 550, max: 780 }, addition: { maxOperand: 10, maxResult: 780, steps: 1 } });
    const group = screen.getByRole('group', { name: T.title });
    const qr = await within(group).findByTestId('transfer-qr');
    expect(qr.tagName.toLowerCase()).toBe('svg');
    expect(qr.querySelector('path')?.getAttribute('d')).toMatch(/^M\d+ \d+h1v1h-1z/);
    const section = screen.getByTestId('transfer');
    const link = section.getAttribute('data-transfer-link')!;
    expect(link).toContain('#save=v2.');
    const decoded = await decodeTransfer(link.slice(link.indexOf('#save=') + 6));
    expect(decoded.ok && decoded.data.settings.range).toEqual({ preset: 'custom', min: 550, max: 780 });
    expect(within(group).queryByText(T.trimmed)).toBeNull();
  });

  it('"QR groß anzeigen" shows the same QR code full screen on white, and "Schließen" or Escape closes it (T305)', async () => {
    setup();
    const small = await screen.findByTestId('transfer-qr');
    fireEvent.click(screen.getByRole('button', { name: T.showLarge }));
    const dialog = screen.getByRole('dialog', { name: T.qrLabel });
    expect(dialog.className).toContain('qr-fullscreen');
    const large = within(dialog).getByTestId('transfer-qr-large');
    expect(large.querySelector('path')?.getAttribute('d')).toBe(small.querySelector('path')?.getAttribute('d'));
    expect(large.getAttribute('data-qr-size')).toBe(small.getAttribute('data-qr-size'));
    fireEvent.click(within(dialog).getByRole('button', { name: T.closeLarge }));
    expect(screen.queryByRole('dialog', { name: T.qrLabel })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: T.showLarge }));
    fireEvent.keyDown(screen.getByRole('dialog', { name: T.qrLabel }), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: T.qrLabel })).toBeNull();
  });

  it('"Link kopieren" writes the link to the clipboard and says so', async () => {
    const writeText = mockClipboard();
    setup();
    await screen.findByTestId('transfer-qr');
    const link = screen.getByTestId('transfer').getAttribute('data-transfer-link');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: T.copy }));
    });
    expect(writeText).toHaveBeenCalledWith(link);
    expect(await screen.findByText(T.copied)).toBeTruthy();
  });

  it('when the clipboard fails, the link is shown as text', async () => {
    mockClipboard(true);
    setup();
    await screen.findByTestId('transfer-qr');
    const link = screen.getByTestId('transfer').getAttribute('data-transfer-link')!;
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: T.copy }));
    });
    expect(await screen.findByText(T.copyFailed)).toBeTruthy();
    expect(screen.getByTestId('transfer-link-text').textContent).toBe(link);
  });

  it('a save too large for one QR code leaves out old sessions and says that only "Daten sichern" moves the whole history', async () => {
    setup(undefined, { [PROGRESS_KEY]: JSON.stringify(manySessions(400)) });
    const group = screen.getByRole('group', { name: T.title });
    expect(await within(group).findByText(T.trimmed)).toBeTruthy();
    const link = screen.getByTestId('transfer').getAttribute('data-transfer-link')!;
    expect(new TextEncoder().encode(link).length).toBeLessThanOrEqual(2300);
    expect(within(group).getByTestId('transfer-qr')).toBeTruthy();
  });
});

// Bug "iPhone rotation in Chrome" (Phase 24): a parent can see which build runs.
it('shows the build version and date', () => {
  setup();
  expect(screen.getByTestId('build-version').textContent).toBe(m.settings.version(BUILD_VERSION, BUILD_DATE));
});

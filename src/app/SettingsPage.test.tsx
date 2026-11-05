/**
 * Settings page (FR-046 to FR-048a, FR-069, FR-079, US6 scenarios 4 and 5).
 * Amendment 06 (announced by the product owner, built in the next chunk): "Genau treffen" is not shown, and the
 * round length is labeled "Gegner pro Runde" with 1 to 20; until the schema changes, the page accepts 3 to 20.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../core/settings/defaults';
import type { Settings } from '../core/settings/schema';
import { exportData } from '../core/storage/exportImport';
import { memoryKeyValue } from '../core/storage/keyValue';
import { SETTINGS_KEY } from '../core/storage/storage';
import { t } from '../i18n';
import { COMING_SOON } from './comingSoon';
import { createPersistence } from './persistence';
import { SettingsPage } from './SettingsPage';

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

  it('turning off all challenge types shows the hint and offers free play', () => {
    // Comparison is "kommt bald" and cannot be changed, so it starts off here.
    setup({ challengeTypes: { numberLine: true, addition: true, subtraction: true, comparison: false } });
    toggle(L.numberLine);
    toggle(L.addition);
    toggle(L.subtraction);
    expect(screen.getByText(m.settings.guidedNeedsType)).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: m.settings.offerFreePlay }));
    expect(field(L.freePlay).checked).toBe(true);
    expect(saveButton().disabled).toBe(false);
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

  it('the ruler preview shows the chosen range and starting level', () => {
    setup();
    setValue(L.rangePreset, 'custom');
    setValue(L.rangeMin, '550');
    setValue(L.rangeMax, '780');
    setValue(L.rulerLevelStart, '2');
    const preview = screen.getByTestId('ruler-preview');
    expect(preview.getAttribute('aria-label')).toBe(m.settings.preview(550, 780, 2));
    const labels = within(preview as unknown as HTMLElement).getAllByTestId('preview-label').map((el) => Number(el.textContent));
    expect(labels).toEqual([550, 600, 650, 700, 750, 780]);
    setValue(L.rulerLevelStart, '5');
    expect(within(preview as unknown as HTMLElement).getAllByTestId('preview-label').map((el) => Number(el.textContent))).toEqual([550, 780]);
  });

  it('does not show "Genau treffen" (amendment 06), an aim-correction or a label-level field', () => {
    setup();
    expect(screen.queryByLabelText(L.exactHit)).toBeNull();
    expect(screen.queryByText(L.exactHit)).toBeNull();
    expect(screen.queryByLabelText(/Zielhilfe|aim/i)).toBeNull();
    expect(screen.queryByLabelText(/Beschriftung/i)).toBeNull();
  });

  it('keeps a stored exactHit value on save (amendment 06 removes it in the next chunk)', () => {
    const { persistence } = setup({ exactHit: true });
    toggle(L.noDamage);
    fireEvent.click(saveButton());
    expect(persistence.settings().exactHit).toBe(true);
    expect(persistence.settings().noDamage).toBe(true);
  });

  it('labels the round length "Gegner pro Runde" and accepts 3 to 20', () => {
    setup();
    expect(field(L.roundLength).value).toBe('10');
    setValue(L.roundLength, '21');
    expect(screen.getByText(m.settings.roundLengthRange(3, 20))).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    setValue(L.roundLength, '20');
    expect(saveButton().disabled).toBe(false);
  });

  it('shows a reset notice when stored data could not be read', () => {
    setup(undefined, { [SETTINGS_KEY]: '{not json' });
    expect(screen.getByText(m.parent.storageReset)).toBeTruthy();
  });

  it('shows every field of FR-046', () => {
    setup({ timeLimitSeconds: 30 });
    for (const label of [
      L.numberLine, L.addition, L.subtraction, L.comparison, L.freePlay,
      L.rangePreset,
      L.additionMaxOperand, L.additionMaxResult, L.additionSteps, L.subtractionMaxOperand, L.subtractionSteps,
      L.crossTens, L.crossHundreds,
      L.rulerLevelStart, L.rulerLevelMax,
      L.helpNearestTen, L.helpCountSteps, L.helpZoom, L.helpStepAnimation, L.beginnerAssist,
      L.enemyDifficulty, L.noDamage,
      L.soundEffects, L.music, L.speech,
      L.roundLength, L.adaptive, L.timeLimit, L.timeLimitSeconds,
    ]) {
      expect(screen.getByLabelText(label), label).toBeTruthy();
    }
    for (const group of Object.values(m.settings.groups)) {
      expect(screen.getByRole('group', { name: group }), group).toBeTruthy();
    }
  });

  it('shows fields of features not built yet disabled with "kommt bald" and keeps their stored values on save', () => {
    const stored: Partial<Settings> = {
      help: { nearestTen: false, countSteps: true, zoom: false, stepAnimation: true },
      sound: { effects: true, music: true, speech: false },
      adaptive: false,
      beginnerAssist: false,
      timeLimitSeconds: 45,
      addition: { maxOperand: 7, maxResult: 90, steps: 2 },
    };
    const { persistence } = setup(stored);
    expect(COMING_SOON.length).toBeGreaterThan(0);
    for (const label of [L.comparison, L.helpNearestTen, L.music, L.speech, L.adaptive, L.beginnerAssist, L.timeLimit, L.additionMaxOperand, L.additionSteps]) {
      const input = field(label);
      expect(input.disabled, label).toBe(true);
      const note = document.getElementById(input.getAttribute('aria-describedby') ?? '');
      expect(note?.textContent, label).toBe(m.parent.comingSoon);
    }
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

  it('"Schließen" calls onClose', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: m.parent.close }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsPage data section (FR-048a)', () => {
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
    const text = exportData(other, persistence.progress(), new Date('2026-11-01T00:00:00Z'));
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

  it('explains how to add the game to the Home Screen', () => {
    setup();
    expect(screen.getByText(m.settings.data.homeScreen)).toBeTruthy();
  });
});

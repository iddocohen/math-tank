/**
 * Ruler previews on the settings page and level 1 labels (Phase 18a, T217 to T219, FR-017, FR-069).
 *
 * The parent opens the settings page through the gear press and changes the starting level, the hardest level and
 * the range. After each change the lines and labels of the matching preview change. Both previews are as wide as
 * the settings page. A second case checks that the game ruler at 0 to 100, level 1, labels every number.
 */
import type { Locator } from '@playwright/test';
import { expect, openSettings, seedStorage, startButton, test } from './fixtures';
import { ticksFor } from '../../src/core/numberline/ticks';
import { defaultSettings } from '../../src/core/settings/defaults';
import { withRange } from '../../src/core/settings/validate';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

/** The labels of the 0 to 100 ruler on level 1 (T217, T231): every number except the ones crowding a large label. */
const LEVEL1_LABELS = ticksFor({ min: 0, max: 100 }, 1, 0)
  .ticks.filter((tk) => tk.labeled)
  .map((tk) => tk.value);

const m = t();
const L = m.settings.labels;

/** Line and label counts of one preview, and its labels as text. */
async function counts(preview: Locator): Promise<{ lines: number; labels: number; text: string }> {
  const labels = preview.getByTestId('preview-label');
  return {
    lines: await preview.getByTestId('preview-line').count(),
    labels: await labels.count(),
    text: (await labels.allTextContents()).join(','),
  };
}

test('both ruler previews change with the levels and the range, and fill the page width (T219, FR-069)', async ({ page }) => {
  await page.goto('/?seed=3');
  await openSettings(page);
  const start = page.getByTestId('ruler-preview-start');
  const hardest = page.getByTestId('ruler-preview-max');
  await expect(start.getByText(m.settings.previewStart, { exact: true })).toBeVisible();
  await expect(hardest.getByText(m.settings.previewMax, { exact: true })).toBeVisible();

  // Defaults: 0 to 100, starting level 1 labels every number except the small labels crowding a large one (T231),
  // hardest level 5 draws every line and labels only the end points (amendment 20).
  const start1 = await counts(start);
  const max5 = await counts(hardest);
  expect(start1).toMatchObject({ lines: 101, labels: LEVEL1_LABELS.length });
  // Medium lines at 5, 15 … 95 on level 1 (T235).
  await expect(start.locator('[data-testid="preview-line"][data-size="medium"]')).toHaveCount(10);
  expect(max5).toMatchObject({ lines: 101, labels: 2, text: '0,100' });

  // Both previews are as wide as the settings page.
  const pageWidth = (await page.locator('.settings-groups').boundingBox())!.width;
  for (const preview of [start, hardest]) {
    const w = (await preview.locator('svg').boundingBox())!.width;
    expect(w).toBeGreaterThan(pageWidth * 0.9);
  }
  await page.locator('.settings-group-wide').screenshot({ path: test.info().outputPath('previews-default.png') });

  // Starting level 1 -> 4: the starting preview keeps every line and labels 0, 50 and 100 (amendment 20); the hardest
  // preview stays.
  await page.getByLabel(L.rulerLevelStart, { exact: true }).selectOption('4');
  await expect(start.getByTestId('preview-label')).toHaveCount(3);
  expect(await counts(start)).toEqual({ lines: 101, labels: 3, text: '0,50,100' });
  await expect(start.locator('[data-testid="preview-line"][data-size="medium"]')).toHaveCount(10);
  expect(await counts(hardest)).toEqual(max5);

  // Hardest level 5 -> 3 is easier than the starting level 4: an error shows, and the hardest preview changes.
  await page.getByLabel(L.rulerLevelMax, { exact: true }).selectOption('3');
  await expect(hardest.getByTestId('preview-line')).toHaveCount(101);
  const max3 = await counts(hardest);
  expect(max3).toEqual({ lines: 101, labels: 6, text: '0,20,40,60,80,100' });
  await expect(page.getByText(m.settingsErrors.rulerLevelOrder)).toBeVisible();

  // Range 0 to 100 -> 550 to 780: both previews change.
  await page.getByLabel(L.rangePreset, { exact: true }).selectOption('custom');
  await page.getByLabel(L.rangeMax, { exact: true }).fill('780');
  await page.getByLabel(L.rangeMin, { exact: true }).fill('550');
  await expect(start.getByTestId('preview-label').first()).toHaveText('550');
  await expect(start.getByTestId('preview-line')).toHaveCount(24);
  const start4 = await counts(start);
  expect(start4).toEqual({ lines: 24, labels: 3, text: '550,650,780' });
  const max3Custom = await counts(hardest);
  expect(max3Custom).toEqual({ lines: 24, labels: 4, text: '550,600,700,780' });
  expect(max3Custom).not.toEqual(max3);
  await page.locator('.settings-group-wide').screenshot({ path: test.info().outputPath('previews-550-780.png') });
});

test('the game ruler at 0 to 100, level 1, labels the numbers in two rows, none crowding a large label (T217, T231, FR-017)', async ({ page }) => {
  const settings = { ...defaultSettings() };
  expect(settings.range).toMatchObject({ min: 0, max: 100 });
  expect(settings.rulerLevelStart).toBe(1);
  await seedStorage(page, { [SETTINGS_KEY]: settings });
  await page.goto('/?seed=4&mode=ruler');
  await expect(startButton(page)).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-phase]')).toHaveAttribute('data-phase', 'challenge');
  await expect(page.locator('canvas')).toHaveAttribute('data-ruler-labels', LEVEL1_LABELS.join(','));
  await page.screenshot({ path: test.info().outputPath('game-ruler-0-100-level-1.png') });
});

/** Expected game ruler labels per level at 0 to 100 (amendment 20). */
const LABELS_0_100: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: LEVEL1_LABELS.join(','),
  2: '0,10,20,30,40,50,60,70,80,90,100',
  3: '0,20,40,60,80,100',
  4: '0,50,100',
  5: '0,100',
};

for (const [level, range, labels] of [
  ...([1, 2, 3, 4, 5] as const).map((l) => [l, { preset: '0-100', min: 0, max: 100 }, LABELS_0_100[l]] as const),
  [5, { preset: '0-1000', min: 0, max: 1000 }, '0,1000'] as const,
]) {
  test(`the game ruler at ${range.min} to ${range.max}, level ${level}, draws all 101 lines and labels ${labels.length > 30 ? 'every number with room' : labels} (amendment 20)`, async ({ page }) => {
    const settings = { ...withRange(defaultSettings(), range), rulerLevelStart: level, rulerLevelMax: level };
    await seedStorage(page, { [SETTINGS_KEY]: settings });
    await page.goto('/?seed=4&mode=ruler');
    await expect(startButton(page)).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-phase]')).toHaveAttribute('data-phase', 'challenge');
    const canvas = page.locator('canvas');
    await expect(canvas).toHaveAttribute('data-ruler-lines', '101');
    await expect(canvas).toHaveAttribute('data-ruler-labels', labels);
    // playwright.config.ts passes SCREENSHOT_DIR as metadata (the e2e specs have no Node types).
    const dir = test.info().config.metadata.screenshotDir as string | undefined;
    if (dir && test.info().project.name === 'chromium') await page.screenshot({ path: `${dir}/ruler-${range.min}-${range.max}-level-${level}.png` });
  });
}

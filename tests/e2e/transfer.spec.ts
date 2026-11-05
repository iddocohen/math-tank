/**
 * Moving a save to another browser with a QR code or a link (amendment 15, FR-115 to FR-120, T300).
 *
 * A first browser context stores a save, opens the settings page through the parent gate and reads the link from
 * `data-transfer-link`; the QR code drawn on the page is decoded with jsqr and must give the same link. A fresh
 * second context opens the link and decides in the dialog: a 2-second hold on "Übernehmen" takes the save over,
 * "Abbrechen" changes nothing, and in both cases the address loses `#save=`. A changed code shows "Dieser Code
 * passt nicht". With SCREENSHOT_DIR set, the Chromium run saves the settings transfer group and the dialog.
 */
import jsQR from 'jsqr';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { expect, silenceAudio, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { withRange } from '../../src/core/settings/validate';
import { GARAGE_KEY, PROGRESS_KEY, RECORDS_KEY, SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const m = t();

const SETTINGS = { ...withRange(defaultSettings(), { preset: 'custom', min: 550, max: 780 }), enemyDifficulty: 'normal' as const, showClock: true };
const GARAGE = { version: 1, stars: 37, look: { color: 'sky', flag: 'rocket', trail: 'sparkles', hat: 'none' } };
const RECORDS = { version: 1, best: { '550-780|1|untilHearts': { enemies: 4, ms: 61_000, at: 1_700_000_000_000 } } };
const SKILL = {
  step: 2,
  recent: ['independent'],
  masteryWindow: ['independent', 'assisted', 'independent'],
  guesses: 1,
  attempts: 12,
  independentCorrect: 9,
  assisted: 2,
};
const SESSIONS = [{ id: 's1', startedAt: 1_700_000_000_000, lastActiveAt: 1_700_000_600_000, attempts: 12, independentCorrect: 9, assisted: 2 }];
const PROGRESS = {
  version: 1,
  attempts: [
    {
      challengeId: '1-0',
      seed: 1,
      kind: 'findNumber',
      skills: ['positions'],
      rangeKey: '550-780',
      difficultyStep: 2,
      solved: true,
      independent: true,
      exact: true,
      helpLevel: 0,
      wrongAnswers: 0,
      responseMs: 3000,
      guess: false,
      sessionId: 's1',
      at: 1_700_000_000_000,
    },
  ],
  skills: { 'positions|550-780': SKILL },
  sessions: SESSIONS,
};

async function silentPage(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  await context.addInitScript(silenceAudio);
  return { context, page: await context.newPage() };
}

/** Parent gate: a 2-second press on the gear, then "Einstellungen" (FR-045). */
async function openSettings(page: Page): Promise<void> {
  await page.getByTestId('parent-gate').hover();
  await page.mouse.down();
  await page.waitForTimeout(2_300);
  await page.mouse.up();
  await page.getByRole('button', { name: m.parent.settings, exact: true }).click();
  await expect(page.getByTestId('settings-page')).toBeVisible();
}

async function stored(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate((keys) => Object.fromEntries(keys.map((k) => [k, JSON.parse(window.localStorage.getItem(k) ?? 'null') as unknown])), [
    SETTINGS_KEY,
    PROGRESS_KEY,
    RECORDS_KEY,
    GARAGE_KEY,
  ]);
}

/** Draws the QR code's SVG on a canvas in the page and returns its pixels, as a camera would see the screen. */
async function qrPixels(page: Page): Promise<{ data: number[]; width: number }> {
  return page.getByTestId('transfer-qr').evaluate(async (svg) => {
    const size = Number(svg.getAttribute('data-qr-size'));
    const width = size * 4;
    const copy = svg.cloneNode(true) as SVGSVGElement;
    copy.setAttribute('width', String(width));
    copy.setAttribute('height', String(width));
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(copy));
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = width;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, width);
    ctx.drawImage(img, 0, 0, width, width);
    return { data: Array.from(ctx.getImageData(0, 0, width, width).data), width };
  });
}

/** A first context with the save; returns the link from the settings page. */
async function linkFromFirstBrowser(browser: Browser, screenshot?: string): Promise<string> {
  const { context, page } = await silentPage(browser);
  await page.goto('/');
  await page.evaluate(
    (entries) => {
      for (const [k, v] of entries) window.localStorage.setItem(k, v);
    },
    [
      [SETTINGS_KEY, JSON.stringify(SETTINGS)],
      [GARAGE_KEY, JSON.stringify(GARAGE)],
      [RECORDS_KEY, JSON.stringify(RECORDS)],
      [PROGRESS_KEY, JSON.stringify(PROGRESS)],
    ] as const,
  );
  await page.reload();
  await openSettings(page);
  const group = page.getByRole('group', { name: m.settings.transfer.title });
  await expect(group.getByTestId('transfer-qr')).toBeVisible();
  const link = (await page.getByTestId('transfer').getAttribute('data-transfer-link'))!;
  expect(link).toMatch(/^http:\/\/localhost:4173\/#save=v1\.[A-Za-z0-9_-]+$/);

  // The QR code on the page is scannable and holds the same link (FR-118).
  const { data, width } = await qrPixels(page);
  expect(jsQR(new Uint8ClampedArray(data), width, width)?.data).toBe(link);

  if (screenshot) {
    await group.scrollIntoViewIfNeeded();
    await group.screenshot({ path: screenshot });
  }
  await context.close();
  return link;
}

test.describe('move a save to another browser (amendment 15)', () => {
  test('"Übernehmen" held for 2 seconds takes over stars, look, settings, records and progress', async ({ browser }, info) => {
    const dir = info.config.metadata.screenshotDir as string | undefined;
    const shots = dir && info.project.name === 'chromium' ? dir : undefined;
    const link = await linkFromFirstBrowser(browser, shots && `${shots}/transfer-settings.png`);

    const { context, page } = await silentPage(browser);
    await page.goto(link);
    const dialog = page.getByTestId('transfer-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(m.transfer.summary(37, 4, 550, 780));
    if (shots) await page.screenshot({ path: `${shots}/transfer-dialog.png` });

    // Enter does not start the game behind the dialog, and a short tap does not take over.
    await page.keyboard.press('Enter');
    const accept = page.getByRole('button', { name: m.transfer.accept });
    await accept.click();
    await expect(dialog).toBeVisible();
    expect(await stored(page)).toEqual({ [SETTINGS_KEY]: null, [PROGRESS_KEY]: null, [RECORDS_KEY]: null, [GARAGE_KEY]: null });

    await accept.hover();
    await page.mouse.down();
    await page.waitForTimeout(2_300);
    await page.mouse.up();
    await expect(dialog).toBeHidden();
    expect(page.url()).not.toContain('#save=');
    expect(page.url()).toBe('http://localhost:4173/');

    await expect(page.getByTestId('star-total')).toHaveAttribute('aria-label', m.garage.stars(37));
    const s = await stored(page);
    expect(s[SETTINGS_KEY]).toEqual(SETTINGS);
    expect(s[GARAGE_KEY]).toEqual(GARAGE);
    expect(s[RECORDS_KEY]).toEqual(RECORDS);
    expect(s[PROGRESS_KEY]).toEqual({ version: 1, attempts: [], skills: { 'positions|550-780': { ...SKILL, recent: [] } }, sessions: SESSIONS });

    // The garage shows the same look, and a reload asks nothing.
    await page.getByRole('button', { name: m.start.garage, exact: true }).click();
    await expect(page.getByTestId('garage')).toHaveAttribute('data-look', 'color:sky flag:rocket trail:sparkles hat:none');
    await page.reload();
    await expect(page.getByRole('button', { name: m.start.play, exact: true })).toBeVisible();
    await expect(page.getByTestId('transfer-dialog')).toHaveCount(0);
    await context.close();
  });

  test('"Abbrechen" changes nothing and removes #save= from the address', async ({ browser }) => {
    const link = await linkFromFirstBrowser(browser);
    const { context, page } = await silentPage(browser);
    await page.goto(link);
    await expect(page.getByTestId('transfer-dialog')).toBeVisible();
    await page.getByRole('button', { name: m.transfer.cancel }).click();
    await expect(page.getByTestId('transfer-dialog')).toHaveCount(0);
    expect(page.url()).not.toContain('#save=');
    expect(await stored(page)).toEqual({ [SETTINGS_KEY]: null, [PROGRESS_KEY]: null, [RECORDS_KEY]: null, [GARAGE_KEY]: null });
    await expect(page.getByRole('button', { name: m.start.play, exact: true })).toBeVisible();
    await context.close();
  });

  test('a changed code shows "Dieser Code passt nicht" and changes nothing', async ({ page }) => {
    await page.goto('/#save=v1.AAECAwQFBgcICQ');
    const dialog = page.getByTestId('transfer-dialog');
    await expect(dialog).toContainText(m.transfer.invalid);
    await expect(page.getByRole('button', { name: m.transfer.accept })).toHaveCount(0);
    await page.getByRole('button', { name: m.transfer.close }).click();
    await expect(dialog).toHaveCount(0);
    expect(page.url()).not.toContain('#save=');
    expect(await stored(page)).toEqual({ [SETTINGS_KEY]: null, [PROGRESS_KEY]: null, [RECORDS_KEY]: null, [GARAGE_KEY]: null });
  });
});

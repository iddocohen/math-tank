/**
 * Amendment 26 end to end (T415, FR-148 to FR-155): the parent turns on only plus and sets plus "Zahlengröße" to
 * "Zwei Zahlen" with the first and the second number 10 to 99 and "Plus mit Übertrag" off, stops offering "Zahlen-Rätsel"
 * (amendment 27), then saves. In "Gemischt" the child destroys 5 enemies: every banner shows two two-digit numbers
 * whose columns do not carry. On the next enemy H twice reaches help step 2, which shows the place-value lines inside the viewport. Then the parent sets the
 * battlefield to 550 to 780: saving is blocked and the error under the plus "Zahlengröße" names plus.
 * Runs in the desktop projects and in the device projects (playwright.config.ts); on touch devices the parent gate is a
 * held touch and every button is a tap.
 *
 * With SCREENSHOT_DIR set, every project saves the battle with the place-value lines.
 */
import type { Locator, Page } from '@playwright/test';
import { expect, pressGear, seedStorage, startButton, test, touchHold, typeAndFire } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const m = t();
const L = m.settings.labels;

/** The two numbers of the banner "Der Gegner ist bei a + b". */
async function bannerPair(page: Page): Promise<[number, number]> {
  const banner = page.getByTestId('challenge-banner');
  await expect(banner).toHaveText(/^Der Gegner ist bei \d+ \+ \d+$/);
  const [, a, b] = /(\d+) \+ (\d+)$/.exec((await banner.textContent())!)!;
  return [Number(a), Number(b)];
}

/** True when no column of a + b adds up to more than 9. */
function noCarry(a: number, b: number): boolean {
  for (; a > 0 || b > 0; a = Math.floor(a / 10), b = Math.floor(b / 10)) if ((a % 10) + (b % 10) > 9) return false;
  return true;
}

test('"Zwei Zahlen" plus without carrying: 5 banners with two two-digit numbers, place-value help, 550 to 780 blocks saving', async ({ page }, info) => {
  test.setTimeout(150_000);
  const touch = info.project.use.hasTouch === true;
  const press = async (locator: Locator) => (touch ? locator.tap() : locator.click());
  const openSettings = async () => {
    const gear = page.getByTestId('parent-gate');
    if (touch) await touchHold(gear);
    else await pressGear(page);
    await press(page.getByRole('dialog', { name: m.parent.menu }).getByRole('button', { name: m.parent.settings, exact: true }));
    const settings = page.getByTestId('settings-page');
    await expect(settings).toBeVisible();
    return settings;
  };
  const dir = info.config.metadata.screenshotDir as string | undefined;
  await seedStorage(page, { [SETTINGS_KEY]: { ...defaultSettings() } }, { once: true });
  await page.goto('/?seed=1');
  await expect(startButton(page)).toBeVisible();

  // The parent turns on only plus, with "Zwei Zahlen" 10 to 99 and no carrying (the defaults of the two ranges).
  let settings = await openSettings();
  await settings.getByLabel(L.numberLine, { exact: true }).uncheck();
  await settings.getByLabel(L.subtraction, { exact: true }).uncheck();
  await settings.getByLabel(L.comparison, { exact: true }).uncheck();
  // "Zahlen-Rätsel" needs "Zahlenstrahl" or "Vergleichen", so the parent stops offering it (amendment 27, FR-162).
  await settings.getByLabel(L.playModeNumbers, { exact: true }).uncheck();
  const plus = settings.getByRole('group', { name: m.settings.groups.addition, exact: true });
  await plus.getByLabel(L.numberSize, { exact: true }).selectOption('twoNumbers');
  await expect(plus.getByLabel(L.firstFrom, { exact: true })).toHaveValue('10');
  await expect(plus.getByLabel(L.firstTo, { exact: true })).toHaveValue('99');
  await expect(plus.getByLabel(L.secondFrom, { exact: true })).toHaveValue('10');
  await expect(plus.getByLabel(L.secondTo, { exact: true })).toHaveValue('99');
  await expect(plus.getByLabel(L.additionCarry, { exact: true })).not.toBeChecked();
  await press(settings.getByRole('button', { name: m.settings.save, exact: true }));
  await expect(settings.getByText(m.settings.saved)).toBeVisible();
  await press(settings.getByRole('button', { name: m.parent.close, exact: true }));
  await expect(settings).toHaveCount(0);

  await press(startButton(page));
  const overlay = page.getByTestId('battle-overlay');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');

  // 5 banners: two two-digit numbers whose columns do not carry; the answer destroys the enemy.
  for (let i = 0; i < 5; i++) {
    const [a, b] = await bannerPair(page);
    for (const n of [a, b]) {
      expect(n).toBeGreaterThanOrEqual(10);
      expect(n).toBeLessThanOrEqual(99);
    }
    expect(noCarry(a, b), `${a} + ${b} carries`).toBe(true);
    await expect(overlay).toHaveAttribute('data-enemy-number', String(a + b));
    await typeAndFire(page, overlay, a + b);
    await expect(overlay).toHaveAttribute('data-enemies-destroyed', String(i + 1));
    await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  }

  // H twice: help step 2 shows the tens line, the ones line and the sum of the parts, inside the viewport.
  const [a, b] = await bannerPair(page);
  await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true');
  await page.keyboard.press('h');
  await expect(overlay).toHaveAttribute('data-help-level', '1');
  await page.keyboard.press('h');
  await expect(overlay).toHaveAttribute('data-help-level', '2');
  const tens = [Math.floor(a / 10) * 10, Math.floor(b / 10) * 10];
  const ones = [a % 10, b % 10];
  const tensSum = tens[0]! + tens[1]!;
  const onesSum = ones[0]! + ones[1]!;
  // A place shows a line when the second number has a digit there; the sum of the parts shows when there are two parts.
  const expected = [
    `Zehner: ${tens[0]} + ${tens[1]} = ${tensSum}`,
    ...(ones[1] !== 0 ? [`Einer: ${ones[0]} + ${ones[1]} = ${onesSum}`] : []),
    ...(onesSum > 0 ? [`${tensSum} + ${onesSum} = ${a + b}`] : []),
  ];
  const lines = page.getByTestId('help-line');
  await expect(lines).toHaveText(expected);
  const viewport = page.viewportSize()!;
  for (const line of await lines.all()) {
    await expect(line).toBeInViewport({ ratio: 1 });
    const box = (await line.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  }
  if (dir !== undefined) await page.screenshot({ path: `${dir}/two-numbers-help-${info.project.name}.png` });

  // The battlefield 550 to 780 has no plus exercise with first numbers 10 to 99: saving is blocked, plus is named.
  settings = await openSettings();
  await settings.getByLabel(L.rangePreset, { exact: true }).selectOption('custom');
  await settings.getByLabel(L.rangeMin, { exact: true }).fill('550');
  await settings.getByLabel(L.rangeMax, { exact: true }).fill('780');
  const plusAfter = settings.getByRole('group', { name: m.settings.groups.addition, exact: true });
  await expect(plusAfter.getByText(m.settingsErrors.additionNoPair)).toBeVisible();
  await expect(plusAfter.getByLabel(L.numberSize, { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(settings.getByText(m.settings.checkFields)).toBeVisible();
  await expect(settings.getByRole('button', { name: m.settings.save, exact: true })).toBeDisabled();
});

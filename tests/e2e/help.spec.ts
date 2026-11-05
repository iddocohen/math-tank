/**
 * US5 help end to end (T098, AC-07, SC-005, SC-006, FR-030, FR-031, FR-062, FR-081): in a guided search the child
 * types and fires three wrong numbers. After each one the ruler shows the landing number and the one message line
 * shows an encouraging phrase and then the help text (T230), with no forbidden word, and the enemy fires back (amendment 07). After the first the direction is shown, after the third the
 * solution; one press of Enter fires at it and destroys the enemy. A miss never removes a heart by itself. In the next
 * search H shows the first help step, and the enemy does not fire. Game state comes from the overlay's and the
 * canvas's data-* attributes (D4).
 */
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { forbiddenWords, t } from '../../src/i18n';

const m = t();
const { min, max } = defaultSettings().range;

function hasForbiddenWord(text: string): boolean {
  const lower = text.toLocaleLowerCase('de');
  return forbiddenWords.some((w) => lower.includes(w.toLocaleLowerCase('de')));
}

/** A wrong number `offset` away from the answer, inside the range and off the enemy tank's body. */
function wrongNumber(answer: number, offset: number): number {
  return answer - offset >= min ? answer - offset : answer + offset;
}

async function typeAndFire(page: Page, overlay: Locator, n: number): Promise<void> {
  await expect(overlay).toHaveAttribute('data-phase', 'challenge', { timeout: 15_000 });
  await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true');
  await page.keyboard.type(String(n));
  await expect(page.getByTestId('readout')).toHaveText(String(n));
  await page.keyboard.press('Enter');
}

test('three wrong numbers: help escalates to the solution, Enter fires at it, H shows help without an enemy shot (AC-07)', async ({ page }) => {
  test.setTimeout(150_000);
  // Number line challenges only, so every search is a position search with all three help steps.
  const settings = { ...defaultSettings(), challengeTypes: { numberLine: true, addition: false, subtraction: false, comparison: false } };
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [SETTINGS_KEY, JSON.stringify(settings)] as const,
  );
  await page.goto('/?seed=21');
  await page.getByRole('button', { name: m.start.play, exact: true }).click();
  const overlay = page.getByTestId('battle-overlay');
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  const answer = Number(await overlay.getAttribute('data-enemy-number'));
  expect(answer).toBeGreaterThanOrEqual(min);
  expect(answer).toBeLessThanOrEqual(max);
  await expect(page.getByTestId('help-button')).toBeVisible();

  for (const [i, offset] of [12, 15, 18].entries()) {
    const wrong = wrongNumber(answer, offset);
    const lives = await overlay.getAttribute('data-lives');
    await typeAndFire(page, overlay, wrong);
    await expect(overlay).toHaveAttribute('data-last-landing', String(wrong), { timeout: 15_000 });
    await expect(overlay).toHaveAttribute('data-last-shot', 'miss');
    // The enemy fires back after every shot that does not destroy it (amendment 07); the miss itself took no heart.
    await expect(overlay).toHaveAttribute('data-phase', 'enemyTurn', { timeout: 15_000 });
    await expect(overlay).toHaveAttribute('data-lives', lives!);
    await expect(overlay).toHaveAttribute('data-phase', 'challenge', { timeout: 15_000 });
    await expect(overlay).toHaveAttribute('data-help-level', String(i + 1));

    // One message line (T230): the landing number is on the ruler; the phrase comes first, then the help text.
    await expect(page.locator('canvas')).toHaveAttribute('data-landing', String(wrong));
    await expect(page.getByText(m.battle.landedAt(wrong))).toHaveCount(0);
    const encouragement = page.getByTestId('encouragement');
    await expect(encouragement).toBeVisible();
    const phrase = (await encouragement.textContent()) ?? '';
    expect(m.encouragements).toContain(phrase);
    await expect(page.getByTestId('help-text')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('status').locator(':scope > *')).toHaveCount(1);
    const help = (await page.getByTestId('help-text').textContent()) ?? '';
    for (const text of [phrase, help, (await page.getByRole('status').textContent()) ?? '']) expect(hasForbiddenWord(text)).toBe(false);

    if (i === 0) await expect(page.getByTestId('help-text')).toHaveText(m.helpSteps.direction[answer > wrong ? 'right' : 'left']);
  }

  // The third miss shows the solution: the selection is the answer and the fire button names it (FR-013, FR-031).
  await expect(page.getByTestId('help-text')).toHaveText(m.helpSteps.solution(answer));
  await expect(overlay).toHaveAttribute('data-selection', String(answer));
  await expect(page.getByRole('button', { name: m.battle.fireAt(answer) })).toBeVisible();
  await expect(page.locator('canvas')).toHaveAttribute('data-help-solution', String(answer));
  await expect(overlay).toHaveAttribute('data-challenge-answerable', 'true');
  await page.keyboard.press('Enter');
  await expect(overlay).toHaveAttribute('data-enemies-destroyed', '1', { timeout: 15_000 });
  await expect(overlay).toHaveAttribute('data-last-shot', 'hit');

  // A new search: H shows the next help step, and it is not a shot, so the enemy does not fire (FR-030, FR-081).
  await expect(overlay).toHaveAttribute('data-phase', 'challenge', { timeout: 15_000 });
  await expect(overlay).toHaveAttribute('data-help-level', '0');
  const turn = await overlay.getAttribute('data-turn');
  const lives = await overlay.getAttribute('data-lives');
  await page.keyboard.press('h');
  await expect(overlay).toHaveAttribute('data-help-level', '1');
  await expect(page.getByTestId('help-text')).toBeVisible();
  await page.waitForTimeout(2000);
  await expect(overlay).toHaveAttribute('data-phase', 'challenge');
  await expect(overlay).toHaveAttribute('data-turn', turn!);
  await expect(overlay).toHaveAttribute('data-lives', lives!);
});

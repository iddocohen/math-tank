/**
 * US1 end to end (FR-001 to FR-008, SC-001, AC-01): start a free-play round with one tap,
 * aim with the overlay controls, fire, watch the enemy turn, play to the round end and start
 * a new round without a page reload. Game state is read from the overlay's data-* attributes (D4).
 */
import type { Locator } from '@playwright/test';
import { expect, test } from './fixtures';
import { forbiddenWords, t } from '../../src/i18n';

const m = t();

async function healths(overlay: Locator): Promise<[string | null, string | null]> {
  return [await overlay.getAttribute('data-player-health'), await overlay.getAttribute('data-enemy-health')];
}

test('play a free-play round from the start screen to the round end and start another', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/?seed=1');

  // Count page loads from here on. Firefox also fires 'load' for the initial about:blank page,
  // so counting starts after the app has loaded; a marker in the page must survive too.
  let reloads = 0;
  page.on('load', () => {
    reloads++;
  });
  await page.evaluate(() => {
    (window as unknown as { e2eMarker: boolean }).e2eMarker = true;
  });

  // One tap starts the battle; the canvas appears within 3 seconds (SC-001).
  await page.getByRole('button', { name: m.start.play, exact: true }).click();
  await expect(page.locator('canvas')).toHaveCount(1, { timeout: 3_000 });
  await expect(page.locator('canvas')).toBeVisible({ timeout: 3_000 });

  const overlay = page.locator('[data-phase]');
  await expect(overlay).toHaveAttribute('data-phase', 'aiming');
  await expect(overlay).toHaveAttribute('data-turn', '0');
  const startHealth = await healths(overlay);
  expect(startHealth).toEqual(['100', '100']);

  // Set power with the plus button.
  const power = page.getByRole('slider', { name: m.battle.power });
  const powerBefore = Number(await power.inputValue());
  await page.getByRole('button', { name: m.battle.powerUp }).click();
  await expect(power).toHaveValue(String(powerBefore + 5));

  // Fire; the enemy turn follows, then the player aims again (or the round ends).
  const fire = page.getByRole('button', { name: m.battle.fire });
  await expect(fire).toBeEnabled();
  await fire.click();
  await expect(fire).toBeDisabled();
  await expect(overlay).toHaveAttribute('data-phase', 'enemyTurn', { timeout: 15_000 });
  await expect(overlay).toHaveAttribute('data-phase', /^(aiming|roundOver)$/, { timeout: 15_000 });
  await expect(overlay).toHaveAttribute('data-turn', '1');

  // Keep firing until the round ends; vary power so some shells land near the enemy.
  let shots = 1;
  while ((await overlay.getAttribute('data-phase')) !== 'roundOver') {
    await expect(overlay).toHaveAttribute('data-phase', /^(aiming|roundOver)$/, { timeout: 20_000 });
    if ((await overlay.getAttribute('data-phase')) === 'roundOver') break;
    const step = shots % 2 === 0 ? m.battle.powerUp : m.battle.powerDown;
    await page.getByRole('button', { name: step }).click();
    await fire.click();
    shots++;
    await expect(overlay).not.toHaveAttribute('data-phase', 'aiming', { timeout: 5_000 });
    expect(shots).toBeLessThan(40);
  }

  // Health changed after a hit (the enemy aims at the player every turn).
  expect(await healths(overlay)).not.toEqual(startHealth);

  // The round end shows only encouraging text (FR-008, FR-033).
  const roundEnd = page.getByTestId('round-end');
  await expect(roundEnd).toBeVisible();
  const text = (await roundEnd.innerText()).toLocaleLowerCase('de');
  const messages = [m.roundEnd.playerWon, m.roundEnd.enemyWon, m.roundEnd.turnsUsed];
  expect(messages.some((msg) => text.includes(msg.toLocaleLowerCase('de')))).toBe(true);
  for (const word of forbiddenWords) expect(text).not.toContain(word.toLocaleLowerCase('de'));

  // "Nochmal" starts a new round without a page reload.
  await page.getByRole('button', { name: m.roundEnd.again }).click();
  await expect(overlay).toHaveAttribute('data-phase', 'aiming');
  await expect(overlay).toHaveAttribute('data-turn', '0');
  await expect(overlay).toHaveAttribute('data-player-health', '100');
  await expect(overlay).toHaveAttribute('data-enemy-health', '100');
  await expect(roundEnd).toBeHidden();
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(reloads).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { e2eMarker?: boolean }).e2eMarker)).toBe(true);
});

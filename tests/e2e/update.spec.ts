/**
 * Phase 24 "Fast updates and cache cleanup" (FR-051a): a new build reaches a device after one load, and the old build's
 * files leave the cache. The spec builds the game twice, as version `e2e-v1` and `e2e-v2` (APP_VERSION, vite.config.ts),
 * into temporary folders and serves them from its own small server on a free port (tests/e2e/updateServer.mjs), first v1, then v2 at the same
 * address. With v1 installed and in control, it adds a cache named as an older Workbox version names its precache.
 * After the server switches to v2, one reload of the page is enough: the app finds the waiting worker on the start
 * screen, applies it and reloads once by itself, and the page shows v2. The outdated cache and v1's script are gone.
 *
 * Runs wherever the browser under Playwright offers service workers (decision D6), otherwise skipped with the reason.
 */
import { expect, startButton, test } from './fixtures';
import { startUpdateServer, type UpdateServer } from './updateServer.mjs';

let server: UpdateServer | undefined;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(120_000);
  server = await startUpdateServer(['e2e-v1', 'e2e-v2']);
});

test.afterAll(async () => {
  await server?.stop();
});

test('a new build shows after one load, and the old caches are gone', async ({ page, browserName }) => {
  test.setTimeout(120_000);
  await page.goto(`${server!.url}/?debug=screen`);
  await expect(startButton(page)).toBeVisible();
  const supported = await page.evaluate(() => 'serviceWorker' in navigator);
  test.skip(!supported, `${browserName} under Playwright offers no service worker here (decision D6)`);
  const debug = page.getByTestId('screen-debug');
  await expect(debug).toContainText('version e2e-v1');

  // v1 is installed and controls the page (clientsClaim).
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  const v1Scripts = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls: string[] = [];
    for (const name of names) for (const req of await (await caches.open(name)).keys()) urls.push(req.url);
    return urls.filter((u) => /\/assets\/index-[^/]+\.js/.test(u)).map((u) => new URL(u).pathname);
  });
  expect(v1Scripts.length).toBeGreaterThan(0);
  // A precache as an older Workbox version named it.
  const outdated = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    const name = `workbox-precache-${reg.scope}`;
    await (await caches.open(name)).put('/old-file', new Response('old'));
    return name;
  });

  // The server now serves v2. One load: the page finds the waiting worker and reloads once by itself.
  server!.serve('e2e-v2');
  await page.reload();
  await expect(page.getByTestId('screen-debug')).toContainText('version e2e-v2', { timeout: 30_000 });
  await expect(startButton(page)).toBeVisible();

  const after = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls: string[] = [];
    for (const name of names) for (const req of await (await caches.open(name)).keys()) urls.push(new URL(req.url).pathname);
    return { names, urls };
  });
  expect(after.names).not.toContain(outdated);
  for (const script of v1Scripts) expect(after.urls).not.toContain(script);
});

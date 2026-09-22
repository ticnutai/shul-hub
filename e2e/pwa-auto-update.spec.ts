import { expect, test } from '@playwright/test';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

/**
 * A deploy reaching a phone that already has the app installed.
 *
 * This is the test for the thing that looks, from the outside, exactly like
 * "the deploy did not happen": the files are on the server, and the browser
 * keeps showing yesterday's app because a service worker is answering for
 * it. So it has to run against a real build served the way the real thing
 * is served - not against the dev server, which has no service worker at
 * all and would pass while proving nothing.
 *
 * Hence its own preview server. Two production builds run inside it, which
 * is slow and is the reason for the timeout below; it earns that by being
 * the only place the update path is exercised end to end.
 */

const PORT = 4322;
const BASE = `http://127.0.0.1:${PORT}`;

const buildPwa = (buildId: string) => {
  const viteBin = path.resolve('node_modules/vite/bin/vite.js');
  execFileSync(process.execPath, [viteBin, 'build'], {
    cwd: process.cwd(),
    env: { ...process.env, VITE_PWA_BUILD_ID: buildId },
    stdio: 'pipe',
    timeout: 180_000,
  });
};

/** Serves dist the way a host would: static files, read from disk each time. */
async function servePwa(): Promise<ChildProcess> {
  const viteBin = path.resolve('node_modules/vite/bin/vite.js');
  const server = spawn(
    process.execPath,
    [viteBin, 'preview', '--port', String(PORT), '--strictPort'],
    { cwd: process.cwd(), stdio: 'ignore' },
  );
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(BASE, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return server;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  server.kill();
  throw new Error('the preview server never came up');
}

test.describe.configure({ timeout: 300_000 });

test('an installed app picks up a new build without losing what is on it', async ({ page }) => {
  buildPwa('qa-v1');
  const server = await servePwa();

  try {
    await page.goto(`${BASE}/chumash`);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.appBuild))
      .toBe('qa-v1');

    // Something of the user's, which the update must not sweep away.
    await page.evaluate(() => {
      localStorage.setItem('pwa-update-user-data-sentinel', 'preserved');
    });

    await page.evaluate(() => navigator.serviceWorker.ready);
    const hasController = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
    if (!hasController) await page.reload({ waitUntil: 'domcontentloaded' });
    await expect
      .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
      .toBe(true);

    // A new build lands on the server while the app sits open.
    buildPwa('qa-v2');

    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
    });

    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.appBuild), {
        timeout: 90_000,
      })
      .toBe('qa-v2');

    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('pwa-update-user-data-sentinel')))
      .toBe('preserved');

    const workerState = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return {
        updateViaCache: registration?.updateViaCache,
        cacheNames: await caches.keys(),
      };
    });
    // The worker script itself must never be answered from the HTTP cache,
    // or an update can be a day late for no reason anyone can see.
    expect(workerState.updateViaCache).toBe('none');
    expect(workerState.cacheNames).not.toContain('supabase-cache');
  } finally {
    server.kill();
  }
});

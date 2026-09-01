import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const buildPwa = (buildId: string) => {
  const viteBin = path.resolve('node_modules/vite/bin/vite.js');
  execFileSync(process.execPath, [viteBin, 'build'], {
    cwd: process.cwd(),
    env: { ...process.env, VITE_PWA_BUILD_ID: buildId },
    stdio: 'pipe',
    timeout: 120_000,
  });
};

test('mobile PWA activates a new build without clearing user data', async ({ page }) => {
  buildPwa('qa-v1');
  await page.goto('/chumash');
  await expect.poll(
    () => page.evaluate(() => document.documentElement.dataset.appBuild),
  ).toBe('qa-v1');

  await page.evaluate(() => {
    localStorage.setItem('pwa-update-user-data-sentinel', 'preserved');
  });

  await page.evaluate(() => navigator.serviceWorker.ready);
  const hasController = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
  if (!hasController) await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(
    () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
  ).toBe(true);

  buildPwa('qa-v2');

  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
  });

  await expect.poll(
    () => page.evaluate(() => document.documentElement.dataset.appBuild),
    { timeout: 90_000 },
  ).toBe('qa-v2');

  await expect.poll(
    () => page.evaluate(() => localStorage.getItem('pwa-update-user-data-sentinel')),
  ).toBe('preserved');

  const workerState = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return {
      updateViaCache: registration?.updateViaCache,
      cacheNames: await caches.keys(),
    };
  });
  expect(workerState.updateViaCache).toBe('none');
  expect(workerState.cacheNames).not.toContain('supabase-cache');
});

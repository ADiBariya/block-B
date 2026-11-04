import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

test('capture the local-first app screens for visual review', async ({ page }) => {
  const capture = async (name: string) => {
    const file = resolve('artifacts', 'screenshots', name);
    await mkdir(dirname(file), { recursive: true });
    await page.screenshot({ path: file, fullPage: false });
  };

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForTimeout(900);
  await capture('home-gameplay.png');
  const screens = [
    ['Daily challenge', 'A fresh little puzzle.', 'daily-challenge.png'],
    ['Profile', 'A little about you.', 'profile.png'],
    ['Statistics', 'The good stuff, counted.', 'statistics.png'],
    ['Collection', 'A small collection.', 'collection.png'],
    ['Shop', 'A shop, someday.', 'shop-disabled.png'],
    ['Settings', 'Settings.', 'settings.png'],
    ['Global', 'The global leaderboard.', 'global-offline.png'],
  ] as const;

  for (const [button, heading, file] of screens) {
    await page.getByRole('button', { name: button }).first().click();
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await page.waitForTimeout(280);
    await capture(file);
    await page.getByRole('button', { name: 'Close dialog' }).click();
  }
});

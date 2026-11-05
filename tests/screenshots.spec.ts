import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

test('capture the premium mobile home and player screens for visual review', async ({ page }) => {
  const capture = async (name: string) => {
    const file = resolve('artifacts', 'screenshots', name);
    await mkdir(dirname(file), { recursive: true });
    await page.screenshot({ path: file, fullPage: false });
  };

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ready for a little fun?' })).toBeVisible();
  await page.waitForTimeout(350);
  await capture('home-gameplay.png');

  await page.locator('.mobile-bottom-nav').getByRole('button', { name: 'Daily' }).click();
  await expect(page.getByRole('heading', { name: 'A fresh little puzzle.' })).toBeVisible();
  await page.waitForTimeout(180);
  await capture('daily-challenge.png');
  await page.getByRole('button', { name: 'Close dialog' }).click();

  await page.locator('.mobile-bottom-nav').getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByRole('heading', { name: 'A little about you.' })).toBeVisible();
  await page.waitForTimeout(180);
  await capture('profile.png');

  const profileScreens = [
    ['Statistics', 'The good stuff, counted.', 'statistics.png'],
    ['Collection', 'A small collection.', 'collection.png'],
    ['Shop', 'A shop, someday.', 'shop-disabled.png'],
    ['Settings', 'Settings.', 'settings.png'],
  ] as const;
  for (const [button, heading, file] of profileScreens) {
    await page.locator('.profile-shortcuts').getByRole('button', { name: button }).click();
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await page.waitForTimeout(180);
    await capture(file);
    await page.getByRole('button', { name: 'Close dialog' }).click();
    if (button !== 'Settings') {
      await page.locator('.mobile-bottom-nav').getByRole('button', { name: 'Profile' }).click();
      await expect(page.getByRole('heading', { name: 'A little about you.' })).toBeVisible();
    }
  }

  await page.locator('.mobile-bottom-nav').getByRole('button', { name: 'Leaderboard' }).click();
  await expect(page.getByRole('heading', { name: 'The global leaderboard.' })).toBeVisible();
  await page.waitForTimeout(180);
  await capture('global-offline.png');
});

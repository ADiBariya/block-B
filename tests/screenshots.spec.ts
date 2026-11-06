import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

test('capture the new auth, home, gameplay and profile screens for visual review', async ({ page }) => {
  const capture = async (name: string) => {
    const file = resolve('artifacts', 'screenshots', name);
    await mkdir(dirname(file), { recursive: true });
    await page.screenshot({ path: file, fullPage: false });
  };

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.splash-screen')).toBeVisible();
  await page.waitForTimeout(180);
  await capture('splash-screen.png');
  await expect(page.getByRole('heading', { name: 'Welcome to Block Party!' })).toBeVisible();
  await page.waitForTimeout(180);
  await capture('onboarding-welcome-screen-1.png');
  await page.getByRole('button', { name: 'Get Started' }).click();
  await expect(page.getByRole('heading', { name: 'Block Party' })).toBeVisible();
  await page.waitForTimeout(350);
  await capture('home-hub.png');

  await page.getByRole('button', { name: "Let's play" }).click();
  await expect(page.locator('.board-grid')).toBeVisible();
  await page.waitForTimeout(180);
  await capture('gameplay-fullscreen.png');
  await page.getByRole('button', { name: 'Pause game' }).click();
  await page.getByRole('button', { name: 'Back to home' }).click();

  await page.locator('.mobile-bottom-nav').getByRole('button', { name: 'Daily' }).click();
  await expect(page.getByRole('heading', { name: 'A fresh little puzzle.' })).toBeVisible();
  await page.waitForTimeout(180);
  await capture('daily-challenge.png');
  await page.getByRole('button', { name: 'Close dialog' }).click();

  await page.locator('.mobile-bottom-nav').getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByRole('heading', { name: 'A little about you.' })).toBeVisible();
  await page.waitForTimeout(180);
  await capture('profile.png');
});

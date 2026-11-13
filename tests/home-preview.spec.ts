import { expect, test } from '@playwright/test';

test('capture the current Home screen at a mobile size', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  // Enter the already-onboarded local player state so this preview captures Home,
  // not the first-launch splash or sign-in screens.
  await page.evaluate(() => {
    localStorage.setItem('blockparty.onboarding.welcome.v1', 'complete');
    localStorage.setItem('blockparty.entry.v1', 'offline');
  });
  await page.reload();

  await expect(page.locator('.site-shell.screen-home')).toBeVisible();
  await expect(page.locator('.home-brand-logo')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play online' })).toBeVisible();
  await expect(page.locator('.home-action-solo')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Daily Challenge' })).toBeVisible();
  await expect(page.locator('.mobile-bottom-nav')).toBeVisible();

  await page.waitForTimeout(500);
  await page.screenshot({
    path: 'artifacts/screenshots/home-hub-current.png',
    fullPage: false,
  });
});

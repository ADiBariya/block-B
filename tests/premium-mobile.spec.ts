import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });

test('mobile home is the first screen and primary navigation stays available', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Block Party home' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ready for a little fun?' })).toBeVisible();
  await expect(page.getByRole('button', { name: "Let's play" })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  await expect(page.locator('.mobile-bottom-nav').getByRole('button', { name: 'Daily' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leaderboard' })).toBeVisible();
  await expect(page.locator('.mobile-bottom-nav').getByRole('button', { name: 'Profile' })).toBeVisible();
});

test('mobile play enters gameplay and the brand returns to the home hub', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's play" }).tap();
  await expect(page.locator('.mobile-home-screen')).toBeHidden();
  await expect(page.locator('.board-grid')).toBeVisible();
  await expect(page.locator('.score-value')).toHaveAttribute('aria-label', 'Score 0');
  await page.getByRole('link', { name: 'Block Party home' }).tap();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Keep playing' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start a fresh game' })).toBeVisible();
});

test('daily challenge can be opened from the bottom navigation and starts gameplay', async ({ page }) => {
  await page.goto('/');
  await page.locator('.mobile-bottom-nav').getByRole('button', { name: 'Daily' }).tap();
  await expect(page.getByRole('heading', { name: 'A fresh little puzzle.' })).toBeVisible();
  await page.getByRole('button', { name: 'Play today’s challenge' }).tap();
  await expect(page.locator('.mobile-home-screen')).toBeHidden();
  await expect(page.locator('.board-grid')).toBeVisible();
  await expect(page.locator('.score-value')).toHaveAttribute('aria-label', 'Score 0');
});

test('profile contains secondary player destinations without crowding the bottom navigation', async ({ page }) => {
  await page.goto('/');
  await page.locator('.mobile-bottom-nav').getByRole('button', { name: 'Profile' }).tap();
  await expect(page.getByRole('heading', { name: 'A little about you.' })).toBeVisible();
  const shortcuts = page.locator('.profile-shortcuts');
  await expect(shortcuts.getByRole('button', { name: 'Statistics' })).toBeVisible();
  await expect(shortcuts.getByRole('button', { name: 'Collection' })).toBeVisible();
  await expect(shortcuts.getByRole('button', { name: 'Shop' })).toBeVisible();
  await expect(shortcuts.getByRole('button', { name: 'Settings' })).toBeVisible();
  await shortcuts.getByRole('button', { name: 'Statistics' }).tap();
  await expect(page.getByRole('heading', { name: 'The good stuff, counted.' })).toBeVisible();
});

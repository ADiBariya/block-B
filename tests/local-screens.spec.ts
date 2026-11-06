import { expect, test } from '@playwright/test';

test('home opens the daily challenge as an offline local seeded round', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Daily Challenge' }).click();
  await expect(page.getByRole('heading', { name: 'A fresh little puzzle.' })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('not sent to global rankings');
  await page.getByRole('button', { name: 'Play today’s challenge' }).click();
  await expect(page.locator('.score-value')).toHaveAttribute('aria-label', 'Score 0');
  await expect(page.locator('.start-screen')).toHaveCount(0);
  await expect(page.locator('.global-score-status')).toHaveCount(0);
});

test('profile and statistics show only local totals and honest unavailable playtime', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByRole('heading', { name: 'A little about you.' })).toBeVisible();
  await expect(page.locator('.profile-card')).toContainText('Local player profile');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Statistics' }).click();
  await expect(page.getByRole('heading', { name: 'The good stuff, counted.' })).toBeVisible();
  await expect(page.locator('.stats-grid')).toContainText('Playtime not tracked');
});

test('collection choices persist locally and shop purchases stay disabled', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Collection' }).click();
  await page.getByRole('button', { name: /Soft lavender/ }).click();
  await page.getByRole('button', { name: /Soft gloss/ }).click();
  await expect(page.locator('.site-shell')).toHaveClass(/theme-lavender/);
  await expect(page.locator('.site-shell')).toHaveClass(/skin-gloss/);
  await page.reload();
  await expect(page.locator('.site-shell')).toHaveClass(/theme-lavender/);
  await expect(page.locator('.site-shell')).toHaveClass(/skin-gloss/);
  await page.getByRole('button', { name: 'Shop' }).click();
  await expect(page.getByRole('heading', { name: 'A shop, someday.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unavailable' }).first()).toBeDisabled();
  await expect(page.getByRole('dialog')).toContainText('No payment flow is active');
});

test('settings persist sound, haptic and motion preferences', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('checkbox', { name: /Sound/ }).uncheck();
  await page.getByRole('checkbox', { name: /Haptics/ }).uncheck();
  await page.getByRole('checkbox', { name: /Motion effects/ }).uncheck();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await page.reload();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('checkbox', { name: /Sound/ })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: /Haptics/ })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: /Motion effects/ })).not.toBeChecked();
});

test('online leaderboard requires a real signed-in account', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Global', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign In to Play' })).toBeVisible();
  await expect(page.locator('.auth-notice')).toContainText('Sign in or create an account');
  await expect(page.locator('.global-rank-row')).toHaveCount(0);
});

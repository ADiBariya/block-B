import { expect, test } from '@playwright/test';

test('leaderboard never substitutes sample data when Supabase is not configured', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Global', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign In to Play' })).toBeVisible();
  await expect(page.locator('.auth-notice')).toContainText('Sign in or create an account');
  await expect(page.locator('.global-rank-row')).toHaveCount(0);
});

test('ranked game fallback is explicitly local when Supabase is unavailable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's play" }).click();
  await expect(page.locator('.score-value')).toHaveAttribute('aria-label', 'Score 0');
  await page.getByRole('button', { name: 'Global', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign In to Play' })).toBeVisible();
  await expect(page.locator('.auth-notice')).toContainText('Sign in or create an account');
  await expect(page.locator('.global-rank-row')).toHaveCount(0);
});

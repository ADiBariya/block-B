import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });

async function enterOffline(page: Page) {
  await page.getByRole('button', { name: 'Play solo offline' }).tap();
}

test('mobile starts with account entry and offers honest offline play', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Apple' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play solo offline' })).toBeVisible();
  await enterOffline(page);
  await expect(page.getByRole('region', { name: 'Block Party home' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Block Party' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play online' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  await expect(page.locator('.mobile-bottom-nav').getByRole('button', { name: 'Daily' })).toBeVisible();
  await expect(page.locator('.mobile-bottom-nav').getByRole('button', { name: 'Leaderboard' })).toBeVisible();
  await expect(page.locator('.mobile-bottom-nav').getByRole('button', { name: 'Profile' })).toBeVisible();
});

test('sign-in form reports that authentication is not connected yet', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email address').fill('player@example.com');
  await page.getByLabel('Password').fill('valid-password-123');
  await page.locator('.auth-form').getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('.auth-message')).toContainText('No session was created');
});

test('online mode options require a real account before entering matchmaking', async ({ page }) => {
  await page.goto('/');
  await enterOffline(page);
  await page.getByRole('button', { name: 'Play online' }).tap();
  await expect(page.getByRole('heading', { name: 'Play online.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Quick Match/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Ranked Match/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Private Room/ })).toBeVisible();
  await page.getByRole('button', { name: /Quick Match/ }).tap();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.locator('.auth-notice')).toContainText('Sign in or create an account');
});

test('mobile play enters immersive gameplay and the brand returns home', async ({ page }) => {
  await page.goto('/');
  await enterOffline(page);
  await page.getByRole('button', { name: "Let's play" }).tap();
  await expect(page.locator('.mobile-home-screen')).toBeHidden();
  await expect(page.locator('.board-grid')).toBeVisible();
  await expect(page.locator('.site-shell')).toHaveClass(/screen-game/);
  await expect(page.locator('.site-header')).toBeHidden();
  await expect(page.locator('.mobile-bottom-nav')).toBeHidden();
  await page.getByRole('button', { name: 'Pause game' }).tap();
  await page.getByRole('button', { name: 'Back to home' }).tap();
  await expect(page.getByRole('heading', { name: 'Block Party' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Keep playing' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start a fresh game' })).toBeVisible();
});

test('daily challenge can be opened from bottom navigation and starts local gameplay', async ({ page }) => {
  await page.goto('/');
  await enterOffline(page);
  await page.locator('.mobile-bottom-nav').getByRole('button', { name: 'Daily' }).tap();
  await expect(page.getByRole('heading', { name: 'A fresh little puzzle.' })).toBeVisible();
  await page.getByRole('button', { name: 'Play today’s challenge' }).tap();
  await expect(page.locator('.mobile-home-screen')).toBeHidden();
  await expect(page.locator('.board-grid')).toBeVisible();
  await expect(page.locator('.score-value')).toHaveAttribute('aria-label', 'Score 0');
});

test('profile contains secondary player destinations without crowding navigation', async ({ page }) => {
  await page.goto('/');
  await enterOffline(page);
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

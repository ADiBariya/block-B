import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });

async function completeWelcome(page: Page) {
  await expect(page.locator('.splash-screen')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign In to Play' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue offline' }).tap();
  await expect(page.getByRole('heading', { name: 'Welcome to Block Party!' })).toBeVisible();
  await page.getByRole('button', { name: 'Get Started' }).tap();
  await expect(page.getByRole('heading', { name: 'Place Blocks' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).tap();
}

test('first mobile launch shows splash, sign-in, onboarding, then home', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.splash-screen')).toBeVisible();
  await expect(page.locator('.mobile-home-screen')).toBeHidden();
  await expect(page.locator('.auth-screen')).toBeHidden();

  await expect(page.getByRole('heading', { name: 'Sign In to Play' })).toBeVisible();
  await expect(page.locator('.splash-screen')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Email' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Apple' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create an Account' })).toBeVisible();
  await expect(page.locator('.onboarding-screen')).toBeHidden();

  await page.getByRole('button', { name: 'Continue offline' }).tap();
  await expect(page.getByRole('heading', { name: 'Welcome to Block Party!' })).toBeVisible();
  await expect(page.locator('.auth-screen')).toBeHidden();
  const viewport = await page.evaluate(() => ({
    height: window.innerHeight,
    documentHeight: document.documentElement.scrollHeight,
    buttonBottom: document.querySelector('.onboarding-next')!.getBoundingClientRect().bottom,
  }));
  expect(viewport.documentHeight).toBeLessThanOrEqual(viewport.height + 1);
  expect(viewport.buttonBottom).toBeLessThanOrEqual(viewport.height);
  await page.mouse.wheel(0, 400);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await page.getByRole('button', { name: 'Get Started' }).tap();
  await expect(page.getByRole('heading', { name: 'Place Blocks' })).toBeVisible();
  await expect(page.locator('.onboarding-tutorial-board .onboarding-tutorial-cell')).toHaveCount(64);
  await expect(page.locator('.onboarding-tutorial-cell.is-highlighted')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Previous onboarding screen' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).tap();
  await expect(page.getByRole('region', { name: 'Block Party home' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Block Party' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play online' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  await expect(page.locator('.mobile-bottom-nav').getByRole('button', { name: 'Daily' })).toBeVisible();
  await expect(page.locator('.mobile-bottom-nav').getByRole('button', { name: 'Leaderboard' })).toBeVisible();
  await expect(page.locator('.mobile-bottom-nav').getByRole('button', { name: 'Profile' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Block Party' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign In to Play' })).toBeHidden();
});
test('upgrading an older offline install still shows the new welcome screen before home', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('blockparty.entry.v1', 'offline');
    localStorage.setItem('blockparty.onboarding.v1', 'complete');
    localStorage.setItem('blockparty.onboarding.welcome.v1', 'incomplete');
  });
  await page.goto('/');
  await expect(page.locator('.splash-screen')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign In to Play' })).toBeVisible();
  await expect(page.locator('.mobile-home-screen')).toBeHidden();
  await page.getByRole('button', { name: 'Continue offline' }).tap();
  await expect(page.getByRole('heading', { name: 'Welcome to Block Party!' })).toBeVisible();
});

test('Create an Account opens the registration form with profile fields', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign In to Play' })).toBeVisible();
  await page.getByRole('button', { name: 'Create an Account' }).tap();
  await expect(page.getByRole('heading', { name: 'Create an Account' })).toBeVisible();
  await expect(page.getByLabel('Display name')).toBeVisible();
  await expect(page.getByLabel('Username')).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.locator('#auth-password')).toBeVisible();
  await expect(page.getByLabel('Confirm password')).toBeVisible();
  await page.getByRole('button', { name: '← Back' }).tap();
  await expect(page.getByRole('heading', { name: 'Sign In to Play' })).toBeVisible();
});

test('sign-in form reports that authentication is not connected yet', async ({ page }) => {
  await page.goto('/');
  await completeWelcome(page);
  await page.getByRole('button', { name: 'Play online' }).tap();
  await page.getByRole('button', { name: /Quick Match/ }).tap();
  await expect(page.getByRole('heading', { name: 'Sign In to Play' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue with Email' }).tap();
  await page.getByLabel('Email address').fill('player@example.com');
  await page.locator('#auth-password').fill('valid-password-123');
  await page.locator('.auth-form').getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('.auth-message')).toContainText('No session was created');
});

test('online mode options require a real account before entering matchmaking', async ({ page }) => {
  await page.goto('/');
  await completeWelcome(page);
  await page.getByRole('button', { name: 'Play online' }).tap();
  await expect(page.getByRole('heading', { name: 'Play online.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Quick Match/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Ranked Match/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Private Room/ })).toBeVisible();
  await page.getByRole('button', { name: /Quick Match/ }).tap();
  await expect(page.getByRole('heading', { name: 'Sign In to Play' })).toBeVisible();
  await expect(page.locator('.auth-notice')).toContainText('Sign in or create an account');
});

test('mobile play enters immersive gameplay and the brand returns home', async ({ page }) => {
  await page.goto('/');
  await completeWelcome(page);
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
  await completeWelcome(page);
  await page.locator('.mobile-bottom-nav').getByRole('button', { name: 'Daily' }).tap();
  await expect(page.getByRole('heading', { name: 'A fresh little puzzle.' })).toBeVisible();
  await page.getByRole('button', { name: 'Play today’s challenge' }).tap();
  await expect(page.locator('.mobile-home-screen')).toBeHidden();
  await expect(page.locator('.board-grid')).toBeVisible();
  await expect(page.locator('.score-value')).toHaveAttribute('aria-label', 'Score 0');
});

test('profile contains secondary player destinations without crowding navigation', async ({ page }) => {
  await page.goto('/');
  await completeWelcome(page);
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

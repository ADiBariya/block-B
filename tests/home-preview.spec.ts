import { test } from '@playwright/test';

test('capture the current mobile app screen for Home visual review', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await page.evaluate(() => {
    localStorage.setItem('blockparty.onboarding.welcome.v1', 'complete');
    localStorage.setItem('blockparty.entry.v1', 'offline');
  });
  await page.reload();
  await page.waitForTimeout(900);

  const state = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    welcome: localStorage.getItem('blockparty.onboarding.welcome.v1'),
    entry: localStorage.getItem('blockparty.entry.v1'),
    screenClass: document.querySelector('.site-shell')?.className ?? 'NO_SITE_SHELL',
    bodyText: document.body.innerText.slice(0, 800),
    rootHtml: document.querySelector('#root')?.innerHTML.slice(0, 1000) ?? 'NO_ROOT',
  }));
  console.log('HOME_PREVIEW_STATE', JSON.stringify(state));
  console.log('HOME_PREVIEW_PAGE_ERRORS', JSON.stringify(pageErrors));

  await page.screenshot({
    path: 'artifacts/screenshots/home-hub-current.png',
    fullPage: false,
  });
});

import { expect, test } from '@playwright/test';

const board = Array(64).fill(null);
for (let col = 1; col < 8; col++) {
  board[2 * 8 + col] = 'violet';
  board[3 * 8 + col] = 'coral';
}
board[48] = 'mint';
board[49] = 'butter';
board[56] = 'blue';
board[57] = 'blue';

test('a two-line clear shows AMAZING and an in-board celebration', async ({ page }) => {
  await page.addInitScript((seededBoard) => {
    localStorage.setItem('blockparty.session.v1', JSON.stringify({
      id: 'praise-test',
      board: seededBoard,
      tray: [
        { id: 'domino', color: 'mint', cells: [{ row: 0, col: 0 }, { row: 1, col: 0 }] },
        { id: 'single', color: 'coral', cells: [{ row: 0, col: 0 }] },
        { id: 'small-l', color: 'butter', cells: [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 1, col: 1 }] },
      ],
      score: 500, moves: 4, lines: 2, combo: 0, bestCombo: 2,
    }));
  }, board);
  await page.goto('/');
  await page.getByRole('button', { name: 'Keep playing', exact: true }).click();
  await page.locator('[data-cell="16"]').click();
  await expect(page.locator('.praise-word')).toHaveText('AMAZING!');
  await expect(page.locator('.praise-kicker')).toContainText('beautifully big move');
  await expect(page.locator('.feedback-points')).toHaveText('+410');
  await expect(page.locator('.celebration-ring')).toBeVisible();
  await expect(page.locator('.score-value')).toHaveAttribute('aria-label', 'Score 910');
  const letterAnimation = await page.locator('.praise-word > span').first().evaluate((letter) => getComputedStyle(letter).animationName);
  expect(letterAnimation).toBe('praise-letter');
});

test('a hot streak escalates a two-line clear to LEGENDARY', async ({ page }) => {
  await page.addInitScript((seededBoard) => {
    localStorage.setItem('blockparty.session.v1', JSON.stringify({
      id: 'legendary-test',
      board: seededBoard,
      tray: [
        { id: 'domino', color: 'mint', cells: [{ row: 0, col: 0 }, { row: 1, col: 0 }] },
        { id: 'single', color: 'coral', cells: [{ row: 0, col: 0 }] },
        { id: 'small-l', color: 'butter', cells: [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 1, col: 1 }] },
      ],
      score: 820, moves: 8, lines: 4, combo: 4, bestCombo: 4,
    }));
  }, board);
  await page.goto('/');
  await page.getByRole('button', { name: 'Keep playing', exact: true }).click();
  await page.locator('[data-cell="16"]').click();
  await expect(page.locator('.praise-word')).toHaveText('LEGENDARY!');
  await expect(page.locator('.feedback-combo')).toHaveText('5x COMBO');
  await expect(page.locator('.feedback-points')).toHaveText('+2,010');
});

test('interactive sounds create audio voices when sound is enabled', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeAudioContext = window.AudioContext;
    const stats = { contexts: 0, oscillators: 0 };
    Object.defineProperty(window, '__audioStats', { value: stats, configurable: true });
    window.AudioContext = class extends NativeAudioContext {
      constructor() {
        super();
        stats.contexts++;
      }
      createOscillator() {
        stats.oscillators++;
        return super.createOscillator();
      }
    } as typeof AudioContext;
  });
  await page.goto('/');
  await page.getByRole('button', { name: "Let's play" }).click();
  await page.locator('[data-cell="50"]').click();
  const stats = await page.evaluate(() => (window as unknown as { __audioStats: { contexts: number; oscillators: number } }).__audioStats);
  expect(stats.contexts).toBe(1);
  expect(stats.oscillators).toBeGreaterThan(5);
  await expect(page.locator('.praise-word')).toHaveText('NICE!');
});

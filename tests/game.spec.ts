import { expect, test } from '@playwright/test';

test('mouse placement clears a line, scores it, and replenishes the tray', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: "Let's play" }).click();
  await expect(page.locator('.starter-suggestion')).toHaveCount(3);
  await page.locator('[data-cell="50"]').click();
  await expect(page.locator('.score-value')).toHaveAttribute('aria-label', 'Score 115');
  await expect(page.locator('.clear-feedback')).toContainText('+115');
  await expect(page.locator('.used-slot')).toHaveCount(1);
  for (let cell = 48; cell < 56; cell++) await expect(page.locator(`[data-cell="${cell}"]`)).not.toHaveClass(/occupied/);
  await page.locator('[data-cell="0"]').click();
  await expect(page.locator('.score-value')).toHaveAttribute('aria-label', 'Score 135');
  await page.locator('[data-cell="4"]').click();
  await expect(page.locator('.score-value')).toHaveAttribute('aria-label', 'Score 155');
  await expect(page.locator('.piece-button')).toHaveCount(3);
  await expect(page.locator('.used-slot')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('mouse dragging snaps to the board and clears a line', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's play" }).click();
  const source = (await page.locator('.piece-button').first().boundingBox())!;
  const target = (await page.locator('[data-cell="51"]').boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 18 });
  await expect(page.locator('.drag-ghost')).toBeVisible();
  await expect(page.locator('.line-preview')).toHaveCount(8);
  await page.mouse.up();
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
  await expect(page.locator('.score-value')).toHaveAttribute('aria-label', 'Score 115');
});

test('keyboard selection, movement, rotation, pause and instant restart work', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's play" }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.start-screen')).toHaveCount(0);
  await page.keyboard.press('1');
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.line-preview')).toHaveCount(8);
  await page.keyboard.press('Enter');
  await expect(page.locator('.score-value')).toHaveAttribute('aria-label', 'Score 115');
  await page.keyboard.press('2');
  await page.keyboard.press('Space');
  const rows = await page.locator('.piece-button.is-selected .piece-shape').evaluate((element) => getComputedStyle(element).gridTemplateRows.split(' ').length);
  expect(rows).toBe(3);
  await page.keyboard.press('p');
  await expect(page.locator('.pause-screen')).toBeVisible();
  await page.keyboard.press('1');
  await expect(page.locator('.score-value')).toHaveAttribute('aria-label', 'Score 115');
  await page.keyboard.press('Enter');
  await expect(page.locator('.pause-screen')).toHaveCount(0);
  await page.keyboard.press('r');
  await expect(page.locator('.score-value')).toHaveAttribute('aria-label', 'Score 0');
  await expect(page.locator('.piece-button')).toHaveCount(3);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('blockparty.highscores.v1')!));
  expect(stored).toHaveLength(1);
  expect(stored[0].score).toBe(115);
});

test('invalid moves are harmless and help pauses and resumes the round', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's play" }).click();
  await page.locator('[data-cell="32"]').click();
  await expect(page.locator('.invalid-caption')).toContainText('Not quite');
  await expect(page.locator('.score-value')).toHaveAttribute('aria-label', 'Score 0');
  await page.getByRole('button', { name: 'How to play', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Small moves. Big happy.' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Pause game', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Turn sound off' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Turn sound on' })).toBeVisible();
  await expect(page.locator('.score-value')).toHaveAttribute('aria-label', 'Score 0');
});

test('a round and sound preference survive a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's play" }).click();
  await page.locator('[data-cell="50"]').click();
  await page.getByRole('button', { name: 'Turn sound off' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Keep playing', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Turn sound on' })).toBeVisible();
  await expect(page.locator('.score-value')).toHaveAttribute('aria-label', 'Score 115');
  await page.getByRole('button', { name: 'Keep playing', exact: true }).click();
  await expect(page.locator('[data-cell="50"]')).not.toHaveClass(/occupied/);
  await page.getByRole('button', { name: 'Restart game', exact: true }).click();
  await page.getByRole('button', { name: 'Best runs', exact: true }).click();
  await expect(page.locator('.table-score').first()).toHaveText('115');
});

test('game over saves a high score, restart is instant, and scores can be cleared', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('blockparty.session.v1', JSON.stringify({
      id: 'test-final-round',
      board: Array.from({ length: 64 }, (_, index) => (Math.floor(index / 8) + index % 8) % 2 === 0 ? 'violet' : null),
      tray: [
        { id: 'last', color: 'mint', cells: [{ row: 0, col: 0 }] },
        { id: 'blocked', color: 'mint', cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 1 }] },
        null,
      ],
      score: 240, moves: 10, lines: 2, combo: 0, bestCombo: 2,
    }));
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Keep playing', exact: true }).click();
  await page.locator('[data-cell="1"]').click();
  await expect(page.locator('.gameover-screen')).toBeVisible();
  await expect(page.locator('.final-score')).toContainText('245');
  await expect(page.locator('.overlay-eyebrow')).toContainText('NEW PERSONAL BEST');
  await page.getByRole('button', { name: 'One more round' }).click();
  await expect(page.locator('.gameover-screen')).toHaveCount(0);
  await expect(page.locator('.score-value')).toHaveAttribute('aria-label', 'Score 0');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('blockparty.highscores.v1')!));
  expect(saved).toHaveLength(1);
  expect(saved[0].score).toBe(245);
  await page.getByRole('button', { name: 'Best runs', exact: true }).click();
  await expect(page.locator('.table-score')).toHaveText('245');
  await page.getByRole('button', { name: 'Clear scores', exact: true }).click();
  await expect(page.locator('.clear-confirm')).toContainText('Clear all saved runs?');
  await page.getByRole('button', { name: 'Clear scores', exact: true }).click();
  await expect(page.locator('.empty-leaderboard')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('blockparty.highscores.v1'))).toBe('[]');
});

test('layouts fit phones, tablets and desktop without horizontal scrolling', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's play" }).click();
  for (const width of [320, 390, 600, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
    expect(dimensions.content, `Overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport);
    const board = (await page.locator('.board-wrap').boundingBox())!;
    expect(Math.abs(board.width - board.height)).toBeLessThan(1);
    expect(board.x).toBeGreaterThanOrEqual(0);
    expect(board.x + board.width).toBeLessThanOrEqual(width);
  }
});

test.describe('mobile touch controls', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });

  test('tap selection and placement work on a touch screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.splash-screen')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sign In to Play' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue offline' }).tap();
    await expect(page.getByRole('heading', { name: 'Welcome to Block Party!' })).toBeVisible();
    await page.getByRole('button', { name: 'Get Started' }).tap();
    await page.getByRole('button', { name: "Let's play" }).tap();
    await page.getByRole('button', { name: 'Select block 3: 4 mint squares' }).tap();
    await page.locator('[data-cell="0"]').tap();
    await expect(page.locator('.score-value')).toHaveAttribute('aria-label', 'Score 20');
    await page.getByRole('button', { name: 'Restart game', exact: true }).tap();
    await page.getByRole('button', { name: 'Select block 1: 3 coral squares' }).tap();
    await page.locator('[data-cell="50"]').tap();
    await expect(page.locator('.score-value')).toHaveAttribute('aria-label', 'Score 115');
    await page.getByRole('button', { name: 'Rotate selected block', exact: true }).tap();
    await expect(page.locator('.piece-button.is-selected')).toHaveAttribute('aria-label', 'Select block 2: 4 violet squares');
  });

  test('real touch dragging lifts the block above the finger and places it', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.splash-screen')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sign In to Play' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue offline' }).tap();
    await expect(page.getByRole('heading', { name: 'Welcome to Block Party!' })).toBeVisible();
    await page.getByRole('button', { name: 'Get Started' }).tap();
    await page.getByRole('button', { name: "Let's play" }).tap();
    const source = (await page.locator('.piece-button').first().boundingBox())!;
    const target = (await page.locator('[data-cell="51"]').boundingBox())!;
    const grid = (await page.locator('.board-grid').boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const from = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
    const to = { x: target.x + target.width / 2, y: target.y + target.height / 2 + Math.min(72, grid.width * 0.19) };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
    for (let step = 1; step <= 12; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * step / 12, y: from.y + (to.y - from.y) * step / 12, id: 1 }] });
      await page.waitForTimeout(17);
    }
    await expect(page.locator('.drag-ghost')).toBeVisible();
    await expect(page.locator('.line-preview')).toHaveCount(8);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('.score-value')).toHaveAttribute('aria-label', 'Score 115');
    await expect(page.locator('.drag-ghost')).toHaveCount(0);
  });
});
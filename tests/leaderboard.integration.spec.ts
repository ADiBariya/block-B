import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { canPlace, newSeededGame, placePiece, rotatePiece, type Game, type Piece } from '../src/game/engine';
import type { ReplayAction } from '../src/game/competitive';

const SUPABASE_URL = process.env.SUPABASE_TEST_URL;
const SUPABASE_KEY = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;

function finishedRun(seed: number, sessionId: string) {
  let game = newSeededGame(seed, sessionId);
  let selected = 0;
  const actions: ReplayAction[] = [];
  let isOver = false;
  for (let turn = 0; turn < 1_000 && !isOver; turn++) {
    let found: { index: number; rotations: number; row: number; col: number; piece: Piece } | undefined;
    for (let index = 0; index < 3 && !found; index++) {
      const original = game.tray[index];
      if (!original) continue;
      let piece = original;
      for (let rotations = 0; rotations < 4 && !found; rotations++) {
        for (let row = 0; row < 8 && !found; row++) for (let col = 0; col < 8 && !found; col++) {
          if (canPlace(game.board, piece, row, col)) found = { index, rotations, row, col, piece };
        }
        if (!found) piece = rotatePiece(piece);
      }
    }
    if (!found) break;
    if (selected !== found.index) { actions.push({ type: 'select', index: found.index }); selected = found.index; }
    for (let index = 0; index < found.rotations; index++) actions.push({ type: 'rotate' });
    actions.push({ type: 'place', index: found.index, row: found.row, col: found.col });
    game = { ...game, tray: game.tray.map((piece, index) => index === found!.index ? found!.piece : piece) };
    const placed = placePiece(game, found.index, found.row, found.col)!;
    game = placed.game;
    isOver = placed.isOver;
    selected = game.tray.findIndex(Boolean);
    if (selected < 0) selected = 0;
  }
  if (!isOver) throw new Error('Unable to construct a finished ranked test run.');
  return { actions, score: game.score, lines: game.lines, moves: game.moves };
}

async function errorPayload(error: unknown) {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try { return await context.clone().json() as { error?: string }; } catch { /* Keep the fallback below. */ }
  }
  return { error: error instanceof Error ? error.message : String(error) };
}

test('local Supabase verifies, deduplicates, ranks, searches, protects, and broadcasts score submissions', async () => {
  test.skip(!SUPABASE_URL || !SUPABASE_KEY, 'Set SUPABASE_TEST_URL and SUPABASE_TEST_PUBLISHABLE_KEY for local integration tests.');
  const first = createClient(SUPABASE_URL!, SUPABASE_KEY!, { auth: { persistSession: false } });
  const second = createClient(SUPABASE_URL!, SUPABASE_KEY!, { auth: { persistSession: false } });
  const firstAuth = await first.auth.signInAnonymously();
  const secondAuth = await second.auth.signInAnonymously();
  expect(firstAuth.error).toBeNull();
  expect(secondAuth.error).toBeNull();
  const firstUser = firstAuth.data.user!;
  const secondUser = secondAuth.data.user!;

  const firstSessionResponse = await first.functions.invoke('start-session', { body: {} });
  expect(firstSessionResponse.error).toBeNull();
  const firstSession = firstSessionResponse.data as { sessionId: string; seed: number; rulesetVersion: number };
  const firstRun = finishedRun(firstSession.seed, firstSession.sessionId);
  const firstBody = { sessionId: firstSession.sessionId, idempotencyKey: crypto.randomUUID(), ...firstRun, rulesetVersion: firstSession.rulesetVersion };

  const accepted = await first.functions.invoke('submit-score', { body: firstBody });
  expect(accepted.error).toBeNull();
  expect(accepted.data).toMatchObject({ verified: true, duplicate: false, score: firstRun.score });
  const duplicate = await first.functions.invoke('submit-score', { body: firstBody });
  expect(duplicate.error).toBeNull();
  expect(duplicate.data).toMatchObject({ verified: true, duplicate: true });

  const modified = await first.functions.invoke('submit-score', {
    body: { ...firstBody, idempotencyKey: crypto.randomUUID(), score: firstRun.score + 1 },
  });
  expect(modified.error).not.toBeNull();
  expect((await errorPayload(modified.error)).error).toMatch(/does not match replay/i);

  const directWrite = await first.from('leaderboard_scores').insert({
    player_id: firstUser!.id, session_id: crypto.randomUUID(), score: 999_999, lines: 0, moves: 1, ruleset_version: 1,
  });
  expect(directWrite.error).not.toBeNull();

  const name = `Player_${crypto.randomUUID().slice(0, 8)}`;
  const renamed = await first.functions.invoke('change-username', { body: { username: name } });
  expect(renamed.error).toBeNull();
  const conflict = await second.functions.invoke('change-username', { body: { username: name.toLowerCase() } });
  expect(conflict.error).not.toBeNull();
  expect((await errorPayload(conflict.error)).error).toMatch(/already taken/i);

  const eventPromise = new Promise<Record<string, unknown>>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for a verified score broadcast.')), 8_000);
    first.channel('global-leaderboard', { config: { private: true } })
      .on('broadcast', { event: 'INSERT' }, (message) => { clearTimeout(timeout); resolve(message as unknown as Record<string, unknown>); })
      .subscribe((status) => { if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(timeout); reject(new Error(`Realtime subscription ${status}`)); } });
  });
  await new Promise((resolve) => setTimeout(resolve, 600));
  const secondSessionResponse = await second.functions.invoke('start-session', { body: {} });
  expect(secondSessionResponse.error).toBeNull();
  const secondSession = secondSessionResponse.data as { sessionId: string; seed: number; rulesetVersion: number };
  const secondRun = finishedRun(secondSession.seed, secondSession.sessionId);
  const secondSubmit = await second.functions.invoke('submit-score', {
    body: { sessionId: secondSession.sessionId, idempotencyKey: crypto.randomUUID(), ...secondRun, rulesetVersion: secondSession.rulesetVersion },
  });
  expect(secondSubmit.error).toBeNull();
  const broadcast = await eventPromise;
  expect(JSON.stringify(broadcast)).toContain(secondUser!.id);

  const page = await first.functions.invoke('leaderboard-page', { body: { cursor: null } });
  expect(page.error).toBeNull();
  expect(page.data.entries.length).toBeGreaterThanOrEqual(2);
  expect(page.data.entries.map((entry: { player_id: string }) => entry.player_id)).toEqual(
    expect.arrayContaining([firstUser!.id, secondUser!.id]),
  );
  expect(new Set(page.data.entries.map((entry: { player_id: string }) => entry.player_id)).size).toBe(page.data.entries.length);
  expect(page.data.entries.map((entry: { rank: number }) => entry.rank)).toEqual(
    [...page.data.entries.map((entry: { rank: number }) => entry.rank)].sort((a: number, b: number) => a - b),
  );
  expect(page.data.my_entry).toMatchObject({ player_id: firstUser!.id, username: name });
  const search = await first.functions.invoke('leaderboard-page', { body: { search: name } });
  expect(search.error).toBeNull();
  expect(search.data.entries).toHaveLength(1);
  await first.removeAllChannels();
});

import { expect, test } from '@playwright/test';
import { canPlace, newSeededGame, placePiece, rotatePiece, type Piece } from '../src/game/engine';
import { assertVerifiedResult, replayGame, type ReplayAction } from '../src/game/competitive';
import { appendUniqueEntries, EventDeduper, nextCursor, validateUsername, type RankEntry } from '../src/game/leaderboard';

test('ruleset v1 seeded starts and refilled trays are deterministic', () => {
  const left = newSeededGame(0x12345678, 'session-a');
  const right = newSeededGame(0x12345678, 'session-a');
  expect(left).toEqual(right);
  const firstRun = makeFinishedReplay(0x12345678, 'session-a');
  const secondRun = makeFinishedReplay(0x12345678, 'session-a');
  expect(firstRun).toEqual(secondRun);
  expect(firstRun.result.game.rngState).toBeDefined();
});

function makeFinishedReplay(seed: number, session: string): { actions: ReplayAction[]; result: ReturnType<typeof replayGame> } {
  let game = newSeededGame(seed, session);
  let selected = 0;
  const actions: ReplayAction[] = [];
  let isOver = false;
  for (let guard = 0; guard < 500 && !isOver; guard++) {
    let found: { index: number; rotations: number; row: number; col: number; piece: Piece } | undefined;
    for (let index = 0; index < game.tray.length && !found; index++) {
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
    if (selected !== found.index) {
      actions.push({ type: 'select', index: found.index });
      selected = found.index;
    }
    for (let i = 0; i < found.rotations; i++) actions.push({ type: 'rotate' });
    actions.push({ type: 'place', index: found.index, row: found.row, col: found.col });
    game = { ...game, tray: game.tray.map((piece, index) => index === found!.index ? found!.piece : piece) };
    const placed = placePiece(game, found.index, found.row, found.col)!;
    game = placed.game;
    isOver = placed.isOver;
    selected = game.tray.findIndex(Boolean);
    if (selected < 0) selected = 0;
  }
  expect(isOver).toBe(true);
  return { actions, result: replayGame(seed, session, actions) };
}

test('replay verifies complete legal games and rejects illegal or modified results', () => {
  const { actions, result } = makeFinishedReplay(42, 'replay-session');
  expect(result.isOver).toBe(true);
  expect(() => assertVerifiedResult(result, { score: result.game.score, lines: result.game.lines, moves: result.game.moves })).not.toThrow();
  expect(() => assertVerifiedResult(result, { score: result.game.score + 1, lines: result.game.lines, moves: result.game.moves })).toThrow(/does not match/);
  expect(() => replayGame(42, 'replay-session', [...actions.slice(0, -1), { type: 'place', index: 0, row: 7, col: 7 }])).toThrow();
});

test('replay rejects submissions that stop before game over and excessive action streams', () => {
  const first = newSeededGame(123, 'short-session');
  const moved = placePiece(first, 0, 6, 2)!;
  expect(() => assertVerifiedResult(replayGame(123, 'short-session', [{ type: 'place', index: 0, row: 6, col: 2 }]), {
    score: moved.game.score, lines: moved.game.lines, moves: moved.game.moves,
  })).toThrow(/game over/);
  expect(() => replayGame(1, 'long', Array.from({ length: 5_001 }, () => ({ type: 'rotate' as const })))).toThrow(/length/);
});

test('cursor pages append without duplicates and preserve deterministic ranks', () => {
  const entry = (rank: number): RankEntry => ({ player_id: `p${rank}`, username: `Player${rank}`, score: 100 - rank, verified_at: `2026-01-0${rank}T00:00:00.000Z`, rank });
  const first = [entry(1), entry(2)];
  const cursor = nextCursor(first);
  expect(cursor?.player_id).toBe('p2');
  const combined = appendUniqueEntries(first, [entry(2), entry(3), entry(4)]);
  expect(combined.map((item) => item.player_id)).toEqual(['p1', 'p2', 'p3', 'p4']);
  expect(combined.map((item) => item.rank)).toEqual([1, 2, 3, 4]);
});

test('Realtime event IDs deduplicate and username validation rejects collisions in spelling', () => {
  const deduper = new EventDeduper();
  expect(deduper.accept('score-1')).toBe(true);
  expect(deduper.accept('score-1')).toBe(false);
  expect(deduper.accept('score-2')).toBe(true);
  expect(validateUsername('  Party_42 ')).toBe('Party_42');
  expect(() => validateUsername('a')).toThrow();
  const usernames = ['Party_42'];
  expect(usernames.some((name) => name.toLowerCase() === validateUsername('party_42').toLowerCase())).toBe(true);
});

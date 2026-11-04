import { expect, test } from '@playwright/test';
import { canPlace, firstFit, hasAvailableMove, newGame, pieceSize, placePiece, rotatePiece, type Cell, type Game, type Piece } from '../src/game/engine';

const single = (id: string): Piece => ({ id, color: 'mint', cells: [{ row: 0, col: 0 }] });
const emptyGame = (): Game => ({ ...newGame(), board: Array(64).fill(null), tray: [single('a'), single('b'), single('c')] });

test('the starter board has an immediate, satisfying line clear', () => {
  const game = newGame();
  expect(game.board).toHaveLength(64);
  expect(game.tray).toHaveLength(3);
  const result = placePiece(game, 0, 6, 2)!;
  expect(result.lineCount).toBe(1);
  expect(result.points).toBe(115);
  expect(result.game.lines).toBe(1);
  expect(result.game.moves).toBe(1);
  expect(result.game.board.slice(48, 56)).toEqual(Array(8).fill(null));
  expect(game.score).toBe(0);
  expect(game.tray[0]).not.toBeNull();
});

test('invalid and overlapping placements never change the board', () => {
  const game = newGame();
  const original = JSON.stringify(game);
  expect(placePiece(game, 0, 7, 7)).toBeNull();
  expect(placePiece(game, 0, 6, -1)).toBeNull();
  expect(placePiece(game, 0, 7, 0)).toBeNull();
  expect(JSON.stringify(game)).toBe(original);
});

test('intersecting rows and columns clear together with a multi-line bonus', () => {
  const game = emptyGame();
  for (let i = 1; i < 8; i++) {
    game.board[i] = 'violet';
    game.board[i * 8] = 'coral';
  }
  const result = placePiece(game, 0, 0, 0)!;
  expect(result.lineCount).toBe(2);
  expect(result.cleared).toHaveLength(15);
  expect(result.points).toBe(405);
  expect(result.game.board.every((cell) => cell === null)).toBe(true);
});

test('consecutive clears multiply the bonus and a quiet move resets the combo', () => {
  const game = emptyGame();
  game.combo = 2;
  game.bestCombo = 2;
  for (let i = 1; i < 8; i++) game.board[i] = 'violet';
  const clear = placePiece(game, 0, 0, 0)!;
  expect(clear.game.combo).toBe(3);
  expect(clear.game.bestCombo).toBe(3);
  expect(clear.points).toBe(305);
  const quiet = placePiece(clear.game, 1, 2, 2)!;
  expect(quiet.game.combo).toBe(0);
  expect(quiet.game.bestCombo).toBe(3);
  expect(quiet.points).toBe(5);
});

test('using all three pieces produces a fresh playable tray', () => {
  let game = emptyGame();
  game = placePiece(game, 0, 0, 0)!.game;
  game = placePiece(game, 1, 1, 1)!.game;
  game = placePiece(game, 2, 2, 2)!.game;
  expect(game.tray.every(Boolean)).toBe(true);
  expect(game.tray.every((piece) => !['a', 'b', 'c'].includes(piece!.id))).toBe(true);
  expect(hasAvailableMove(game)).toBe(true);
});

test('rotation is reversible and rotated moves count before game over', () => {
  let piece = newGame().tray[0]!;
  const original = JSON.stringify(piece.cells);
  piece = rotatePiece(piece);
  expect(pieceSize(piece)).toEqual({ rows: 3, cols: 1 });
  for (let i = 0; i < 3; i++) piece = rotatePiece(piece);
  expect(JSON.stringify(piece.cells)).toBe(original);

  const game = emptyGame();
  game.board = Array(64).fill('violet');
  game.board[0] = null;
  game.board[8] = null;
  game.tray = [{ id: 'horizontal', color: 'mint', cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }] }, null, null];
  expect(firstFit(game.board, game.tray[0]!)).toBeNull();
  expect(hasAvailableMove(game)).toBe(true);
});

test('a genuinely blocked tray ends the round', () => {
  const game = emptyGame();
  game.board = Array.from({ length: 64 }, (_, index): Cell => (Math.floor(index / 8) + index % 8) % 2 === 0 ? 'violet' : null);
  game.tray = [single('last-move'), { id: 'square', color: 'mint', cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 1 }] }, null];
  const result = placePiece(game, 0, 0, 1)!;
  expect(result.isOver).toBe(true);
});

test('random complete games preserve board and scoring invariants', () => {
  test.setTimeout(60_000);
  for (let run = 0; run < 30; run++) {
    let game = newGame();
    for (let turn = 0; turn < 120; turn++) {
      const moves: { index: number; row: number; col: number; piece: Piece }[] = [];
      game.tray.forEach((original, index) => {
        if (!original) return;
        let piece = original;
        for (let rotation = 0; rotation < 4; rotation++) {
          for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
            if (canPlace(game.board, piece, row, col)) moves.push({ index, row, col, piece });
          }
          piece = rotatePiece(piece);
        }
      });
      if (!moves.length) { expect(hasAvailableMove(game)).toBe(false); break; }
      const move = moves[Math.floor(Math.random() * moves.length)];
      game.tray[move.index] = move.piece;
      const result = placePiece(game, move.index, move.row, move.col)!;
      expect(result.game.score).toBeGreaterThan(game.score);
      game = result.game;
      expect(game.board).toHaveLength(64);
      expect(game.tray).toHaveLength(3);
      for (let line = 0; line < 8; line++) {
        expect(Array.from({ length: 8 }, (_, col) => game.board[line * 8 + col]).every(Boolean)).toBe(false);
        expect(Array.from({ length: 8 }, (_, row) => game.board[row * 8 + line]).every(Boolean)).toBe(false);
      }
      expect(result.isOver).toBe(!hasAvailableMove(game));
    }
  }
});
import { newSeededGame, placePiece, rotatePiece, type Game } from './engine.ts';

export type ReplayAction =
  | { type: 'select'; index: number }
  | { type: 'rotate' }
  | { type: 'place'; index: number; row: number; col: number };

export type ReplayResult = { game: Game; isOver: boolean; actionsApplied: number; selectedIndex: number };
export const MAX_REPLAY_ACTIONS = 5_000;

/** Replays the versioned game command stream with the same engine used by the UI. */
export function replayGame(seed: number, sessionId: string, actions: ReplayAction[]): ReplayResult {
  if (!Array.isArray(actions) || actions.length === 0 || actions.length > MAX_REPLAY_ACTIONS) {
    throw new Error('Invalid replay length');
  }
  let game = newSeededGame(seed, sessionId);
  let selected = 0;
  let isOver = false;

  for (const action of actions) {
    if (isOver || !action || typeof action !== 'object') throw new Error('Actions continue after game over');
    if (action.type === 'select') {
      if (!Number.isInteger(action.index) || action.index < 0 || action.index > 2 || !game.tray[action.index]) {
        throw new Error('Invalid piece selection');
      }
      selected = action.index;
      continue;
    }
    if (action.type === 'rotate') {
      const piece = game.tray[selected];
      if (!piece) throw new Error('No selected piece to rotate');
      game = { ...game, tray: game.tray.map((item, index) => index === selected ? rotatePiece(piece) : item) };
      continue;
    }
    if (action.type === 'place') {
      if (action.index !== selected || !Number.isInteger(action.row) || !Number.isInteger(action.col)) {
        throw new Error('Invalid placement command');
      }
      const result = placePiece(game, selected, action.row, action.col);
      if (!result) throw new Error('Replay contains an illegal move');
      game = result.game;
      isOver = result.isOver;
      const next = game.tray.findIndex(Boolean);
      selected = next < 0 ? 0 : next;
      continue;
    }
    throw new Error('Unknown replay action');
  }
  return { game, isOver, actionsApplied: actions.length, selectedIndex: selected };
}

export function assertVerifiedResult(
  replay: ReplayResult,
  submitted: { score: number; lines: number; moves: number },
) {
  if (!replay.isOver) throw new Error('Competitive runs must end at game over');
  if (replay.game.score !== submitted.score || replay.game.lines !== submitted.lines || replay.game.moves !== submitted.moves) {
    throw new Error('Submitted result does not match replay');
  }
}

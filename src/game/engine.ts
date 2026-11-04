export const GRID_SIZE = 8;
export const RULESET_VERSION = 1;

export const PALETTE = {
  violet: '#aa8be8',
  mint: '#81cdb5',
  coral: '#ee9b88',
  butter: '#e9cd7b',
  blue: '#86addf',
} as const;

export type BlockColor = keyof typeof PALETTE;
export type Cell = BlockColor | null;
export type Point = { row: number; col: number };
export type Piece = {
  id: string;
  cells: Point[];
  color: BlockColor;
};
export type Game = {
  id: string;
  board: Cell[];
  tray: (Piece | null)[];
  score: number;
  lines: number;
  moves: number;
  combo: number;
  bestCombo: number;
  /** Present only for server-verifiable, ruleset-v1 sessions. */
  rngState?: number;
};
export type Placement = {
  game: Game;
  placed: number[];
  cleared: number[];
  beforeClear: Cell[];
  points: number;
  lineCount: number;
  isOver: boolean;
};
export type HighScore = {
  id: string;
  score: number;
  lines: number;
  combo: number;
  date: string;
};

const SHAPES: { cells: number[][]; weight: number }[] = [
  { cells: [[0, 0]], weight: 3 },
  { cells: [[0, 0], [0, 1]], weight: 7 },
  { cells: [[0, 0], [0, 1], [0, 2]], weight: 14 },
  { cells: [[0, 0], [0, 1], [0, 2], [0, 3]], weight: 8 },
  { cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], weight: 4 },
  { cells: [[0, 0], [0, 1], [1, 0], [1, 1]], weight: 14 },
  { cells: [[0, 0], [1, 0], [1, 1]], weight: 12 },
  { cells: [[0, 0], [1, 0], [2, 0], [2, 1]], weight: 10 },
  { cells: [[0, 0], [1, 0], [1, 1], [1, 2]], weight: 10 },
  { cells: [[0, 0], [0, 1], [0, 2], [1, 1]], weight: 8 },
  { cells: [[0, 0], [0, 1], [1, 1], [1, 2]], weight: 7 },
  { cells: [[0, 1], [0, 2], [1, 0], [1, 1]], weight: 7 },
  { cells: [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]], weight: 5 },
  { cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]], weight: 3 },
];

const COLORS = Object.keys(PALETTE) as BlockColor[];
const SCORE_KEY = 'blockparty.highscores.v1';
const SESSION_KEY = 'blockparty.session.v1';

function uid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function pieceSize(piece: Piece) {
  return {
    rows: Math.max(...piece.cells.map((cell) => cell.row)) + 1,
    cols: Math.max(...piece.cells.map((cell) => cell.col)) + 1,
  };
}

export function rotatePiece(piece: Piece): Piece {
  const { rows } = pieceSize(piece);
  return {
    ...piece,
    cells: piece.cells.map(({ row, col }) => ({ row: col, col: rows - 1 - row })),
  };
}

export function canPlace(board: Cell[], piece: Piece, row: number, col: number): boolean {
  return piece.cells.every((cell) => {
    const r = row + cell.row;
    const c = col + cell.col;
    return r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE && board[r * GRID_SIZE + c] === null;
  });
}

export function firstFit(board: Cell[], piece: Piece): Point | null {
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (canPlace(board, piece, row, col)) return { row, col };
    }
  }
  return null;
}

function hasFitInAnyRotation(board: Cell[], original: Piece): boolean {
  let piece = original;
  for (let rotation = 0; rotation < 4; rotation++) {
    if (firstFit(board, piece)) return true;
    piece = rotatePiece(piece);
  }
  return false;
}

export function hasAvailableMove(game: Game): boolean {
  return game.tray.some((piece) => piece && hasFitInAnyRotation(game.board, piece));
}

function randomPiece(): Piece {
  let target = Math.random() * SHAPES.reduce((sum, shape) => sum + shape.weight, 0);
  const shape = SHAPES.find((candidate) => {
    target -= candidate.weight;
    return target < 0;
  }) ?? SHAPES[0];
  let piece: Piece = {
    id: uid(),
    cells: shape.cells.map(([row, col]) => ({ row, col })),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
  const rotations = Math.floor(Math.random() * 4);
  for (let i = 0; i < rotations; i++) piece = rotatePiece(piece);
  return piece;
}

export function makeTray(board: Cell[]): Piece[] {
  const tray = [randomPiece(), randomPiece(), randomPiece()];
  // A fresh tray always offers a move; choices within the tray still matter.
  if (!tray.some((piece) => hasFitInAnyRotation(board, piece))) {
    const rescue = [...SHAPES].sort((a, b) => b.cells.length - a.cells.length).find((shape) =>
      hasFitInAnyRotation(board, {
        id: 'test',
        cells: shape.cells.map(([row, col]) => ({ row, col })),
        color: 'mint',
      }),
    );
    if (rescue) {
      tray[0] = {
        id: uid(),
        cells: rescue.cells.map(([row, col]) => ({ row, col })),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      };
    }
  }
  return tray;
}

export function newGame(): Game {
  const board: Cell[] = Array(GRID_SIZE * GRID_SIZE).fill(null);
  const groups: { color: BlockColor; cells: number[][] }[] = [
    { color: 'blue', cells: [[3, 6], [3, 7], [4, 6], [4, 7]] },
    { color: 'violet', cells: [[4, 0], [4, 1], [5, 0], [5, 1]] },
    { color: 'coral', cells: [[5, 4], [5, 5]] },
    { color: 'mint', cells: [[6, 0], [6, 1]] },
    { color: 'butter', cells: [[6, 5], [6, 6], [6, 7]] },
    { color: 'coral', cells: [[7, 0], [7, 1], [7, 2]] },
    { color: 'violet', cells: [[7, 6], [7, 7]] },
  ];
  groups.forEach(({ color, cells }) => cells.forEach(([row, col]) => { board[row * GRID_SIZE + col] = color; }));
  return {
    id: uid(),
    board,
    tray: [
      { id: uid(), color: 'coral', cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }] },
      { id: uid(), color: 'violet', cells: [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }] },
      { id: uid(), color: 'mint', cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 1 }] },
    ],
    score: 0,
    lines: 0,
    moves: 0,
    combo: 0,
    bestCombo: 0,
  };
}

export function placePiece(game: Game, index: number, row: number, col: number): Placement | null {
  const piece = game.tray[index];
  if (!piece || !canPlace(game.board, piece, row, col)) return null;

  const beforeClear = [...game.board];
  const placed = piece.cells.map((cell) => (row + cell.row) * GRID_SIZE + col + cell.col);
  placed.forEach((cell) => { beforeClear[cell] = piece.color; });

  const clearedSet = new Set<number>();
  let lineCount = 0;
  for (let r = 0; r < GRID_SIZE; r++) {
    if (Array.from({ length: GRID_SIZE }, (_, c) => beforeClear[r * GRID_SIZE + c]).every(Boolean)) {
      lineCount++;
      for (let c = 0; c < GRID_SIZE; c++) clearedSet.add(r * GRID_SIZE + c);
    }
  }
  for (let c = 0; c < GRID_SIZE; c++) {
    if (Array.from({ length: GRID_SIZE }, (_, r) => beforeClear[r * GRID_SIZE + c]).every(Boolean)) {
      lineCount++;
      for (let r = 0; r < GRID_SIZE; r++) clearedSet.add(r * GRID_SIZE + c);
    }
  }
  const board = beforeClear.map((cell, index) => clearedSet.has(index) ? null : cell);
  const combo = lineCount ? game.combo + 1 : 0;
  const points = piece.cells.length * 5 + 100 * lineCount * lineCount * Math.max(1, combo);
  let tray = game.tray.map((item, i) => i === index ? null : item);
  let rngState = game.rngState;
  if (tray.every((item) => !item)) {
    if (rngState === undefined) tray = makeTray(board);
    else {
      const generated = makeSeededTray(board, rngState, game.id);
      tray = generated.tray;
      rngState = generated.rngState;
    }
  }

  const next: Game = {
    ...game,
    board,
    tray,
    score: game.score + points,
    lines: game.lines + lineCount,
    moves: game.moves + 1,
    combo,
    bestCombo: Math.max(game.bestCombo, combo),
    ...(rngState === undefined ? {} : { rngState }),
  };
  return { game: next, placed, cleared: [...clearedSet], beforeClear, points, lineCount, isOver: !hasAvailableMove(next) };
}

function seededNext(state: number): { value: number; state: number } {
  // Mulberry32: explicit unsigned math keeps browser and Deno streams identical.
  const nextState = (state + 0x6d2b79f5) >>> 0;
  let value = nextState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return { value: ((value ^ (value >>> 14)) >>> 0) / 4294967296, state: nextState };
}

function makeSeededTray(board: Cell[], initialState: number, gameId: string): { tray: Piece[]; rngState: number } {
  let state = initialState >>> 0;
  const next = () => {
    const result = seededNext(state);
    state = result.state;
    return result.value;
  };
  const tray = Array.from({ length: 3 }, (_, slot) => {
    let target = next() * SHAPES.reduce((sum, shape) => sum + shape.weight, 0);
    const shape = SHAPES.find((candidate) => { target -= candidate.weight; return target < 0; }) ?? SHAPES[0];
    let piece: Piece = {
      id: `${gameId}:generated:${state.toString(16)}:${slot}`,
      cells: shape.cells.map(([row, col]) => ({ row, col })),
      color: COLORS[Math.floor(next() * COLORS.length)],
    };
    const rotations = Math.floor(next() * 4);
    for (let i = 0; i < rotations; i++) piece = rotatePiece(piece);
    return piece;
  });
  if (!tray.some((piece) => hasFitInAnyRotation(board, piece))) {
    const rescue = [...SHAPES].sort((a, b) => b.cells.length - a.cells.length).find((shape) =>
      hasFitInAnyRotation(board, { id: 'rescue', cells: shape.cells.map(([row, col]) => ({ row, col })), color: 'mint' }),
    );
    if (rescue) tray[0] = {
      id: `${gameId}:rescue:${state.toString(16)}`,
      cells: rescue.cells.map(([row, col]) => ({ row, col })),
      color: COLORS[Math.floor(next() * COLORS.length)],
    };
  }
  return { tray, rngState: state };
}

/** Creates the deterministic ruleset-v1 start state used by competitive sessions. */
export function newSeededGame(seed: number, sessionId: string): Game {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || !sessionId) throw new Error('Invalid seeded game parameters');
  const game = newGame();
  return {
    ...game,
    id: sessionId,
    rngState: seed >>> 0,
    tray: game.tray.map((piece, index) => piece ? { ...piece, id: `${sessionId}:starter:${index}` } : null),
  };
}

export function loadScores(): HighScore[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(SCORE_KEY) ?? '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter((item): item is HighScore =>
      !!item && typeof item.id === 'string' && Number.isFinite(item.score) && item.score >= 0 &&
      Number.isFinite(item.lines) && Number.isFinite(item.combo) && typeof item.date === 'string' &&
      !Number.isNaN(Date.parse(item.date)),
    ).sort((a, b) => b.score - a.score).slice(0, 10);
  } catch {
    return [];
  }
}

export function saveScores(scores: HighScore[]) {
  try { localStorage.setItem(SCORE_KEY, JSON.stringify(scores)); } catch { /* Private browsing can disable storage. */ }
}

export function saveSession(game: Game | null) {
  try {
    if (game) localStorage.setItem(SESSION_KEY, JSON.stringify(game));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* The game remains playable without storage. */ }
}

export function loadSession(): Game | null {
  try {
    const game = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as Game | null;
    if (!game || typeof game.id !== 'string' || !Array.isArray(game.board) || game.board.length !== 64 ||
      !game.board.every((cell) => cell === null || COLORS.includes(cell)) || !Array.isArray(game.tray) ||
      game.tray.length !== 3 || !game.tray.some(Boolean) ||
      ![game.score, game.moves, game.lines, game.combo, game.bestCombo].every((value) => Number.isFinite(value) && value >= 0)) return null;
    if (!game.tray.every((piece) => piece === null || (
      typeof piece.id === 'string' && COLORS.includes(piece.color) && Array.isArray(piece.cells) &&
      piece.cells.length > 0 && piece.cells.length <= 9 && piece.cells.every((cell) =>
        Number.isInteger(cell.row) && Number.isInteger(cell.col) && cell.row >= 0 && cell.row < 5 && cell.col >= 0 && cell.col < 5,
      )
    ))) return null;
    return hasAvailableMove(game) ? game : null;
  } catch {
    return null;
  }
}

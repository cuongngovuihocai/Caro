import { PlayerSymbol, AIDifficulty, WinningResult } from '../types';

export const BOARD_SIZE = 20;

export function createEmptyBoard(size: number = BOARD_SIZE): (PlayerSymbol | null)[][] {
  return Array(size)
    .fill(null)
    .map(() => Array(size).fill(null));
}

// Check Gomoku / Caro win condition
export function checkWin(
  board: (PlayerSymbol | null)[][],
  lastRow: number,
  lastCol: number,
  player: PlayerSymbol,
  boardSize: number = BOARD_SIZE,
  ruleBlockedEnds: boolean = false
): WinningResult {
  const directions = [
    [0, 1],   // Horizontal
    [1, 0],   // Vertical
    [1, 1],   // Diagonal Down-Right
    [1, -1],  // Diagonal Down-Left
  ];

  for (const [dr, dc] of directions) {
    const line: { row: number; col: number }[] = [{ row: lastRow, col: lastCol }];

    // Positive direction
    let r = lastRow + dr;
    let c = lastCol + dc;
    let posBlocked = false;
    while (r >= 0 && r < boardSize && c >= 0 && c < boardSize && board[r][c] === player) {
      line.push({ row: r, col: c });
      r += dr;
      c += dc;
    }
    if (r >= 0 && r < boardSize && c >= 0 && c < boardSize && board[r][c] !== null) {
      posBlocked = true;
    } else if (r < 0 || r >= boardSize || c < 0 || c >= boardSize) {
      posBlocked = true;
    }

    // Negative direction
    r = lastRow - dr;
    c = lastCol - dc;
    let negBlocked = false;
    while (r >= 0 && r < boardSize && c >= 0 && c < boardSize && board[r][c] === player) {
      line.unshift({ row: r, col: c });
      r -= dr;
      c -= dc;
    }
    if (r >= 0 && r < boardSize && c >= 0 && c < boardSize && board[r][c] !== null) {
      negBlocked = true;
    } else if (r < 0 || r >= boardSize || c < 0 || c >= boardSize) {
      negBlocked = true;
    }

    if (line.length >= 5) {
      // Check blocked ends rule
      if (ruleBlockedEnds && line.length === 5 && posBlocked && negBlocked) {
        continue;
      }
      return { win: true, winner: player, line };
    }
  }

  return { win: false, winner: null, line: null };
}

export function checkDraw(board: (PlayerSymbol | null)[][], boardSize: number = BOARD_SIZE): boolean {
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      if (board[r][c] === null) return false;
    }
  }
  return true;
}

// Get candidate empty cells that are adjacent to at least one placed piece (distance <= 2)
function getCandidateMoves(board: (PlayerSymbol | null)[][], boardSize: number = BOARD_SIZE): { row: number; col: number }[] {
  const candidates = new Set<string>();
  let hasPieces = false;

  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      if (board[r][c] !== null) {
        hasPieces = true;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < boardSize && nc >= 0 && nc < boardSize && board[nr][nc] === null) {
              candidates.add(`${nr},${nc}`);
            }
          }
        }
      }
    }
  }

  // If board is empty, return center cell
  if (!hasPieces) {
    const center = Math.floor(boardSize / 2);
    return [{ row: center, col: center }];
  }

  return Array.from(candidates).map((key) => {
    const [row, col] = key.split(',').map(Number);
    return { row, col };
  });
}

// Line evaluation scores for local on-device calculation engine
const SCORES = {
  WIN: 100000000,
  OPEN_4: 10000000,
  BLOCKED_4: 1000000,
  OPEN_3: 100000,
  BLOCKED_3: 10000,
  OPEN_2: 1000,
  BLOCKED_2: 100,
};

// Evaluate a single cell's strategic value for a player
function evaluateCell(
  board: (PlayerSymbol | null)[][],
  row: number,
  col: number,
  player: PlayerSymbol,
  boardSize: number = BOARD_SIZE,
  ruleBlockedEnds: boolean = false
): number {
  let totalScore = 0;
  let open3Count = 0;
  let blocked4Count = 0;

  const directions = [
    [0, 1],   // Horizontal
    [1, 0],   // Vertical
    [1, 1],   // Diagonal Down-Right
    [1, -1],  // Diagonal Down-Left
  ];

  for (const [dr, dc] of directions) {
    let count = 1;
    let openEnds = 0;

    // Positive direction
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < boardSize && c >= 0 && c < boardSize && board[r][c] === player) {
      count++;
      r += dr;
      c += dc;
    }
    if (r >= 0 && r < boardSize && c >= 0 && c < boardSize && board[r][c] === null) {
      openEnds++;
    }

    // Negative direction
    r = row - dr;
    c = col - dc;
    while (r >= 0 && r < boardSize && c >= 0 && c < boardSize && board[r][c] === player) {
      count++;
      r -= dr;
      c -= dc;
    }
    if (r >= 0 && r < boardSize && c >= 0 && c < boardSize && board[r][c] === null) {
      openEnds++;
    }

    if (count >= 5) {
      if (ruleBlockedEnds && count === 5 && openEnds === 0) {
        totalScore += SCORES.BLOCKED_4;
      } else {
        totalScore += SCORES.WIN;
      }
    } else if (count === 4) {
      if (openEnds === 2) {
        totalScore += SCORES.OPEN_4;
      } else if (openEnds === 1) {
        totalScore += SCORES.BLOCKED_4;
        blocked4Count++;
      }
    } else if (count === 3) {
      if (openEnds === 2) {
        totalScore += SCORES.OPEN_3;
        open3Count++;
      } else if (openEnds === 1) {
        totalScore += SCORES.BLOCKED_3;
      }
    } else if (count === 2) {
      if (openEnds === 2) totalScore += SCORES.OPEN_2;
      else if (openEnds === 1) totalScore += SCORES.BLOCKED_2;
    }
  }

  // Fork bonuses (Double Open-3 or Open-3 + Blocked-4 creates an unblockable win condition)
  if (open3Count >= 2) {
    totalScore += SCORES.OPEN_4 * 0.8;
  }
  if (blocked4Count >= 2 || (open3Count >= 1 && blocked4Count >= 1)) {
    totalScore += SCORES.OPEN_4 * 0.9;
  }

  return totalScore;
}

// AI Engine to calculate best move 100% on device
export function getBestAIMove(
  board: (PlayerSymbol | null)[][],
  aiPlayer: PlayerSymbol,
  difficulty: AIDifficulty,
  boardSize: number = BOARD_SIZE,
  ruleBlockedEnds: boolean = false
): { row: number; col: number } | null {
  const humanPlayer: PlayerSymbol = aiPlayer === 'X' ? 'O' : 'X';
  const candidates = getCandidateMoves(board, boardSize);

  if (candidates.length === 0) return null;

  // 1. Check for immediate winning move for AI
  for (const move of candidates) {
    board[move.row][move.col] = aiPlayer;
    const winResult = checkWin(board, move.row, move.col, aiPlayer, boardSize, ruleBlockedEnds);
    board[move.row][move.col] = null;
    if (winResult.win) {
      return move;
    }
  }

  // 2. Check for immediate blocking move against human win
  for (const move of candidates) {
    board[move.row][move.col] = humanPlayer;
    const winResult = checkWin(board, move.row, move.col, humanPlayer, boardSize, ruleBlockedEnds);
    board[move.row][move.col] = null;
    if (winResult.win) {
      return move;
    }
  }

  // Easy mode: add slight randomness
  if (difficulty === 'easy') {
    if (Math.random() < 0.35 && candidates.length > 1) {
      const randomIndex = Math.floor(Math.random() * candidates.length);
      return candidates[randomIndex];
    }
  }

  // Evaluate candidate moves with offensive and defensive weights
  let bestMove = candidates[0];
  let maxScore = -Infinity;

  const defenseMultiplier = difficulty === 'hard' ? 1.15 : 0.95;

  for (const move of candidates) {
    const offensiveScore = evaluateCell(board, move.row, move.col, aiPlayer, boardSize, ruleBlockedEnds);
    const defensiveScore = evaluateCell(board, move.row, move.col, humanPlayer, boardSize, ruleBlockedEnds);

    // Center proximity bonus (prefers center board control)
    const center = boardSize / 2;
    const centerDist = Math.abs(move.row - center) + Math.abs(move.col - center);
    const centerBonus = (boardSize - centerDist) * 10;

    let combinedScore = offensiveScore + defensiveScore * defenseMultiplier + centerBonus;

    // Slight noise for medium mode so it's not 100% deterministic
    if (difficulty === 'medium') {
      combinedScore += Math.random() * 50;
    }

    if (combinedScore > maxScore) {
      maxScore = combinedScore;
      bestMove = move;
    }
  }

  return bestMove;
}

// Get Hint for current player
export function getHint(
  board: (PlayerSymbol | null)[][],
  player: PlayerSymbol,
  boardSize: number = BOARD_SIZE,
  ruleBlockedEnds: boolean = false
): { row: number; col: number } | null {
  return getBestAIMove(board, player, 'hard', boardSize, ruleBlockedEnds);
}

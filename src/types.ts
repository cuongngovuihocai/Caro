export type GameMode = 'vs-ai' | 'online' | 'local';

export type BoardTheme = 'notebook' | 'blackboard';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

export type PlayerSymbol = 'X' | 'O';

export interface Move {
  row: number;
  col: number;
  player: PlayerSymbol;
  timestamp?: number;
}

export interface WinningResult {
  win: boolean;
  winner: PlayerSymbol | null;
  line: { row: number; col: number }[] | null;
}

export interface PlayerStats {
  vsAiWins: number;
  vsAiLosses: number;
  vsAiDraws: number;
  onlineWins: number;
  onlineLosses: number;
  onlineDraws: number;
  localGames: number;
  currentStreak: number;
  maxStreak: number;
}

export interface ChatMessage {
  id: string;
  sender: string;
  senderRole?: 'X' | 'O' | 'system';
  text: string;
  type: 'chat' | 'emoji' | 'system';
  time: string;
}

export interface OnlineRoomState {
  id: string;
  name: string;
  createdAt: number;
  isPublic: boolean;
  timePerTurn: number;
  ruleBlockedEnds: boolean;
  boardSize: number;
  players: {
    X: { name: string; connected: boolean } | null;
    O: { name: string; connected: boolean } | null;
  };
  spectatorCount: number;
  board: (PlayerSymbol | null)[][];
  currentTurn: PlayerSymbol;
  winner: PlayerSymbol | 'DRAW' | null;
  winningLine: { row: number; col: number }[] | null;
  lastMove: { row: number; col: number } | null;
  moveHistory: Move[];
  status: 'waiting' | 'playing' | 'ended';
  chatMessages: ChatMessage[];
  rematchRequests: { X?: boolean; O?: boolean };
  turnDeadline: number | null;
}

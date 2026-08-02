import React from 'react';
import { GameMode, PlayerSymbol, AIDifficulty } from '../types';
import { RotateCcw, Lightbulb, Flag, Play, Bot, User, Clock, ShieldAlert } from 'lucide-react';

interface ControlsProps {
  mode: GameMode;
  currentTurn: PlayerSymbol;
  playerSymbol: PlayerSymbol; // Symbol used by local human player or Player 1
  aiDifficulty: AIDifficulty;
  setAiDifficulty: (diff: AIDifficulty) => void;
  isAiThinking: boolean;
  ruleBlockedEnds: boolean;
  setRuleBlockedEnds: (val: boolean) => void;
  turnTimeLeft: number | null; // Seconds remaining in turn
  maxTurnTime: number; // e.g. 30
  onUndo: () => void;
  onHint: () => void;
  onSurrender: () => void;
  onRestart: () => void;
  canUndo: boolean;
  gameStatus: 'waiting' | 'playing' | 'ended';
  winner: PlayerSymbol | 'DRAW' | null;
  p1Name?: string;
  p2Name?: string;
  isSpectator?: boolean;
  rematchRequestedByMe?: boolean;
  rematchRequestedByOpponent?: boolean;
}

export const Controls: React.FC<ControlsProps> = ({
  mode,
  currentTurn,
  playerSymbol,
  aiDifficulty,
  setAiDifficulty,
  isAiThinking,
  ruleBlockedEnds,
  setRuleBlockedEnds,
  turnTimeLeft,
  maxTurnTime,
  onUndo,
  onHint,
  onSurrender,
  onRestart,
  canUndo,
  gameStatus,
  winner,
  p1Name = 'Người chơi 1',
  p2Name = 'Máy AI',
  isSpectator = false,
  rematchRequestedByMe = false,
  rematchRequestedByOpponent = false,
}) => {
  // Timer bar percentage
  const timerPercent = turnTimeLeft !== null && maxTurnTime > 0 ? (turnTimeLeft / maxTurnTime) * 100 : 100;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-3 my-2 select-none">
      {/* Player Turn Status Bar */}
      <div
        className="border border-sky-200 rounded-2xl p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3"
        style={{ backgroundColor: '#CC313D' }}
      >
        {/* Player X Info */}
        <div
          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all w-full sm:w-auto ${
            currentTurn === 'X' && gameStatus === 'playing'
              ? 'text-white shadow-md font-bold scale-102'
              : 'text-amber-900 border border-amber-200/60 opacity-80'
          }`}
          style={{ backgroundColor: '#FFFBEB' }}
        >
          <div
            className="w-8 h-8 rounded-lg text-white font-extrabold flex items-center justify-center text-lg shadow-xs"
            style={{ backgroundColor: '#06a0f1' }}
          >
            ✕
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold truncate max-w-[140px]" style={{ color: '#300202', fontSize: '16px' }}>
              {p1Name}
            </span>
          </div>
        </div>

        {/* VS Badge & Turn Timer */}
        <div className="flex flex-col items-center justify-center">
          {gameStatus === 'playing' ? (
            <div className="flex flex-col items-center gap-1">
              <span
                className="text-xs font-bold uppercase tracking-wide flex items-center gap-1"
                style={{ color: '#ffffff', fontSize: '18px' }}
              >
                Lượt: <span className={currentTurn === 'X' ? 'font-extrabold' : 'font-extrabold'} style={{ color: '#ffffff' }}>{currentTurn}</span>
              </span>

              {/* Turn Time Bar */}
              {turnTimeLeft !== null && maxTurnTime > 0 && (
                <div
                  className="w-28 sm:w-36 h-2 rounded-full overflow-hidden border border-amber-300"
                  style={{ backgroundColor: '#fef586' }}
                >
                  <div
                    className={`h-full transition-all duration-1000 ${
                      turnTimeLeft <= 5 ? 'bg-rose-600 animate-pulse' : 'bg-emerald-600'
                    }`}
                    style={{ width: `${timerPercent}%` }}
                  />
                </div>
              )}
              {turnTimeLeft !== null && maxTurnTime > 0 && (
                <span
                  className="font-mono font-extrabold flex items-center gap-1 drop-shadow-xs"
                  style={{ color: '#ffffff', fontSize: '16px' }}
                >
                  <Clock className="w-4 h-4 text-white" /> {turnTimeLeft}s
                </span>
              )}
            </div>
          ) : winner ? (
            <span className="text-sm font-extrabold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300 animate-bounce">
              {winner === 'DRAW' ? 'Hòa cờ!' : `Thắng: ${winner}`}
            </span>
          ) : (
            <span className="text-xs font-bold text-amber-800 bg-amber-200/60 px-2.5 py-1 rounded-full">
              Sẵn sàng
            </span>
          )}
        </div>

        {/* Player O Info */}
        <div
          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all w-full sm:w-auto justify-end ${
            currentTurn === 'O' && gameStatus === 'playing'
              ? 'bg-rose-600 text-white shadow-md font-bold scale-102'
              : 'bg-amber-50 text-amber-900 border border-amber-200/60 opacity-80'
          }`}
        >
          <div className="flex flex-col text-right">
            <span className="text-sm font-bold truncate max-w-[140px]" style={{ color: '#300202', fontSize: '16px' }}>
              {mode === 'vs-ai' ? (isAiThinking ? 'Máy AI (Đang nghĩ...)' : p2Name) : p2Name}
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-rose-700 text-white font-extrabold flex items-center justify-center text-lg shadow-xs">
            ◯
          </div>
        </div>
      </div>

      {/* Spectator Locked Banner Notice */}
      {isSpectator && (
        <div className="bg-amber-100/90 border border-amber-300 text-amber-900 text-xs font-bold px-3 py-1.5 rounded-xl text-center shadow-xs">
          👁️ Quyền Khán Giả: Đã khóa các tính năng điều khiển (Đánh lại, Đầu hàng, Ván mới, Đổi luật) để tránh ảnh hưởng thi đấu.
        </div>
      )}

      {/* Mode-Specific Settings (AI Difficulty & Blocked Ends Rules) */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border text-xs text-amber-950"
        style={{ backgroundColor: '#f96167' }}
      >
        {mode === 'vs-ai' && (
          <div className="flex items-center gap-1.5 font-semibold">
            <Bot className="w-4 h-4" style={{ color: '#ffffff', width: '15px', height: '15px' }} />
            <span style={{ fontSize: '16.5px', color: '#ffffff' }}>Cấp độ Máy:</span>
            <div
              className="flex gap-1 p-0.5 rounded-lg border border-amber-300/60"
              style={{ backgroundColor: '#f9E795', color: '#060200' }}
            >
              {(['easy', 'medium', 'hard'] as AIDifficulty[]).map((diff) => (
                <button
                  key={diff}
                  onClick={() => setAiDifficulty(diff)}
                  style={{ fontSize: '16px', color: aiDifficulty === diff ? '#ffffff' : '#1e293b' }}
                  className={`px-2 py-1 rounded-md capitalize cursor-pointer transition-colors ${
                    aiDifficulty === diff
                      ? 'bg-amber-800 text-white font-bold shadow-xs'
                      : 'text-amber-900 hover:bg-amber-200'
                  }`}
                >
                  {diff === 'easy' ? 'Mơ mộng' : diff === 'medium' ? 'Hoàng tử Lai' : 'Chúa tể Hắc ám'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Gomoku Blocked-Ends Rule Toggle */}
        <label className={`flex items-center gap-1.5 font-semibold select-none ${isSpectator ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:text-amber-900'}`}>
          <input
            type="checkbox"
            checked={ruleBlockedEnds}
            disabled={isSpectator}
            onChange={(e) => setRuleBlockedEnds(e.target.checked)}
            className="accent-amber-800 w-4 h-4 rounded cursor-pointer disabled:cursor-not-allowed"
          />
          <span style={{ fontSize: '15px', color: '#f9e795' }}>Luật "Chặn 2 đầu không thắng"</span>
        </label>
      </div>

      {/* Primary Action Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Undo */}
        <button
          onClick={onUndo}
          disabled={isSpectator || !canUndo || gameStatus !== 'playing' || isAiThinking}
          style={{ backgroundColor: '#fBEAEB', borderColor: '#2f3c7e' }}
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl hover:bg-amber-300 text-amber-950 font-bold border shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs sm:text-sm"
        >
          <RotateCcw className="w-4 h-4 text-amber-800" />
          <span style={{ color: '#000000' }}>Đánh lại</span>
        </button>

        {/* Hint */}
        <button
          onClick={onHint}
          disabled={isSpectator || gameStatus !== 'playing' || isAiThinking}
          style={{ backgroundColor: '#2f3c7e' }}
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl hover:bg-amber-300 text-amber-950 font-bold border border-amber-300/80 shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs sm:text-sm"
        >
          <Lightbulb className="w-4 h-4" style={{ color: '#ffffff' }} />
          <span style={{ color: '#ffffff' }}>Gợi ý</span>
        </button>

        {/* Surrender */}
        <button
          onClick={onSurrender}
          disabled={isSpectator || gameStatus !== 'playing' || isAiThinking}
          style={{ backgroundColor: '#89ABE3' }}
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl hover:bg-rose-200 text-rose-950 font-bold border border-rose-300 shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs sm:text-sm"
        >
          <Flag className="w-4 h-4 text-rose-700" />
          <span style={{ color: '#C70036' }}>Đầu hàng</span>
        </button>

        {/* New Game */}
        <button
          onClick={onRestart}
          disabled={isSpectator || rematchRequestedByMe}
          style={{ backgroundColor: rematchRequestedByOpponent ? '#10B981' : '#EA738D' }}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl hover:bg-amber-800 text-white font-bold shadow-md transition-all cursor-pointer text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
            rematchRequestedByOpponent ? 'animate-bounce' : ''
          }`}
        >
          <Play className="w-4 h-4 fill-white" />
          <span style={{ color: '#ffffff' }}>
            {rematchRequestedByMe
              ? 'Đang chờ đối thủ... (1/2)'
              : rematchRequestedByOpponent
              ? 'Chấp nhận Ván mới (1/2)'
              : 'Ván mới'}
          </span>
        </button>
      </div>
    </div>
  );
};

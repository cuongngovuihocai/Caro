import React from 'react';
import { PlayerSymbol, BoardTheme } from '../types';
import { BOARD_SIZE } from '../utils/caroLogic';

interface BoardProps {
  board: (PlayerSymbol | null)[][];
  onCellClick: (row: number, col: number) => void;
  currentTurn: PlayerSymbol;
  theme: BoardTheme;
  lastMove: { row: number; col: number } | null;
  winningLine: { row: number; col: number }[] | null;
  hintCell: { row: number; col: number } | null;
  disabled: boolean;
}

export const Board: React.FC<BoardProps> = ({
  board,
  onCellClick,
  currentTurn,
  theme,
  lastMove,
  winningLine,
  hintCell,
  disabled,
}) => {
  // Check if a cell is part of the winning line
  const isWinningCell = (r: number, c: number) => {
    if (!winningLine) return false;
    return winningLine.some((cell) => cell.row === r && cell.col === c);
  };

  // Compute SVG winning line path coordinates
  const getWinningLineCoordinates = () => {
    if (!winningLine || winningLine.length < 2) return null;

    const first = winningLine[0];
    const last = winningLine[winningLine.length - 1];

    // Grid size percentage per cell
    const cellPercent = 100 / BOARD_SIZE;

    const x1 = (first.col + 0.5) * cellPercent;
    const y1 = (first.row + 0.5) * cellPercent;
    const x2 = (last.col + 0.5) * cellPercent;
    const y2 = (last.row + 0.5) * cellPercent;

    return { x1: `${x1}%`, y1: `${y1}%`, x2: `${x2}%`, y2: `${y2}%` };
  };

  const lineCoords = getWinningLineCoordinates();

  // Theme styling configurations
  const themeStyles = {
    notebook: {
      boardBg: 'bg-[#faf8f2] border-sky-300 shadow-md',
      gridBorder: 'border-blue-200/70',
      xColor: 'text-blue-700 font-black',
      oColor: 'text-rose-600 font-black',
      hoverCell: 'hover:bg-blue-100/50',
      lastMoveRing: 'ring-2 ring-sky-500 bg-sky-100/40',
    },
    blackboard: {
      boardBg: 'bg-[#1e293b] border-sky-300 shadow-xl',
      gridBorder: 'border-slate-600/60',
      xColor: 'text-cyan-400 font-black',
      oColor: 'text-amber-300 font-black',
      hoverCell: 'hover:bg-slate-700/60',
      lastMoveRing: 'ring-2 ring-emerald-400 bg-slate-700/50',
    },
  }[theme];

  // Red notebook margin line after exactly 3 cells from left
  const redMarginLeftPercent = (3 / BOARD_SIZE) * 100;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center select-none">
      {/* The Game Board */}
      <div className={`relative w-full aspect-square rounded-xl border-2 p-1 ${themeStyles.boardBg} transition-colors duration-300 overflow-hidden`}>
        {/* Notebook Red Margin Line (Notebook Theme special detail: 3 cells margin from left) */}
        {theme === 'notebook' && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-rose-400/60 pointer-events-none z-10"
            style={{ left: `${redMarginLeftPercent}%` }}
          />
        )}

        {/* Top-Left Margin Logo (First row from top, spanning 3-cell margin) */}
        <div
          className="absolute top-1 left-1 pointer-events-none z-10 flex items-center justify-center p-0.5"
          style={{
            width: `${(3 / BOARD_SIZE) * 100}%`,
            height: `${(1 / BOARD_SIZE) * 100}%`,
          }}
        >
          <img
            src={
              theme === 'blackboard'
                ? 'https://lh3.googleusercontent.com/d/1q6B38HJxp8PEO5qmufm3HrJ0gBv8a2Z8'
                : 'https://lh3.googleusercontent.com/d/1yOLi510GeFZT7mihMrnhZRKXtel1C6-z'
            }
            alt="Logo"
            className="max-h-full max-w-full object-contain drop-shadow-xs"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* SVG Winning Line Overlay */}
        {lineCoords && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
            <line
              x1={lineCoords.x1}
              y1={lineCoords.y1}
              x2={lineCoords.x2}
              y2={lineCoords.y2}
              stroke={theme === 'blackboard' ? '#34d399' : '#2563eb'}
              strokeWidth="6"
              strokeLinecap="round"
              className="animate-pulse"
            />
          </svg>
        )}

        {/* Grid Cells */}
        <div
          className="grid w-full h-full border border-transparent"
          style={{
            gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
          }}
        >
          {board.map((row, rIdx) =>
            row.map((cell, cIdx) => {
              const isLast = lastMove?.row === rIdx && lastMove?.col === cIdx;
              const isWin = isWinningCell(rIdx, cIdx);
              const isHint = hintCell?.row === rIdx && hintCell?.col === cIdx;

              return (
                <button
                  key={`${rIdx}-${cIdx}`}
                  disabled={disabled || cell !== null}
                  onClick={() => onCellClick(rIdx, cIdx)}
                  className={`relative flex items-center justify-center border-r border-b ${themeStyles.gridBorder} transition-all duration-150 cursor-pointer ${
                    cell === null && !disabled ? themeStyles.hoverCell : ''
                  } ${isLast ? themeStyles.lastMoveRing : ''} ${
                    isWin ? 'bg-amber-300/60 dark:bg-amber-600/60 scale-105 z-10 shadow-md font-bold' : ''
                  }`}
                >
                  {/* Hint Cell Indicator */}
                  {cell === null && isHint && (
                    <div className="absolute inset-0.5 rounded-full border-2 border-dashed border-emerald-500 animate-ping opacity-75 pointer-events-none" />
                  )}

                  {/* Piece Symbol Rendering */}
                  {cell === 'X' && (
                    <span
                      className={`text-xs sm:text-base font-shantell ${themeStyles.xColor} animate-in zoom-in-50 duration-150`}
                    >
                      ✕
                    </span>
                  )}

                  {/* O Symbol Rendering */}
                  {cell === 'O' && (
                    <span
                      className={`text-xs sm:text-base font-shantell ${themeStyles.oColor} animate-in zoom-in-50 duration-150`}
                    >
                      ◯
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Handwritten Quote placed inside board overlaying bottom right cells */}
        <div className="absolute bottom-1 right-2 pointer-events-none z-10 text-right pr-1 pb-0.5">
          <span
            className={`${
              theme === 'blackboard' ? 'text-white' : 'text-purple-700'
            } font-grape text-sm sm:text-base font-semibold tracking-wide drop-shadow-2xs opacity-90`}
          >
            Vui chơi là khởi nguồn của Tri thức
          </span>
        </div>
      </div>
    </div>
  );
};

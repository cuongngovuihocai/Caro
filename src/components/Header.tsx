import React from 'react';
import { GameMode, BoardTheme } from '../types';
import { Volume2, VolumeX, BarChart2, HelpCircle, Bot, Users, Globe, BookOpen, Square } from 'lucide-react';

interface HeaderProps {
  mode: GameMode;
  setMode: (mode: GameMode) => void;
  theme: BoardTheme;
  setTheme: (theme: BoardTheme) => void;
  soundEnabled: boolean;
  toggleSound: () => void;
  onOpenStats: () => void;
  onOpenRules: () => void;
  isSpectator?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  setMode,
  theme,
  setTheme,
  soundEnabled,
  toggleSound,
  onOpenStats,
  onOpenRules,
  isSpectator = false,
}) => {
  return (
    <header className="w-full bg-amber-50/90 border-b border-sky-200 shadow-xs backdrop-blur-md px-3 py-2 sm:px-6 sm:py-3 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Title Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-red-500 to-amber-600 text-white flex items-center justify-center font-extrabold text-xl shadow-md border border-amber-400/30">
            X<span className="text-amber-200 text-sm">O</span>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-amber-950 flex items-center gap-2 font-serif">
              CỜ CARO
            </h1>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center bg-amber-100/80 p-1 rounded-xl border border-amber-200 shadow-inner text-xs sm:text-sm font-semibold text-amber-900">
          <button
            onClick={() => setMode('vs-ai')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              mode === 'vs-ai'
                ? 'bg-amber-700 text-white shadow-sm font-bold'
                : 'hover:bg-amber-200/60 text-amber-900'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Đấu với Máy</span>
          </button>

          <button
            onClick={() => setMode('online')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              mode === 'online'
                ? 'bg-amber-700 text-white shadow-sm font-bold'
                : 'hover:bg-amber-200/60 text-amber-900'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Trực Tuyến</span>
          </button>

          <button
            onClick={() => setMode('local')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              mode === 'local'
                ? 'bg-amber-700 text-white shadow-sm font-bold'
                : 'hover:bg-amber-200/60 text-amber-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Chơi 2 Người</span>
          </button>
        </div>

        {/* Action Controls: Theme, Sound, Stats, Help */}
        <div className="flex items-center gap-2">
          {/* Theme Dropdown / Selector */}
          <div className="flex items-center bg-amber-200/60 p-1 rounded-lg border border-amber-300/60 text-xs">
            <button
              onClick={() => !isSpectator && setTheme('notebook')}
              disabled={isSpectator}
              title={isSpectator ? 'Khán giả không thể đổi giao diện bàn cờ' : 'Giao diện Tập Học Sinh'}
              className={`p-1.5 rounded-md flex items-center gap-1 transition-all ${
                isSpectator
                  ? 'opacity-50 cursor-not-allowed'
                  : 'cursor-pointer hover:bg-amber-200'
              } ${
                theme === 'notebook' ? 'bg-white text-blue-700 font-bold shadow-xs' : 'text-amber-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden lg:inline" style={{ fontWeight: 'bold', fontSize: '15px' }}>Tập Học Sinh</span>
            </button>
            <button
              onClick={() => !isSpectator && setTheme('blackboard')}
              disabled={isSpectator}
              title={isSpectator ? 'Khán giả không thể đổi giao diện bàn cờ' : 'Giao diện Bảng Đen'}
              className={`p-1.5 rounded-md flex items-center gap-1 transition-all ${
                isSpectator
                  ? 'opacity-50 cursor-not-allowed'
                  : 'cursor-pointer hover:bg-amber-200'
              } ${
                theme === 'blackboard' ? 'bg-slate-800 text-cyan-300 font-bold shadow-xs' : 'text-amber-900'
              }`}
            >
              <Square className="w-3.5 h-3.5" />
              <span className="hidden lg:inline" style={{ fontWeight: 'bold', fontSize: '15px' }}>Bảng Đen</span>
            </button>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="p-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-200 transition-colors cursor-pointer"
            title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-700" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>

          {/* Stats Button */}
          <button
            onClick={onOpenStats}
            className="p-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-200 transition-colors cursor-pointer"
            title="Thống kê ván chơi"
          >
            <BarChart2 className="w-4 h-4" />
          </button>

          {/* Rules Button */}
          <button
            onClick={onOpenRules}
            className="p-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-200 transition-colors cursor-pointer"
            title="Luật chơi & Hướng dẫn"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;

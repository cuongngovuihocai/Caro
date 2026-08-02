import React from 'react';
import { PlayerStats } from '../types';
import { Trophy, Bot, Globe, Flame, X, RefreshCw } from 'lucide-react';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: PlayerStats;
  onResetStats: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({ isOpen, onClose, stats, onResetStats }) => {
  if (!isOpen) return null;

  const totalAi = stats.vsAiWins + stats.vsAiLosses + stats.vsAiDraws;
  const aiWinRate = totalAi > 0 ? Math.round((stats.vsAiWins / totalAi) * 100) : 0;

  const totalOnline = stats.onlineWins + stats.onlineLosses + stats.onlineDraws;
  const onlineWinRate = totalOnline > 0 ? Math.round((stats.onlineWins / totalOnline) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-amber-950">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-amber-200/60 hover:bg-amber-300 text-amber-900 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-7 h-7 text-amber-600" />
          <h2 className="text-xl font-black font-serif">Thống Kê Ván Chơi</h2>
        </div>

        {/* Highlight Streak Card */}
        <div className="bg-linear-to-r from-amber-600 to-amber-700 text-white rounded-2xl p-4 mb-4 shadow-md flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-amber-200 uppercase tracking-wide block">Chuỗi Thắng Hiện Tại</span>
            <span className="text-3xl font-black tracking-tight">{stats.currentStreak} ván</span>
          </div>
          <div className="flex items-center gap-1 bg-amber-800/60 px-3 py-1.5 rounded-xl border border-amber-500/40 text-xs font-bold">
            <Flame className="w-4 h-4 text-amber-300 fill-amber-300" />
            <span style={{ fontSize: '18px' }}>Kỷ lục: {stats.maxStreak}</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="space-y-3">
          {/* Vs AI Stats */}
          <div className="bg-white border border-amber-200 rounded-2xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm flex items-center gap-1.5 text-amber-900">
                <Bot className="w-4 h-4 text-amber-700" />
                <span style={{ fontSize: '18px' }}>Đấu với Máy AI</span>
              </span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full" style={{ fontSize: '16px' }}>
                Thắng {aiWinRate}%
              </span>
            </div>
            <div className="grid grid-cols-3 text-center text-xs font-bold gap-1 bg-amber-50 p-2 rounded-xl">
              <div className="text-emerald-700" style={{ fontSize: '15px' }}>Thắng: {stats.vsAiWins}</div>
              <div className="text-rose-700" style={{ fontSize: '15px' }}>Thua: {stats.vsAiLosses}</div>
              <div className="text-amber-700" style={{ fontSize: '15px' }}>Hòa: {stats.vsAiDraws}</div>
            </div>
          </div>

          {/* Online Stats */}
          <div className="bg-white border border-amber-200 rounded-2xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm flex items-center gap-1.5 text-amber-900">
                <Globe className="w-4 h-4 text-amber-700" />
                <span style={{ fontSize: '18px' }}>Đấu Trực Tuyến</span>
              </span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full" style={{ fontSize: '16px' }}>
                Thắng {onlineWinRate}%
              </span>
            </div>
            <div className="grid grid-cols-3 text-center text-xs font-bold gap-1 bg-amber-50 p-2 rounded-xl">
              <div className="text-emerald-700" style={{ fontSize: '15px' }}>Thắng: {stats.onlineWins}</div>
              <div className="text-rose-700" style={{ fontSize: '15px' }}>Thua: {stats.onlineLosses}</div>
              <div className="text-amber-700" style={{ fontSize: '15px' }}>Hòa: {stats.onlineDraws}</div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-5 flex justify-between items-center pt-3 border-t border-amber-200">
          <button
            onClick={onResetStats}
            className="text-xs text-rose-700 hover:text-rose-900 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span style={{ fontSize: '16px' }}>Đặt lại thống kê</span>
          </button>

          <button
            onClick={onClose}
            style={{ fontSize: '18px' }}
            className="px-5 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl font-bold text-xs shadow-md cursor-pointer transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

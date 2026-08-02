import React, { useState } from 'react';
import { OnlineRoomState } from '../types';
import { Globe, Users, Copy, Check, Plus, ArrowRight, RefreshCw, Clock, ShieldAlert, Lock, Unlock } from 'lucide-react';

interface OnlineRoomModalProps {
  roomState: OnlineRoomState | null;
  playerName: string;
  setPlayerName: (name: string) => void;
  onCreateRoom: (options: {
    roomName: string;
    timePerTurn: number;
    isPublic: boolean;
    ruleBlockedEnds: boolean;
  }) => void;
  onJoinRoom: (code: string) => void;
  onRefreshPublicRooms: () => void;
  onLeaveRoom?: () => void;
  publicRooms: {
    id: string;
    name: string;
    playersCount: number;
    status: string;
    timePerTurn: number;
    hostName: string;
  }[];
  isConnected: boolean;
  errorMsg: string | null;
}

export const OnlineRoomModal: React.FC<OnlineRoomModalProps> = ({
  roomState,
  playerName,
  setPlayerName,
  onCreateRoom,
  onJoinRoom,
  onRefreshPublicRooms,
  onLeaveRoom,
  publicRooms,
  isConnected,
  errorMsg,
}) => {
  const [activeTab, setActiveTab] = useState<'join' | 'create' | 'public'>('join');
  const [joinCode, setJoinCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  // Room Creation Form state
  const [roomName, setRoomName] = useState(`Phòng cờ của ${playerName}`);
  const [timePerTurn, setTimePerTurn] = useState(30);
  const [isPublic, setIsPublic] = useState(true);
  const [ruleBlockedEnds, setRuleBlockedEnds] = useState(false);

  const handleCopyCode = () => {
    if (!roomState?.id) return;
    navigator.clipboard.writeText(roomState.id);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (!isConnected) {
    return (
      <div className="bg-amber-100 border border-amber-300 rounded-2xl p-6 text-center max-w-md mx-auto my-6 shadow-md">
        <div className="w-12 h-12 bg-amber-200 text-amber-800 rounded-full flex items-center justify-center mx-auto mb-3 animate-spin">
          <RefreshCw className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-amber-950 mb-1">Đang kết nối Máy Chủ Trực Tuyến...</h3>
        <p className="text-xs text-amber-800">Vui lòng chờ trong giây lát để hệ thống khởi tạo kênh truyền Firebase.</p>
      </div>
    );
  }

  // If already in a room, show room header card
  if (roomState) {
    return (
      <div className="bg-amber-100/90 border border-amber-300 rounded-2xl p-4 max-w-2xl mx-auto my-3 shadow-md">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-800 uppercase px-2 py-0.5 bg-amber-200 rounded-full">
                Mã Phòng Trực Tuyến
              </span>
              {roomState.isPublic ? (
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Unlock className="w-3 h-3" /> Công khai
                </span>
              ) : (
                <span className="text-xs font-semibold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Riêng tư
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black text-amber-950 tracking-wider font-mono mt-1 flex items-center gap-2">
              {roomState.id}
              <button
                onClick={handleCopyCode}
                className="p-1.5 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 border border-amber-300 transition-colors cursor-pointer text-xs flex items-center gap-1 font-sans"
                title="Sao chép mã phòng"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCode ? 'Đã chép!' : 'Sao chép'}</span>
              </button>
            </h2>
          </div>

          {/* Players in Room & Leave Room Button */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 text-xs font-bold text-amber-900 bg-amber-50/90 px-3 py-2 rounded-xl border border-amber-200">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>X: {roomState.players.X?.name || 'Đang chờ...'}</span>
              </div>
              <span className="text-amber-400">|</span>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${roomState.players.O ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                <span>O: {roomState.players.O?.name || 'Đang chờ...'}</span>
              </div>
            </div>

            {onLeaveRoom && (
              <button
                onClick={onLeaveRoom}
                className="px-3 py-2 text-xs font-bold text-rose-800 bg-rose-100 hover:bg-rose-200 border border-rose-300 rounded-xl transition-all cursor-pointer shadow-xs"
                title="Thoát khỏi phòng cờ này"
              >
                Rời phòng
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-50/95 border border-amber-200 rounded-2xl p-5 max-w-xl mx-auto my-4 shadow-lg backdrop-blur-md">
      {/* Name Setup */}
      <div className="mb-4">
        <label className="block text-xs font-bold text-amber-900 mb-1">Tên Người Chơi Của Bạn:</label>
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value.slice(0, 20))}
          placeholder="Nhập tên hiển thị..."
          className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl font-bold text-amber-950 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-sm"
        />
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-rose-100 border border-rose-300 text-rose-900 rounded-xl text-xs font-bold">
          {errorMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-amber-200 mb-4 text-xs font-bold">
        <button
          onClick={() => setActiveTab('join')}
          className={`pb-2 px-3 border-b-2 transition-all cursor-pointer ${
            activeTab === 'join'
              ? 'border-amber-800 text-amber-950 font-extrabold'
              : 'border-transparent text-amber-800/70 hover:text-amber-950'
          }`}
        >
          Vào Bằng Mã Phòng
        </button>
        <button
          onClick={() => setActiveTab('create')}
          className={`pb-2 px-3 border-b-2 transition-all cursor-pointer ${
            activeTab === 'create'
              ? 'border-amber-800 text-amber-950 font-extrabold'
              : 'border-transparent text-amber-800/70 hover:text-amber-950'
          }`}
        >
          Tạo Phòng Mới
        </button>
        <button
          onClick={() => {
            setActiveTab('public');
            onRefreshPublicRooms();
          }}
          className={`pb-2 px-3 border-b-2 transition-all cursor-pointer ${
            activeTab === 'public'
              ? 'border-amber-800 text-amber-950 font-extrabold'
              : 'border-transparent text-amber-800/70 hover:text-amber-950'
          }`}
        >
          Danh Sách Phòng Mở
        </button>
      </div>

      {/* Tab Content: Join Room */}
      {activeTab === 'join' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-amber-800 font-medium">
            Nhập mã gồm 6 chữ số từ bạn bè của bạn để tham gia phòng chơi ngay lập tức:
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={6}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ''))}
              placeholder="VD: 889922"
              className="flex-1 px-4 py-2.5 bg-white border border-amber-300 rounded-xl text-center font-mono text-xl font-bold tracking-widest text-amber-950 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
            <button
              onClick={() => onJoinRoom(joinCode)}
              disabled={joinCode.length !== 6}
              className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl font-bold shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 transition-all text-sm"
            >
              <span>Vào Phòng</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tab Content: Create Room */}
      {activeTab === 'create' && (
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-bold text-amber-900 mb-1">Tên Phòng:</label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-sm font-semibold text-amber-950 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-amber-900 mb-1">Thời gian mỗi nước:</label>
              <select
                value={timePerTurn}
                onChange={(e) => setTimePerTurn(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-amber-950 focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value={15}>15 Giây</option>
                <option value={30}>30 Giây (Khuyên dùng)</option>
                <option value={60}>60 Giây</option>
                <option value={0}>Không giới hạn</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-900 mb-1">Chế độ hiển thị:</label>
              <select
                value={isPublic ? 'public' : 'private'}
                onChange={(e) => setIsPublic(e.target.value === 'public')}
                className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-amber-950 focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="public">Công khai (Mọi người có thể thấy)</option>
                <option value="private">Riêng tư (Chỉ vào bằng mã)</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-bold text-amber-900 cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={ruleBlockedEnds}
              onChange={(e) => setRuleBlockedEnds(e.target.checked)}
              className="accent-amber-800 w-4 h-4 rounded cursor-pointer"
            />
            <ShieldAlert className="w-4 h-4 text-amber-700" />
            <span>Áp dụng luật "Chặn 2 đầu không thắng"</span>
          </label>

          <button
            onClick={() => onCreateRoom({ roomName, timePerTurn, isPublic, ruleBlockedEnds })}
            className="w-full py-3 bg-amber-700 hover:bg-amber-800 text-white rounded-xl font-bold shadow-md cursor-pointer flex items-center justify-center gap-2 transition-all mt-2 text-sm"
          >
            <Plus className="w-5 h-5" />
            <span>Tạo Phòng & Lấy Mã</span>
          </button>
        </div>
      )}

      {/* Tab Content: Public Rooms */}
      {activeTab === 'public' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900">Danh Sách Phòng Đang Chờ:</span>
            <button
              onClick={onRefreshPublicRooms}
              className="text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer bg-amber-200/60 px-2.5 py-1 rounded-lg"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Làm mới</span>
            </button>
          </div>

          {publicRooms.length === 0 ? (
            <div className="text-center py-6 bg-amber-100/60 rounded-xl border border-amber-200 text-xs text-amber-800">
              Hiện chưa có phòng công khai nào. Hãy tạo phòng mới để bắt đầu thách đấu!
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              {publicRooms.map((room) => (
                <div
                  key={room.id}
                  className="flex items-center justify-between p-3 bg-white border border-amber-200 rounded-xl hover:border-amber-400 transition-all shadow-2xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-amber-950">{room.name}</span>
                      <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded-md">
                        #{room.id}
                      </span>
                    </div>
                    <div className="text-xs text-amber-800/80 flex items-center gap-3 mt-0.5">
                      <span>Chủ phòng: <b>{room.hostName}</b></span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-3 h-3" /> {room.timePerTurn ? `${room.timePerTurn}s` : 'Vô hạn'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onJoinRoom(room.id)}
                    className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors"
                  >
                    Vào Chơi
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { Send, MessageSquare, Smile, Zap } from 'lucide-react';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, type?: 'chat' | 'emoji') => void;
  playerName: string;
}

const QUICK_EMOJIS = ['😀', '😎', '😱', '🔥', '👏', '🎯', '😭', '🚀', '⭐', '🤝'];

const QUICK_PHRASES = [
  'Đánh hay lắm!',
  'Tới lượt bạn rồi!',
  'Cho xin hòa nhé?',
  'Thách đấu lại không?',
  'Suy nghĩ lâu thế?',
  'Cố lên!',
];

export const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSendMessage, playerName }) => {
  const [inputText, setInputText] = useState('');
  const [showQuickList, setShowQuickList] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim(), 'chat');
    setInputText('');
  };

  const handleQuickSend = (text: string, type: 'chat' | 'emoji') => {
    onSendMessage(text, type);
    setShowQuickList(false);
  };

  return (
    <div className="w-full bg-amber-50/90 border border-amber-200/80 rounded-2xl shadow-sm p-3 my-1 select-none flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-amber-200 pb-2 mb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
          <MessageSquare className="w-4 h-4 text-amber-800" />
          <span>Trò Chuyện</span>
        </div>
        <button
          onClick={() => setShowQuickList(!showQuickList)}
          className="text-xs font-bold text-amber-800 hover:text-amber-950 bg-amber-200/60 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
        >
          <Zap className="w-3.5 h-3.5 text-amber-700" />
          <span>Thả Nhanh</span>
        </button>
      </div>

      {/* Quick Emojis / Phrases Drawer */}
      {showQuickList && (
        <div className="bg-amber-100/90 border border-amber-300 rounded-xl p-2 mb-2 animate-in fade-in duration-150">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleQuickSend(emoji, 'emoji')}
                className="text-lg p-1.5 bg-white hover:bg-amber-200 rounded-lg shadow-2xs transition-transform active:scale-95 cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1">
            {QUICK_PHRASES.map((phrase) => (
              <button
                key={phrase}
                onClick={() => handleQuickSend(phrase, 'chat')}
                className="text-xs font-semibold px-2.5 py-1 bg-white hover:bg-amber-200 text-amber-900 rounded-lg border border-amber-200/60 cursor-pointer transition-colors"
              >
                {phrase}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message History */}
      <div
        ref={messagesContainerRef}
        className="h-28 lg:h-[360px] landscape:h-[260px] overflow-y-auto flex flex-col gap-2 pr-1 mb-2 bg-white/70 border border-amber-200/60 rounded-xl p-2.5 text-[16px]"
      >
        {messages.length === 0 ? (
          <div className="text-center text-amber-800/60 my-auto italic text-[15px]">
            Chưa có tin nhắn nào. Thả icon hoặc trò chuyện cùng đối thủ!
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.type === 'system'
                  ? 'items-center my-0.5'
                  : msg.sender === playerName
                  ? 'items-end'
                  : 'items-start'
              }`}
            >
              {msg.type === 'system' ? (
                <span className="bg-amber-200/80 text-amber-950 text-[15px] font-bold px-3 py-1 rounded-full text-center max-w-full leading-normal shadow-2xs">
                  {msg.text}
                </span>
              ) : (
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 ${
                    msg.sender === playerName
                      ? 'bg-amber-700 text-white rounded-br-none'
                      : 'bg-amber-100 text-amber-950 border border-amber-200 rounded-bl-none'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-[12px] opacity-90">{msg.sender}</span>
                    <span className="text-[11px] opacity-75">{msg.time}</span>
                  </div>
                  <p className={msg.type === 'emoji' ? 'text-3xl' : 'text-[16px] leading-relaxed font-medium'}>
                    {msg.text}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Nhập nội dung trò chuyện..."
          maxLength={120}
          className="flex-1 px-3 py-2 bg-white border border-amber-300 rounded-xl text-[16px] font-semibold text-amber-950 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl font-bold text-[15px] shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 transition-all"
        >
          <span>Gửi</span>
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;

import React from 'react';
import { HelpCircle, CheckCircle2, ShieldAlert, Sparkles, X } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative text-amber-950 max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-amber-200/60 hover:bg-amber-300 text-amber-900 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-7 h-7 text-amber-600" />
          <h2 className="text-xl font-black font-serif">Luật Chơi Cờ Caro (Gomoku)</h2>
        </div>

        <div className="space-y-4 text-xs leading-relaxed text-amber-900/90 font-medium">
          {/* Section 1 */}
          <div className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-2xs">
            <h3 className="font-extrabold text-sm text-amber-950 flex items-center gap-1.5 mb-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Luật Thắng Cơ Bản
            </h3>
            <p style={{ fontSize: '15px' }}>
              Hai người chơi luân phiên nhau đặt quân cờ (X hoặc O) vào các ô lưới trên bàn cờ 20x20. Người chơi nào xếp được liền nhau <b>5 quân cờ cùng loại</b> theo đường ngang, đường dọc hoặc đường chéo trước sẽ chiến thắng!
            </p>
          </div>

          {/* Section 2 */}
          <div className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-2xs">
            <h3 className="font-extrabold text-sm text-amber-950 flex items-center gap-1.5 mb-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              Luật "Chặn 2 Đầu Không Thắng" (Tùy chọn)
            </h3>
            <p style={{ fontSize: '15px' }}>
              Nếu bật luật này, hàng 5 quân cờ bị đối thủ <b>chặn ở cả hai đầu</b> (hoặc chạm mép bàn cờ cả 2 đầu) sẽ <b>KHÔNG</b> tính là thắng. Chuỗi 5 phải mở ít nhất 1 đầu mới đạt chiến thắng.
            </p>
          </div>

          {/* Section 3 */}
          <div className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-2xs" style={{ fontSize: '15px' }}>
            <h3 className="font-extrabold text-sm text-amber-950 flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-4 h-4 text-amber-600" />
              Mẹo Chiến Thuật Cao Thủ
            </h3>
            <ul className="list-disc pl-4 space-y-1 mt-1 text-amber-900">
              <li>Tạo thế cờ <b>3 Mở (Open 3)</b> hoặc <b>Double 3 (Hai đường 3 cùng lúc)</b> để khiến đối thủ không thể đỡ.</li>
              <li>Tạo thế <b>4 Mở (Open 4)</b> để nắm chắc chiến thắng ở nước đi kế tiếp.</li>
              <li>Ưu tiên chiếm vị trí trung tâm bàn cờ lúc khai cuộc.</li>
              <li>Luôn chủ động quan sát để chặn các chuỗi 3, 4 tiềm năng của đối thủ.</li>
            </ul>
          </div>
        </div>

        <div className="mt-5 text-right pt-3 border-t border-amber-200">
          <button
            onClick={onClose}
            style={{ fontSize: '16px' }}
            className="px-6 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl font-bold text-xs shadow-md cursor-pointer transition-colors"
          >
            Đã Đã Hiểu
          </button>
        </div>
      </div>
    </div>
  );
};

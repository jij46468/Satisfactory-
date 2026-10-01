import React from 'react';
import { PrecisionMode, LayoutStyle } from '../types';
import { Sparkles, History, RotateCcw, ChevronDown, Layers, Star } from 'lucide-react';

interface HeaderProps {
  precision: PrecisionMode;
  onPrecisionChange: (p: PrecisionMode) => void;
  onReset: () => void;
  onOpenPresets: () => void;
  onOpenHistory: () => void;
  historyCount: number;
  bookmarkedCount?: number;
  layoutStyle: LayoutStyle;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  precision,
  onPrecisionChange,
  onReset,
  onOpenPresets,
  onOpenHistory,
  historyCount,
  bookmarkedCount = 0,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-md select-none">
      {/* Main Bar */}
      <div className="max-w-md mx-auto px-3.5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-sm shadow-purple-900/40 shrink-0">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight tracking-tight text-white flex items-center gap-1.5">
              連立・多段方程式 計算機
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">Auto System & Chain Equation Solver</p>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-1.5">
          {/* Precision Selector */}
          <div className="relative">
            <select
              id="precision-selector"
              aria-label="小数点桁数"
              value={precision}
              onChange={(e) => onPrecisionChange(e.target.value as PrecisionMode)}
              className="appearance-none bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold px-2 py-1.5 pr-5 rounded-xl border border-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
            >
              <option value="auto">自動</option>
              <option value="0">整数</option>
              <option value="1">1桁</option>
              <option value="2">2桁</option>
              <option value="3">3桁</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Presets Button */}
          <button
            type="button"
            id="open-presets-button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenPresets();
            }}
            aria-label="プリセットを開く"
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-amber-400 hover:text-amber-300 border border-slate-700 transition-all flex items-center justify-center relative cursor-pointer"
            title="例題・プリセット"
          >
            <Sparkles className="w-4 h-4 pointer-events-none" />
          </button>

          {/* History & Bookmarks Button */}
          <button
            type="button"
            id="open-history-button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenHistory();
            }}
            aria-label="計算履歴・ブックマークを開く"
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white border border-slate-700 transition-all flex items-center justify-center relative cursor-pointer"
            title="計算履歴 & ブックマーク"
          >
            <History className="w-4 h-4 pointer-events-none" />
            {bookmarkedCount > 0 ? (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-[9px] font-bold text-slate-950 flex items-center justify-center shadow-xs pointer-events-none">
                <Star className="w-2.5 h-2.5 fill-slate-950" />
              </span>
            ) : historyCount > 0 ? (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-purple-500 text-[9px] font-bold text-white flex items-center justify-center pointer-events-none">
                {historyCount > 9 ? '9+' : historyCount}
              </span>
            ) : null}
          </button>

          {/* Reset Button */}
          <button
            type="button"
            id="reset-all-button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onReset();
            }}
            aria-label="全クリア（空欄）"
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-rose-950/40 active:scale-95 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-800/60 transition-all flex items-center justify-center cursor-pointer"
            title="式と値をクリアして空欄にする"
          >
            <RotateCcw className="w-4 h-4 pointer-events-none" />
          </button>
        </div>
      </div>
    </header>
  );
});

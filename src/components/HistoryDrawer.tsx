import React, { useState, useMemo } from 'react';
import { CalculationHistoryEntry } from '../types';
import {
  X,
  History,
  Trash2,
  Copy,
  Check,
  RotateCcw,
  Star,
  Search,
  FileText,
  Tag,
  Calendar,
} from 'lucide-react';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: CalculationHistoryEntry[];
  onRestore: (entry: CalculationHistoryEntry) => void;
  onClear: () => void;
  onToggleBookmark: (id: string) => void;
  onDeleteEntry: (id: string) => void;
  onUpdateNote?: (id: string, note: string) => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onRestore,
  onClear,
  onToggleBookmark,
  onDeleteEntry,
  onUpdateNote,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'bookmarked'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState('');

  const filteredHistory = useMemo(() => {
    return history.filter((entry) => {
      // Bookmark filter
      if (filterTab === 'bookmarked' && !entry.isBookmarked) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = entry.title.toLowerCase().includes(q);
        const inSummary = entry.summary.toLowerCase().includes(q);
        const inDetails = entry.details.toLowerCase().includes(q);
        const inNote = (entry.note || '').toLowerCase().includes(q);
        const inEquations = entry.snapshot?.equations
          ?.some((eq) => eq.rawText.toLowerCase().includes(q)) ?? false;
        const inMemos = Object.values(entry.snapshot?.variableMemos || {})
          .some((m) => String(m).toLowerCase().includes(q));

        return inTitle || inSummary || inDetails || inNote || inEquations || inMemos;
      }
      return true;
    });
  }, [history, filterTab, searchQuery]);

  const bookmarkCount = useMemo(() => {
    return history.filter((h) => h.isBookmarked).length;
  }, [history]);

  if (!isOpen) return null;

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleStartEditNote = (entry: CalculationHistoryEntry) => {
    setEditingNoteId(entry.id);
    setTempNote(entry.note || '');
  };

  const handleSaveNote = (id: string) => {
    if (onUpdateNote) {
      onUpdateNote(id, tempNote.trim());
    }
    setEditingNoteId(null);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs transition-opacity animate-in fade-in select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-slate-900 border border-slate-800 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-925">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                計算履歴 & ブックマーク
              </h2>
              <p className="text-[10px] text-slate-400">
                自動保存された計算結果とお気に入り
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {history.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClear();
                }}
                className="text-xs text-rose-400 hover:text-rose-300 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-rose-950/40 border border-slate-750 transition-colors cursor-pointer"
                title="すべての履歴を消去"
              >
                全消去
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="p-3 bg-slate-950/90 border-b border-slate-800 space-y-2">
          <div className="flex items-center gap-2">
            {/* Filter Tabs */}
            <div className="flex bg-slate-900 p-0.5 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setFilterTab('all');
                }}
                className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                  filterTab === 'all'
                    ? 'bg-purple-600 text-white shadow-xs font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>すべて</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
                  {history.length}
                </span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setFilterTab('bookmarked');
                }}
                className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                  filterTab === 'bookmarked'
                    ? 'bg-amber-600 text-white shadow-xs font-bold'
                    : 'text-amber-400/80 hover:text-amber-300'
                }`}
              >
                <Star className="w-3.5 h-3.5 fill-amber-400/80 text-amber-400" />
                <span>ブックマーク</span>
                {bookmarkCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
                    {bookmarkCount}
                  </span>
                )}
              </button>
            </div>

            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="式・変数・メモで検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* History Items List */}
        <div className="p-3.5 space-y-3 overflow-y-auto flex-1 max-h-[58vh]">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs space-y-2">
              {filterTab === 'bookmarked' ? (
                <>
                  <Star className="w-8 h-8 text-slate-600 mx-auto stroke-1" />
                  <p>ブックマークされた計算結果はありません。</p>
                  <p className="text-[11px] text-slate-600">
                    履歴カードの「★」アイコンをタップすると、重要な計算をブックマークできます。
                  </p>
                </>
              ) : searchQuery ? (
                <>
                  <Search className="w-8 h-8 text-slate-600 mx-auto stroke-1" />
                  <p>「{searchQuery}」に一致する履歴は見つかりませんでした。</p>
                </>
              ) : (
                <>
                  <History className="w-8 h-8 text-slate-600 mx-auto stroke-1" />
                  <p>まだ計算履歴がありません。</p>
                  <p className="text-[11px] text-slate-600">
                    方程式や数値を入力すると自動的にここに記録されます。
                  </p>
                </>
              )}
            </div>
          ) : (
            filteredHistory.map((entry) => {
              const dateStr = new Date(entry.timestamp).toLocaleDateString([], {
                month: 'numeric',
                day: 'numeric',
              });
              const timeStr = new Date(entry.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              const memos = entry.snapshot?.variableMemos || {};
              const memoKeys = Object.keys(memos).filter((k) => memos[k]);
              const isEditingThisNote = editingNoteId === entry.id;

              return (
                <div
                  key={entry.id}
                  className={`bg-slate-950 border rounded-2xl p-3.5 space-y-2.5 transition-all relative ${
                    entry.isBookmarked
                      ? 'border-amber-500/40 bg-gradient-to-br from-slate-950 via-slate-950 to-amber-950/20 shadow-xs'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Top: Title, Date, Bookmark button, Delete button */}
                  <div className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="font-bold text-slate-200 truncate text-xs sm:text-sm">
                        {entry.title}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1 whitespace-nowrap">
                        <Calendar className="w-3 h-3 text-slate-600" />
                        {dateStr} {timeStr}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Bookmark toggle button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onToggleBookmark(entry.id);
                        }}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer active:scale-95 ${
                          entry.isBookmarked
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 hover:bg-amber-500/30'
                            : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-amber-400 hover:border-amber-500/30'
                        }`}
                        title={entry.isBookmarked ? 'ブックマークを解除' : 'ブックマークに登録'}
                      >
                        <Star
                          className={`w-3.5 h-3.5 pointer-events-none ${
                            entry.isBookmarked ? 'fill-amber-400' : ''
                          }`}
                        />
                      </button>

                      {/* Delete single entry */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onDeleteEntry(entry.id);
                        }}
                        className="p-1.5 rounded-lg bg-slate-900 text-slate-500 hover:text-rose-400 border border-slate-800 hover:border-rose-900/50 transition-colors cursor-pointer"
                        title="この履歴を削除"
                      >
                        <Trash2 className="w-3.5 h-3.5 pointer-events-none" />
                      </button>
                    </div>
                  </div>

                  {/* Summary / Result Value Display */}
                  <div className="bg-slate-900/90 rounded-xl p-2.5 font-mono text-xs text-purple-200 break-words leading-relaxed border border-slate-800">
                    {entry.summary}
                  </div>

                  {/* Equations List Preview */}
                  {entry.snapshot?.equations && entry.snapshot.equations.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {entry.snapshot.equations.map((eq, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-slate-900 text-slate-300 font-mono border border-slate-850"
                        >
                          {eq.rawText}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Variable Memos Preview (if any) */}
                  {memoKeys.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] bg-slate-900/60 p-2 rounded-xl border border-slate-855">
                      <Tag className="w-3 h-3 text-purple-400 shrink-0" />
                      <span className="text-slate-500 text-[10px]">変数メモ:</span>
                      {memoKeys.map((k) => (
                        <span
                          key={k}
                          className="px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-800/40 text-purple-300 text-[10px] font-mono"
                        >
                          {k}: {memos[k]}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Custom History Entry Note */}
                  <div className="text-xs">
                    {isEditingThisNote ? (
                      <div className="flex items-center gap-1.5 mt-1">
                        <input
                          type="text"
                          placeholder="この履歴にメモを付ける（例: 8月ロット計算）"
                          value={tempNote}
                          onChange={(e) => setTempNote(e.target.value)}
                          className="flex-1 bg-slate-900 border border-purple-500 rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveNote(entry.id);
                            if (e.key === 'Escape') setEditingNoteId(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSaveNote(entry.id);
                          }}
                          className="px-2 py-1 bg-purple-600 text-white rounded-lg font-bold text-xs cursor-pointer"
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingNoteId(null)}
                          className="px-2 py-1 bg-slate-800 text-slate-400 rounded-lg text-xs cursor-pointer"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        {entry.note ? (
                          <div
                            onClick={() => handleStartEditNote(entry)}
                            className="flex items-center gap-1 text-amber-300/90 hover:text-amber-200 cursor-pointer bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded-lg"
                            title="クリックしてメモを編集"
                          >
                            <FileText className="w-3 h-3 text-amber-400" />
                            <span>{entry.note}</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleStartEditNote(entry);
                            }}
                            className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 py-0.5 cursor-pointer"
                          >
                            <FileText className="w-3 h-3 pointer-events-none" />
                            <span className="pointer-events-none">＋ 履歴にメモを追記</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions: Copy and Restore */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-900">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCopy(entry.id, entry.summary);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs flex items-center gap-1 border border-slate-800 cursor-pointer active:scale-95"
                    >
                      {copiedId === entry.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400 pointer-events-none" />
                          <span className="text-emerald-400 font-bold pointer-events-none">コピー済</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                          <span className="pointer-events-none">コピー</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRestore(entry);
                        onClose();
                      }}
                      className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs flex items-center gap-1.5 font-bold shadow-xs transition-colors cursor-pointer active:scale-95"
                    >
                      <RotateCcw className="w-3.5 h-3.5 pointer-events-none" />
                      <span className="pointer-events-none">この式と数値を再読込</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

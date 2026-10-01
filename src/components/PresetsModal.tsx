import React, { useState } from 'react';
import { PresetItem } from '../types';
import { DEFAULT_PRESETS } from '../utils/presets';
import { X, Sparkles, Trash2, BookmarkPlus, Tag } from 'lucide-react';

interface PresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset: (preset: PresetItem) => void;
  customPresets: PresetItem[];
  onSaveCurrentAsPreset: (title: string, category: PresetItem['category']) => void;
  onDeleteCustomPreset: (id: string) => void;
}

export const PresetsModal: React.FC<PresetsModalProps> = ({
  isOpen,
  onClose,
  onSelectPreset,
  customPresets,
  onSaveCurrentAsPreset,
  onDeleteCustomPreset,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'math' | 'business' | 'custom'>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<PresetItem['category']>('custom');

  const allPresets = [...customPresets, ...DEFAULT_PRESETS];
  const filtered = activeTab === 'all'
    ? allPresets
    : activeTab === 'custom'
    ? customPresets
    : allPresets.filter(p => p.category === activeTab);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onSaveCurrentAsPreset(newTitle.trim(), newCategory);
    setNewTitle('');
    setIsSaving(false);
    setActiveTab('custom');
  };

  const categoryLabels: Record<string, string> = {
    all: 'すべて',
    math: '🔢 数学・連立方程式',
    business: '💼 損益・為替・実務',
    custom: '⭐ マイ保存',
  };

  if (!isOpen) return null;

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
        className="bg-slate-900 border border-slate-800 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-925">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">方程式プリセット & テンプレート</h2>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 pointer-events-none" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-850 overflow-x-auto flex gap-1.5 no-scrollbar">
          {(['all', 'math', 'business', 'custom'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveTab(cat);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === cat
                  ? 'bg-purple-600 text-white font-bold shadow-xs'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {categoryLabels[cat]}
            </button>
          ))}
        </div>

        {/* Preset List */}
        <div className="p-4 space-y-2.5 overflow-y-auto flex-1 max-h-[50vh]">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              該当するプリセットがありません
            </div>
          ) : (
            filtered.map((p) => {
              const isCustom = customPresets.some(c => c.id === p.id);
              const memoEntries = Object.entries(p.variableMemos || {}).filter(([_, m]) => m);

              return (
                <div
                  key={p.id}
                  className="bg-slate-950/80 hover:bg-slate-850/90 border border-slate-800/85 hover:border-purple-500/50 rounded-2xl p-3.5 transition-all flex items-start justify-between gap-3 group text-left cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelectPreset(p);
                    onClose();
                  }}
                >
                  <div className="flex-1 min-w-0 space-y-1.5 pointer-events-none">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-100 truncate group-hover:text-purple-300 transition-colors">
                        {p.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2">{p.description}</p>
                    
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {p.equations.map((eq, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 font-mono border border-slate-800">
                          {eq}
                        </span>
                      ))}
                    </div>

                    {/* Variable Memos Preview */}
                    {memoEntries.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        <Tag className="w-2.5 h-2.5 text-purple-400" />
                        {memoEntries.slice(0, 3).map(([k, v]) => (
                          <span key={k} className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950/60 border border-purple-800/40 text-purple-300 font-mono">
                            {k}: {v}
                          </span>
                        ))}
                        {memoEntries.length > 3 && (
                          <span className="text-[9px] text-slate-500">+{memoEntries.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {isCustom && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDeleteCustomPreset(p.id);
                      }}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-950/30 transition-colors shrink-0 cursor-pointer"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4 pointer-events-none" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Save current state footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950">
          {isSaving ? (
            <form onSubmit={handleSave} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="プリセット名を入力 (例: 3段ロット利益計算)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2 flex-1 focus:outline-none focus:border-purple-500"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-3 py-2 rounded-xl disabled:opacity-40 shadow-xs cursor-pointer"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => setIsSaving(false)}
                  className="bg-slate-800 text-slate-400 text-xs px-2.5 py-2 rounded-xl cursor-pointer"
                >
                  取消
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsSaving(true);
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-purple-300 border border-slate-700 hover:border-purple-500/50 font-semibold text-xs transition-colors cursor-pointer"
            >
              <BookmarkPlus className="w-4 h-4 pointer-events-none" />
              <span className="pointer-events-none">現在の方程式セット（変数メモ含む）をマイ保存</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react';
import {
  PrecisionMode,
  LayoutStyle,
  SystemEquationConfig,
  PresetItem,
  CalculationHistoryEntry,
} from './types';
import { formatValue } from './utils/calculator';
import { solveSystemOfEquations } from './utils/systemSolver';
import { Header } from './components/Header';
import { SystemEquationsSection } from './components/SystemEquationsSection';
import { OfflineBanner } from './components/OfflineBanner';
import { Copy, Check, RotateCcw, History, Star, Sparkles, Globe } from 'lucide-react';

// Lazy load non-critical modal components to minimize initial JS bundle size and accelerate startup
const PresetsModal = React.lazy(() =>
  import('./components/PresetsModal').then((m) => ({ default: m.PresetsModal }))
);
const HistoryDrawer = React.lazy(() =>
  import('./components/HistoryDrawer').then((m) => ({ default: m.HistoryDrawer }))
);
const GitHubPagesModal = React.lazy(() =>
  import('./components/GitHubPagesModal').then((m) => ({ default: m.GitHubPagesModal }))
);

// Preload helper for instant modal opening
const preloadModals = () => {
  import('./components/PresetsModal');
  import('./components/HistoryDrawer');
  import('./components/GitHubPagesModal');
};

// Default initial state: Empty equations
const INITIAL_SYSTEM_CONFIG: SystemEquationConfig = {
  equations: [
    { id: 'eq-1', rawText: '', isEnabled: true },
  ],
  userOverrides: {},
  variableMemos: {},
  proportionalBalance: true,
};

export default function App() {
  // Precision Setting
  const [precision, setPrecision] = useState<PrecisionMode>(() => {
    try {
      const saved = localStorage.getItem('system_calc_precision');
      return (saved as PrecisionMode) || 'auto';
    } catch {
      return 'auto';
    }
  });

  // Display Layout Style Setting
  const [layoutStyle, setLayoutStyle] = useState<LayoutStyle>(() => {
    try {
      const saved = localStorage.getItem('system_calc_layout_style');
      return (saved as LayoutStyle) || 'standard';
    } catch {
      return 'standard';
    }
  });

  // System Equations State (Defaults to empty input)
  const [systemConfig, setSystemConfig] = useState<SystemEquationConfig>(() => {
    try {
      const saved = localStorage.getItem('system_equation_config_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.equations)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_SYSTEM_CONFIG;
  });

  // Modals & History State
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isGithubGuideOpen, setIsGithubGuideOpen] = useState(false);
  const [customPresets, setCustomPresets] = useState<PresetItem[]>(() => {
    try {
      const saved = localStorage.getItem('system_custom_presets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [history, setHistory] = useState<CalculationHistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem('system_history_entries');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [copiedAll, setCopiedAll] = useState(false);
  const historyDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('system_calc_precision', precision);
    } catch (e) {
      console.error(e);
    }
  }, [precision]);

  useEffect(() => {
    try {
      localStorage.setItem('system_calc_layout_style', layoutStyle);
    } catch (e) {
      console.error(e);
    }
  }, [layoutStyle]);

  useEffect(() => {
    try {
      localStorage.setItem('system_equation_config_v2', JSON.stringify(systemConfig));
    } catch (e) {
      console.error(e);
    }
  }, [systemConfig]);

  useEffect(() => {
    try {
      localStorage.setItem('system_custom_presets', JSON.stringify(customPresets));
    } catch (e) {
      console.error(e);
    }
  }, [customPresets]);

  useEffect(() => {
    try {
      localStorage.setItem('system_history_entries', JSON.stringify(history));
    } catch {
      // Storage quota exceeded fallback: prune oldest half of history and retry
      try {
        const pruned = history.slice(0, 20);
        localStorage.setItem('system_history_entries', JSON.stringify(pruned));
      } catch {
        // Silently fail without crashing UI if private mode or storage fully disabled
      }
    }
  }, [history]);

  // Record history helper (debounced)
  const recordHistory = useCallback((summary: string, details: string, snapshot: SystemEquationConfig) => {
    if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
    historyDebounceRef.current = setTimeout(() => {
      const memos = snapshot.variableMemos || {};
      const memoLabels = Object.keys(memos)
        .filter((k) => memos[k])
        .map((k) => `${k}:${memos[k]}`);

      const title = memoLabels.length > 0
        ? `連立計算 (${memoLabels.slice(0, 2).join(', ')})`
        : '連立方程式・チェーン計算';

      const newEntry: CalculationHistoryEntry = {
        id: `hist-${Date.now()}`,
        timestamp: Date.now(),
        title,
        summary,
        details,
        snapshot: JSON.parse(JSON.stringify(snapshot)),
        isBookmarked: false,
      };

      setHistory((prev) => [newEntry, ...prev.slice(0, 49)]); // Keep up to 50 entries
    }, 1200);
  }, []);

  // Reset to empty
  const handleResetAll = useCallback(() => {
    setSystemConfig({
      equations: [{ id: `eq-${Date.now()}`, rawText: '', isEnabled: true }],
      userOverrides: {},
      variableMemos: {},
      proportionalBalance: true,
    });
  }, []);

  // Presets management
  const handleSelectPreset = useCallback((preset: PresetItem) => {
    setSystemConfig({
      equations: preset.equations.map((eq, idx) => ({
        id: `sys-preset-${Date.now()}-${idx}`,
        rawText: eq,
        isEnabled: true,
      })),
      userOverrides: preset.userOverrides || {},
      variableMemos: preset.variableMemos || {},
      proportionalBalance: true,
    });
  }, []);

  const handleSaveCurrentAsPreset = useCallback((title: string, category: PresetItem['category']) => {
    const validEquations = systemConfig.equations
      .map((e) => e.rawText.trim())
      .filter((t) => t.length > 0);

    const newPreset: PresetItem = {
      id: `custom-preset-${Date.now()}`,
      title,
      description: validEquations.join(' / ') || '連立方程式セット',
      category,
      equations: validEquations,
      userOverrides: systemConfig.userOverrides,
      variableMemos: systemConfig.variableMemos || {},
    };
    setCustomPresets((prev) => [newPreset, ...prev]);
  }, [systemConfig]);

  const handleDeleteCustomPreset = useCallback((id: string) => {
    setCustomPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // History Actions
  const handleRestoreHistory = useCallback((entry: CalculationHistoryEntry) => {
    if (entry.snapshot) {
      setSystemConfig(JSON.parse(JSON.stringify(entry.snapshot)));
    }
  }, []);

  const handleToggleBookmark = useCallback((id: string) => {
    setHistory((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, isBookmarked: !entry.isBookmarked } : entry
      )
    );
  }, []);

  const handleDeleteHistoryEntry = useCallback((id: string) => {
    setHistory((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const handleUpdateHistoryNote = useCallback((id: string, note: string) => {
    setHistory((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, note } : entry))
    );
  }, []);

  // Copy all results (including variable memos if present)
  const handleCopySummary = useCallback(() => {
    const res = solveSystemOfEquations(systemConfig);
    const memos = systemConfig.variableMemos || {};
    const text = Object.entries(res.variables)
      .map(([k, v]) => {
        const memo = memos[k];
        const formatted = formatValue(v, precision);
        return memo ? `${k} (${memo}) = ${formatted}` : `${k} = ${formatted}`;
      })
      .join('\n');

    if (text) {
      navigator.clipboard?.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  }, [systemConfig, precision]);

  const bookmarkCount = useMemo(() => {
    return history.filter((h) => h.isBookmarked).length;
  }, [history]);

  const handleConfigChange = useCallback((newCfg: SystemEquationConfig) => {
    setSystemConfig(newCfg);
    const res = solveSystemOfEquations(newCfg);
    const memos = newCfg.variableMemos || {};
    const summaryStr = Object.entries(res.variables)
      .map(([k, v]) => {
        const m = memos[k];
        const valStr = formatValue(v, precision);
        return m ? `${k}(${m})=${valStr}` : `${k}=${valStr}`;
      })
      .join(', ');
    if (summaryStr) {
      recordHistory(summaryStr, '連立方程式計算', newCfg);
    }
  }, [precision, recordHistory]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-purple-600 selection:text-white pb-12">
      {/* Header */}
      <Header
        precision={precision}
        onPrecisionChange={setPrecision}
        onReset={handleResetAll}
        onOpenPresets={() => {
          preloadModals();
          setIsPresetsOpen(true);
        }}
        onOpenHistory={() => {
          preloadModals();
          setIsHistoryOpen(true);
        }}
        onOpenGithubGuide={() => {
          preloadModals();
          setIsGithubGuideOpen(true);
        }}
        historyCount={history.length}
        bookmarkedCount={bookmarkCount}
        layoutStyle={layoutStyle}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-md w-full mx-auto p-3 sm:p-4 space-y-4">
        <div className="animate-in fade-in duration-200">
          <SystemEquationsSection
            config={systemConfig}
            onChangeConfig={handleConfigChange}
            precision={precision}
            onSelectVariableForHistory={(title, summary) =>
              recordHistory(summary, title, systemConfig)
            }
          />
        </div>

        {/* Bottom Actions Bar */}
        <div className="pt-2 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCopySummary();
              }}
              className="flex-1 py-2.5 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] border border-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              {copiedAll ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400 pointer-events-none" />
                  <span className="text-emerald-400 font-bold pointer-events-none">全数値をコピー完了！</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-400 pointer-events-none" />
                  <span className="pointer-events-none">全結果数値をコピー</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleResetAll();
              }}
              className="py-2.5 px-3 rounded-2xl bg-slate-900 hover:bg-rose-950/40 active:scale-[0.99] border border-slate-800 text-slate-400 hover:text-rose-400 text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer"
              title="すべてクリアして空欄にする"
            >
              <RotateCcw className="w-4 h-4 pointer-events-none" />
              <span className="pointer-events-none">全クリア（空欄）</span>
            </button>
          </div>

          {/* Quick Access to History & Presets Bar */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onMouseEnter={preloadModals}
              onTouchStart={preloadModals}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsHistoryOpen(true);
              }}
              className="py-2.5 px-3 rounded-2xl bg-slate-900/90 hover:bg-slate-850 active:scale-[0.99] border border-purple-500/30 hover:border-purple-500/60 text-purple-300 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <History className="w-4 h-4 text-purple-400 pointer-events-none" />
              <span className="pointer-events-none">
                履歴 & ブックマーク ({history.length})
              </span>
              {bookmarkCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold pointer-events-none flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5 fill-slate-950" />
                  {bookmarkCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onMouseEnter={preloadModals}
              onTouchStart={preloadModals}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsPresetsOpen(true);
              }}
              className="py-2.5 px-3 rounded-2xl bg-slate-900/90 hover:bg-slate-850 active:scale-[0.99] border border-amber-500/30 hover:border-amber-500/60 text-amber-300 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <Sparkles className="w-4 h-4 text-amber-400 pointer-events-none" />
              <span className="pointer-events-none">プリセット & 保存</span>
            </button>
          </div>

          {/* GitHub Pages Deployment Guide Banner/Button */}
          <button
            type="button"
            onMouseEnter={preloadModals}
            onTouchStart={preloadModals}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsGithubGuideOpen(true);
            }}
            className="w-full mt-3 py-2.5 px-3 rounded-2xl bg-slate-900/80 hover:bg-slate-850 active:scale-[0.99] border border-sky-500/30 hover:border-sky-500/60 text-sky-300 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <Globe className="w-4 h-4 text-sky-400 pointer-events-none" />
            <span className="pointer-events-none">GitHub Pages 公開ガイド & デプロイ手順</span>
          </button>
        </div>
      </main>

      {/* Lazy-loaded Presets Modal */}
      {isPresetsOpen && (
        <Suspense fallback={null}>
          <PresetsModal
            isOpen={isPresetsOpen}
            onClose={() => setIsPresetsOpen(false)}
            onSelectPreset={handleSelectPreset}
            customPresets={customPresets}
            onSaveCurrentAsPreset={handleSaveCurrentAsPreset}
            onDeleteCustomPreset={handleDeleteCustomPreset}
          />
        </Suspense>
      )}

      {/* Lazy-loaded History Drawer */}
      {isHistoryOpen && (
        <Suspense fallback={null}>
          <HistoryDrawer
            isOpen={isHistoryOpen}
            onClose={() => setIsHistoryOpen(false)}
            history={history}
            onRestore={handleRestoreHistory}
            onClear={() => setHistory([])}
            onToggleBookmark={handleToggleBookmark}
            onDeleteEntry={handleDeleteHistoryEntry}
            onUpdateNote={handleUpdateHistoryNote}
          />
        </Suspense>
      )}

      {/* Lazy-loaded GitHub Pages Deployment Guide Modal */}
      {isGithubGuideOpen && (
        <Suspense fallback={null}>
          <GitHubPagesModal
            isOpen={isGithubGuideOpen}
            onClose={() => setIsGithubGuideOpen(false)}
          />
        </Suspense>
      )}

      {/* Connectivity status banner when offline */}
      <OfflineBanner />
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { SystemEquationConfig, SystemEquationRow, PrecisionMode } from '../types';
import {
  solveSystemOfEquations,
  SYSTEM_VAR_COLORS,
  SystemSolveResult,
  detectRatioEquation,
  flipEquationCoefficients,
  parseEquationToRecipe,
  normalizeVariableValue,
} from '../utils/systemSolver';
import { formatValue } from '../utils/calculator';

// Lazy-load BomFlowchartModal on demand to keep initial JS bundle ultra lightweight
const BomFlowchartModal = React.lazy(() =>
  import('./BomFlowchartModal').then((m) => ({ default: m.BomFlowchartModal }))
);
const preloadBomFlowchart = () => {
  import('./BomFlowchartModal');
};
import {
  Plus,
  Trash2,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  Calculator,
  Copy,
  Check,
  HelpCircle,
  FileText,
  Lock,
  Tag,
  Edit3,
  ArrowLeftRight,
  Factory,
  GitBranch,
  Boxes,
  ChevronDown,
  Workflow,
} from 'lucide-react';

interface SystemEquationsSectionProps {
  config: SystemEquationConfig;
  onChangeConfig: (newConfig: SystemEquationConfig) => void;
  precision: PrecisionMode;
  onSelectVariableForHistory?: (title: string, summary: string, details: string) => void;
}

const SYSTEM_QUICK_PRESETS = [
  {
    label: '例題: 2.5A+5B=10C, 30C=20D, B=480×6',
    equations: ['2.5A + 5B = 10C', '30C = 20D', 'B = 480 * 6'],
    overrides: {},
    memos: {
      A: '主原料ロット',
      B: '添加ベース（480×6包）',
      C: '中間生成物',
      D: '最終完成ロット',
    },
    desc: '3段階連鎖・複合例題',
  },
  {
    label: '数学 2元連立 (2x + 3y = 13, 5x - y = 7)',
    equations: ['2x + 3y = 13', '5x - y = 7'],
    overrides: {},
    memos: { x: '第1未知数', y: '第2未知数' },
    desc: '2元連立1次方程式',
  },
  {
    label: '数学 3元連立 (x, y, z)',
    equations: ['x + y + z = 6', '2x - y + 3z = 9', '-x + 2y - z = -2'],
    overrides: {},
    memos: { x: '未知数X', y: '未知数Y', z: '未知数Z' },
    desc: '3変数ガウス消去法',
  },
  {
    label: '損益・原価計算 (売上 = 原価 + 利益)',
    equations: [
      '売上 = 原価 + 利益',
      '原価 = 500A + 300B',
      '利益 = 0.25 * 売上',
      'A = 120',
      'B = 80',
    ],
    overrides: {},
    memos: {
      売上: '目標販売総額',
      原価: '製造原価',
      利益: '粗利益額(25%)',
      A: '部品A個数',
      B: '部品B個数',
    },
    desc: '原価・売上・利益バランス',
  },
];

export interface CategoryPreset {
  key: string;
  label: string;
  icon: string;
  badgeClass: string;
  desc?: string;
}

export const CATEGORY_PRESETS: CategoryPreset[] = [
  { key: 'auto', label: '自動判定に戻す', icon: '🔄', badgeClass: 'bg-slate-800 text-slate-300 border-slate-700', desc: 'レシピツリーから自動判定' },
  { key: 'product', label: '最終製品', icon: '🎯', badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', desc: '生産目標となる完成品' },
  { key: 'intermediate', label: '中間生産物', icon: '⚙️', badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40', desc: '他の工程で消費される部品・素材' },
  { key: 'raw', label: '基礎原料', icon: '⛏️', badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40', desc: '採掘やインゴット等の最下層素材' },
  { key: 'byproduct', label: '副産物', icon: '♻️', badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40', desc: '工程から副次的に排出される物' },
  { key: 'fuel', label: '燃料・電力', icon: '⚡', badgeClass: 'bg-violet-500/20 text-violet-300 border-violet-500/40', desc: 'エネルギー・触媒・消耗品' },
];

export const SystemEquationsSection: React.FC<SystemEquationsSectionProps> = React.memo(({
  config,
  onChangeConfig,
  precision,
}) => {
  const [copiedVar, setCopiedVar] = useState<string | null>(null);
  const [showBulkModal, setShowBulkModal] = useState<boolean>(false);
  const [bulkText, setBulkText] = useState<string>('');
  const [showMemosModal, setShowMemosModal] = useState<boolean>(false);

  // Variable Category Management State
  const [categoryPopoverVar, setCategoryPopoverVar] = useState<string | null>(null);
  const [customCategoryInput, setCustomCategoryInput] = useState<string>('');
  const [showCategoriesModal, setShowCategoriesModal] = useState<boolean>(false);

  // Quick Presets Foldable Accordion State (default closed)
  const [isPresetsOpen, setIsPresetsOpen] = useState<boolean>(false);

  // BOM Flowchart Modal State
  const [showBomFlowchart, setShowBomFlowchart] = useState<boolean>(false);

  // Equation Deletion Confirmation Dialog State
  const [pendingDeleteEquation, setPendingDeleteEquation] = useState<SystemEquationRow | null>(null);

  // In-card editing of memo state
  const [editingMemoVar, setEditingMemoVar] = useState<string | null>(null);
  const [memoInputText, setMemoInputText] = useState<string>('');

  // In-card editing of variable override (preserves live typing of full-width, arithmetic expressions, commas, etc.)
  const [activeOverrideVar, setActiveOverrideVar] = useState<string | null>(null);
  const [activeOverrideText, setActiveOverrideText] = useState<string>('');

  // Solve the system with current config
  const solveResult: SystemSolveResult = useMemo(() => {
    return solveSystemOfEquations(config);
  }, [config]);

  // Color map for variables
  const varColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    solveResult.discoveredVars.forEach((v, idx) => {
      map[v] = SYSTEM_VAR_COLORS[idx % SYSTEM_VAR_COLORS.length];
    });
    return map;
  }, [solveResult.discoveredVars]);

  // Category determination helper
  const getVariableCategoryInfo = (varName: string) => {
    const manual = config.variableCategories?.[varName];
    if (manual) {
      const preset = CATEGORY_PRESETS.find((p) => p.key === manual);
      if (preset && preset.key !== 'auto') {
        return {
          key: preset.key,
          label: preset.label,
          icon: preset.icon,
          badgeClass: preset.badgeClass,
          isManual: true,
        };
      }
      return {
        key: manual,
        label: manual,
        icon: '🏷️',
        badgeClass: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
        isManual: true,
      };
    }

    // Auto determination if in recipe tree
    if (solveResult.recipeTreeData) {
      if (solveResult.recipeTreeData.rootProducts.includes(varName)) {
        return {
          key: 'product',
          label: '最終製品',
          icon: '🎯',
          badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          isManual: false,
        };
      }
      if (solveResult.recipeTreeData.intermediates.includes(varName)) {
        return {
          key: 'intermediate',
          label: '中間生産物',
          icon: '⚙️',
          badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
          isManual: false,
        };
      }
      if (solveResult.recipeTreeData.rawMaterials.includes(varName)) {
        return {
          key: 'raw',
          label: '基礎原料',
          icon: '⛏️',
          badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          isManual: false,
        };
      }
    }

    return {
      key: 'unclassified',
      label: '未分類',
      icon: '📦',
      badgeClass: 'bg-slate-800/80 text-slate-400 border-slate-700/80',
      isManual: false,
    };
  };

  const handleSetVariableCategory = (varName: string, categoryKey: string) => {
    const newCats = { ...(config.variableCategories || {}) };
    if (categoryKey === 'auto' || categoryKey.trim() === '') {
      delete newCats[varName];
    } else {
      newCats[varName] = categoryKey.trim();
    }
    onChangeConfig({ ...config, variableCategories: newCats });
  };

  // Handle single equation text change
  const handleEquationChange = (id: string, text: string) => {
    const updated = config.equations.map((eq) =>
      eq.id === id ? { ...eq, rawText: text } : eq
    );
    onChangeConfig({ ...config, equations: updated });
  };

  // Toggle equation enabled state
  const handleToggleEquation = (id: string) => {
    const updated = config.equations.map((eq) =>
      eq.id === id ? { ...eq, isEnabled: !eq.isEnabled } : eq
    );
    onChangeConfig({ ...config, equations: updated });
  };

  // Delete equation
  const handleDeleteEquation = (id: string) => {
    if (config.equations.length <= 1) return;
    const updated = config.equations.filter((eq) => eq.id !== id);
    onChangeConfig({ ...config, equations: updated });
  };

  // Add new equation row (no upper limit!)
  const handleAddEquation = () => {
    const newId = `eq-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const updated = [
      ...config.equations,
      { id: newId, rawText: '', isEnabled: true },
    ];
    onChangeConfig({ ...config, equations: updated });
  };

  // Flip coefficients for 2-variable ratio equation e.g. 30A = 20B <-> 20A = 30B
  const handleFlipCoefficients = (id: string) => {
    const updated = config.equations.map((eq) => {
      if (eq.id === id) {
        const flipped = flipEquationCoefficients(eq.rawText);
        return flipped ? { ...eq, rawText: flipped } : eq;
      }
      return eq;
    });
    onChangeConfig({ ...config, equations: updated });
  };

  // Toggle ratio conversion mode for an equation
  const handleToggleRatioMode = (id: string) => {
    const updated = config.equations.map((eq) =>
      eq.id === id ? { ...eq, isRatioMode: !eq.isRatioMode } : eq
    );
    onChangeConfig({ ...config, equations: updated });
  };

  // Handle user override for a specific variable
  const handleVarOverrideChange = (varName: string, valStr: string) => {
    const newOverrides = { ...config.userOverrides };
    const normalized = normalizeVariableValue(valStr);
    if (normalized !== null) {
      newOverrides[varName] = normalized;
    } else {
      delete newOverrides[varName];
    }
    onChangeConfig({ ...config, userOverrides: newOverrides });
  };

  // Reset variable override
  const handleClearVarOverride = (varName: string) => {
    const newOverrides = { ...config.userOverrides };
    delete newOverrides[varName];
    onChangeConfig({ ...config, userOverrides: newOverrides });
  };

  // Clear all equations and reset to empty state
  const handleClearEquations = () => {
    onChangeConfig({
      equations: [{ id: `eq-${Date.now()}`, rawText: '', isEnabled: true }],
      userOverrides: {},
      variableMemos: {},
      proportionalBalance: true,
    });
  };

  // Variable Memo updates
  const handleStartEditMemo = (varName: string) => {
    setEditingMemoVar(varName);
    setMemoInputText(config.variableMemos?.[varName] || '');
  };

  const handleSaveMemo = (varName: string) => {
    const newMemos = { ...(config.variableMemos || {}) };
    const trimmed = memoInputText.trim();
    if (trimmed) {
      newMemos[varName] = trimmed;
    } else {
      delete newMemos[varName];
    }
    onChangeConfig({ ...config, variableMemos: newMemos });
    setEditingMemoVar(null);
  };

  const handleUpdateSingleMemo = (varName: string, text: string) => {
    const newMemos = { ...(config.variableMemos || {}) };
    if (text.trim()) {
      newMemos[varName] = text.trim();
    } else {
      delete newMemos[varName];
    }
    onChangeConfig({ ...config, variableMemos: newMemos });
  };

  // Apply preset
  const handleApplyPreset = (preset: (typeof SYSTEM_QUICK_PRESETS)[0]) => {
    const newEquations: SystemEquationRow[] = preset.equations.map((eq, i) => ({
      id: `eq-${i}-${Date.now()}`,
      rawText: eq,
      isEnabled: true,
    }));
    onChangeConfig({
      equations: newEquations,
      userOverrides: preset.overrides || {},
      variableMemos: preset.memos || {},
      proportionalBalance: true,
    });
  };

  // Bulk edit apply
  const handleOpenBulkModal = () => {
    setBulkText(config.equations.map((eq) => eq.rawText).join('\n'));
    setShowBulkModal(true);
  };

  const handleApplyBulkText = () => {
    const lines = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('//') && !l.startsWith('#'));

    const newEquations: SystemEquationRow[] = lines.map((line, idx) => ({
      id: `eq-bulk-${idx}-${Date.now()}`,
      rawText: line,
      isEnabled: true,
    }));

    onChangeConfig({
      ...config,
      equations: newEquations.length > 0 ? newEquations : config.equations,
    });
    setShowBulkModal(false);
  };

  const handleCopy = (name: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedVar(name);
    setTimeout(() => setCopiedVar(null), 1500);
  };

  return (
    <div className="space-y-4">
      {/* 1. Header & Solver Mode Selector */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-4 md:p-5 shadow-lg space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-bold text-white tracking-tight">
                  連立方程式・生産ツリー計算
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  式・変数 無制限
                </span>
              </div>
              <p className="text-xs text-slate-400">
                工場レシピ・生産ツリー（BOM合算）および数学連立方程式（ガウス消去）に対応
              </p>
            </div>
          </div>

          {/* Solver Mode Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => onChangeConfig({ ...config, solverMode: 'recipe_tree' })}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                (config.solverMode || 'recipe_tree') === 'recipe_tree'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="複数のレシピで消費される同一素材（鋼梁やネジ等）を自動合算する工場計算モード"
            >
              <Factory className="w-3.5 h-3.5" />
              <span>生産ツリー (BOM合算)</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeConfig({ ...config, solverMode: 'standard' })}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                config.solverMode === 'standard'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="純粋な数学連立方程式（ガウス消去法・連鎖代入）"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>標準連立 (ガウス消去)</span>
            </button>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-2">
            {solveResult.status === 'solved' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/80 border border-emerald-600/50 text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                全変数 解決完了 ({solveResult.discoveredVars.length}変数)
              </span>
            )}
            {solveResult.status === 'partial' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-950/80 border border-amber-600/50 text-amber-300">
                <AlertCircle className="w-3.5 h-3.5" />
                一部算出完了 (未確定あり)
              </span>
            )}
            {solveResult.status === 'underdetermined' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-950/80 border border-blue-600/50 text-blue-300">
                <HelpCircle className="w-3.5 h-3.5" />
                条件入力待ち
              </span>
            )}
            {solveResult.status === 'empty' && (
              <span className="text-xs text-slate-500">方程式を入力してください</span>
            )}
          </div>
        </div>

        {/* Recipe mode informative badge */}
        {solveResult.isRecipeTreeMode && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 text-xs text-indigo-200">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                <strong>工場生産ツリー (BOM合算モード):</strong> 同一素材が複数工程で消費される場合、各工程の必要量を自動集計・合算して工場全体の総量を算出します。
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowBomFlowchart(true)}
              onMouseEnter={preloadBomFlowchart}
              onTouchStart={preloadBomFlowchart}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer shrink-0"
              title="BOM生産フローチャート（合算・依存ダイアグラム）を表示"
            >
              <Workflow className="w-3.5 h-3.5" />
              <span>BOMフローチャートを表示</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Discovered Variables Live Results Card (All Variables N-dim + Variable Memos) */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-4 md:p-5 shadow-lg space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs md:text-sm font-bold text-white flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-emerald-400" />
              変数一覧とリアルタイム算出結果
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
              {solveResult.discoveredVars.length} 個の変数
            </span>
          </div>

          <div className="flex items-center gap-2">
            {solveResult.discoveredVars.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowCategoriesModal(true);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-750 active:scale-95 border border-slate-700 text-indigo-300 hover:text-white text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  title="材料や製品の分類バッジを一括手動設定"
                >
                  <Boxes className="w-3 h-3 text-indigo-400 pointer-events-none" />
                  <span className="pointer-events-none">分類一括設定</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowMemosModal(true);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-750 active:scale-95 border border-slate-700 text-purple-300 hover:text-white text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  title="変数名にメモ書きを一括設定"
                >
                  <Tag className="w-3 h-3 text-purple-400 pointer-events-none" />
                  <span className="pointer-events-none">変数メモ一覧</span>
                </button>
              </>
            )}

            <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={config.proportionalBalance}
                onChange={(e) =>
                  onChangeConfig({ ...config, proportionalBalance: e.target.checked })
                }
                className="rounded border-slate-700 text-purple-600 focus:ring-0"
              />
              <span>比例混合連動</span>
            </label>
          </div>
        </div>

        {solveResult.discoveredVars.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 rounded-2xl bg-slate-950/50 border border-dashed border-slate-800">
            下に方程式を入力すると、自動的にすべての変数（A, B, C, D, x, y...）が検出され、ここにリアルタイム表示されます。
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {solveResult.discoveredVars.map((varName) => {
              const color = varColorMap[varName] || '#3b82f6';
              const val = solveResult.variables[varName];
              const isOverridden =
                config.userOverrides[varName] !== undefined &&
                config.userOverrides[varName] !== null;
              const statusType = solveResult.varStatus[varName];
              const isCopied = copiedVar === varName;
              const memo = config.variableMemos?.[varName] || '';
              const isEditingThisMemo = editingMemoVar === varName;

              return (
                <div
                  key={varName}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between relative group shadow-xs space-y-2"
                  style={{ borderLeftColor: color, borderLeftWidth: '4px' }}
                >
                  {/* Top: Var name, Memo badge / Edit, Lock, Copy */}
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-sm font-bold font-mono px-1.5 py-0.2 rounded"
                          style={{ color }}
                        >
                          {varName}
                        </span>

                        {statusType && (
                          <span className="text-[9px] text-slate-500 font-mono">
                            {statusType === 'solved' && '確定'}
                            {statusType === 'proportional' && '比率連動'}
                            {statusType === 'given' && '条件'}
                          </span>
                        )}
                      </div>

                      {/* Memo note / label area */}
                      <div className="mt-1">
                        {isEditingThisMemo ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              placeholder="メモ (例: 原料単価)"
                              value={memoInputText}
                              onChange={(e) => setMemoInputText(e.target.value)}
                              onBlur={() => handleSaveMemo(varName)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveMemo(varName);
                                if (e.key === 'Escape') setEditingMemoVar(null);
                              }}
                              className="w-full bg-slate-900 border border-purple-500 rounded-md px-1.5 py-0.5 text-[11px] text-purple-200 focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleSaveMemo(varName);
                              }}
                              className="px-1.5 py-0.5 bg-purple-600 text-white rounded text-[10px] font-bold cursor-pointer"
                            >
                              確定
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => handleStartEditMemo(varName)}
                            className={`text-[11px] flex items-center gap-1 cursor-pointer rounded px-1.5 py-0.5 transition-colors ${
                              memo
                                ? 'bg-purple-950/40 text-purple-300 border border-purple-900/40 hover:bg-purple-900/40'
                                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
                            }`}
                            title="クリックしてメモを編集"
                          >
                            <Tag className="w-2.5 h-2.5 text-purple-400 shrink-0 pointer-events-none" />
                            <span className="truncate pointer-events-none">{memo || '＋ メモを追加'}</span>
                            <Edit3 className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 shrink-0 ml-auto pointer-events-none" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isOverridden && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleClearVarOverride(varName);
                          }}
                          className="p-1 text-amber-400 hover:text-amber-300 rounded bg-amber-950/30 border border-amber-800/40 cursor-pointer"
                          title="手動指定を解除して自動計算に戻す"
                        >
                          <Lock className="w-3 h-3 pointer-events-none" />
                        </button>
                      )}
                      {val !== undefined && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCopy(
                              varName,
                              memo ? `${varName} (${memo}) = ${formatValue(val, precision)}` : String(val)
                            );
                          }}
                          className="p-1 rounded bg-slate-900 text-slate-400 hover:text-white border border-slate-800 cursor-pointer active:scale-95"
                          title="値（メモ付き）をコピー"
                        >
                          {isCopied ? (
                            <Check className="w-3 h-3 text-emerald-400 pointer-events-none" />
                          ) : (
                            <Copy className="w-3 h-3 pointer-events-none" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Value Display */}
                  <div className="my-1">
                    <span className="text-2xl font-bold font-mono text-white block tracking-tight">
                      {val !== undefined ? formatValue(val, precision) : '—'}
                    </span>
                  </div>

                  {/* Material Category Badge (Click to Edit) & Multi-Source Breakdown */}
                  <div className="space-y-1.5 pt-1">
                    {/* Interactive Classification Badge */}
                    <div className="relative">
                      {(() => {
                        const catInfo = getVariableCategoryInfo(varName);
                        // Show badge if in recipe tree mode or if category is explicitly set
                        const shouldShow =
                          solveResult.isRecipeTreeMode ||
                          Boolean(config.variableCategories?.[varName]);

                        if (!shouldShow) return null;

                        return (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setCategoryPopoverVar(categoryPopoverVar === varName ? null : varName);
                                setCustomCategoryInput(
                                  catInfo.isManual && !CATEGORY_PRESETS.some((p) => p.key === catInfo.key)
                                    ? catInfo.label
                                    : ''
                                );
                              }}
                              className={`text-[10px] px-2 py-0.5 rounded-lg border font-medium flex items-center gap-1 cursor-pointer transition-all active:scale-95 ${catInfo.badgeClass} hover:brightness-110 shadow-xs`}
                              title="クリックして分類（最終製品・中間素材・基礎原料など）を手動設定・変更"
                            >
                              <span>{catInfo.icon}</span>
                              <span className="font-bold">{catInfo.label}</span>
                              {catInfo.isManual ? (
                                <span className="text-[9px] bg-slate-950/60 px-1 py-0.2 rounded font-normal text-amber-300 border border-amber-500/30">
                                  手動
                                </span>
                              ) : (
                                <span className="text-[9px] opacity-60 font-normal">自動</span>
                              )}
                              <ChevronDown className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                            </button>
                          </div>
                        );
                      })()}

                      {/* Dropdown Popover */}
                      {categoryPopoverVar === varName && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-0 top-full mt-1.5 w-64 p-2.5 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl space-y-2 z-40 animate-in fade-in"
                        >
                          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                            <span className="text-[11px] font-bold text-white flex items-center gap-1">
                              <Tag className="w-3 h-3 text-purple-400" />
                              「{varName}」の分類を手動編集
                            </span>
                            <button
                              type="button"
                              onClick={() => setCategoryPopoverVar(null)}
                              className="text-slate-400 hover:text-white text-xs p-0.5 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>

                          <div className="grid grid-cols-1 gap-1">
                            {CATEGORY_PRESETS.map((cat) => {
                              const currentCat = getVariableCategoryInfo(varName);
                              const isSelected =
                                cat.key === 'auto'
                                  ? !currentCat.isManual
                                  : config.variableCategories?.[varName] === cat.key;

                              return (
                                <button
                                  key={cat.key}
                                  type="button"
                                  onClick={() => {
                                    handleSetVariableCategory(varName, cat.key);
                                    setCategoryPopoverVar(null);
                                  }}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-purple-600/30 text-white border border-purple-500/50 font-bold'
                                      : 'bg-slate-950 text-slate-300 hover:bg-slate-850 border border-slate-800/60'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span>{cat.icon}</span>
                                    <span>{cat.label}</span>
                                  </div>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-purple-400" />}
                                </button>
                              );
                            })}
                          </div>

                          {/* Custom Category Input */}
                          <div className="pt-1.5 border-t border-slate-800 space-y-1">
                            <span className="text-[10px] text-slate-400 block font-medium">任意のカスタム分類名:</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                placeholder="例: 特注部品, 触媒, 梱包資材..."
                                value={customCategoryInput}
                                onChange={(e) => setCustomCategoryInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && customCategoryInput.trim()) {
                                    handleSetVariableCategory(varName, customCategoryInput.trim());
                                    setCategoryPopoverVar(null);
                                  }
                                }}
                                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (customCategoryInput.trim()) {
                                    handleSetVariableCategory(varName, customCategoryInput.trim());
                                    setCategoryPopoverVar(null);
                                  }
                                }}
                                disabled={!customCategoryInput.trim()}
                                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold cursor-pointer"
                              >
                                設定
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Consumed Breakdown (e.g. 鋼梁 consumed by 被覆鋼梁 & ネジ) */}
                    {solveResult.isRecipeTreeMode &&
                      solveResult.recipeTreeData &&
                      solveResult.recipeTreeData.breakdowns[varName] &&
                      solveResult.recipeTreeData.breakdowns[varName].length > 0 && (
                        <div className="bg-slate-900/90 rounded-xl p-2 border border-slate-800 space-y-1">
                          <span className="text-[10px] text-slate-400 font-bold block">
                            {solveResult.recipeTreeData.breakdowns[varName].length > 1
                              ? '🧩 複数工程からの要求合算:'
                              : '要求元工程:'}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {solveResult.recipeTreeData.breakdowns[varName].map((b, bIdx) => (
                              <span
                                key={bIdx}
                                className="px-1.5 py-0.5 rounded bg-slate-950 text-slate-200 font-mono text-[10px] border border-slate-700/60"
                              >
                                {b.source}: {formatValue(b.amount, precision)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>

                  {/* Optional Override input */}
                  <div className="pt-1.5 border-t border-slate-900 flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">固定/指定:</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="指定 (例: 100, 10/2, 25%)"
                      title="数値、全角数字（１００）、カンマ（1,000）、計算式（10/2）、パーセント（25%）を入力可能"
                      value={
                        activeOverrideVar === varName
                          ? activeOverrideText
                          : config.userOverrides[varName] !== undefined &&
                            config.userOverrides[varName] !== null
                          ? String(config.userOverrides[varName])
                          : ''
                      }
                      onFocus={() => {
                        setActiveOverrideVar(varName);
                        setActiveOverrideText(
                          config.userOverrides[varName] !== undefined &&
                            config.userOverrides[varName] !== null
                            ? String(config.userOverrides[varName])
                            : ''
                        );
                      }}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActiveOverrideText(val);
                        handleVarOverrideChange(varName, val);
                      }}
                      onBlur={() => {
                        setActiveOverrideVar(null);
                        setActiveOverrideText('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-[11px] font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Equations Editor (Infinite Rows & Bulk Edit) */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-4 md:p-5 shadow-lg space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs md:text-sm font-bold text-white flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-400" />
              方程式リスト ({config.equations.length} 式)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {config.equations.some((e) => e.rawText.trim() !== '') && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleClearEquations();
                }}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-800/60 active:scale-95 text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer"
                title="すべての式をクリアして空欄に戻す"
              >
                <Trash2 className="w-3 h-3 pointer-events-none" />
                <span className="pointer-events-none">全消去</span>
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleOpenBulkModal();
              }}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-750 active:scale-95 text-[11px] font-medium text-slate-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
            >
              <FileText className="w-3 h-3 pointer-events-none" />
              <span className="pointer-events-none">一括テキスト編集</span>
            </button>
          </div>
        </div>

        {/* Dynamic Equation Rows */}
        <div className="space-y-2.5">
          {config.equations.map((eq, index) => {
            const ratioInfo = detectRatioEquation(eq.rawText);
            const recipeDef = parseEquationToRecipe(eq);

            return (
              <div
                key={eq.id}
                className={`p-3 rounded-2xl border transition-all space-y-2.5 ${
                  eq.isEnabled
                    ? 'bg-slate-950 border-slate-800/90 focus-within:border-purple-500/80 shadow-xs'
                    : 'bg-slate-950/40 border-slate-900 opacity-60'
                }`}
              >
                {/* Upper Row (上段): Checkbox, Equation number badge, Full-width Equation text input */}
                <div className="flex items-center gap-2.5">
                  {/* Enable / Disable toggle */}
                  <input
                    type="checkbox"
                    checked={eq.isEnabled}
                    onChange={() => handleToggleEquation(eq.id)}
                    className="w-4 h-4 rounded border-slate-700 text-purple-600 focus:ring-0 ml-0.5 cursor-pointer shrink-0"
                    title={eq.isEnabled ? 'この式を無効化' : 'この式を有効化'}
                  />

                  <span className="text-xs font-mono font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800 shrink-0">
                    #{index + 1}
                  </span>

                  {/* Equation Text input - Full width without clipping */}
                  <input
                    type="text"
                    value={eq.rawText}
                    placeholder="式を入力（例: 2ヘビーモジュラーフレーム=10モジュラーフレーム+40鋼管+5被覆鋼梁+240ネジ）"
                    onChange={(e) => handleEquationChange(eq.id, e.target.value)}
                    className="flex-1 bg-transparent text-sm font-mono font-bold text-white placeholder-slate-600 focus:outline-none px-1 min-w-0"
                  />
                </div>

                {/* Lower Row (下段に改行して配置): Recipe summary on left, Action buttons (反転, 比率, 削除) on right */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-900">
                  {/* Left: Recipe recognition preview or ratio note */}
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {recipeDef ? (
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-300">
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <Boxes className="w-3 h-3 text-emerald-400" />
                          製品: {formatValue(recipeDef.productQty, precision)} {recipeDef.productVar}
                        </span>
                        <span className="text-slate-500">←</span>
                        <span className="text-indigo-300">
                          材料: {recipeDef.ingredients.map((i) => `${formatValue(i.qty, precision)} ${i.varName}`).join(' + ')}
                        </span>
                      </div>
                    ) : ratioInfo.isArrowOrColon && ratioInfo.canFlip ? (
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-indigo-300">
                        <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span>
                          <strong>比率自動認識:</strong> 「{ratioInfo.flippedEquation}」として計算中
                        </span>
                      </div>
                    ) : eq.isRatioMode && ratioInfo.canFlip ? (
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-purple-300">
                        <ArrowLeftRight className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span>
                          <strong>比率反転中:</strong> 「{ratioInfo.flippedEquation}」
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-mono">
                        {eq.rawText.trim() === '' ? '式を入力してください' : '標準数式'}
                      </span>
                    )}
                  </div>

                  {/* Right: Actions Toolbar (反転, 比率, 削除) */}
                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    {/* Flip Coefficients Button */}
                    {ratioInfo.canFlip && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleFlipCoefficients(eq.id);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-purple-950/60 hover:bg-purple-900/80 active:scale-95 text-[11px] font-bold text-purple-300 hover:text-white border border-purple-800/60 transition-all flex items-center gap-1 cursor-pointer"
                        title={`係数を反転: ${eq.rawText} ⇄ ${ratioInfo.flippedEquation}`}
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5 text-purple-400 pointer-events-none" />
                        <span className="pointer-events-none">反転</span>
                      </button>
                    )}

                    {/* Ratio Mode toggle button */}
                    {ratioInfo.canFlip && !ratioInfo.isArrowOrColon && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleToggleRatioMode(eq.id);
                        }}
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                          eq.isRatioMode
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                        title="比率変換モード: 30A=20B を原料→製品の比率（20A=30B）として自動反転して解く"
                      >
                        {eq.isRatioMode ? '比率モードON' : '比率'}
                      </button>
                    )}

                    {/* Delete button (positioned securely on lower line with modal confirmation) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setPendingDeleteEquation(eq);
                      }}
                      disabled={config.equations.length <= 1}
                      className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800/60 active:scale-95 text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                      title="この式を削除"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400 pointer-events-none" />
                      <span className="pointer-events-none">式を削除</span>
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>

        {/* Add Equation Button */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleAddEquation();
          }}
          className="w-full py-2.5 rounded-2xl bg-purple-600/10 hover:bg-purple-600/20 active:scale-[0.99] border border-purple-500/30 hover:border-purple-500/50 text-purple-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4 pointer-events-none" />
          <span className="pointer-events-none">新しい式を追加 (上限なし)</span>
        </button>
      </div>

      {/* 4. Calculation Steps & Derivation Process */}
      {solveResult.steps.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-4 md:p-5 shadow-lg space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <span className="text-xs md:text-sm font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              計算導出プロセス・工程別内訳 ({solveResult.steps.length} ステップ)
            </span>

            {solveResult.discoveredVars.length > 0 && (
              <button
                type="button"
                onClick={() => setShowBomFlowchart(true)}
                onMouseEnter={preloadBomFlowchart}
                onTouchStart={preloadBomFlowchart}
                className="px-2.5 py-1 rounded-xl bg-slate-950 hover:bg-slate-800 active:scale-95 border border-indigo-500/40 text-indigo-300 hover:text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="BOM生産フローチャート（合算・依存ダイアグラム）を表示"
              >
                <Workflow className="w-3 h-3 text-indigo-400 pointer-events-none" />
                <span className="pointer-events-none">BOMフローチャートを表示</span>
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {solveResult.steps.map((step, sIdx) => (
              <div
                key={sIdx}
                className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-slate-700/80 transition-all space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-purple-950 text-purple-400 border border-purple-800/50 flex items-center justify-center text-[10px]">
                      {sIdx + 1}
                    </span>
                    {step.title}
                  </span>
                  {step.value !== undefined && (
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      = {formatValue(step.value, precision)}
                    </span>
                  )}
                </div>
                {step.formula && (
                  <div className="font-mono text-xs text-amber-200/90 bg-slate-900/80 px-2.5 py-1.5 rounded-xl border border-slate-800">
                    {step.formula}
                  </div>
                )}
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {step.explanation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Collapsible Quick Presets / Examples (Moved after calculation derivation breakdown) */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-3.5 md:p-4 shadow-lg space-y-3 transition-all">
        <button
          type="button"
          onClick={() => setIsPresetsOpen((prev) => !prev)}
          className="w-full flex items-center justify-between text-left cursor-pointer group"
          aria-expanded={isPresetsOpen}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs md:text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                  代表的な連立例題・用途プリセット
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60">
                  {SYSTEM_QUICK_PRESETS.length}件
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                クリックしてプリセット一覧を{isPresetsOpen ? '折りたたむ' : '展開して選択'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-xs text-slate-400 group-hover:text-purple-300 transition-colors bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 shrink-0">
            <span className="text-[11px] font-medium">{isPresetsOpen ? '閉じる' : '展開'}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isPresetsOpen ? 'rotate-180 text-purple-400' : ''
              }`}
            />
          </div>
        </button>

        {isPresetsOpen && (
          <div className="pt-2.5 border-t border-slate-800/80 space-y-2 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SYSTEM_QUICK_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleApplyPreset(preset);
                  }}
                  className="p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-purple-500/60 hover:bg-slate-900 active:scale-[0.99] text-left transition-all group cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-200 group-hover:text-purple-300 transition-colors">
                      {preset.label}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 shrink-0">
                      {preset.desc}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-400 truncate">
                    {preset.equations.join(' , ')}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bulk Text Edit Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                方程式の一括テキスト入力 / 編集
              </h3>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowBulkModal(false);
                }}
                className="text-slate-400 hover:text-white text-sm p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              1行につき1つの式を入力してください。原料→製品などの比率は「30A -&gt; 20B」や「30A : 20B」と書くことで自動的に係数を反転して計算できます。
            </p>

            <textarea
              rows={8}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3 text-xs font-mono text-white focus:outline-none focus:border-purple-500 leading-relaxed"
              placeholder={`2.5A + 5B = 10C\n30C = 20D\nB = 480 * 6`}
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowBulkModal(false);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleApplyBulkText();
                }}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white shadow-md"
              >
                一括反映する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Variable Memos Batch Management Modal */}
      {showMemosModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 w-full max-w-md shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-purple-400" />
                変数メモの一括編集・注釈設定
              </h3>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMemosModal(false);
                }}
                className="text-slate-400 hover:text-white text-sm p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              各変数（A, B, C...）が表す意味や単位、ロット名などの注釈を設定できます。
            </p>

            <div className="space-y-2.5 overflow-y-auto flex-1 pr-1 max-h-[50vh]">
              {solveResult.discoveredVars.map((varName) => {
                const color = varColorMap[varName] || '#3b82f6';
                const memoVal = config.variableMemos?.[varName] || '';
                return (
                  <div
                    key={varName}
                    className="flex items-center gap-2.5 p-2 bg-slate-950 rounded-2xl border border-slate-800"
                  >
                    <span
                      className="text-xs font-bold font-mono px-2 py-1 rounded bg-slate-900 min-w-8 text-center"
                      style={{ color }}
                    >
                      {varName}
                    </span>
                    <input
                      type="text"
                      placeholder={`変数 ${varName} のメモ・用途 (例: 原材料ロット単価)`}
                      value={memoVal}
                      onChange={(e) => handleUpdateSingleMemo(varName, e.target.value)}
                      className="flex-1 bg-transparent border-b border-slate-800 focus:border-purple-500 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                    />
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMemosModal(false);
                }}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white shadow-md cursor-pointer"
              >
                完了して閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transparent Click-away Backdrop for Category Popover */}
      {categoryPopoverVar && (
        <div
          className="fixed inset-0 z-30 cursor-default"
          onClick={() => setCategoryPopoverVar(null)}
        />
      )}

      {/* Equation Deletion Confirmation Dialog Modal */}
      {pendingDeleteEquation && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPendingDeleteEquation(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-700 rounded-3xl p-5 w-full max-w-md shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  方程式の削除確認
                </h3>
                <p className="text-xs text-slate-400">
                  この方程式をリストから削除しますか？
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
              <span className="text-[10px] text-slate-500 font-bold block">削除対象の式:</span>
              <div className="font-mono text-sm text-white break-all font-semibold">
                {pendingDeleteEquation.rawText.trim() ? pendingDeleteEquation.rawText : '（空の式）'}
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              ※ 式を削除すると、各変数の依存関係や生産量の算出結果が直ちに再計算されます。
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setPendingDeleteEquation(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDeleteEquation(pendingDeleteEquation.id);
                  setPendingDeleteEquation(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-900/40 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>削除する</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Variable Categories Batch Management Modal */}
      {showCategoriesModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowCategoriesModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-700 rounded-3xl p-5 w-full max-w-lg shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    材料・生産物の分類一括設定
                  </h3>
                  <p className="text-xs text-slate-400">
                    最終製品、中間素材、基礎原料などのバッジを手動設定・変更できます
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCategoriesModal(false)}
                className="text-slate-400 hover:text-white text-sm p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 overflow-y-auto flex-1 pr-1 max-h-[50vh]">
              {solveResult.discoveredVars.map((varName) => {
                const color = varColorMap[varName] || '#3b82f6';
                const catInfo = getVariableCategoryInfo(varName);
                const currentManual = config.variableCategories?.[varName] || '';

                return (
                  <div
                    key={varName}
                    className="p-2.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-slate-900 text-center"
                          style={{ color }}
                        >
                          {varName}
                        </span>
                        {config.variableMemos?.[varName] && (
                          <span className="text-[11px] text-slate-400 font-medium">
                            ({config.variableMemos[varName]})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-lg border font-medium flex items-center gap-1 ${catInfo.badgeClass}`}
                        >
                          <span>{catInfo.icon}</span>
                          <span>{catInfo.label}</span>
                          {catInfo.isManual && (
                            <span className="text-[9px] opacity-75 font-normal">(手動)</span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-900">
                      {CATEGORY_PRESETS.map((cat) => {
                        const isSelected =
                          cat.key === 'auto'
                            ? !catInfo.isManual
                            : currentManual === cat.key;
                        return (
                          <button
                            key={cat.key}
                            type="button"
                            onClick={() => handleSetVariableCategory(varName, cat.key)}
                            className={`px-2 py-1 rounded-xl text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                              isSelected
                                ? 'bg-purple-600 text-white border-purple-500 shadow-xs'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                            }`}
                          >
                            <span>{cat.icon}</span>
                            <span>{cat.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  onChangeConfig({ ...config, variableCategories: {} });
                }}
                className="text-[11px] text-slate-400 hover:text-amber-300 underline cursor-pointer"
              >
                すべての手動分類を自動判定にリセット
              </button>
              <button
                type="button"
                onClick={() => setShowCategoriesModal(false)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white shadow-md cursor-pointer"
              >
                完了して閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOM Production Flowchart Modal (On-demand Mermaid Visualization) */}
      {showBomFlowchart && (
        <React.Suspense fallback={null}>
          <BomFlowchartModal
            isOpen={showBomFlowchart}
            onClose={() => setShowBomFlowchart(false)}
            solveResult={solveResult}
            precision={precision}
            variableMemos={config.variableMemos}
            variableCategories={config.variableCategories}
          />
        </React.Suspense>
      )}
    </div>
  );
});

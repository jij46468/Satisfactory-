import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { RecipeTreeData, SystemSolveResult } from '../utils/systemSolver';
import { formatValue } from '../utils/calculator';
import { PrecisionMode } from '../types';
import {
  X,
  Copy,
  Check,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  GitBranch,
  Boxes,
  HelpCircle,
} from 'lucide-react';

interface BomFlowchartModalProps {
  isOpen: boolean;
  onClose: () => void;
  solveResult: SystemSolveResult;
  precision: PrecisionMode;
  variableMemos?: Record<string, string>;
  variableCategories?: Record<string, string>;
}

// Initialize mermaid once safely with a modern, high-contrast dark theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  themeVariables: {
    darkMode: true,
    background: '#090d16',
    primaryColor: '#1e1b4b',
    primaryTextColor: '#f8fafc',
    primaryBorderColor: '#6366f1',
    lineColor: '#818cf8',
    secondaryColor: '#064e3b',
    tertiaryColor: '#451a03',
    mainBkg: '#0f172a',
    nodeBorder: '#334155',
    clusterBkg: '#0b1120',
    clusterBorder: '#1e293b',
    titleColor: '#e2e8f0',
    edgeLabelBackground: '#020617',
  },
  flowchart: {
    curve: 'basis',
    nodeSpacing: 40,
    rankSpacing: 60,
    padding: 16,
    htmlLabels: true,
  },
});

/**
 * Clean sanitization for mermaid node IDs
 */
function toNodeId(str: string): string {
  // Convert any non-alphanumeric character to a safe hex representation or clean identifier
  return (
    'node_' +
    Array.from(str)
      .map((ch) => {
        const code = ch.charCodeAt(0);
        if (
          (code >= 48 && code <= 57) || // 0-9
          (code >= 65 && code <= 90) || // A-Z
          (code >= 97 && code <= 122)   // a-z
        ) {
          return ch;
        }
        return `_${code.toString(16)}_`;
      })
      .join('')
  );
}

/**
 * Escapes characters for Mermaid label strings
 */
function sanitizeMermaidText(str: string): string {
  return str
    .replace(/["]/g, "'")
    .replace(/[\n\r]/g, ' ')
    .trim();
}

/**
 * Escapes characters for HTML label content inside Mermaid nodes
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generates Mermaid definition from solveResult and recipeTreeData
 */
export function generateMermaidBomDefinition(
  solveResult: SystemSolveResult,
  precision: PrecisionMode,
  variableMemos?: Record<string, string>,
  variableCategories?: Record<string, string>
): string {
  // graph BT: Bottom to Top (Raw materials at bottom, Final products at top)
  const lines: string[] = ['graph BT'];

  const recipeTree = solveResult.recipeTreeData;
  const variables = solveResult.variables;

  if (!recipeTree || recipeTree.recipes.length === 0) {
    // If not a recognized multi-recipe tree, fallback to simple discovered variable links
    lines.push('  subgraph SG_SIMPLE ["📊 変数一覧・生産関係"]');
    lines.push('    direction BT');
    solveResult.discoveredVars.forEach((v) => {
      const nid = toNodeId(v);
      const val = variables[v];
      const valStr = val !== undefined ? formatValue(val, precision) : '?';
      const memo = variableMemos?.[v] ? `<br/><small style="color:#94a3b8">${escapeHtml(variableMemos[v])}</small>` : '';
      lines.push(`    ${nid}["<b>${escapeHtml(v)}</b>: ${valStr}${memo}"]`);
    });
    lines.push('  end');
    return lines.join('\n');
  }

  // 1. Define nodes and organize by subgraphs (Raw Materials, Intermediates, Products)
  const rawSet = new Set(recipeTree.rawMaterials);
  const interSet = new Set(recipeTree.intermediates);
  const rootSet = new Set(recipeTree.rootProducts);

  // Group variables for clear visual clustering
  const rawNodes: string[] = [];
  const interNodes: string[] = [];
  const productNodes: string[] = [];

  solveResult.discoveredVars.forEach((v) => {
    const val = variables[v];
    const valStr = val !== undefined ? formatValue(val, precision) : '?';
    const memo = variableMemos?.[v] ? `<div style="font-size:10px;color:#cbd5e1;opacity:0.85;">${escapeHtml(variableMemos[v])}</div>` : '';
    const manualCat = variableCategories?.[v];

    let icon = '⚙️';
    let catLabel = '中間素材';
    let styleClass = 'interNode';

    if (manualCat === 'raw' || (!manualCat && rawSet.has(v))) {
      icon = '⛏️';
      catLabel = '基礎原料';
      styleClass = 'rawNode';
      rawNodes.push(v);
    } else if (manualCat === 'product' || (!manualCat && rootSet.has(v))) {
      icon = '🎯';
      catLabel = '最終製品';
      styleClass = 'productNode';
      productNodes.push(v);
    } else {
      interNodes.push(v);
    }

    const nid = toNodeId(v);
    // Multi-source note
    const breakdown = recipeTree.breakdowns[v];
    const multiNote = breakdown && breakdown.length > 1 ? `<div style="font-size:9px;color:#a5b4fc;font-weight:bold;margin-top:2px;">🧩 ${breakdown.length}工程合算</div>` : '';

    const labelContent = `"<div style='text-align:center;padding:4px 8px;min-width:110px;'><div><span style='font-size:10px;opacity:0.75;'>${icon} ${catLabel}</span></div><div style='font-size:13px;font-weight:bold;margin:2px 0;'>${escapeHtml(v)}</div><div style='font-size:12px;font-family:monospace;font-weight:bold;color:#38bdf8;'>総量: ${valStr}</div>${memo}${multiNote}</div>"`;

    lines.push(`  ${nid}[${labelContent}]:::${styleClass}`);
  });

  // 2. Edges: Trace recipe connections from ingredients to product
  // For each recipe: ing1, ing2 -> product
  // Also annotate edges with amounts if available in breakdowns
  recipeTree.recipes.forEach((rcp) => {
    const pNodeId = toNodeId(rcp.productVar);
    const pVal = variables[rcp.productVar] || 0;
    const batchCount = rcp.productQty > 0 ? pVal / rcp.productQty : 1;

    rcp.ingredients.forEach((ing) => {
      const ingNodeId = toNodeId(ing.varName);
      const consumedAmount = batchCount * ing.qty;
      const consumedStr = formatValue(consumedAmount, precision);

      // Label on the edge
      const edgeLabel = `|"${consumedStr}"|`;
      lines.push(`  ${ingNodeId} -->${edgeLabel} ${pNodeId}`);
    });
  });

  // 3. Modern CSS Styling definitions for classes
  lines.push('  classDef rawNode fill:#2d1b09,stroke:#d97706,stroke-width:2px,color:#fef3c7,rx:12px,ry:12px;');
  lines.push('  classDef interNode fill:#1e1b4b,stroke:#6366f1,stroke-width:2px,color:#e0e7ff,rx:12px,ry:12px;');
  lines.push('  classDef productNode fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#d1fae5,rx:12px,ry:12px;');

  return lines.join('\n');
}

export const BomFlowchartModal: React.FC<BomFlowchartModalProps> = ({
  isOpen,
  onClose,
  solveResult,
  precision,
  variableMemos,
  variableCategories,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [mermaidCode, setMermaidCode] = useState<string>('');
  const [showCode, setShowCode] = useState<boolean>(false);

  // Generate and render mermaid diagram when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setRenderError(null);

    const definition = generateMermaidBomDefinition(
      solveResult,
      precision,
      variableMemos,
      variableCategories
    );
    setMermaidCode(definition);

    const renderId = `mermaid_bom_${Date.now()}`;

    // Render using mermaid API
    mermaid
      .render(renderId, definition)
      .then((res) => {
        if (!isMounted) return;
        if (containerRef.current) {
          containerRef.current.innerHTML = res.svg;
          // Apply responsive svg styling
          const svgEl = containerRef.current.querySelector('svg');
          if (svgEl) {
            svgEl.style.maxWidth = '100%';
            svgEl.style.height = 'auto';
            svgEl.style.display = 'block';
            svgEl.style.margin = '0 auto';
          }
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Mermaid render error:', err);
        setRenderError('フローチャートの自動レイアウト生成中にエラーが発生しました。数式の依存関係を確認してください。');
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, solveResult, precision, variableMemos, variableCategories]);

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(mermaidCode);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadSvg = () => {
    if (!containerRef.current) return;
    const svgEl = containerRef.current.querySelector('svg');
    if (!svgEl) return;

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BOM_Flowchart_${new Date().toISOString().slice(0, 10)}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const recipeTree = solveResult.recipeTreeData;
  const rawMaterials = recipeTree?.rawMaterials || [];
  const rootProducts = recipeTree?.rootProducts || [];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-in fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-6xl h-[92vh] max-h-[900px] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 md:px-6 md:py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base md:text-lg font-bold text-white flex items-center gap-1.5">
                  BOM生産フローチャート（合算可視化）
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-bold">
                  Mermaid DAG
                </span>
              </div>
              <p className="text-xs text-slate-400">
                下から上へ「⛏️原料（下） ➔ ⚙️中間素材 ➔ 🎯最終製品（上）」の積み上げルートを自動描画
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="flex items-center bg-slate-950 rounded-xl border border-slate-800 p-0.5">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-850 active:scale-95 cursor-pointer"
                title="縮小"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono text-slate-300 px-2 select-none min-w-[45px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-850 active:scale-95 cursor-pointer"
                title="拡大"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-850 active:scale-95 border-l border-slate-800 cursor-pointer"
                title="100%にリセット"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Download SVG */}
            <button
              type="button"
              onClick={handleDownloadSvg}
              className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="SVG画像としてダウンロード保存"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">SVG保存</span>
            </button>

            {/* Toggle Code */}
            <button
              type="button"
              onClick={() => setShowCode(!showCode)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Mermaid記法コードを表示・コピー"
            >
              <Copy className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">{showCode ? 'グラフ表示' : 'コード'}</span>
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 flex items-center justify-center transition-colors cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Legend & Summary Sub-header */}
        <div className="px-6 py-2.5 bg-slate-950/40 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-slate-400 font-bold">凡例:</span>
            <span className="flex items-center gap-1 text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-800/50">
              <span>⛏️ 基礎原料</span>
            </span>
            <span className="flex items-center gap-1 text-indigo-300 bg-indigo-950/40 px-2 py-0.5 rounded-lg border border-indigo-800/50">
              <span>⚙️ 中間生産物</span>
            </span>
            <span className="flex items-center gap-1 text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-800/50">
              <span>🎯 最終目標製品</span>
            </span>
            <span className="text-slate-500 text-[11px]">
              ※ 矢印上の数値は各工程への要求流量を表します
            </span>
          </div>

          {recipeTree && (
            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
              <span>原料: <strong className="text-amber-300">{rawMaterials.length}</strong>種</span>
              <span>•</span>
              <span>完成品: <strong className="text-emerald-300">{rootProducts.length}</strong>種</span>
            </div>
          )}
        </div>

        {/* Flowchart Content Canvas Area */}
        <div className="flex-1 bg-slate-950 overflow-auto relative p-4 md:p-8">
          {renderError ? (
            <div className="max-w-md mx-auto my-12 p-5 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-center space-y-3">
              <span className="text-rose-400 text-sm font-bold block">
                フローチャートの描画に失敗しました
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">{renderError}</p>
              <button
                type="button"
                onClick={() => setShowCode(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white hover:bg-slate-800 cursor-pointer"
              >
                Mermaidコードを確認する
              </button>
            </div>
          ) : showCode ? (
            <div className="w-full h-full max-w-3xl mx-auto flex flex-col space-y-2 p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">Mermaid Definition Code:</span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? 'コピー完了' : 'コードをコピー'}</span>
                </button>
              </div>
              <textarea
                readOnly
                value={mermaidCode}
                className="w-full flex-1 bg-slate-900 font-mono text-xs text-purple-200 p-4 rounded-2xl border border-slate-800 focus:outline-none resize-none select-all min-h-[300px]"
              />
            </div>
          ) : (
            <div className="min-w-full flex flex-col items-center justify-start pb-12">
              <div
                className="transition-transform duration-150 origin-top flex flex-col items-center justify-start w-full"
                style={{ transform: `scale(${zoom})` }}
              >
                <div
                  ref={containerRef}
                  className="w-full flex justify-center items-start select-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 md:px-6 md:py-3 border-t border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>複数工程から重複して要求された素材は自動合流し、総必要量が一本化されています。</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer ml-auto"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

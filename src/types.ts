export type LayoutStyle = 'standard' | 'compact';

export type PrecisionMode = 'auto' | '0' | '1' | '2' | '3' | '4';

export type SolverMode = 'recipe_tree' | 'standard';

export interface SystemEquationRow {
  id: string;
  rawText: string;
  isEnabled: boolean;
  isRatioMode?: boolean; // When true, automatically inverts coefficients for ratio conversion (e.g. 30A = 20B treated as 20A = 30B)
}

export interface SystemEquationConfig {
  equations: SystemEquationRow[];
  userOverrides: Record<string, number | string | null>; // variable manual values (supports numbers, string expressions, or null)
  variableMemos?: Record<string, string>; // user notes/labels for variables e.g. { "A": "原料A単価", "B": "包装費" }
  variableCategories?: Record<string, string>; // user manual category override e.g. { "鋼梁": "intermediate", "ネジ": "raw" }
  proportionalBalance: boolean; // if underdetermined, solve proportional variables
  solverMode?: SolverMode; // 'recipe_tree' for factory recipes / BOM accumulation, 'standard' for pure algebraic linear system
}

export interface PresetItem {
  id: string;
  title: string;
  description: string;
  category: 'math' | 'business' | 'custom';
  equations: string[];
  userOverrides?: Record<string, number | string | null>;
  variableMemos?: Record<string, string>;
}

export interface CalculationHistoryEntry {
  id: string;
  timestamp: number;
  title: string;
  summary: string;
  details: string;
  snapshot: SystemEquationConfig;
  isBookmarked?: boolean;
  note?: string; // custom note for the history entry
}

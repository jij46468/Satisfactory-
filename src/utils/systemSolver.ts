import { SystemEquationRow, SystemEquationConfig } from '../types';

export interface SystemStep {
  title: string;
  formula?: string;
  explanation: string;
  highlightVar?: string;
  value?: number;
}

export interface RecipeBreakdownItem {
  source: string; // e.g. "被覆鋼梁" or "ネジ"
  amount: number; // e.g. 15 or 6.75
  ratioNote?: string;
}

export interface RecipeTreeData {
  rootProducts: string[];
  rawMaterials: string[];
  intermediates: string[];
  breakdowns: Record<string, RecipeBreakdownItem[]>;
  batches: Record<string, number>;
  recipes: Array<{
    id: string;
    productVar: string;
    productQty: number;
    ingredients: Array<{ varName: string; qty: number }>;
  }>;
}

export interface SystemSolveResult {
  status: 'solved' | 'partial' | 'underdetermined' | 'inconsistent' | 'empty' | 'error';
  variables: Record<string, number>;
  varStatus: Record<string, 'solved' | 'given' | 'proportional' | 'free'>;
  discoveredVars: string[];
  steps: SystemStep[];
  errorMessage?: string;
  equationCount: number;
  variableCount: number;
  isRecipeTreeMode?: boolean;
  recipeTreeData?: RecipeTreeData;
}

// Variable distinct palette
export const SYSTEM_VAR_COLORS: string[] = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
  '#84cc16', // lime
  '#d946ef', // fuchsia
  '#64748b', // slate
];

/**
 * Normalizes full-width alphanumeric chars, math operators, Japanese brackets, and percentages
 * NOTE: Katakana/Hiragana prolonged sound mark 'ー' (\u30FC) is kept intact as part of Japanese variable words (e.g. ユーザー, サーバー, データ, エネルギー)
 */
export function normalizeEquationText(str: string): string {
  return str
    // Full-width numbers: ０-９ -> 0-9
    .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    // Full-width alphabets: ａ-ｚ -> a-z, Ａ-Ｚ -> A-Z
    .replace(/[ａ-ｚＡ-Ｚ]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    // Full-width math symbols & equality (Do NOT include Katakana prolonged mark 'ー')
    .replace(/[＝]/g, '=')
    .replace(/[＋]/g, '+')
    .replace(/[－−―–—]/g, '-')
    .replace(/[×✕✖・＊*]/g, '*')
    .replace(/[÷／⁄/]/g, '/')
    .replace(/[（〔【「『]/g, '(')
    .replace(/[）〕】」』]/g, ')')
    .replace(/[％]/g, '%')
    .trim();
}

const DANGEROUS_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Validates that a variable name is safe and does not pollute Object prototypes
 */
export function isSafeVariableName(name: string): boolean {
  return typeof name === 'string' && name.trim().length > 0 && !DANGEROUS_OBJECT_KEYS.has(name.trim());
}

/**
 * Safely evaluates purely numerical arithmetic expressions like "(20 / 30)", "480 * 6", "100 / 4", "50 + 20 - 10"
 * Uses a zero-dependency, pure recursive-descent parser without eval() or new Function().
 * Complies with strict CSP (Content Security Policy) and provides instant, zero-JIT-overhead calculations.
 */
export function evaluateSimpleArithmetic(expr: string): number | null {
  const normalized = normalizeEquationText(expr)
    // Convert percentage e.g. "25%" -> "(25 * 0.01)"
    .replace(/([0-9]+(?:\.[0-9]+)?)\s*%/g, '($1 * 0.01)')
    .replace(/\s+/g, '');

  if (!normalized) return null;

  // Only allow digits, +, -, *, /, ., (, )
  if (!/^[-+*\/0-9.()]+$/.test(normalized)) {
    return null;
  }

  let pos = 0;
  const len = normalized.length;

  function peek(): string {
    return pos < len ? normalized[pos] : '';
  }

  function consume(): string {
    return normalized[pos++];
  }

  // expr := term (('+' | '-') term)*
  function parseExpression(): number | null {
    let val = parseTerm();
    if (val === null) return null;

    while (pos < len) {
      const op = peek();
      if (op === '+' || op === '-') {
        consume();
        const next = parseTerm();
        if (next === null) return null;
        val = op === '+' ? val + next : val - next;
      } else {
        break;
      }
    }
    return val;
  }

  // term := factor (('*' | '/') factor)*
  function parseTerm(): number | null {
    let val = parseFactor();
    if (val === null) return null;

    while (pos < len) {
      const op = peek();
      if (op === '*' || op === '/') {
        consume();
        const next = parseFactor();
        if (next === null) return null;
        if (op === '/') {
          if (Math.abs(next) < 1e-15) return null; // Safe guard against division by zero
          val = val / next;
        } else {
          val = val * next;
        }
      } else {
        break;
      }
    }
    return val;
  }

  // factor := ('+' | '-')* (number | '(' expr ')')
  function parseFactor(): number | null {
    let sign = 1;
    while (peek() === '+' || peek() === '-') {
      if (consume() === '-') sign = -sign;
    }

    const ch = peek();
    if (ch === '(') {
      consume(); // consume '('
      const inner = parseExpression();
      if (inner === null || peek() !== ')') return null;
      consume(); // consume ')'
      return sign * inner;
    }

    // Number literal parsing
    const start = pos;
    let dotCount = 0;
    while (pos < len && /[0-9.]/.test(peek())) {
      if (peek() === '.') {
        dotCount++;
        if (dotCount > 1) return null; // Invalid number with multiple decimals
      }
      consume();
    }
    if (start === pos) return null;

    const numStr = normalized.slice(start, pos);
    const num = parseFloat(numStr);
    if (isNaN(num) || !isFinite(num)) return null;

    return sign * num;
  }

  try {
    const result = parseExpression();
    if (pos !== len || result === null || !isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

interface ParsedTerm {
  coeff: number;
  varName: string | null; // null if constant
}

/**
 * Splits a mathematical side string into top-level terms separated by + or - (respecting parentheses)
 */
function splitTopLevelTerms(sideStr: string): { sign: number; text: string }[] {
  const normalized = normalizeEquationText(sideStr);
  const terms: { sign: number; text: string }[] = [];

  let current = '';
  let currentSign = 1;
  let parenDepth = 0;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];

    if (ch === '(') {
      parenDepth++;
      current += ch;
    } else if (ch === ')') {
      if (parenDepth > 0) parenDepth--;
      current += ch;
    } else if (parenDepth === 0 && (ch === '+' || ch === '-')) {
      const trimmed = current.trim();
      if (trimmed) {
        terms.push({ sign: currentSign, text: trimmed });
        current = '';
      }
      currentSign = ch === '-' ? -1 : 1;
    } else {
      current += ch;
    }
  }

  const lastTrimmed = current.trim();
  if (lastTrimmed) {
    terms.push({ sign: currentSign, text: lastTrimmed });
  }

  return terms;
}

/**
 * Parses terms from an algebraic side, e.g. "2.5A + 5B - 10", "B = (20/30) * A", "480 * 6", "A / 30"
 */
function parseSideTerms(sideStr: string): ParsedTerm[] {
  const rawTerms = splitTopLevelTerms(sideStr);
  const results: ParsedTerm[] = [];

  // Match variable identifier (letters, underscore, Japanese hiragana/katakana/kanji/prolonged mark ー)
  const VAR_IDENTIFIER_REGEX = /[a-zA-Z_\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff66-\uff9f][a-zA-Z0-9_\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff66-\uff9f]*/g;
  const JAP_CLASS = 'a-zA-Z0-9_\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uff66-\\uff9f';

  for (const item of rawTerms) {
    const termText = item.text.trim();
    if (!termText) continue;

    // Find all variable identifiers in this term
    const varMatches = termText.match(VAR_IDENTIFIER_REGEX);

    if (!varMatches || varMatches.length === 0) {
      // Pure numerical constant term (e.g. "480 * 6", "100", "(50 + 20) / 2")
      const num = evaluateSimpleArithmetic(termText);
      if (num !== null) {
        results.push({ coeff: item.sign * num, varName: null });
      }
    } else if (varMatches.length === 1) {
      // Exactly one linear variable in this term (e.g. "(20/30)*A", "30*A", "A/2", "2.5A", "25%*売上", "ユーザー数", "-A", "A")
      const varName = varMatches[0];
      if (!isSafeVariableName(varName)) continue; // Prototype pollution protection

      const escapedVar = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // To calculate exact coefficient, insert explicit multiplication if missing, then replace variable with (1)
      let prepared = termText
        // Insert * between number/parenthesis and variable: e.g. "30A" -> "30 * A", "(20/30)A" -> "(20/30) * A"
        .replace(new RegExp(`([0-9%\\)])\\s*(${escapedVar})(?![${JAP_CLASS}])`, 'g'), '$1 * $2')
        .replace(new RegExp(`(?<![${JAP_CLASS}])(${escapedVar})\\s*(\\()`, 'g'), '$1 * $2');

      // Replace variable token with (1)
      const coeffExpr = prepared.replace(new RegExp(`(?<![${JAP_CLASS}])${escapedVar}(?![${JAP_CLASS}])`, 'g'), '(1)');

      const coeffVal = evaluateSimpleArithmetic(coeffExpr);
      const finalCoeff = coeffVal !== null ? item.sign * coeffVal : item.sign * 1;

      results.push({
        coeff: finalCoeff,
        varName,
      });
    } else {
      // Multiple identifiers in a single term: process each cleanly
      for (const v of varMatches) {
        if (isSafeVariableName(v)) {
          results.push({ coeff: item.sign * 1, varName: v });
        }
      }
    }
  }

  return results;
}

export interface RatioEquationInfo {
  canFlip: boolean;
  var1?: string;
  coeff1?: number;
  coeff1Str?: string;
  var2?: string;
  coeff2?: number;
  coeff2Str?: string;
  flippedEquation?: string;
  isArrowOrColon?: boolean;
}

/**
 * Detects if an equation represents a 2-variable ratio / conversion,
 * such as "30A = 20B", "30A -> 20B", "30A : 20B", "A = 1.5B", or "A:B = 30:20".
 * Returns flipped coefficients equation e.g. "20A = 30B".
 */
export function detectRatioEquation(eqStr: string): RatioEquationInfo {
  const trimmed = eqStr.trim();
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) {
    return { canFlip: false };
  }

  const normalized = normalizeEquationText(trimmed);

  // Check proportion syntax: A : B = 30 : 20
  const JAP_IDENTIFIER = '[a-zA-Z_\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uff66-\\uff9f][a-zA-Z0-9_\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uff66-\\uff9f]*';
  const propMatch = normalized.match(
    new RegExp(`^(${JAP_IDENTIFIER})\\s*[:：]\\s*(${JAP_IDENTIFIER})\\s*=\\s*([0-9.]+)\\s*[:：]\\s*([0-9.]+)$`)
  );
  if (propMatch) {
    const v1 = propMatch[1];
    const v2 = propMatch[2];
    const c1 = parseFloat(propMatch[3]);
    const c2 = parseFloat(propMatch[4]);
    const c1Str = Number.isInteger(c1) ? String(c1) : String(Number(c1.toFixed(4)));
    const c2Str = Number.isInteger(c2) ? String(c2) : String(Number(c2.toFixed(4)));
    return {
      canFlip: true,
      var1: v1,
      coeff1: c1,
      coeff1Str: c1Str,
      var2: v2,
      coeff2: c2,
      coeff2Str: c2Str,
      flippedEquation: `${c2Str}${v1} = ${c1Str}${v2}`,
      isArrowOrColon: true,
    };
  }

  // Check separator: arrow (->, →, =>, ⇒), colon (:), or equal (=)
  let separator: '=' | '->' | ':' = '=';
  let parts: string[] = [];

  const arrowMatch = normalized.match(/(-->|->|→|=>|⇒)/);
  const colonMatch = !arrowMatch && normalized.includes(':') && !normalized.includes('=');

  if (arrowMatch) {
    separator = '->';
    parts = normalized.split(/-->|->|→|=>|⇒/);
  } else if (colonMatch) {
    separator = ':';
    parts = normalized.split(/[:：]/);
  } else {
    parts = normalized.split('=');
  }

  if (parts.length !== 2) {
    return { canFlip: false };
  }

  const lhsTerms = parseSideTerms(parts[0]);
  const rhsTerms = parseSideTerms(parts[1]);

  if (
    lhsTerms.length === 1 &&
    lhsTerms[0].varName !== null &&
    rhsTerms.length === 1 &&
    rhsTerms[0].varName !== null &&
    lhsTerms[0].varName !== rhsTerms[0].varName
  ) {
    const v1 = lhsTerms[0].varName;
    const c1 = Math.abs(lhsTerms[0].coeff);
    const v2 = rhsTerms[0].varName;
    const c2 = Math.abs(rhsTerms[0].coeff);

    const c1Str = Number.isInteger(c1) ? String(c1) : String(Number(c1.toFixed(4)));
    const c2Str = Number.isInteger(c2) ? String(c2) : String(Number(c2.toFixed(4)));

    // Flipped: coeff2 goes to var1, coeff1 goes to var2
    const term1 = c2 === 1 ? v1 : `${c2Str}${v1}`;
    const term2 = c1 === 1 ? v2 : `${c1Str}${v2}`;
    const flippedEquation = `${term1} = ${term2}`;

    return {
      canFlip: true,
      var1: v1,
      coeff1: c1,
      coeff1Str: c1Str,
      var2: v2,
      coeff2: c2,
      coeff2Str: c2Str,
      flippedEquation,
      isArrowOrColon: separator !== '=',
    };
  }

  return { canFlip: false };
}

/**
 * Returns the equation with coefficients inverted between the 2 variables.
 * e.g. "30A = 20B" -> "20A = 30B"
 */
export function flipEquationCoefficients(eqStr: string): string | null {
  const info = detectRatioEquation(eqStr);
  return info.canFlip && info.flippedEquation ? info.flippedEquation : null;
}

export interface ParsedSystemEquation {
  raw: string;
  varCoeffs: Record<string, number>; // varName -> coeff (on LHS)
  rhsConstant: number; // constant on RHS
  isDirectAssignment?: { varName: string; value: number };
  isRatioConverted?: boolean;
}

/**
 * Parses an equation string like "2.5A + 5B = 10C" into linear standard form:
 * 2.5A + 5B - 10C = 0
 *
 * If `isRatioMode` is true, or if arrow/colon is used (e.g. "30A -> 20B" or "30A : 20B"),
 * coefficients are automatically inverted to represent the ratio relation (20A = 30B).
 */
export function parseSystemEquation(
  eqStr: string,
  isRatioMode?: boolean
): ParsedSystemEquation | null {
  const trimmed = eqStr.trim();
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) return null;

  const normalized = normalizeEquationText(trimmed);

  // Check proportion syntax: A : B = 30 : 20
  const JAP_IDENTIFIER = '[a-zA-Z_\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uff66-\\uff9f][a-zA-Z0-9_\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uff66-\\uff9f]*';
  const propMatch = normalized.match(
    new RegExp(`^(${JAP_IDENTIFIER})\\s*[:：]\\s*(${JAP_IDENTIFIER})\\s*=\\s*([0-9.]+)\\s*[:：]\\s*([0-9.]+)$`)
  );
  if (propMatch) {
    const v1 = propMatch[1];
    const v2 = propMatch[2];
    const c1 = parseFloat(propMatch[3]);
    const c2 = parseFloat(propMatch[4]);
    if (!isNaN(c1) && !isNaN(c2) && c1 !== 0 && c2 !== 0) {
      // v1 : v2 = c1 : c2 => c2 * v1 = c1 * v2 => c2 * v1 - c1 * v2 = 0
      return {
        raw: trimmed,
        varCoeffs: { [v1]: c2, [v2]: -c1 },
        rhsConstant: 0,
        isRatioConverted: true,
      };
    }
  }

  // Check if equation uses explicit arrow (->, →, =>, ⇒) or colon (:) for conversion/ratio
  let separator: '=' | '->' | ':' = '=';
  let parts: string[] = [];

  const arrowMatch = normalized.match(/(-->|->|→|=>|⇒)/);
  const colonMatch = !arrowMatch && normalized.includes(':') && !normalized.includes('=');

  if (arrowMatch) {
    separator = '->';
    parts = normalized.split(/-->|->|→|=>|⇒/);
  } else if (colonMatch) {
    separator = ':';
    parts = normalized.split(/[:：]/);
  } else {
    parts = normalized.split('=');
  }

  if (parts.length !== 2) {
    return null;
  }

  const lhsTerms = parseSideTerms(parts[0]);
  const rhsTerms = parseSideTerms(parts[1]);

  // Check if this is a 2-variable ratio conversion
  const isTwoVarRatio =
    lhsTerms.length === 1 &&
    lhsTerms[0].varName !== null &&
    rhsTerms.length === 1 &&
    rhsTerms[0].varName !== null &&
    lhsTerms[0].varName !== rhsTerms[0].varName;

  const shouldInvertForRatio =
    isTwoVarRatio && (separator === '->' || separator === ':' || isRatioMode === true);

  const varCoeffs: Record<string, number> = {};
  let rhsConstant = 0;

  if (shouldInvertForRatio) {
    // Ratio conversion: coeff1 * var1 relates to coeff2 * var2
    // By ratio rule (var1 : var2 = coeff1 : coeff2):
    // Inverted equation is: coeff2 * var1 = coeff1 * var2
    // Standard form: coeff2 * var1 - coeff1 * var2 = 0
    const var1 = lhsTerms[0].varName!;
    const coeff1 = lhsTerms[0].coeff;
    const var2 = rhsTerms[0].varName!;
    const coeff2 = rhsTerms[0].coeff;

    varCoeffs[var1] = coeff2;
    varCoeffs[var2] = -coeff1;
    rhsConstant = 0;
  } else {
    // Standard linear equation
    for (const term of lhsTerms) {
      if (term.varName) {
        varCoeffs[term.varName] = (varCoeffs[term.varName] || 0) + term.coeff;
      } else {
        rhsConstant -= term.coeff;
      }
    }

    for (const term of rhsTerms) {
      if (term.varName) {
        varCoeffs[term.varName] = (varCoeffs[term.varName] || 0) - term.coeff;
      } else {
        rhsConstant += term.coeff;
      }
    }
  }

  // Clean near-zero coefficients
  for (const [k, v] of Object.entries(varCoeffs)) {
    if (Math.abs(v) < 1e-9) {
      delete varCoeffs[k];
    }
  }

  // Detect direct assignment: e.g. "B = 2880" or "B = 480 * 6"
  let isDirectAssignment: { varName: string; value: number } | undefined;
  const nonZeroVars = Object.keys(varCoeffs);
  if (nonZeroVars.length === 1) {
    const vName = nonZeroVars[0];
    const coeff = varCoeffs[vName];
    if (coeff !== 0) {
      isDirectAssignment = { varName: vName, value: rhsConstant / coeff };
    }
  }

  return {
    raw: trimmed,
    varCoeffs,
    rhsConstant,
    isDirectAssignment,
    isRatioConverted: shouldInvertForRatio,
  };
}

/**
 * Standard Gaussian Elimination and Iterative Substitution Linear Solver
 */
export function solveStandardLinearSystem(
  config: SystemEquationConfig,
  customOverrides?: Record<string, number | null>
): SystemSolveResult {
  const activeRows = config.equations.filter((eq) => eq.isEnabled && eq.rawText.trim().length > 0);
  const overrides = customOverrides || config.userOverrides || {};

  if (activeRows.length === 0 && Object.keys(overrides).length === 0) {
    return {
      status: 'empty',
      variables: {},
      varStatus: {},
      discoveredVars: [],
      steps: [],
      equationCount: 0,
      variableCount: 0,
    };
  }

  const parsedEquations: ParsedSystemEquation[] = [];
  const allVarsSet = new Set<string>();

  // Parse all equations
  for (const row of activeRows) {
    const parsed = parseSystemEquation(row.rawText, row.isRatioMode);
    if (parsed) {
      parsedEquations.push(parsed);
      for (const v of Object.keys(parsed.varCoeffs)) {
        allVarsSet.add(v);
      }
    }
  }

  // Also include variables from overrides
  for (const v of Object.keys(overrides)) {
    if (overrides[v] !== null && !isNaN(overrides[v]!)) {
      allVarsSet.add(v);
    }
  }

  const varList = Array.from(allVarsSet).sort();
  const knownValues: Record<string, number> = {};
  const varStatus: Record<string, 'solved' | 'given' | 'proportional' | 'free'> = {};
  const steps: SystemStep[] = [];

  // Step 1: Record user overrides
  for (const v of varList) {
    if (overrides[v] !== null && overrides[v] !== undefined && !isNaN(overrides[v]!)) {
      knownValues[v] = overrides[v]!;
      varStatus[v] = 'given';
      steps.push({
        title: `条件指定: ${v} = ${overrides[v]}`,
        formula: `${v} = ${overrides[v]}`,
        explanation: `ユーザー指定または前提条件として ${v} を固定します。`,
        highlightVar: v,
        value: overrides[v]!,
      });
    }
  }

  // Step 2: Record direct equation evaluations (e.g. B = 480 * 6)
  for (const eq of parsedEquations) {
    if (eq.isDirectAssignment) {
      const { varName, value } = eq.isDirectAssignment;
      if (knownValues[varName] === undefined) {
        knownValues[varName] = value;
        varStatus[varName] = 'solved';
        steps.push({
          title: `直接算出: ${varName}`,
          formula: `${eq.raw} ⇒ ${varName} = ${value}`,
          explanation: `式「${eq.raw}」の計算より、${varName} の値が確定しました。`,
          highlightVar: varName,
          value,
        });
      }
    }
  }

  // Step 3: Iterative substitution solver (solves chained/cascading equations)
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 30) {
    changed = false;
    iterations++;

    for (const eq of parsedEquations) {
      const varsInEq = Object.keys(eq.varCoeffs);
      const unknownVars = varsInEq.filter((v) => knownValues[v] === undefined);

      // If exactly 1 unknown variable remains in this equation, solve it directly!
      if (unknownVars.length === 1) {
        const unknown = unknownVars[0];
        const coeff = eq.varCoeffs[unknown];
        if (coeff !== 0) {
          // LHS known sum
          let knownSum = 0;
          for (const v of varsInEq) {
            if (v !== unknown) {
              knownSum += eq.varCoeffs[v] * knownValues[v];
            }
          }
          const solvedVal = (eq.rhsConstant - knownSum) / coeff;
          knownValues[unknown] = solvedVal;
          varStatus[unknown] = 'solved';
          changed = true;

          steps.push({
            title: `方程式より算出: ${unknown}`,
            formula: `${eq.raw} ⇒ ${unknown} = ${solvedVal}`,
            explanation: `既知の変数を式「${eq.raw}」に代入して ${unknown} を求めました。`,
            highlightVar: unknown,
            value: solvedVal,
          });
        }
      }
    }
  }

  // Step 4: If any variables still remain unknown, attempt full Gaussian Elimination on remaining equations
  const remainingVars = varList.filter((v) => knownValues[v] === undefined);
  if (remainingVars.length > 0) {
    // Build matrix A * x = b for remaining unknowns
    const matrix: number[][] = [];
    const bVec: number[] = [];

    for (const eq of parsedEquations) {
      let eqLhsConst = 0;
      const row: number[] = [];
      let hasAnyRemainingVar = false;

      for (const v of remainingVars) {
        const coeff = eq.varCoeffs[v] || 0;
        row.push(coeff);
        if (coeff !== 0) hasAnyRemainingVar = true;
      }

      // Subtract known variables contributions from RHS
      for (const [v, c] of Object.entries(eq.varCoeffs)) {
        if (knownValues[v] !== undefined) {
          eqLhsConst += c * knownValues[v];
        }
      }

      if (hasAnyRemainingVar) {
        matrix.push(row);
        bVec.push(eq.rhsConstant - eqLhsConst);
      }
    }

    if (matrix.length > 0) {
      const gaussRes = solveGaussian(matrix, bVec);
      if (gaussRes) {
        for (let i = 0; i < remainingVars.length; i++) {
          const v = remainingVars[i];
          if (gaussRes[i] !== null && !isNaN(gaussRes[i]!)) {
            knownValues[v] = gaussRes[i]!;
            varStatus[v] = 'solved';
            steps.push({
              title: `連立消去法による解: ${v}`,
              formula: `${v} = ${gaussRes[i]}`,
              explanation: `連立方程式を行列消去法（ガウスの消去法）により解き、${v} を算出しました。`,
              highlightVar: v,
              value: gaussRes[i]!,
            });
          }
        }
      }
    }
  }

  // Step 5: Proportional Mixture Fallback for remaining underdetermined variables (like 2.5A + 5B = 10C when B is known)
  if (config.proportionalBalance) {
    for (const eq of parsedEquations) {
      const varsInEq = Object.keys(eq.varCoeffs);
      const unknowns = varsInEq.filter((v) => knownValues[v] === undefined);
      const knowns = varsInEq.filter((v) => knownValues[v] !== undefined);

      // Example: 2.5A + 5B = 10C where B is known, or C is known
      // If mixture proportion is balanced: ratio of unknown to known is proportional to coeffs
      if (unknowns.length >= 1 && knowns.length >= 1) {
        const refKnown = knowns[0];
        const refVal = knownValues[refKnown];
        const refCoeff = Math.abs(eq.varCoeffs[refKnown]);

        if (refCoeff > 0 && refVal !== 0) {
          for (const u of unknowns) {
            const uCoeff = Math.abs(eq.varCoeffs[u]);
            if (uCoeff > 0 && knownValues[u] === undefined) {
              // Proportional ratio: u = refVal * (uCoeff / refCoeff)
              const propVal = refVal * (uCoeff / refCoeff);
              knownValues[u] = propVal;
              varStatus[u] = 'proportional';
              steps.push({
                title: `比例バランス配分: ${u}`,
                formula: `${u} = ${propVal}`,
                explanation: `比率関係（係数比 ${uCoeff} : ${refCoeff}）に基づき、${refKnown} = ${refVal} から ${u} を連動算出しました。`,
                highlightVar: u,
                value: propVal,
              });
            }
          }
        }
      }
    }

    // Run iterative substitution one more time in case new values unlocked further equations (like 30C = 20D)
    let extraChanged = true;
    let extraIter = 0;
    while (extraChanged && extraIter < 10) {
      extraChanged = false;
      extraIter++;
      for (const eq of parsedEquations) {
        const varsInEq = Object.keys(eq.varCoeffs);
        const unknownVars = varsInEq.filter((v) => knownValues[v] === undefined);
        if (unknownVars.length === 1) {
          const unknown = unknownVars[0];
          const coeff = eq.varCoeffs[unknown];
          if (coeff !== 0) {
            let knownSum = 0;
            for (const v of varsInEq) {
              if (v !== unknown) {
                knownSum += eq.varCoeffs[v] * (knownValues[v] ?? 0);
              }
            }
            const solvedVal = (eq.rhsConstant - knownSum) / coeff;
            knownValues[unknown] = solvedVal;
            varStatus[unknown] = 'solved';
            extraChanged = true;

            steps.push({
              title: `連鎖算出: ${unknown}`,
              formula: `${eq.raw} ⇒ ${unknown} = ${solvedVal}`,
              explanation: `連動した値を式「${eq.raw}」に代入し、${unknown} を導出しました。`,
              highlightVar: unknown,
              value: solvedVal,
            });
          }
        }
      }
    }
  }

  // Determine overall solution status
  const solvedCount = Object.keys(knownValues).length;
  const totalCount = varList.length;

  let status: SystemSolveResult['status'] = 'solved';
  if (totalCount === 0) {
    status = 'empty';
  } else if (solvedCount === 0) {
    status = 'underdetermined';
  } else if (solvedCount < totalCount) {
    status = 'partial';
  } else {
    status = 'solved';
  }

  return {
    status,
    variables: knownValues,
    varStatus,
    discoveredVars: varList,
    steps,
    equationCount: activeRows.length,
    variableCount: totalCount,
  };
}

/**
 * Standard Gaussian Elimination solver with partial pivoting for M x N matrix
 */
function solveGaussian(A: number[][], b: number[]): (number | null)[] | null {
  const m = A.length;
  const n = A[0]?.length || 0;
  if (m === 0 || n === 0) return null;

  // Make copy of augmented matrix
  const M: number[][] = A.map((row, i) => [...row, b[i]]);

  let lead = 0;
  for (let r = 0; r < m && lead < n; r++) {
    let pivot = r;
    for (let i = r + 1; i < m; i++) {
      if (Math.abs(M[i][lead]) > Math.abs(M[pivot][lead])) {
        pivot = i;
      }
    }

    if (Math.abs(M[pivot][lead]) < 1e-10) {
      lead++;
      r--;
      continue;
    }

    // Swap rows
    const temp = M[r];
    M[r] = M[pivot];
    M[pivot] = temp;

    // Normalize pivot row
    const div = M[r][lead];
    for (let j = 0; j <= n; j++) {
      M[r][j] /= div;
    }

    // Eliminate other rows
    for (let i = 0; i < m; i++) {
      if (i !== r) {
        const factor = M[i][lead];
        for (let j = 0; j <= n; j++) {
          M[i][j] -= factor * M[r][j];
        }
      }
    }

    lead++;
  }

  // Back-substitution / extraction
  const x: (number | null)[] = new Array(n).fill(null);
  for (let r = 0; r < m; r++) {
    const nonZeroCols = [];
    for (let c = 0; c < n; c++) {
      if (Math.abs(M[r][c]) > 1e-9) nonZeroCols.push(c);
    }
    if (nonZeroCols.length === 1) {
      const col = nonZeroCols[0];
      x[col] = M[r][n];
    }
  }

  return x;
}

export interface RecipeDefinition {
  id: string;
  rawText: string;
  productVar: string;
  productQty: number;
  ingredients: Array<{ varName: string; qty: number }>;
}

/**
 * Parses an equation row into a Recipe (Product and Ingredients).
 * Supports:
 * - "2HMF = 10MF + 40鋼管 + 5被覆鋼梁 + 240ネジ"
 * - "260ネジ = 5鋼梁"
 * - "15鋼梁 : 60鋼鉄インゴット"
 * - "5鋼梁 -> 260ネジ"
 * - Flipped / ratioMode rows: "5ネジ = 260鋼梁" with isRatioMode -> 260ネジ = 5鋼梁
 */
export function parseEquationToRecipe(row: SystemEquationRow): RecipeDefinition | null {
  const trimmed = row.rawText.trim();
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) return null;

  const normalized = normalizeEquationText(trimmed);

  // Check proportion syntax: A : B = 30 : 20
  const JAP_IDENTIFIER =
    '[a-zA-Z_\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uff66-\\uff9f][a-zA-Z0-9_\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uff66-\\uff9f]*';
  const propMatch = normalized.match(
    new RegExp(`^(${JAP_IDENTIFIER})\\s*[:：]\\s*(${JAP_IDENTIFIER})\\s*=\\s*([0-9.]+)\\s*[:：]\\s*([0-9.]+)$`)
  );
  if (propMatch) {
    const v1 = propMatch[1];
    const v2 = propMatch[2];
    const c1 = parseFloat(propMatch[3]);
    const c2 = parseFloat(propMatch[4]);
    if (!isNaN(c1) && !isNaN(c2) && c1 > 0 && c2 > 0) {
      return {
        id: row.id,
        rawText: row.rawText,
        productVar: v1,
        productQty: c1,
        ingredients: [{ varName: v2, qty: c2 }],
      };
    }
  }

  // Check separator
  let separator: '=' | '->' | ':' = '=';
  let parts: string[] = [];

  const arrowMatch = normalized.match(/(-->|->|→|=>|⇒)/);
  const colonMatch = !arrowMatch && normalized.includes(':') && !normalized.includes('=');

  if (arrowMatch) {
    separator = '->';
    parts = normalized.split(/-->|->|→|=>|⇒/);
  } else if (colonMatch) {
    separator = ':';
    parts = normalized.split(/[:：]/);
  } else {
    parts = normalized.split('=');
  }

  if (parts.length !== 2) return null;

  const lhsTerms = parseSideTerms(parts[0]);
  const rhsTerms = parseSideTerms(parts[1]);

  if (lhsTerms.length === 0 || rhsTerms.length === 0) return null;

  const lhsHasOnlyVars = lhsTerms.every((t) => t.varName !== null);
  const rhsHasOnlyVars = rhsTerms.every((t) => t.varName !== null);

  if (!lhsHasOnlyVars || !rhsHasOnlyVars) {
    return null;
  }

  // Case 1: arrow A -> B (A is ingredients, B is product)
  if (separator === '->') {
    if (rhsTerms.length === 1 && rhsTerms[0].varName !== null) {
      return {
        id: row.id,
        rawText: row.rawText,
        productVar: rhsTerms[0].varName,
        productQty: Math.abs(rhsTerms[0].coeff),
        ingredients: lhsTerms.map((t) => ({ varName: t.varName!, qty: Math.abs(t.coeff) })),
      };
    }
  }

  // Case 2: LHS has 1 term, RHS has 1 or more terms (standard [Product] = [Ingredients])
  if (lhsTerms.length === 1 && lhsTerms[0].varName !== null) {
    const pVar = lhsTerms[0].varName;
    const pQty = Math.abs(lhsTerms[0].coeff);
    const ings = rhsTerms.map((t) => ({ varName: t.varName!, qty: Math.abs(t.coeff) }));

    if (row.isRatioMode && ings.length === 1) {
      // Inverted ratio mode: e.g. 5ネジ = 260鋼梁 flipped to 260ネジ = 5鋼梁
      return {
        id: row.id,
        rawText: row.rawText,
        productVar: pVar,
        productQty: ings[0].qty,
        ingredients: [{ varName: ings[0].varName, qty: pQty }],
      };
    }

    return {
      id: row.id,
      rawText: row.rawText,
      productVar: pVar,
      productQty: pQty,
      ingredients: ings,
    };
  }

  // Case 3: RHS has 1 term, LHS has multiple terms ([Ingredients] = [Product])
  if (rhsTerms.length === 1 && rhsTerms[0].varName !== null) {
    return {
      id: row.id,
      rawText: row.rawText,
      productVar: rhsTerms[0].varName,
      productQty: Math.abs(rhsTerms[0].coeff),
      ingredients: lhsTerms.map((t) => ({ varName: t.varName!, qty: Math.abs(t.coeff) })),
    };
  }

  return null;
}

function formatRecipeNum(val: number): string {
  if (Number.isInteger(val)) return String(val);
  return Number(val.toFixed(3)).toString();
}

/**
 * Factory Production Tree (BOM) Solver:
 * Propagates demand from target products down through intermediate recipes,
 * correctly accumulating shared materials (e.g. 鋼梁, 鋼管, ネジ, 鋼鉄インゴット)
 * consumed across multiple recipes.
 */
export function solveRecipeTreeSystem(
  config: SystemEquationConfig,
  customOverrides?: Record<string, number | null>
): SystemSolveResult | null {
  const activeRows = config.equations.filter((eq) => eq.isEnabled && eq.rawText.trim().length > 0);
  const overrides = customOverrides || config.userOverrides || {};

  if (activeRows.length === 0 && Object.keys(overrides).length === 0) {
    return {
      status: 'empty',
      variables: {},
      varStatus: {},
      discoveredVars: [],
      steps: [],
      equationCount: 0,
      variableCount: 0,
      isRecipeTreeMode: true,
    };
  }

  const recipes: RecipeDefinition[] = [];
  for (const row of activeRows) {
    const r = parseEquationToRecipe(row);
    if (!r) {
      // Equation does not follow recipe format (e.g. x + y = 10 with constant 10)
      return null;
    }
    recipes.push(r);
  }

  if (recipes.length === 0) {
    return null;
  }

  // Collect variables
  const allVarsSet = new Set<string>();
  const producedSet = new Set<string>();
  const consumedSet = new Set<string>();

  for (const r of recipes) {
    allVarsSet.add(r.productVar);
    producedSet.add(r.productVar);
    for (const ing of r.ingredients) {
      allVarsSet.add(ing.varName);
      consumedSet.add(ing.varName);
    }
  }

  for (const v of Object.keys(overrides)) {
    if (overrides[v] !== null && overrides[v] !== undefined && !isNaN(overrides[v]!)) {
      allVarsSet.add(v);
    }
  }

  const varList = Array.from(allVarsSet).sort();
  const rootProducts = Array.from(producedSet).filter((p) => !consumedSet.has(p));
  const rawMaterials = Array.from(consumedSet).filter((c) => !producedSet.has(c));
  const intermediates = Array.from(producedSet).filter((p) => consumedSet.has(p));

  // Targets / Goals
  const targets: Record<string, number> = {};
  for (const [v, val] of Object.entries(overrides)) {
    if (val !== null && val !== undefined && !isNaN(val) && val > 0) {
      targets[v] = val;
    }
  }

  // If no user target specified, default the primary root product to its recipe batch quantity
  if (Object.keys(targets).length === 0) {
    const defaultProduct = rootProducts.length > 0 ? rootProducts[0] : recipes[0]?.productVar;
    if (defaultProduct) {
      const rec = recipes.find((r) => r.productVar === defaultProduct);
      targets[defaultProduct] = rec ? rec.productQty : 1;
    }
  }

  const totalDemands: Record<string, number> = {};
  const rawBreakdowns: Record<string, Array<{ source: string; amount: number; ratioNote?: string }>> = {};
  const batches: Record<string, number> = {};
  const steps: SystemStep[] = [];
  const varStatus: Record<string, 'solved' | 'given' | 'proportional' | 'free'> = {};

  // Step 1: Initialize target production quantities
  for (const [v, val] of Object.entries(targets)) {
    totalDemands[v] = val;
    varStatus[v] = 'given';
    steps.push({
      title: `生産目標指定: ${v} = ${val}`,
      formula: `${v} = ${val}`,
      explanation: `基準生産量（目標設定）として ${v} を ${val} 個に設定しました。`,
      highlightVar: v,
      value: val,
    });
  }

  // Map recipes by product
  const recipeMap = new Map<string, RecipeDefinition>();
  for (const r of recipes) {
    if (!recipeMap.has(r.productVar)) {
      recipeMap.set(r.productVar, r);
    }
  }

  // Queue for BFS demand propagation with path-tracking for circular dependency prevention
  const queue: Array<{
    item: string;
    amount: number;
    source: string;
    ratioNote?: string;
    path: string[];
  }> = [];

  for (const [v, val] of Object.entries(targets)) {
    if (isSafeVariableName(v)) {
      queue.push({ item: v, amount: val, source: '目標生産数', path: [v] });
    }
  }

  let iterations = 0;
  const maxIterations = 1000;

  while (queue.length > 0 && iterations < maxIterations) {
    iterations++;
    const current = queue.shift()!;

    if (!isSafeVariableName(current.item)) continue;

    if (current.source !== '目標生産数') {
      totalDemands[current.item] = (totalDemands[current.item] || 0) + current.amount;
      if (!varStatus[current.item]) {
        varStatus[current.item] = 'solved';
      }
      if (!rawBreakdowns[current.item]) {
        rawBreakdowns[current.item] = [];
      }
      rawBreakdowns[current.item].push({
        source: current.source,
        amount: current.amount,
        ratioNote: current.ratioNote,
      });
    }

    const recipe = recipeMap.get(current.item);
    if (recipe && recipe.productQty > 0) {
      const batchCount = current.amount / recipe.productQty;
      batches[current.item] = (batches[current.item] || 0) + batchCount;

      for (const ing of recipe.ingredients) {
        if (!isSafeVariableName(ing.varName)) continue;

        // Circular dependency check: If ing.varName already exists in the current ancestry path,
        // break cycle immediately to prevent infinite loop or explosion
        if (current.path.includes(ing.varName)) {
          continue;
        }

        const needed = batchCount * ing.qty;
        queue.push({
          item: ing.varName,
          amount: needed,
          source: current.item,
          ratioNote: `${current.item} ${formatRecipeNum(current.amount)}個製造（1バッチ${recipe.productQty}個中${ing.qty}個消費）`,
          path: [...current.path, ing.varName],
        });
      }
    }
  }

  // Consolidate breakdowns by source parent item
  const breakdowns: Record<string, RecipeBreakdownItem[]> = {};
  for (const v of Object.keys(totalDemands)) {
    if (rawBreakdowns[v] && rawBreakdowns[v].length > 0) {
      const sourceMap = new Map<string, number>();
      for (const item of rawBreakdowns[v]) {
        sourceMap.set(item.source, (sourceMap.get(item.source) || 0) + item.amount);
      }
      const consolidated: RecipeBreakdownItem[] = [];
      for (const [src, amt] of sourceMap.entries()) {
        consolidated.push({ source: src, amount: amt });
      }
      breakdowns[v] = consolidated;
    }
  }

  // Generate steps with breakdown explanations
  for (const v of varList) {
    if (targets[v] !== undefined && (rawBreakdowns[v] === undefined || rawBreakdowns[v].length === 0)) {
      continue; // already in steps as target
    }

    const totalVal = totalDemands[v];
    if (totalVal === undefined) continue;

    const bList = breakdowns[v] || [];
    if (bList.length > 1) {
      // Multiple consumption sources (e.g. 鋼梁, 鋼管, ネジ, 鋼鉄インゴット)!
      const formulaParts = bList.map((b) => `${formatRecipeNum(b.amount)} (${b.source}用)`);
      steps.push({
        title: `複数レシピからの合算: ${v}`,
        formula: `${v} = ${formulaParts.join(' + ')} = ${formatRecipeNum(totalVal)}`,
        explanation: `「${v}」は複数のレシピで消費されます。各工程の所要量（${bList.map((b) => `${b.source}用: ${formatRecipeNum(b.amount)}個`).join('、')}）を合算し、工場全体の総必要量 ${formatRecipeNum(totalVal)} 個を算出しました。`,
        highlightVar: v,
        value: totalVal,
      });
    } else if (bList.length === 1) {
      const src = bList[0].source;
      const rec = recipeMap.get(src);
      const ingDef = rec?.ingredients.find((i) => i.varName === v);
      steps.push({
        title: `素材の要求算出: ${v}`,
        formula: `${v} = ${formatRecipeNum(totalVal)} (${src}用)`,
        explanation: `上位製品「${src}」の生産に伴い、レシピ比率（${src} ${rec?.productQty}個に対し ${v} ${ingDef?.qty}個）に基づき ${formatRecipeNum(totalVal)} 個が要求されました。`,
        highlightVar: v,
        value: totalVal,
      });
    }
  }

  for (const v of varList) {
    if (varStatus[v] === undefined) {
      varStatus[v] = 'free';
    }
  }

  return {
    status: 'solved',
    variables: totalDemands,
    varStatus,
    discoveredVars: varList,
    steps,
    equationCount: activeRows.length,
    variableCount: varList.length,
    isRecipeTreeMode: true,
    recipeTreeData: {
      rootProducts,
      rawMaterials,
      intermediates,
      breakdowns,
      batches,
      recipes: recipes.map((r) => ({
        id: r.id,
        productVar: r.productVar,
        productQty: r.productQty,
        ingredients: r.ingredients,
      })),
    },
  };
}

/**
 * Main General Linear & Recipe Tree Solver
 * Dispatches to Recipe Tree solver (for factory recipes / BOM accumulation)
 * or Standard Linear Solver (for algebraic simultaneous equations).
 */
export function solveSystemOfEquations(
  config: SystemEquationConfig,
  customOverrides?: Record<string, number | null>
): SystemSolveResult {
  const solverMode = config.solverMode || 'recipe_tree';

  if (solverMode === 'recipe_tree') {
    const treeResult = solveRecipeTreeSystem(config, customOverrides);
    if (treeResult) {
      return treeResult;
    }
  }

  return solveStandardLinearSystem(config, customOverrides);
}

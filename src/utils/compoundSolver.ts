import { PrecisionMode } from '../types';
import { formatValue } from './calculator';

export interface MultiEquationStep {
  equationText: string;
  explanation: string;
  formula: string;
  resultVar: string;
  resultValue: number;
}

export interface MultiEquationSolution {
  title: string;
  description: string;
  equations: string[];
  given: { name: string; value: number; expr?: string }[];
  steps: MultiEquationStep[];
  results: { name: string; value: number; unit?: string }[];
}

/**
 * Solves the requested compound equation system:
 * 1) 2.5A + 5B = 10C
 * 2) 30C = 20D (or 3C = 2D => D = 1.5C)
 * 3) B = 480 × 6 = 2880
 *
 * When proportional mode is balanced or when A is given/varied,
 * we can compute all variables A, B, C, D!
 *
 * Standard baseline:
 * - If 2.5A + 5B = 10C is a proportional mixture where A & B balance with ratio 2.5 : 5 (i.e. A : B = 1 : 2 => A = B / 2),
 *   Given B = 2880:
 *   A = 1440
 *   2.5(1440) + 5(2880) = 3600 + 14400 = 18000 = 10C => C = 1800
 *   30C = 20D => 30(1800) = 54000 = 20D => D = 2700 (or D = 1.5 × C = 2700)
 */
export function solveCompoundSystem(
  bValue: number = 2880,
  aValue: number | null = null,
  cCoeff: number = 10,
  cToD_cCoeff: number = 30,
  cToD_dCoeff: number = 20
): MultiEquationSolution {
  // If A is not provided, default to proportional ratio of 2.5A to 5B (i.e., A = B * (2.5/5) or A = B * 0.5 = 1440)
  const A = aValue !== null ? aValue : (bValue * 2.5) / 5;
  const B = bValue;

  const lhsTotal = 2.5 * A + 5 * B;
  const C = lhsTotal / cCoeff; // 18000 / 10 = 1800

  // 30C = 20D => D = (30 * C) / 20 = 1.5 * C = 2700
  const D = (cToD_cCoeff * C) / cToD_dCoeff;

  return {
    title: '連立・複合方程式の解法例題',
    description: '2.5A + 5B = 10C , 30C = 20D , B = 480 × 6',
    equations: ['2.5A + 5B = 10C', '30C = 20D', 'B = 480 × 6'],
    given: [
      { name: 'B', value: B, expr: '480 × 6 = 2,880' },
      { name: 'A', value: A, expr: aValue !== null ? `${A}` : '比例関係: 2.5A : 5B ⇒ 1,440' },
    ],
    steps: [
      {
        equationText: 'B の確定',
        formula: 'B = 480 × 6',
        explanation: '与えられた条件から B の確定値を計算します。',
        resultVar: 'B',
        resultValue: B,
      },
      {
        equationText: '第1方程式: 2.5A + 5B = 10C',
        formula: `2.5 × (${A}) + 5 × (${B}) = ${lhsTotal} = 10C`,
        explanation: `左辺の合計 ${lhsTotal} を 10 で割り、C を算出します。`,
        resultVar: 'C',
        resultValue: C,
      },
      {
        equationText: '第2方程式: 30C = 20D',
        formula: `30 × (${C}) = ${cToD_cCoeff * C} = 20D ⇒ D = ${cToD_cCoeff * C} ÷ 20`,
        explanation: `30C の値 (${cToD_cCoeff * C}) を 20 で割り、D を算出します。`,
        resultVar: 'D',
        resultValue: D,
      },
    ],
    results: [
      { name: 'A', value: A, unit: '値' },
      { name: 'B', value: B, unit: '値' },
      { name: 'C', value: C, unit: '値' },
      { name: 'D', value: D, unit: '値' },
    ],
  };
}

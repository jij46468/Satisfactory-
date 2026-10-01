import { PrecisionMode } from '../types';

/**
 * Format a number cleanly according to chosen precision mode
 */
export function formatValue(val: number | null | undefined, precision: PrecisionMode = 'auto'): string {
  if (val === null || val === undefined || isNaN(val)) return '';
  if (!isFinite(val)) return '0';

  if (precision === 'auto') {
    // Keep up to 4 decimals, trim trailing zeros
    const rounded = Math.round(val * 10000) / 10000;
    if (Number.isInteger(rounded)) return rounded.toString();
    // Return formatted string without trailing zeroes
    return rounded.toFixed(4).replace(/\.?0+$/, '');
  }

  const digits = parseInt(precision, 10);
  return val.toFixed(digits);
}

/**
 * Parses user input to float safely, returning null if invalid/empty
 */
export function parseNumericInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '-' || trimmed === '.') return null;
  const num = parseFloat(trimmed);
  return isNaN(num) ? null : num;
}

/**
 * Calculates Greatest Common Divisor (GCD)
 */
export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

/**
 * Converts decimal to clean fraction string representation (e.g. 0.5 -> "1/2")
 * Protected against zero-division, non-finite values, and runaway loops.
 */
export function toFraction(val: number, tolerance = 1.0e-4): string {
  if (val === 0 || !isFinite(val) || isNaN(val)) return '0';
  if (Number.isInteger(val)) return val.toString();

  const isNeg = val < 0;
  const absVal = Math.abs(val);

  let h1 = 1, h2 = 0;
  let k1 = 0, k2 = 1;
  let b = absVal;
  let iterations = 0;
  const maxIterations = 15; // Prevent runaway continued fraction loops

  do {
    iterations++;
    const a = Math.floor(b);
    let aux = h1;
    h1 = a * h1 + h2;
    h2 = aux;
    aux = k1;
    k1 = a * k1 + k2;
    k2 = aux;

    const diff = b - a;
    if (Math.abs(diff) < 1e-12) {
      break; // Terminate early on clean integer remainder
    }
    b = 1 / diff;
  } while (
    isFinite(b) &&
    Math.abs(absVal - h1 / k1) > absVal * tolerance &&
    k1 < 1000 &&
    iterations < maxIterations
  );

  const res = `${h1}/${k1}`;
  return isNeg ? `-${res}` : res;
}

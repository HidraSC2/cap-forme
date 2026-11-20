import type { Ingredient, Qty, Unit } from './types.ts';

const DEFAULT_CS_G = 12;
const DEFAULT_PIECE_G = 100;

/** « 500g », « 1.5kg », « 20cl », « 1l », « 2cs », « 1cc », « 2 » (pièces). */
export function parseQty(raw: string): Qty {
  const m = raw.trim().replace(',', '.').match(/^(\d+(?:\.\d+)?)\s*(kg|g|ml|cl|l|cs|cc)?$/i);
  if (!m) throw new Error(`Quantité illisible : « ${raw} »`);
  const n = Number(m[1]);
  switch ((m[2] ?? '').toLowerCase()) {
    case 'kg': return { n: n * 1000, unit: 'g' };
    case 'g': return { n, unit: 'g' };
    case 'l': return { n: n * 1000, unit: 'ml' };
    case 'cl': return { n: n * 10, unit: 'ml' };
    case 'ml': return { n, unit: 'ml' };
    case 'cs': return { n, unit: 'cs' };
    case 'cc': return { n, unit: 'cc' };
    default: return { n, unit: 'pc' };
  }
}

export function toGrams(q: Qty, ing: Ingredient): number {
  switch (q.unit) {
    case 'g': return q.n;
    case 'ml': return q.n * (ing.mlG ?? 1);
    case 'cs': return q.n * (ing.csG ?? DEFAULT_CS_G);
    case 'cc': return (q.n * (ing.csG ?? DEFAULT_CS_G)) / 3;
    case 'pc': return q.n * (ing.pieceG ?? DEFAULT_PIECE_G);
  }
}

const fmtN = (n: number): string => {
  const r = Math.round(n * 100) / 100;
  const frac: Record<string, string> = { '0.25': '¼', '0.5': '½', '0.75': '¾' };
  const whole = Math.floor(r);
  const rest = String(Math.round((r - whole) * 100) / 100);
  if (frac[rest]) return (whole ? `${whole} ` : '') + frac[rest];
  return String(Math.round(r * 10) / 10).replace('.', ',');
};

/** Affichage d'une quantité de recette, multipliée par `factor`. */
export function formatQty(q: Qty, ing: Ingredient, factor = 1): string {
  const n = q.n * factor;
  switch (q.unit) {
    case 'g': return n >= 1000 ? `${fmtN(n / 1000)} kg` : `${Math.round(n)} g`;
    case 'ml': return n >= 1000 ? `${fmtN(n / 1000)} l` : `${Math.round(n)} ml`;
    case 'cs': return `${fmtN(n)} c. à soupe`;
    case 'cc': return `${fmtN(n)} c. à café`;
    case 'pc': return ing.pieceName ? `${fmtN(n)} ${plural(ing.pieceName, n)}` : fmtN(n);
  }
}

export function plural(word: string, n: number): string {
  if (n < 2 || /[sxz]$/.test(word)) return word;
  return word + 's';
}

export function formatGrams(g: number): string {
  if (g >= 1000) return `${fmtN(g / 1000)} kg`;
  return `${Math.round(g)} g`;
}

export const UNIT_LABEL: Record<Unit, string> = { g: 'g', ml: 'ml', cs: 'c. à soupe', cc: 'c. à café', pc: 'pièce(s)' };

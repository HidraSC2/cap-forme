import type { Ingredient } from '../lib/types.ts';
import { AISLES, INGREDIENT_DEFS } from './ingredient-defs.ts';
import macrosJson from '../generated/ing-macros.json' with { type: 'json' };
import pricesJson from '../generated/prices.json' with { type: 'json' };

const MACROS = macrosJson as Record<string, number[]>;
const OPEN_PRICES = pricesJson as { updated: string; prices: Record<string, { eurKg: number; n: number }> };

// Classement utilisé par la note nutritionnelle (algorithme Nutri-Score 2023).
const NOT_FVL = new Set(['pomme-de-terre', 'patate-douce']); // tubercules exclus
const EXTRA_FVL = new Set(['petits-pois', 'epinard-surgele', 'haricot-vert', 'fruits-rouges', 'pois-chiche', 'haricot-rouge', 'haricot-blanc', 'mais',
  'tomate-concassee', 'coulis-tomate', 'concentre-tomate', 'olive', 'lentille-verte', 'lentille-corail', 'compote']);
const RED_MEAT = new Set(['boeuf-hache', 'boeuf-braiser', 'porc-filet', 'jambon-blanc', 'lardons', 'chorizo']);
/** Prise de poids à la cuisson des féculents et légumineuses secs (eau absorbée). */
const COOKED: Record<string, number> = {
  pates: 2.3, 'pates-completes': 2.3, 'riz-basmati': 2.6, 'riz-complet': 2.5, semoule: 2.2, quinoa: 2.7, boulgour: 2.5,
  'lentille-verte': 2.4, 'lentille-corail': 2.4, nouille: 2.2,
};

export const INGREDIENTS: Ingredient[] = INGREDIENT_DEFS.map(([id, name, aisle, , eurKg, o = {}]) => {
  const m = MACROS[id];
  if (!m) throw new Error(`Macros manquantes pour « ${id} » : relancer npm run ciqual`);
  return {
    id, name, aisle: AISLES[aisle],
    per100: { kcal: m[0], p: m[1], c: m[2], f: m[3], fiber: m[4] },
    pieceG: o.pc, pieceName: o.pn, csG: o.cs, mlG: o.ml, packs: o.packs,
    soldBy: o.by === 'piece' ? 'piece' : o.packs ? 'pack' : 'weight',
    eurKg, opTag: o.tag, opCat: o.cat,
    preg: o.preg ? { level: o.preg[0], why: o.preg[1] } : undefined,
    pantry: !!o.pantry,
    noBuy: !!o.nobuy,
    nutri: { sugars: m[5], sat: m[6], salt: m[7] },
    fvl: (aisle === 'FL' && !NOT_FVL.has(id)) || EXTRA_FVL.has(id),
    redMeat: RED_MEAT.has(id),
    cookedFactor: COOKED[id],
  };
});

const BY_ID = new Map(INGREDIENTS.map((i) => [i.id, i]));
export const ingOf = (id: string): Ingredient | undefined => BY_ID.get(id);

export const AISLE_ORDER = Object.values(AISLES);

export type PriceSource = 'open-prices' | 'moyenne' | 'perso';

/** Prix au kilo hors correction de l'utilisateur : Open Prices si disponible, sinon prix moyen de repli. */
export function basePrice(id: string): { eurKg: number; src: PriceSource; n: number } {
  const op = OPEN_PRICES.prices[id];
  if (op) return { eurKg: op.eurKg, src: 'open-prices', n: op.n };
  return { eurKg: BY_ID.get(id)?.eurKg ?? 0, src: 'moyenne', n: 0 };
}

export const PRICES_UPDATED = OPEN_PRICES.updated;

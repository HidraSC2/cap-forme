import type { Ingredient, Macros, PlanEntry, Recipe } from './types.ts';
import { ZERO, add, recipeCostPerServing, recipePerServing, scale } from './nutrition.ts';
import { formatGrams, plural, toGrams } from './units.ts';

type IngOf = (id: string) => Ingredient | undefined;
type RecipeOf = (id: string) => Recipe | undefined;

export interface ShoppingLine {
  ingId: string;
  name: string;
  aisle: string;
  pantry: boolean;
  needG: number;
  buyG: number;
  buyLabel: string;
  leftoverG: number;
  eurKg: number;
  price: number;
  /** Recettes du planning qui utilisent cet ingrédient. */
  recipeIds: string[];
}

export interface LooseLine {
  text: string;
  recipeId: string;
}

export function entryServings(e: PlanEntry): number {
  return Object.values(e.portions).reduce((s, n) => s + n, 0) + (e.extra || 0);
}

/** Portions achetées pour chaque repas : une préparation batch inclut ses restes, qui ne sont pas rachetés. */
export function purchasedServings(entries: PlanEntry[], all: PlanEntry[] = entries): Map<string, number> {
  const ids = new Set(all.map((e) => e.id));
  const leftovers = new Map<string, number>();
  for (const e of all) if (e.leftoverOf && ids.has(e.leftoverOf)) leftovers.set(e.leftoverOf, (leftovers.get(e.leftoverOf) ?? 0) + entryServings(e));
  const out = new Map<string, number>();
  for (const e of entries) {
    if (e.leftoverOf && ids.has(e.leftoverOf)) continue; // déjà acheté avec la préparation d'origine
    out.set(e.id, entryServings(e) + (leftovers.get(e.id) ?? 0));
  }
  return out;
}

/** Besoin total en grammes par ingrédient : un ingrédient commun à plusieurs recettes est cumulé sur une seule ligne.
 *  `all` : tout le planning, pour retrouver les restes d'une préparation qui tombent hors de la période. */
export function aggregateNeeds(entries: PlanEntry[], recipeOf: RecipeOf, ingOf: IngOf, all: PlanEntry[] = entries): Map<string, { g: number; recipeIds: Set<string> }> {
  const needs = new Map<string, { g: number; recipeIds: Set<string> }>();
  const servings = purchasedServings(entries, all);
  for (const e of entries) {
    const recipe = recipeOf(e.recipeId);
    if (!recipe || !servings.has(e.id)) continue;
    const factor = servings.get(e.id)! / Math.max(1, recipe.servings);
    if (factor <= 0) continue;
    for (const ri of recipe.ings) {
      const ing = ingOf(ri.ing);
      if (!ing || ing.noBuy) continue;
      const cur = needs.get(ri.ing) ?? { g: 0, recipeIds: new Set<string>() };
      cur.g += toGrams(ri.qty, ing) * factor;
      cur.recipeIds.add(recipe.id);
      needs.set(ri.ing, cur);
    }
  }
  return needs;
}

/** Plus petite combinaison de conditionnements couvrant le besoin. */
export function choosePacks(needG: number, packs: number[]): { buyG: number; counts: [size: number, n: number][] } {
  const sizes = [...packs].sort((a, b) => a - b);
  const largest = sizes[sizes.length - 1];
  let best: { buyG: number; n: number; counts: [number, number][] } | null = null;
  const maxLarge = Math.ceil(needG / largest);
  for (let k = 0; k <= maxLarge; k++) {
    const rest = needG - k * largest;
    const counts: [number, number][] = k > 0 ? [[largest, k]] : [];
    let total = k * largest;
    let n = k;
    if (rest > 0.5) {
      const small = sizes.find((s) => s >= rest - 0.5);
      if (small === undefined) continue;
      total += small;
      n += 1;
      const same = counts.find((c) => c[0] === small);
      if (same) same[1] += 1;
      else counts.push([small, 1]);
    }
    if (!best || total < best.buyG || (total === best.buyG && n < best.n)) best = { buyG: total, n, counts };
  }
  return { buyG: best!.buyG, counts: best!.counts.sort((a, b) => b[0] - a[0]) };
}

function buyPlan(needG: number, ing: Ingredient): { buyG: number; label: string } {
  if (ing.packs?.length) {
    const { buyG, counts } = choosePacks(needG, ing.packs);
    const label = counts
      .map(([size, n]) => {
        if (ing.soldBy === 'piece' && ing.pieceG) {
          const per = Math.round(size / ing.pieceG);
          return `${n} × ${per} ${ing.pieceName ? plural(ing.pieceName, per) : 'pièces'}`;
        }
        return `${n} × ${formatGrams(size)}`;
      })
      .join(' + ');
    return { buyG, label };
  }
  if (ing.soldBy === 'piece' && ing.pieceG) {
    const n = Math.max(1, Math.ceil((needG - 0.5) / ing.pieceG));
    return { buyG: n * ing.pieceG, label: `${n} ${plural('pièce', n)}` };
  }
  const step = needG <= 100 ? 10 : 50;
  const buyG = Math.max(step, Math.ceil((needG - 0.5) / step) * step);
  const approx = ing.pieceG ? ` (≈ ${Math.max(1, Math.round(buyG / ing.pieceG))} ${plural(ing.pieceName ?? 'pièce', Math.round(buyG / ing.pieceG))})` : '';
  return { buyG, label: formatGrams(buyG) + approx };
}

export function buildShoppingList(
  entries: PlanEntry[], recipeOf: RecipeOf, ingOf: IngOf, eurKgOf: (id: string) => number, all: PlanEntry[] = entries,
): { lines: ShoppingLine[]; loose: LooseLine[] } {
  const needs = aggregateNeeds(entries, recipeOf, ingOf, all);
  const lines: ShoppingLine[] = [];
  for (const [ingId, need] of needs) {
    const ing = ingOf(ingId)!;
    const { buyG, label } = buyPlan(need.g, ing);
    const eurKg = eurKgOf(ingId);
    lines.push({
      ingId, name: ing.name, aisle: ing.aisle, pantry: ing.pantry,
      needG: need.g, buyG, buyLabel: label, leftoverG: Math.max(0, buyG - need.g),
      eurKg, price: (buyG / 1000) * eurKg, recipeIds: [...need.recipeIds],
    });
  }
  lines.sort((a, b) => a.aisle.localeCompare(b.aisle, 'fr') || a.name.localeCompare(b.name, 'fr'));

  const loose: LooseLine[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const recipe = recipeOf(e.recipeId);
    if (!recipe?.loose || seen.has(recipe.id)) continue;
    seen.add(recipe.id);
    for (const text of recipe.loose) loose.push({ text, recipeId: recipe.id });
  }
  return { lines, loose };
}

/** Une ligne est « à acheter » sauf produit de placard, à moins d'un choix explicite de l'utilisateur. */
export function isNeeded(line: ShoppingLine, need: Record<string, boolean>): boolean {
  return need[line.ingId] ?? !line.pantry;
}

export function listTotal(lines: ShoppingLine[], need: Record<string, boolean>): number {
  return lines.filter((l) => isNeeded(l, need)).reduce((s, l) => s + l.price, 0);
}

/** Macros totales couvertes par le planning (toutes portions, tous convives). */
export function planMacros(entries: PlanEntry[], recipeOf: RecipeOf, ingOf: IngOf): Macros {
  let total = ZERO;
  for (const e of entries) {
    const recipe = recipeOf(e.recipeId);
    if (!recipe) continue;
    total = add(total, scale(recipePerServing(recipe, ingOf), entryServings(e)));
  }
  return total;
}

export interface LeftoverIdea {
  recipe: Recipe;
  uses: string[]; // noms des ingrédients restants utilisés
}

/** Recettes non planifiées qui écoulent les restes d'achats (paquets entamés). */
export function leftoverIdeas(lines: ShoppingLine[], recipes: Recipe[], plannedIds: Set<string>, ingOf: IngOf, max = 4): LeftoverIdea[] {
  const left = new Map<string, number>();
  for (const l of lines) if (!l.pantry && l.leftoverG >= 50 && l.leftoverG >= l.buyG * 0.25) left.set(l.ingId, l.leftoverG);
  if (!left.size) return [];
  const ideas: (LeftoverIdea & { score: number })[] = [];
  for (const recipe of recipes) {
    if (plannedIds.has(recipe.id)) continue;
    const uses = recipe.ings.filter((ri) => left.has(ri.ing)).map((ri) => ingOf(ri.ing)!.name);
    if (uses.length >= 2) ideas.push({ recipe, uses, score: uses.length / recipe.ings.length });
  }
  return ideas.sort((a, b) => b.uses.length - a.uses.length || b.score - a.score).slice(0, max);
}

export interface Swap {
  from: Recipe;
  to: Recipe;
  savingPerServing: number;
}

/** Pour les recettes les plus chères du planning : une alternative moins chère, proche en calories et en protéines. */
export function cheaperSwaps(planned: Recipe[], all: Recipe[], ingOf: IngOf, eurKgOf: (id: string) => number, max = 3): Swap[] {
  const cost = (r: Recipe) => recipeCostPerServing(r, ingOf, eurKgOf);
  const plannedIds = new Set(planned.map((r) => r.id));
  const swaps: Swap[] = [];
  const used = new Set<string>();
  for (const from of [...planned].sort((a, b) => cost(b) - cost(a))) {
    const fm = recipePerServing(from, ingOf);
    const fc = cost(from);
    const candidates = all
      .filter((r) => r.meal === from.meal && !plannedIds.has(r.id) && !used.has(r.id))
      .filter((r) => {
        const m = recipePerServing(r, ingOf);
        return cost(r) <= fc * 0.75 && Math.abs(m.kcal - fm.kcal) <= fm.kcal * 0.25 && m.p >= fm.p * 0.7;
      })
      .sort((a, b) => cost(a) - cost(b));
    if (candidates.length) {
      used.add(candidates[0].id);
      swaps.push({ from, to: candidates[0], savingPerServing: fc - cost(candidates[0]) });
    }
    if (swaps.length >= max) break;
  }
  return swaps;
}

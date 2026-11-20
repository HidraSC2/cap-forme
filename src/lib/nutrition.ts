import type { Ingredient, Macros, Recipe } from './types.ts';
import { toGrams } from './units.ts';

export const ZERO: Macros = { kcal: 0, p: 0, c: 0, f: 0, fiber: 0 };

export function add(a: Macros, b: Macros): Macros {
  return { kcal: a.kcal + b.kcal, p: a.p + b.p, c: a.c + b.c, f: a.f + b.f, fiber: a.fiber + b.fiber };
}

export function scale(m: Macros, k: number): Macros {
  return { kcal: m.kcal * k, p: m.p * k, c: m.c * k, f: m.f * k, fiber: m.fiber * k };
}

export function sum(list: Macros[]): Macros {
  return list.reduce(add, ZERO);
}

export function round(m: Macros): Macros {
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return { kcal: Math.round(m.kcal), p: r1(m.p), c: r1(m.c), f: r1(m.f), fiber: r1(m.fiber) };
}

/** Macros d'une quantité (en grammes) d'un aliment défini pour 100 g. */
export function macrosFor(per100: Macros, grams: number): Macros {
  return scale(per100, grams / 100);
}

export type IngLookup = (id: string) => Ingredient | undefined;

/** Macros de la recette entière (toutes portions confondues). */
export function recipeTotal(recipe: Recipe, ing: IngLookup): Macros {
  let total = ZERO;
  for (const ri of recipe.ings) {
    const def = ing(ri.ing);
    if (!def) continue;
    total = add(total, macrosFor(def.per100, toGrams(ri.qty, def)));
  }
  return total;
}

export function recipePerServing(recipe: Recipe, ing: IngLookup): Macros {
  return scale(recipeTotal(recipe, ing), 1 / Math.max(1, recipe.servings));
}

/** Coût d'une portion, au prix au kilo de chaque ingrédient (quantité réellement utilisée). */
export function recipeCostPerServing(recipe: Recipe, ing: IngLookup, eurKg: (id: string) => number): number {
  let cost = 0;
  for (const ri of recipe.ings) {
    const def = ing(ri.ing);
    if (!def) continue;
    cost += (toGrams(ri.qty, def) / 1000) * eurKg(ri.ing);
  }
  return cost / Math.max(1, recipe.servings);
}

export function isVegetarian(recipe: Recipe, ing: IngLookup): boolean {
  const fish = new Set(['thon', 'sardine', 'maquereau']);
  return recipe.ings.every((ri) => {
    const def = ing(ri.ing);
    return !def || (def.aisle !== 'Viandes & poissons' && !fish.has(def.id));
  });
}

import { describe, expect, it } from 'vitest';
import { INGREDIENTS, basePrice, ingOf } from '../src/data/ingredients.ts';
import { BASE_RECIPES, PREG_AVOID } from '../src/data/recipes.ts';
import { recipeCostPerServing, recipePerServing } from '../src/lib/nutrition.ts';
import { checkRecipe } from '../src/lib/pregnancy.ts';

const eurKg = (id: string) => basePrice(id).eurKg;

describe('base d\'ingrédients', () => {
  it('a des identifiants uniques et des macros cohérentes', () => {
    expect(new Set(INGREDIENTS.map((i) => i.id)).size).toBe(INGREDIENTS.length);
    for (const i of INGREDIENTS) {
      const fromMacros = 4 * i.per100.p + 4 * i.per100.c + 9 * i.per100.f + 2 * i.per100.fiber;
      expect(i.per100.kcal, i.id).toBeGreaterThanOrEqual(0);
      // L'énergie déclarée doit rester proche de celle recalculée depuis les macros.
      expect(Math.abs(i.per100.kcal - fromMacros), i.id).toBeLessThan(Math.max(25, i.per100.kcal * 0.2));
      if (!i.noBuy) expect(i.eurKg, i.id).toBeGreaterThan(0);
    }
  });
});

describe('recettes du socle', () => {
  it('a des identifiants uniques', () => {
    expect(new Set(BASE_RECIPES.map((r) => r.id)).size).toBe(BASE_RECIPES.length);
  });

  it('n\'utilise que des ingrédients et des unités connus', () => {
    for (const r of BASE_RECIPES) {
      for (const ri of r.ings) {
        const ing = ingOf(ri.ing);
        expect(ing, `${r.id} → ${ri.ing}`).toBeDefined();
        if (ri.qty.unit === 'pc') expect(ing!.pieceG, `${r.id} → ${ri.ing} à la pièce`).toBeDefined();
        if (ri.qty.unit === 'cs' || ri.qty.unit === 'cc') expect(ing!.csG, `${r.id} → ${ri.ing} à la cuillère`).toBeDefined();
      }
      expect(r.steps.length, r.id).toBeGreaterThanOrEqual(1);
    }
  });

  it('reste dans des apports plausibles par portion', () => {
    const bounds = { pdj: [200, 520], plat: [280, 720], collation: [60, 330] } as const;
    for (const r of BASE_RECIPES) {
      const m = recipePerServing(r, ingOf);
      const [lo, hi] = bounds[r.meal];
      expect(m.kcal, `${r.id} : ${Math.round(m.kcal)} kcal`).toBeGreaterThanOrEqual(lo);
      expect(m.kcal, `${r.id} : ${Math.round(m.kcal)} kcal`).toBeLessThanOrEqual(hi);
      if (r.meal === 'plat') expect(m.p, `${r.id} : ${Math.round(m.p)} g de protéines`).toBeGreaterThanOrEqual(15);
      const cost = recipeCostPerServing(r, ingOf, eurKg);
      expect(cost, `${r.id} : ${cost.toFixed(2)} €`).toBeLessThan(6);
    }
  });

  it('offre assez de choix compatibles grossesse, rapides et batch', () => {
    const ok = BASE_RECIPES.filter((r) => checkRecipe(r, ingOf, PREG_AVOID[r.id]).level !== 'avoid');
    expect(ok.length).toBeGreaterThan(BASE_RECIPES.length * 0.9);
    expect(BASE_RECIPES.filter((r) => r.batch).length).toBeGreaterThanOrEqual(25);
    expect(BASE_RECIPES.filter((r) => r.prep + r.cook <= 20).length).toBeGreaterThanOrEqual(30);
    expect(BASE_RECIPES.length).toBeGreaterThanOrEqual(100);
  });
});

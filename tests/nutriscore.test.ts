import { describe, expect, it } from 'vitest';
import { THRESHOLDS, gradeOf, highlights, points, recipeNutriScore } from '../src/lib/nutriscore.ts';
import { BASE_RECIPES } from '../src/data/recipes.ts';
import { ingOf } from '../src/data/ingredients.ts';
import { parseQty } from '../src/lib/units.ts';
import type { Recipe } from '../src/lib/types.ts';

const recipe = (ings: string): Recipe => ({
  id: 't', title: 't', meal: 'plat', servings: 1, prep: 0, cook: 0, steps: [],
  ings: ings.split(';').map((t) => { const [i, q] = t.trim().split(' '); return { ing: i, qty: parseQty(q) }; }),
});

describe('note nutritionnelle (Nutri-Score 2023)', () => {
  it('compte les seuils strictement dépassés', () => {
    expect(points(335, THRESHOLDS.energy)).toBe(0);
    expect(points(336, THRESHOLDS.energy)).toBe(1);
    expect(points(5000, THRESHOLDS.energy)).toBe(10);
    expect(points(0.21, THRESHOLDS.salt)).toBe(1);
    expect(points(85, THRESHOLDS.fvl)).toBe(5);
    expect(points(65, THRESHOLDS.fvl)).toBe(2);
  });
  it('classe selon le barème des aliments généraux', () => {
    expect([0, 1, 2, 3, 10, 11, 18, 19, -5].map(gradeOf)).toEqual(['A', 'B', 'B', 'C', 'C', 'D', 'D', 'E', 'A']);
  });
  it('note mieux les légumes que le chocolat', () => {
    expect(recipeNutriScore(recipe('courgette 300g; tomate 200g'), ingOf)!.grade).toBe('A');
    const choc = recipeNutriScore(recipe('chocolat-noir 100g'), ingOf)!;
    expect(['D', 'E']).toContain(choc.grade);
    expect(highlights(choc).defects.map((d) => d.key)).toContain('sat');
  });
  it('dilue le sel du bouillon dans l\'eau de la soupe', () => {
    const dry = recipeNutriScore(recipe('poireau 300g; bouillon 1'), ingOf)!;
    const soup = recipeNutriScore(recipe('poireau 300g; bouillon 1; eau 1000ml'), ingOf)!;
    expect(soup.negative[3].value).toBeLessThan(dry.negative[3].value / 3);
  });
  it('plafonne les protéines des plats de viande rouge', () => {
    const r = recipeNutriScore(recipe('boeuf-hache 500g'), ingOf)!;
    expect(r.redMeatCap).toBe(true);
    expect(r.positive[2].points).toBeLessThanOrEqual(2);
  });
  it('note toutes les recettes du socle', () => {
    for (const r of BASE_RECIPES) expect(recipeNutriScore(r, ingOf), r.id).not.toBeNull();
  });
});

import type { Ingredient, PregLevel, Recipe } from './types.ts';
import { diffDays } from './dates.ts';

// Supplément quotidien par trimestre (valeurs de référence EFSA).
export const PREG_EXTRA_KCAL = [70, 260, 500];
export const PREG_EXTRA_PROTEIN = [1, 9, 28];

/** Semaine de grossesse (1 → 40) d'après la date de terme. */
export function pregnancyWeek(dueDate: string, today: string): number {
  const weeksLeft = diffDays(today, dueDate) / 7;
  return Math.min(42, Math.max(1, Math.floor(40 - weeksLeft) + 1));
}

export function trimester(dueDate: string, today: string): 1 | 2 | 3 {
  const week = pregnancyWeek(dueDate, today);
  return week <= 13 ? 1 : week <= 27 ? 2 : 3;
}

export interface PregCheck {
  level: PregLevel;
  reasons: string[];
}

/** Évalue une recette pour une femme enceinte d'après ses ingrédients et ses mentions propres. */
export function checkRecipe(recipe: Recipe, ing: (id: string) => Ingredient | undefined, recipeAvoid?: string): PregCheck {
  const reasons: string[] = [];
  let level: PregLevel = 'ok';
  if (recipeAvoid) {
    level = 'avoid';
    reasons.push(recipeAvoid);
  }
  for (const ri of recipe.ings) {
    const p = ing(ri.ing)?.preg;
    if (!p) continue;
    reasons.push(p.why);
    if (p.level === 'avoid') level = 'avoid';
    else if (level === 'ok') level = 'caution';
  }
  if (recipe.pregNote) {
    reasons.push(recipe.pregNote);
    if (level === 'ok') level = 'caution';
  }
  return { level, reasons: [...new Set(reasons)] };
}

export const PREG_REMINDERS = [
  'Viandes, poissons et œufs toujours bien cuits.',
  'Fruits, légumes et herbes soigneusement lavés.',
  'Pas de fromage au lait cru (sauf pâtes pressées cuites type comté) ni de croûte fleurie.',
  'Aucun alcool.',
];

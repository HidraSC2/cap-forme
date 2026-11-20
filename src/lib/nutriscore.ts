// Note nutritionnelle d'une recette, calculée avec l'algorithme Nutri-Score 2023 (aliments généraux).
// Seuils repris de l'implémentation open source d'Open Food Facts (lib/ProductOpener/Nutriscore.pm).
// Le Nutri-Score officiel s'applique aux produits emballés : appliqué à une recette maison, c'est une estimation.
import type { Ingredient, Recipe } from './types.ts';
import { toGrams } from './units.ts';

export type Grade = 'A' | 'B' | 'C' | 'D' | 'E';

export const THRESHOLDS = {
  energy: [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350], // kJ / 100 g
  sugars: [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51], // g / 100 g
  sat: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], // g / 100 g
  salt: [0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.4, 3.6, 3.8, 4], // g / 100 g
  fvl: [40, 60, 80, 80, 80], // % de fruits, légumes et légumineuses
  fiber: [3.0, 4.1, 5.2, 6.3, 7.4], // g / 100 g
  protein: [2.4, 4.8, 7.2, 9.6, 12, 14, 17], // g / 100 g
};

/** Nombre de seuils strictement dépassés. */
export const points = (value: number, thresholds: number[]): number => thresholds.filter((t) => value > t).length;

export function gradeOf(score: number): Grade {
  return score <= 0 ? 'A' : score <= 2 ? 'B' : score <= 10 ? 'C' : score <= 18 ? 'D' : 'E';
}

export interface NutriComponent {
  key: 'energy' | 'sugars' | 'sat' | 'salt' | 'fvl' | 'fiber' | 'protein';
  value: number; // pour 100 g (kJ pour l'énergie, % pour fruits et légumes)
  points: number;
  max: number;
}

export interface NutriResult {
  grade: Grade;
  score: number;
  negative: NutriComponent[];
  positive: NutriComponent[];
  kcal100: number;
  proteinCounted: boolean;
  redMeatCap: boolean;
}

export function recipeNutriScore(recipe: Recipe, ingOf: (id: string) => Ingredient | undefined): NutriResult | null {
  let weight = 0, kcal = 0, sugars = 0, sat = 0, salt = 0, fiber = 0, protein = 0, fvl = 0, redProtein = 0;
  for (const ri of recipe.ings) {
    const ing = ingOf(ri.ing);
    if (!ing) continue;
    const g = toGrams(ri.qty, ing);
    const k = g / 100;
    weight += g * (ing.cookedFactor ?? 1);
    kcal += ing.per100.kcal * k;
    protein += ing.per100.p * k;
    fiber += ing.per100.fiber * k;
    sugars += (ing.nutri?.sugars ?? 0) * k;
    sat += (ing.nutri?.sat ?? 0) * k;
    salt += (ing.nutri?.salt ?? 0) * k;
    if (ing.fvl) fvl += g * (ing.cookedFactor ?? 1);
    if (ing.redMeat) redProtein += ing.per100.p * k;
  }
  if (weight <= 0) return null;
  const per = (n: number) => (n / weight) * 100;

  const negative: NutriComponent[] = [
    { key: 'energy', value: per(kcal) * 4.184, points: 0, max: THRESHOLDS.energy.length },
    { key: 'sugars', value: per(sugars), points: 0, max: THRESHOLDS.sugars.length },
    { key: 'sat', value: per(sat), points: 0, max: THRESHOLDS.sat.length },
    { key: 'salt', value: per(salt), points: 0, max: THRESHOLDS.salt.length },
  ];
  for (const c of negative) c.points = points(c.value, THRESHOLDS[c.key]);
  const neg = negative.reduce((s, c) => s + c.points, 0);

  // La viande rouge est plafonnée à 2 points protéines : appliqué quand elle apporte l'essentiel des protéines du plat.
  const redMeatCap = redProtein > protein / 2;
  const proteinCounted = neg < 11;
  const positive: NutriComponent[] = [
    { key: 'fvl', value: per(fvl), points: points(per(fvl), THRESHOLDS.fvl), max: THRESHOLDS.fvl.length },
    { key: 'fiber', value: per(fiber), points: points(per(fiber), THRESHOLDS.fiber), max: THRESHOLDS.fiber.length },
    { key: 'protein', value: per(protein), points: 0, max: redMeatCap ? 2 : THRESHOLDS.protein.length },
  ];
  const proteinPts = Math.min(points(per(protein), THRESHOLDS.protein), redMeatCap ? 2 : 7);
  positive[2].points = proteinCounted ? proteinPts : 0;
  const score = neg - positive.reduce((s, c) => s + c.points, 0);

  return { grade: gradeOf(score), score, negative, positive, kcal100: per(kcal), proteinCounted, redMeatCap };
}

export type Tone = 'good' | 'mid' | 'bad';

export interface Highlight {
  key: NutriComponent['key'];
  label: string;
  value: string;
  tone: Tone;
  points: number;
  max: number;
}

const fmt = (n: number, d = 1) => n.toLocaleString('fr-FR', { maximumFractionDigits: d });

/** Qualités et défauts façon Yuka, pour 100 g de plat. */
export function highlights(r: NutriResult): { defects: Highlight[]; qualities: Highlight[] } {
  const defects: Highlight[] = [];
  const qualities: Highlight[] = [];
  const rules: Record<'energy' | 'sugars' | 'sat' | 'salt', { low: number; high: number; labels: [string, string, string]; unit: (v: number) => string }> = {
    energy: { low: 2, high: 5, labels: ['Peu calorique', 'Assez calorique', 'Très calorique'], unit: (v) => `${fmt(v / 4.184, 0)} kcal` },
    sugars: { low: 1, high: 4, labels: ['Peu sucré', 'Assez sucré', 'Trop sucré'], unit: (v) => `${fmt(v)} g` },
    sat: { low: 1, high: 4, labels: ['Peu de graisses saturées', 'Graisses saturées modérées', 'Trop de graisses saturées'], unit: (v) => `${fmt(v)} g` },
    salt: { low: 2, high: 5, labels: ['Peu salé', 'Assez salé', 'Trop salé'], unit: (v) => `${fmt(v, 2)} g` },
  };
  for (const c of r.negative) {
    const rule = rules[c.key as keyof typeof rules];
    const tone: Tone = c.points <= rule.low ? 'good' : c.points >= rule.high ? 'bad' : 'mid';
    const h = { key: c.key, label: rule.labels[tone === 'good' ? 0 : tone === 'mid' ? 1 : 2], value: rule.unit(c.value), tone, points: c.points, max: c.max };
    (tone === 'good' ? qualities : defects).push(h);
  }
  const [fvl, fiber, protein] = r.positive;
  if (protein.value > THRESHOLDS.protein[2]) qualities.push({ key: 'protein', label: protein.value > THRESHOLDS.protein[4] ? 'Riche en protéines' : 'Source de protéines', value: `${fmt(protein.value)} g`, tone: 'good', points: protein.points, max: protein.max });
  if (fiber.value > THRESHOLDS.fiber[0]) qualities.push({ key: 'fiber', label: fiber.value > THRESHOLDS.fiber[2] ? 'Riche en fibres' : 'Source de fibres', value: `${fmt(fiber.value)} g`, tone: 'good', points: fiber.points, max: fiber.max });
  if (fvl.value > THRESHOLDS.fvl[0]) qualities.push({ key: 'fvl', label: 'Riche en fruits et légumes', value: `${fmt(fvl.value, 0)} %`, tone: 'good', points: fvl.points, max: fvl.max });
  defects.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'bad' ? -1 : 1));
  return { defects, qualities };
}

export const GRADE_TEXT: Record<Grade, string> = {
  A: 'Excellente qualité nutritionnelle',
  B: 'Bonne qualité nutritionnelle',
  C: 'Qualité nutritionnelle moyenne',
  D: 'Qualité nutritionnelle médiocre',
  E: 'Qualité nutritionnelle faible',
};

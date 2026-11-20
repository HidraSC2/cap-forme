import { describe, expect, it } from 'vitest';
import { bmr, computeGoal, expectedWeight, smooth, weeklyTrend } from '../src/lib/goals.ts';
import { checkRecipe, pregnancyWeek, trimester } from '../src/lib/pregnancy.ts';
import { aggregateNeeds, buildShoppingList, choosePacks, entryServings, isNeeded, listTotal, planMacros } from '../src/lib/shopping.ts';
import { parseQty, toGrams } from '../src/lib/units.ts';
import { stepsKcal, workoutKcal } from '../src/lib/activity.ts';
import { recipePerServing } from '../src/lib/nutrition.ts';
import { addDays, diffDays, weekStart } from '../src/lib/dates.ts';
import type { Ingredient, PlanEntry, Profile, Recipe } from '../src/lib/types.ts';

const ing = (over: Partial<Ingredient> & { id: string }): Ingredient => ({
  name: over.id, aisle: 'Épicerie salée', per100: { kcal: 100, p: 10, c: 10, f: 2, fiber: 1 },
  soldBy: over.packs ? 'pack' : 'weight', eurKg: 2, pantry: false, ...over,
});
const INGS: Record<string, Ingredient> = {
  pates: ing({ id: 'pates', packs: [500, 1000], per100: { kcal: 360, p: 12, c: 72, f: 1.5, fiber: 3 } }),
  tomate: ing({ id: 'tomate', pieceG: 120, aisle: 'Fruits & légumes', eurKg: 3 }),
  oeuf: ing({ id: 'oeuf', pieceG: 55, packs: [330, 660], soldBy: 'piece', eurKg: 5.5 }),
  huile: ing({ id: 'huile', csG: 13, pantry: true, packs: [690], eurKg: 11 }),
  fume: ing({ id: 'fume', preg: { level: 'avoid', why: 'Poisson fumé.' } }),
  lardons: ing({ id: 'lardons', preg: { level: 'caution', why: 'Bien cuire.' } }),
};
const ingOf = (id: string) => INGS[id];
const recipe = (id: string, servings: number, ings: string): Recipe => ({
  id, title: id, meal: 'plat', servings, prep: 5, cook: 5, steps: [],
  ings: ings.split(';').map((t) => { const [i, q] = t.trim().split(' '); return { ing: i, qty: parseQty(q) }; }),
});
const RECIPES: Record<string, Recipe> = {
  a: recipe('a', 2, 'pates 160g; tomate 2; huile 1cs'),
  b: recipe('b', 4, 'pates 400g; oeuf 4'),
};
const recipeOf = (id: string) => RECIPES[id];
const entry = (id: string, recipeId: string, portions: Record<string, number>, extra = 0): PlanEntry => ({ id, date: '2026-11-16', slot: 'din', recipeId, portions, extra });

const profile = (over: Partial<Profile> = {}): Profile => ({
  id: 'p1', name: 'Test', sex: 'm', birth: '1990-06-15', heightCm: 180, activity: 1.375,
  startKg: 90, startDate: '2026-11-01', targetKg: 80, targetDate: '2027-05-01', stepGoal: 8000, color: '#000', ...over,
});

describe('unités', () => {
  it('lit les quantités', () => {
    expect(parseQty('500g')).toEqual({ n: 500, unit: 'g' });
    expect(parseQty('1.5kg')).toEqual({ n: 1500, unit: 'g' });
    expect(parseQty('20cl')).toEqual({ n: 200, unit: 'ml' });
    expect(parseQty('2cs')).toEqual({ n: 2, unit: 'cs' });
    expect(parseQty('0.5')).toEqual({ n: 0.5, unit: 'pc' });
    expect(() => parseQty('beaucoup')).toThrow();
  });
  it('convertit en grammes', () => {
    expect(toGrams({ n: 2, unit: 'pc' }, INGS.tomate)).toBe(240);
    expect(toGrams({ n: 1, unit: 'cs' }, INGS.huile)).toBe(13);
    expect(toGrams({ n: 3, unit: 'cc' }, INGS.huile)).toBeCloseTo(13);
  });
});

describe('dates', () => {
  it('trouve le lundi de la semaine', () => {
    expect(weekStart('2026-11-14')).toBe('2026-11-09'); // samedi → lundi
    expect(weekStart('2026-11-09')).toBe('2026-11-09');
    expect(weekStart('2026-11-15')).toBe('2026-11-09'); // dimanche
  });
  it('gère les changements de mois et d\'heure', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(diffDays('2026-10-20', '2026-10-30')).toBe(10);
  });
});

describe('objectifs', () => {
  it('calcule le métabolisme de base (Mifflin-St Jeor)', () => {
    expect(bmr('m', 90, 180, 36)).toBeCloseTo(1850, 0);
    expect(bmr('f', 65, 165, 30)).toBeCloseTo(1370.25, 1);
  });
  it('propose un déficit tenable quand l\'échéance est réaliste', () => {
    const g = computeGoal(profile(), 90, '2026-11-14');
    // 10 kg en 168 jours → environ 458 kcal de déficit par jour
    expect(g.mode).toBe('loss');
    expect(g.feasible).toBe(true);
    expect(g.requiredDeficit).toBeCloseTo((10 * 7700) / 168, 0);
    expect(g.targetKcal).toBeCloseTo(g.tdee - g.deficit, -1);
    expect(g.weeklyLossKg).toBeCloseTo(0.42, 1);
    expect(g.reachDate).toBe('2027-05-01');
    expect(g.milestones.at(-1)!.kg).toBe(80);
  });
  it('plafonne le déficit et repousse la date si l\'échéance est irréaliste', () => {
    const g = computeGoal(profile({ targetDate: '2026-12-14' }), 90, '2026-11-14'); // 10 kg en 30 jours
    expect(g.feasible).toBe(false);
    expect(g.deficit).toBeLessThanOrEqual(1000);
    expect(g.weeklyLossKg).toBeLessThanOrEqual(0.9 + 1e-9); // 1 % de 90 kg
    expect(g.reachDate > '2026-12-14').toBe(true);
    expect(g.targetKcal).toBeGreaterThanOrEqual(1500);
  });
  it('ne descend jamais sous le plancher calorique', () => {
    const g = computeGoal(profile({ sex: 'f', heightCm: 155, activity: 1.2, startKg: 55, targetKg: 45, targetDate: '2026-12-31' }), 55, '2026-11-14');
    expect(g.targetKcal).toBeGreaterThanOrEqual(1200);
  });
  it('passe en maintien quand la cible est atteinte', () => {
    const g = computeGoal(profile(), 79.5, '2026-11-14');
    expect(g.mode).toBe('maintain');
    expect(g.deficit).toBe(0);
  });
  it('désactive tout déficit pendant la grossesse', () => {
    const p = profile({ sex: 'f', heightCm: 165, startKg: 68, targetKg: 60, pregnant: true, dueDate: '2027-03-01' });
    const g = computeGoal(p, 72, '2026-11-14');
    expect(g.mode).toBe('pregnancy');
    expect(g.deficit).toBe(0);
    expect(g.trimester).toBe(2);
    expect(g.targetKcal).toBeGreaterThan(g.tdee);
  });
  it('lisse et mesure la tendance', () => {
    const pts = [0, 7, 14, 21].map((d, i) => ({ date: addDays('2026-10-20', d), kg: 90 - i * 0.5 }));
    expect(weeklyTrend(pts, '2026-11-10')).toBeCloseTo(-0.5, 2);
    expect(smooth(pts).at(-1)!.avg).toBe(88.5);
    expect(weeklyTrend(pts.slice(0, 2), '2026-11-10')).toBeNull();
    expect(expectedWeight(profile(), '2027-01-30')).toBeCloseTo(85, 0);
  });
});

describe('grossesse', () => {
  it('déduit la semaine et le trimestre du terme', () => {
    expect(pregnancyWeek('2027-03-01', '2026-11-14')).toBe(25);
    expect(trimester('2027-03-01', '2026-11-14')).toBe(2);
    expect(trimester('2027-07-20', '2026-11-14')).toBe(1);
    expect(trimester('2026-12-20', '2026-11-14')).toBe(3);
  });
  it('signale les recettes à risque', () => {
    expect(checkRecipe(recipe('x', 2, 'pates 100g'), ingOf).level).toBe('ok');
    expect(checkRecipe(recipe('x', 2, 'pates 100g; lardons 50g'), ingOf).level).toBe('caution');
    const bad = checkRecipe(recipe('x', 2, 'fume 100g; lardons 50g'), ingOf);
    expect(bad.level).toBe('avoid');
    expect(bad.reasons).toHaveLength(2);
    expect(checkRecipe(recipe('x', 2, 'pates 100g'), ingOf, 'Œufs crus.').level).toBe('avoid');
  });
});

describe('liste de courses', () => {
  it('choisit les conditionnements', () => {
    expect(choosePacks(560, [500, 1000])).toEqual({ buyG: 1000, counts: [[1000, 1]] });
    expect(choosePacks(400, [500, 1000])).toEqual({ buyG: 500, counts: [[500, 1]] });
    expect(choosePacks(1200, [500, 1000])).toEqual({ buyG: 1500, counts: [[1000, 1], [500, 1]] });
    expect(choosePacks(2500, [500, 1000])).toEqual({ buyG: 2500, counts: [[1000, 2], [500, 1]] });
    expect(choosePacks(500, [500])).toEqual({ buyG: 500, counts: [[500, 1]] });
  });
  it('cumule un ingrédient commun à plusieurs recettes', () => {
    const entries = [entry('1', 'a', { p1: 1, p2: 1 }), entry('2', 'b', { p1: 1, p2: 1 }), entry('3', 'a', { p1: 1 }, 1)];
    expect(entryServings(entries[2])).toBe(2);
    const needs = aggregateNeeds(entries, recipeOf, ingOf);
    // a (2 portions) ×2 = 320 g ; b : 2 portions sur 4 = 200 g
    expect(needs.get('pates')!.g).toBe(520);
    expect([...needs.get('pates')!.recipeIds]).toEqual(['a', 'b']);
    expect(needs.get('oeuf')!.g).toBe(110);
  });
  it('arrondit aux paquets, chiffre et isole le placard', () => {
    const entries = [entry('1', 'a', { p1: 1, p2: 1 }), entry('2', 'b', { p1: 2, p2: 2 })];
    const { lines } = buildShoppingList(entries, recipeOf, ingOf, (id) => INGS[id].eurKg);
    const by = Object.fromEntries(lines.map((l) => [l.ingId, l]));
    expect(by.pates.needG).toBe(560);
    expect(by.pates.buyG).toBe(1000);
    expect(by.pates.buyLabel).toBe('1 × 1 kg');
    expect(by.pates.leftoverG).toBe(440);
    expect(by.pates.price).toBeCloseTo(2);
    expect(by.oeuf.buyLabel).toBe('1 × 6 pièces');
    expect(by.tomate.buyG).toBe(250);
    expect(by.tomate.buyLabel).toBe('250 g (≈ 2 pièces)');
    expect(isNeeded(by.huile, {})).toBe(false);
    expect(isNeeded(by.huile, { huile: true })).toBe(true);
    const total = listTotal(lines, {});
    expect(total).toBeCloseTo(2 + 0.75 + (330 / 1000) * 5.5);
  });
  it("achète les restes avec la préparation, même s'ils tombent la semaine suivante", () => {
    const base = entry('1', 'b', { p1: 1 });
    const left1 = { ...entry('2', 'b', { p1: 1 }), date: '2026-11-17', leftoverOf: '1' };
    const left2 = { ...entry('3', 'b', { p1: 1 }), date: '2026-11-23', leftoverOf: '1' };
    const all = [base, left1, left2];
    // Semaine du 16 : la préparation et ses 2 repas de restes = 3 portions (300 g de pâtes sur 400 g pour 4).
    expect(aggregateNeeds([base, left1], recipeOf, ingOf, all).get('pates')!.g).toBe(300);
    // Semaine du 23 : uniquement des restes, rien à racheter.
    expect(aggregateNeeds([left2], recipeOf, ingOf, all).size).toBe(0);
    // Restes dont la préparation a disparu : comptés normalement.
    expect(aggregateNeeds([left2], recipeOf, ingOf, [left2]).get('pates')!.g).toBe(100);
  });
  it('calcule les macros couvertes par le planning', () => {
    const per = recipePerServing(RECIPES.a, ingOf);
    const m = planMacros([entry('1', 'a', { p1: 1, p2: 0.5 })], recipeOf, ingOf);
    expect(m.kcal).toBeCloseTo(per.kcal * 1.5);
  });
});

describe('activité', () => {
  it('estime les calories', () => {
    expect(workoutKcal('course', 30, 'mid', 80)).toBe(360);
    expect(workoutKcal('course', 30, 'high', 80)).toBe(450);
    expect(stepsKcal(10000, 80)).toBe(320);
  });
});

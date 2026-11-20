// Accès typés aux données et informations dérivées partagées entre les écrans.
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { BASE_RECIPES, PREG_AVOID } from '../data/recipes.ts';
import { basePrice, ingOf, type PriceSource } from '../data/ingredients.ts';
import { isVegetarian, recipeCostPerServing, recipePerServing } from '../lib/nutrition.ts';
import { checkRecipe, type PregCheck } from '../lib/pregnancy.ts';
import { recipeNutriScore, type NutriResult } from '../lib/nutriscore.ts';
import { computeGoal, currentWeight, type GoalPlan } from '../lib/goals.ts';
import { today } from '../lib/dates.ts';
import type { Macros, PriceOverride, Profile, Recipe, Settings, WeightEntry } from '../lib/types.ts';
import { useAll } from './store.ts';

// ── État propre à l'appareil (non synchronisé) ──
const localListeners = new Set<() => void>();

export function useLocal(key: string, initial: string): [string, (v: string) => void] {
  const value = useSyncExternalStore(
    (l) => { localListeners.add(l); return () => localListeners.delete(l); },
    () => localStorage.getItem(`capforme:${key}`) ?? initial,
  );
  const set = useCallback((v: string) => {
    localStorage.setItem(`capforme:${key}`, v);
    localListeners.forEach((l) => l());
  }, [key]);
  return [value, set];
}

export function useProfiles(): { profiles: Profile[]; active: Profile | undefined; setActive: (id: string) => void } {
  const profiles = useAll<Profile>('profile');
  const [activeId, setActive] = useLocal('activeProfile', '');
  const active = profiles.find((p) => p.id === activeId) ?? profiles[0];
  return { profiles, active, setActive };
}

export function useSettings(): Settings {
  const list = useAll<Settings>('settings');
  return list[0] ?? { id: 'settings', weeklyBudget: 0 };
}

export interface PriceInfo {
  eurKg: number;
  src: PriceSource;
  n: number;
}

export interface Catalog {
  recipes: Recipe[];
  recipeOf: (id: string) => Recipe | undefined;
  eurKgOf: (id: string) => number;
  priceInfo: (id: string) => PriceInfo;
  info: (recipe: Recipe) => RecipeInfo;
}

export interface RecipeInfo {
  per: Macros; // par portion
  cost: number; // € par portion
  total: number; // minutes
  quick: boolean;
  eco: boolean;
  veg: boolean;
  protein: boolean;
  preg: PregCheck;
  nutri: NutriResult | null;
}

export const QUICK_MAX_MIN = 20;
export const ECO_MAX_EUR = { pdj: 1, plat: 2.2, collation: 0.8 };

export function useCatalog(): Catalog {
  const custom = useAll<Recipe>('recipe');
  const overrides = useAll<PriceOverride>('price');
  return useMemo(() => {
    const recipes = [...custom.map((r) => ({ ...r, custom: true })), ...BASE_RECIPES];
    const byId = new Map(recipes.map((r) => [r.id, r]));
    const over = new Map(overrides.map((o) => [o.ingId, o.eurKg]));
    const priceInfo = (id: string): PriceInfo => (over.has(id) ? { eurKg: over.get(id)!, src: 'perso', n: 0 } : basePrice(id));
    const eurKgOf = (id: string) => priceInfo(id).eurKg;
    const memo = new Map<string, RecipeInfo>();
    const info = (recipe: Recipe): RecipeInfo => {
      let i = memo.get(recipe.id);
      if (!i) {
        const per = recipePerServing(recipe, ingOf);
        const cost = recipeCostPerServing(recipe, ingOf, eurKgOf);
        const total = recipe.prep + recipe.cook;
        i = {
          per, cost, total,
          quick: total <= QUICK_MAX_MIN,
          eco: cost <= ECO_MAX_EUR[recipe.meal],
          veg: isVegetarian(recipe, ingOf),
          protein: per.kcal > 0 && (per.p * 4) / per.kcal >= 0.25,
          preg: checkRecipe(recipe, ingOf, PREG_AVOID[recipe.id]),
          nutri: recipeNutriScore(recipe, ingOf),
        };
        memo.set(recipe.id, i);
      }
      return i;
    };
    return { recipes, recipeOf: (id: string) => byId.get(id), eurKgOf, priceInfo, info };
  }, [custom, overrides]);
}

/** Objectifs calculés du profil, à partir de sa dernière pesée. */
export function useGoal(profile: Profile | undefined): { goal: GoalPlan; kg: number } | undefined {
  const weights = useAll<WeightEntry>('weight');
  return useMemo(() => {
    if (!profile) return undefined;
    const kg = currentWeight(profile, weights);
    return { goal: computeGoal(profile, kg, today()), kg };
  }, [profile, weights]);
}

export const PROFILE_COLORS = ['#1d5c4a', '#c2552d', '#3b6fb5', '#8a4fa3', '#b3892b', '#2f8f8f'];

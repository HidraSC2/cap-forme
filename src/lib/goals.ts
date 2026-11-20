import type { Profile, WeightEntry } from './types.ts';
import { addDays, ageOn, diffDays } from './dates.ts';
import { PREG_EXTRA_KCAL, PREG_EXTRA_PROTEIN, trimester } from './pregnancy.ts';

export const KCAL_PER_KG = 7700;
const MAX_WEEKLY_LOSS_RATIO = 0.01; // 1 % du poids par semaine
const MAX_DAILY_DEFICIT = 1000;
const FLOOR_KCAL = { m: 1500, f: 1200 };

export const ACTIVITY_LEVELS = [
  { value: 1.2, label: 'Sédentaire', hint: 'Travail assis, peu de marche' },
  { value: 1.375, label: 'Légèrement actif', hint: '1 à 3 séances par semaine' },
  { value: 1.55, label: 'Actif', hint: '3 à 5 séances par semaine' },
  { value: 1.725, label: 'Très actif', hint: 'Sport quotidien ou métier physique' },
];

/** Métabolisme de base, équation de Mifflin-St Jeor (kcal/jour). */
export function bmr(sex: 'm' | 'f', kg: number, heightCm: number, age: number): number {
  return 10 * kg + 6.25 * heightCm - 5 * age + (sex === 'm' ? 5 : -161);
}

export interface GoalPlan {
  mode: 'loss' | 'maintain' | 'pregnancy';
  bmr: number;
  tdee: number;
  /** Apport calorique quotidien conseillé. */
  targetKcal: number;
  /** Déficit quotidien appliqué. */
  deficit: number;
  /** Déficit qu'il faudrait pour tenir l'échéance choisie. */
  requiredDeficit: number;
  weeklyLossKg: number;
  /** L'échéance choisie est-elle tenable sans dépasser les garde-fous ? */
  feasible: boolean;
  /** Date à laquelle l'objectif est atteint au rythme appliqué. */
  reachDate: string;
  toLoseKg: number;
  macros: { p: number; c: number; f: number; fiber: number };
  /** Jalons hebdomadaires de poids. */
  milestones: { date: string; kg: number }[];
  trimester?: 1 | 2 | 3;
}

const round10 = (n: number) => Math.round(n / 10) * 10;

export function computeGoal(profile: Profile, currentKg: number, today: string): GoalPlan {
  const age = ageOn(profile.birth, today);
  const heightM = profile.heightCm / 100;

  if (profile.pregnant && profile.dueDate) {
    // Grossesse : pas de déficit. Besoins calculés sur le poids d'avant grossesse + supplément par trimestre (EFSA).
    const tri = trimester(profile.dueDate, today);
    const base = bmr('f', profile.startKg, profile.heightCm, age);
    const tdee = base * profile.activity;
    const targetKcal = round10(tdee + PREG_EXTRA_KCAL[tri - 1]);
    const p = Math.round(1.1 * profile.startKg + PREG_EXTRA_PROTEIN[tri - 1]);
    const f = Math.round((targetKcal * 0.35) / 9);
    const c = Math.round((targetKcal - 4 * p - 9 * f) / 4);
    return {
      mode: 'pregnancy', bmr: base, tdee, targetKcal, deficit: 0, requiredDeficit: 0, weeklyLossKg: 0,
      feasible: true, reachDate: profile.dueDate, toLoseKg: 0, macros: { p, c, f, fiber: 28 }, milestones: [], trimester: tri,
    };
  }

  const base = bmr(profile.sex, currentKg, profile.heightCm, age);
  const tdee = base * profile.activity;
  const toLoseKg = Math.max(0, currentKg - profile.targetKg);
  const daysLeft = Math.max(1, diffDays(today, profile.targetDate));
  const floor = FLOOR_KCAL[profile.sex];

  const requiredDeficit = (toLoseKg * KCAL_PER_KG) / daysLeft;
  const allowed = Math.max(0, Math.min((currentKg * MAX_WEEKLY_LOSS_RATIO * KCAL_PER_KG) / 7, MAX_DAILY_DEFICIT, tdee - floor));
  const deficit = Math.min(requiredDeficit, allowed);
  const feasible = requiredDeficit <= allowed + 1;
  const targetKcal = round10(tdee - deficit);
  const weeklyLossKg = (deficit * 7) / KCAL_PER_KG;

  let reachDate = profile.targetDate;
  if (toLoseKg === 0) reachDate = today;
  else if (!feasible && deficit > 0) reachDate = addDays(today, Math.ceil((toLoseKg * KCAL_PER_KG) / deficit));

  // Protéines et lipides calculés sur un poids de référence plafonné (IMC 27) pour ne pas les surestimer.
  const refKg = Math.min(currentKg, 27 * heightM * heightM);
  const p = Math.round(1.8 * refKg);
  const f = Math.round(Math.max(0.8 * refKg, (targetKcal * 0.3) / 9));
  const c = Math.max(50, Math.round((targetKcal - 4 * p - 9 * f) / 4));

  const milestones: { date: string; kg: number }[] = [];
  if (toLoseKg > 0 && weeklyLossKg > 0) {
    for (let w = 1; w <= 104; w++) {
      const date = addDays(today, w * 7);
      const kg = Math.max(profile.targetKg, currentKg - weeklyLossKg * w);
      milestones.push({ date, kg: Math.round(kg * 10) / 10 });
      if (kg <= profile.targetKg) break;
    }
  }

  return {
    mode: toLoseKg > 0 ? 'loss' : 'maintain',
    bmr: base, tdee, targetKcal, deficit, requiredDeficit, weeklyLossKg, feasible, reachDate, toLoseKg,
    macros: { p, c, f, fiber: profile.sex === 'm' ? 30 : 25 }, milestones,
  };
}

/** Dernière pesée connue (ou poids de départ). */
export function currentWeight(profile: Profile, weights: WeightEntry[]): number {
  const mine = weights.filter((w) => w.profileId === profile.id).sort((a, b) => a.date.localeCompare(b.date));
  return mine.length ? mine[mine.length - 1].kg : profile.startKg;
}

/** Moyenne glissante sur 7 jours, pour lisser les variations quotidiennes. */
export function smooth(points: { date: string; kg: number }[]): { date: string; kg: number; avg: number }[] {
  return points.map((pt) => {
    const window = points.filter((o) => o.date <= pt.date && diffDays(o.date, pt.date) < 7);
    const avg = window.reduce((s, o) => s + o.kg, 0) / window.length;
    return { ...pt, avg: Math.round(avg * 10) / 10 };
  });
}

/** Tendance réelle en kg par semaine (régression linéaire sur les 28 derniers jours). Négatif = perte. */
export function weeklyTrend(points: { date: string; kg: number }[], today: string): number | null {
  const recent = points.filter((pt) => diffDays(pt.date, today) <= 28 && diffDays(pt.date, today) >= 0);
  if (recent.length < 3) return null;
  const xs = recent.map((pt) => -diffDays(pt.date, today));
  if (Math.max(...xs) - Math.min(...xs) < 7) return null;
  const n = recent.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = recent.reduce((a, b) => a + b.kg, 0) / n;
  let num = 0, den = 0;
  recent.forEach((pt, i) => { num += (xs[i] - mx) * (pt.kg - my); den += (xs[i] - mx) ** 2; });
  return den === 0 ? null : (num / den) * 7;
}

/** Poids attendu à une date donnée sur la trajectoire linéaire départ → cible. */
export function expectedWeight(profile: Profile, date: string): number {
  const total = Math.max(1, diffDays(profile.startDate, profile.targetDate));
  const done = Math.min(total, Math.max(0, diffDays(profile.startDate, date)));
  return profile.startKg + ((profile.targetKg - profile.startKg) * done) / total;
}

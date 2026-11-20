import type { MealType, Slot } from './types.ts';

export const SLOTS: { id: Slot; label: string; short: string }[] = [
  { id: 'pdj', label: 'Petit-déjeuner', short: 'Matin' },
  { id: 'dej', label: 'Déjeuner', short: 'Midi' },
  { id: 'col', label: 'Collation', short: 'Collation' },
  { id: 'din', label: 'Dîner', short: 'Soir' },
];

export const slotLabel = (id: Slot) => SLOTS.find((s) => s.id === id)!.label;

export const MEAL_LABEL: Record<MealType, string> = { pdj: 'Petit-déjeuner', plat: 'Plat', collation: 'Collation' };

/** Créneau proposé par défaut pour un type de recette. */
export function defaultSlot(meal: MealType): Slot {
  return meal === 'pdj' ? 'pdj' : meal === 'collation' ? 'col' : 'din';
}

/** Types de recettes proposés en premier pour un créneau. */
export function mealForSlot(slot: Slot): MealType {
  return slot === 'pdj' ? 'pdj' : slot === 'col' ? 'collation' : 'plat';
}

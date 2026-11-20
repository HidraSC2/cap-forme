// Estimation des dépenses : séances (méthode MET) et pas.

export interface Sport {
  id: string;
  label: string;
  met: number; // équivalent métabolique à intensité modérée
}

export const SPORTS: Sport[] = [
  { id: 'marche', label: 'Marche', met: 3.5 },
  { id: 'marche-rapide', label: 'Marche rapide', met: 4.5 },
  { id: 'course', label: 'Course à pied', met: 9 },
  { id: 'velo', label: 'Vélo', met: 7 },
  { id: 'velo-appart', label: "Vélo d'appartement", met: 6.5 },
  { id: 'natation', label: 'Natation', met: 7 },
  { id: 'musculation', label: 'Musculation', met: 5 },
  { id: 'hiit', label: 'HIIT / circuit training', met: 8 },
  { id: 'fitness', label: 'Fitness / cardio', met: 6 },
  { id: 'yoga', label: 'Yoga', met: 2.8 },
  { id: 'pilates', label: 'Pilates', met: 3 },
  { id: 'randonnee', label: 'Randonnée', met: 6 },
  { id: 'danse', label: 'Danse', met: 5 },
  { id: 'elliptique', label: 'Vélo elliptique', met: 5.5 },
  { id: 'rameur', label: 'Rameur', met: 7 },
  { id: 'tennis', label: 'Tennis / padel', met: 7 },
  { id: 'sport-co', label: 'Sport collectif', met: 7.5 },
  { id: 'escalade', label: 'Escalade', met: 7.5 },
  { id: 'corde', label: 'Corde à sauter', met: 11 },
  { id: 'autre', label: 'Autre activité', met: 5 },
];

export const INTENSITY = {
  low: { label: 'Légère', factor: 0.8 },
  mid: { label: 'Modérée', factor: 1 },
  high: { label: 'Intense', factor: 1.25 },
} as const;

export function sportLabel(id: string): string {
  return SPORTS.find((s) => s.id === id)?.label ?? id;
}

/** Calories d'une séance : MET × poids (kg) × durée (h). */
export function workoutKcal(sportId: string, minutes: number, intensity: keyof typeof INTENSITY, kg: number): number {
  const met = (SPORTS.find((s) => s.id === sportId)?.met ?? 5) * INTENSITY[intensity].factor;
  return Math.round(met * kg * (minutes / 60));
}

/** Calories nettes liées aux pas : environ 0,5 kcal par kg et par km, 0,75 m par pas. */
export function stepsKcal(steps: number, kg: number): number {
  return Math.round(steps * kg * 0.0004);
}

/** Dépense estimée d'une journée : repos et digestion + pas + séances. */
export function dayExpenditure(bmr: number, steps: number, workoutsKcal: number, kg: number): number {
  return Math.round(bmr * 1.15 + stepsKcal(steps, kg) + workoutsKcal);
}

import type { LogEntry, Macros, StepsDay, Workout } from './types.ts';
import { ZERO, add } from './nutrition.ts';

export const planLogId = (planId: string, profileId: string) => `log:${planId}:${profileId}`;
export const stepsId = (profileId: string, date: string) => `steps:${profileId}:${date}`;
export const weightId = (profileId: string, date: string) => `weight:${profileId}:${date}`;

/** Ce qui a été réellement mangé un jour donné. */
export function intake(logs: LogEntry[], profileId: string, date: string): Macros {
  return logs.filter((l) => l.profileId === profileId && l.date === date).reduce((s, l) => add(s, l.macros), ZERO);
}

export function stepsOn(steps: StepsDay[], profileId: string, date: string): number {
  return steps.find((s) => s.profileId === profileId && s.date === date)?.count ?? 0;
}

export function workoutsBetween(workouts: Workout[], profileId: string, from: string, to: string): Workout[] {
  return workouts.filter((w) => w.profileId === profileId && w.date >= from && w.date <= to).sort((a, b) => b.date.localeCompare(a.date));
}

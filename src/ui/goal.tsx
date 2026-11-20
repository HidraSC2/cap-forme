import type { ReactNode } from 'react';
import type { GoalPlan } from '../lib/goals.ts';
import type { Profile } from '../lib/types.ts';
import { full } from '../lib/dates.ts';
import { pregnancyWeek, PREG_REMINDERS } from '../lib/pregnancy.ts';
import { today } from '../lib/dates.ts';
import { MacroTiles, Notice, Stat, kcal } from './kit.tsx';

const kgTxt = (n: number) => (Math.round(n * 10) / 10).toLocaleString('fr-FR');

/** Résumé des objectifs calculés pour un profil. */
export function GoalSummary({ profile, goal, compact }: { profile: Profile; goal: GoalPlan; compact?: boolean }) {
  let message: ReactNode = null;
  if (goal.mode === 'pregnancy') {
    message = (
      <Notice tone="brand" icon="heart">
        <b>Semaine {pregnancyWeek(profile.dueDate!, today())} · {goal.trimester}<sup>{goal.trimester === 1 ? 'er' : 'e'}</sup> trimestre.</b> Pas de régime pendant la grossesse :
        l'objectif couvre tes besoins, sans déficit. Le suivi par ta sage-femme ou ton médecin prime sur ces chiffres.
      </Notice>
    );
  } else if (goal.mode === 'maintain') {
    message = <Notice tone="brand" icon="check">Objectif atteint : l'apport proposé stabilise ton poids.</Notice>;
  } else if (!goal.feasible) {
    message = (
      <Notice tone="gold" icon="alert">
        Perdre {kgTxt(goal.toLoseKg)} kg d'ici le {full(profile.targetDate)} demanderait un déficit de {kcal(goal.requiredDeficit)} kcal par jour, ce qui est trop.
        Au rythme maximal raisonnable ({kgTxt(goal.weeklyLossKg)} kg par semaine), l'objectif est atteint vers le <b>{full(goal.reachDate)}</b>.
      </Notice>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="À manger" value={`${kcal(goal.targetKcal)}`} sub="kcal par jour" />
        {goal.mode === 'loss' ? (
          <>
            <Stat label="Déficit" value={`−${kcal(goal.deficit)}`} sub="kcal par jour" />
            <Stat label="Rythme" value={`−${kgTxt(goal.weeklyLossKg)} kg`} sub="par semaine" />
          </>
        ) : (
          <>
            <Stat label="Dépense" value={kcal(goal.tdee)} sub="kcal par jour" />
            <Stat label="Métabolisme" value={kcal(goal.bmr)} sub="kcal au repos" />
          </>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-sunken px-2">
        <MacroTiles p={goal.macros.p} c={goal.macros.c} f={goal.macros.f} tone="plain" />
      </div>
      {message}
      {!compact && goal.mode === 'loss' && goal.feasible && (
        <p className="text-sm text-soft">
          Dépense estimée : {kcal(goal.tdee)} kcal par jour (métabolisme de base {kcal(goal.bmr)} kcal). Objectif atteint le <b className="text-ink">{full(goal.reachDate)}</b>.
        </p>
      )}
      {!compact && goal.mode === 'pregnancy' && (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-soft">
          {PREG_REMINDERS.map((r) => <li key={r}>{r}</li>)}
        </ul>
      )}
      {!compact && goal.milestones.length > 1 && (
        <details className="text-sm">
          <summary className="font-semibold text-brand">Voir les jalons semaine par semaine</summary>
          <ol className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {goal.milestones.map((m, i) => (
              <li key={m.date} className="tnum flex justify-between border-b border-line/60 py-0.5">
                <span className="text-soft">Sem. {i + 1}</span><b>{kgTxt(m.kg)} kg</b>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

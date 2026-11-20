import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { LogEntry, PlanEntry, ShoppingState, StepsDay, Workout } from '../lib/types.ts';
import { ingOf } from '../data/ingredients.ts';
import { addDays, full, long, short, today, weekStart } from '../lib/dates.ts';
import { dayExpenditure } from '../lib/activity.ts';
import { expectedWeight } from '../lib/goals.ts';
import { pregnancyWeek } from '../lib/pregnancy.ts';
import { buildShoppingList, listTotal } from '../lib/shopping.ts';
import { SLOTS } from '../lib/slots.ts';
import { intake, stepsOn, workoutsBetween } from '../lib/tracking.ts';
import { useAll } from '../store/store.ts';
import { useCatalog, useGoal, useProfiles, useSettings } from '../store/data.ts';
import { Badge, Bar, Button, Card, CardTitle, MacroBars, Notice, Page, Ring, Stat, eur, kcal, kg, num } from '../ui/kit.tsx';
import { Icon } from '../ui/icons.tsx';

export default function Home() {
  const navigate = useNavigate();
  const { active } = useProfiles();
  const computed = useGoal(active);
  const logs = useAll<LogEntry>('log');
  const plan = useAll<PlanEntry>('plan');
  const steps = useAll<StepsDay>('steps');
  const workouts = useAll<Workout>('workout');
  const lists = useAll<ShoppingState>('list');
  const settings = useSettings();
  const catalog = useCatalog();
  const day = today();
  const from = weekStart(day);
  const to = addDays(from, 6);

  const weekEntries = useMemo(() => plan.filter((e) => e.date >= from && e.date <= to), [plan, from, to]);
  const shopping = useMemo(() => buildShoppingList(weekEntries, catalog.recipeOf, ingOf, catalog.eurKgOf, plan), [weekEntries, catalog, plan]);

  if (!active || !computed) return null;
  const { goal, kg: currentKg } = computed;
  const pregnant = goal.mode === 'pregnancy';

  const eaten = intake(logs, active.id, day);
  const todaySteps = stepsOn(steps, active.id, day);
  const todayWorkouts = workoutsBetween(workouts, active.id, day, day);
  const weekWorkouts = workoutsBetween(workouts, active.id, from, to);
  const spent = dayExpenditure(goal.bmr, todaySteps, todayWorkouts.reduce((s, w) => s + w.kcal, 0), currentKg);
  const meals = plan.filter((e) => e.date === day && (e.portions[active.id] ?? 0) > 0);
  const plannedKcal = meals.reduce((s, e) => { const r = catalog.recipeOf(e.recipeId); return s + (r ? catalog.info(r).per.kcal * e.portions[active.id] : 0); }, 0);

  const list = lists.find((l) => l.id === `list:${from}:${to}`);
  const total = listTotal(shopping.lines, list?.need ?? {});
  const lost = active.startKg - currentKg;
  const span = active.startKg - active.targetKg;
  const ahead = expectedWeight(active, day) - currentKg;

  return (
    <Page title={`Bonjour ${active.name}`} subtitle={<span className="first-letter:uppercase">{long(day)}</span>}>
      {pregnant && (
        <Notice tone="brand" icon="heart">
          <b>Semaine {pregnancyWeek(active.dueDate!, day)} de grossesse.</b> Objectifs sans déficit, recettes à risque signalées.
        </Notice>
      )}

      <Card>
        <CardTitle right={<Link to="/suivi?vue=macros" className="text-sm font-semibold text-brand">Détail</Link>}>Aujourd'hui</CardTitle>
        <div className="flex items-center gap-5">
          <Ring value={eaten.kcal} max={goal.targetKcal}>
            <span className="tnum text-2xl font-bold leading-none">{kcal(eaten.kcal)}</span>
            <span className="mt-1 text-xs text-soft">sur {kcal(goal.targetKcal)} kcal</span>
          </Ring>
          <MacroBars value={eaten} target={goal.macros} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line/70 pt-3">
          <Stat label="Mangé" value={kcal(eaten.kcal)} sub={plannedKcal > 0 ? `${kcal(plannedKcal)} prévues` : 'kcal'} />
          <Stat label="Dépensé" value={`≈ ${kcal(spent)}`} sub="kcal estimées" />
          <Stat label="Reste" value={kcal(Math.max(0, goal.targetKcal - eaten.kcal))} sub="kcal à manger" />
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card onClick={() => navigate('/suivi?vue=poids')}>
          <CardTitle right={<Icon name="scale" size={18} className="text-faint" />}>Poids</CardTitle>
          {pregnant ? (
            <Stat label="Dernière pesée" value={kg(currentKg)} sub={`${kg(active.startKg)} avant grossesse`} />
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <span className="tnum text-3xl font-bold">{kg(currentKg)}</span>
                <span className="text-sm text-soft">objectif {kg(active.targetKg)}</span>
              </div>
              <div className="mt-2"><Bar value={Math.max(0, lost)} max={Math.max(0.1, span)} color="var(--color-chart)" /></div>
              <p className="mt-2 text-sm text-soft">
                {lost > 0 ? <><b className="text-ink">−{kg(lost)}</b> depuis le {short(active.startDate)}. </> : null}
                {goal.toLoseKg > 0 ? (Math.abs(ahead) >= 0.2 && lost !== 0 ? (ahead > 0 ? `${kg(ahead)} d'avance.` : `${kg(-ahead)} de retard.`) : `Cap sur le ${full(goal.reachDate)}.`) : 'Objectif atteint.'}
              </p>
            </>
          )}
        </Card>

        <Card onClick={() => navigate('/suivi?vue=sport')}>
          <CardTitle right={<Icon name="steps" size={18} className="text-faint" />}>Activité</CardTitle>
          <div className="flex items-baseline justify-between">
            <span className="tnum text-3xl font-bold">{num(todaySteps)}</span>
            <span className="text-sm text-soft">sur {num(active.stepGoal)} pas</span>
          </div>
          <div className="mt-2"><Bar value={todaySteps} max={active.stepGoal} color="var(--color-chart)" /></div>
          <p className="mt-2 text-sm text-soft">
            <b className="text-ink">{weekWorkouts.length} séance{weekWorkouts.length > 1 ? 's' : ''}</b> cette semaine
            {weekWorkouts.length > 0 && ` · ${kcal(weekWorkouts.reduce((s, w) => s + w.kcal, 0))} kcal`}
          </p>
        </Card>
      </div>

      <Card>
        <CardTitle right={<Link to="/planning" className="text-sm font-semibold text-brand">Planning</Link>}>Au menu aujourd'hui</CardTitle>
        {meals.length === 0 ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-soft">Rien de prévu pour aujourd'hui.</p>
            <Button small variant="soft" icon="plus" onClick={() => navigate('/planning')}>Planifier</Button>
          </div>
        ) : (
          <ul className="divide-y divide-line/60">
            {SLOTS.flatMap((s) => meals.filter((e) => e.slot === s.id).map((e) => {
              const r = catalog.recipeOf(e.recipeId);
              return (
                <li key={e.id}>
                  <Link to={`/recettes/${e.recipeId}`} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-faint">{s.label}</span>
                      <span className="block truncate font-medium">{r?.title ?? 'Recette supprimée'}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {e.leftoverOf && <Badge tone="gold" icon="box">Restes</Badge>}
                      {r && <span className="tnum text-sm text-soft">{kcal(catalog.info(r).per.kcal * e.portions[active.id])} kcal</span>}
                      <Icon name="right" size={18} className="text-faint" />
                    </span>
                  </Link>
                </li>
              );
            }))}
          </ul>
        )}
      </Card>

      <Card onClick={() => navigate('/courses')}>
        <CardTitle right={list?.status === 'validated' ? <Badge tone="brand" icon="check">Validées</Badge> : weekEntries.length > 0 ? <Badge>À valider</Badge> : undefined}>Courses de la semaine</CardTitle>
        {weekEntries.length === 0 ? (
          <p className="text-sm text-soft">La liste se remplit dès que des repas sont planifiés.</p>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <span className="tnum text-3xl font-bold">{eur(total)}</span>
              <span className="text-sm text-soft">{weekEntries.length} repas · {shopping.lines.filter((l) => !l.pantry).length} articles</span>
            </div>
            {settings.weeklyBudget > 0 && (
              <>
                <div className="mt-2"><Bar value={total} max={settings.weeklyBudget} color={total > settings.weeklyBudget ? 'var(--color-warm)' : 'var(--color-chart)'} /></div>
                <p className="mt-2 text-sm text-soft">{total > settings.weeklyBudget ? `${eur(total - settings.weeklyBudget)} au-dessus du budget de ${eur(settings.weeklyBudget)}.` : `${eur(settings.weeklyBudget - total)} de marge sur ${eur(settings.weeklyBudget)}.`}</p>
              </>
            )}
          </>
        )}
      </Card>

      <Card onClick={() => navigate('/profil')}>
        <CardTitle right={<Icon name="right" size={18} className="text-faint" />}>Mon objectif</CardTitle>
        <p className="text-sm text-soft">
          {pregnant ? <>Couvrir tes besoins : <b className="text-ink">{kcal(goal.targetKcal)} kcal</b> par jour, {goal.macros.p} g de protéines.</>
            : goal.mode === 'maintain' ? <>Stabiliser à <b className="text-ink">{kg(active.targetKg)}</b> avec {kcal(goal.targetKcal)} kcal par jour.</>
            : <>Passer de {kg(active.startKg)} à <b className="text-ink">{kg(active.targetKg)}</b> : {kcal(goal.targetKcal)} kcal par jour, soit −{(Math.round(goal.weeklyLossKg * 10) / 10).toLocaleString('fr-FR')} kg par semaine jusqu'au {full(goal.reachDate)}.</>}
        </p>
      </Card>
    </Page>
  );
}

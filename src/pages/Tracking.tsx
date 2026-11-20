import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { LogEntry, PlanEntry, Profile, Slot, StepsDay, WeightEntry, Workout } from '../lib/types.ts';
import { addDays, dayShort, diffDays, full, long, monthEnd, monthName, monthStart, range, short, today, weekStart } from '../lib/dates.ts';
import { INTENSITY, SPORTS, dayExpenditure, sportLabel, stepsKcal, workoutKcal } from '../lib/activity.ts';
import { expectedWeight, smooth, weeklyTrend } from '../lib/goals.ts';
import { scale } from '../lib/nutrition.ts';
import { SLOTS } from '../lib/slots.ts';
import { intake, planLogId, stepsId, stepsOn, weightId, workoutsBetween } from '../lib/tracking.ts';
import { put, putMany, remove, uid, useAll } from '../store/store.ts';
import { useCatalog, useGoal, useProfiles } from '../store/data.ts';
import { Bar, Button, Card, CardTitle, CheckBox, DateNav, Empty, Field, Input, MacroBars, Notice, NumberInput, Page, Ring, Segmented, Select, Sheet, Stat, kcal, kg, num } from '../ui/kit.tsx';
import { Icon } from '../ui/icons.tsx';
import { DayBars, WeightChart, type WeightPoint } from '../ui/charts.tsx';
import { FoodSheet } from '../ui/food-sheet.tsx';

type Tab = 'macros' | 'sport' | 'poids';

export default function Tracking() {
  const [params, setParams] = useSearchParams();
  const tab = (['macros', 'sport', 'poids'].includes(params.get('vue') ?? '') ? params.get('vue') : 'macros') as Tab;
  const { active } = useProfiles();
  if (!active) return null;
  return (
    <Page title="Suivi" subtitle={`Ce que ${active.name} mange, dépense et pèse`}>
      <Segmented value={tab} onChange={(v) => setParams({ vue: v }, { replace: true })} options={[{ value: 'macros', label: 'Macros' }, { value: 'sport', label: 'Sport' }, { value: 'poids', label: 'Poids' }]} />
      {tab === 'macros' && <MacrosTab key={active.id} profile={active} />}
      {tab === 'sport' && <SportTab key={active.id} profile={active} />}
      {tab === 'poids' && <WeightTab key={active.id} profile={active} />}
    </Page>
  );
}

// ───────────────────────── Macros ─────────────────────────
function MacrosTab({ profile }: { profile: Profile }) {
  const logs = useAll<LogEntry>('log');
  const plan = useAll<PlanEntry>('plan');
  const catalog = useCatalog();
  const goal = useGoal(profile)!.goal;
  const [date, setDate] = useState(today());
  const [adding, setAdding] = useState<Slot | null>(null);

  const eaten = intake(logs, profile.id, date);
  const remaining = goal.targetKcal - eaten.kcal;
  const planned = plan.filter((e) => e.date === date && (e.portions[profile.id] ?? 0) > 0);
  const dayLogs = logs.filter((l) => l.profileId === profile.id && l.date === date);
  const week = range(weekStart(date), addDays(weekStart(date), 6));

  const macrosOf = (e: PlanEntry) => {
    const r = catalog.recipeOf(e.recipeId);
    return r ? scale(catalog.info(r).per, e.portions[profile.id]) : null;
  };

  function toggle(e: PlanEntry, on: boolean) {
    const id = planLogId(e.id, profile.id);
    const m = macrosOf(e);
    const r = catalog.recipeOf(e.recipeId);
    if (!on || !m || !r) return remove(id);
    const n = e.portions[profile.id];
    put('log', { id, profileId: profile.id, date, slot: e.slot, label: r.title, qty: `${String(n).replace('.', ',')} portion${n > 1 ? 's' : ''}`, macros: m, planId: e.id } satisfies LogEntry);
  }

  const unchecked = planned.filter((e) => !dayLogs.some((l) => l.id === planLogId(e.id, profile.id)) && macrosOf(e));
  function checkAll() {
    putMany('log', unchecked.map((e) => {
      const r = catalog.recipeOf(e.recipeId)!;
      const n = e.portions[profile.id];
      return { id: planLogId(e.id, profile.id), profileId: profile.id, date, slot: e.slot, label: r.title, qty: `${String(n).replace('.', ',')} portion${n > 1 ? 's' : ''}`, macros: macrosOf(e)!, planId: e.id } satisfies LogEntry;
    }));
  }

  return (
    <>
      <DateNav label={date === today() ? "Aujourd'hui" : long(date)} onPrev={() => setDate(addDays(date, -1))} onNext={() => setDate(addDays(date, 1))} onToday={() => setDate(today())} />

      <Card>
        <div className="flex items-center gap-5">
          <Ring value={eaten.kcal} max={goal.targetKcal}>
            <span className="tnum text-2xl font-bold leading-none">{kcal(eaten.kcal)}</span>
            <span className="mt-1 text-xs text-soft">sur {kcal(goal.targetKcal)} kcal</span>
          </Ring>
          <MacroBars value={eaten} target={goal.macros} />
        </div>
        <p className="mt-3 text-sm text-soft">
          {remaining >= 0 ? <>Il te reste <b className="text-ink">{kcal(remaining)} kcal</b> pour la journée.</> : <>Objectif dépassé de <b className="text-warm">{kcal(-remaining)} kcal</b>.</>}
          {' '}Fibres : {Math.round(eaten.fiber)} / {goal.macros.fiber} g.
        </p>
      </Card>

      {unchecked.length > 1 && <Button variant="soft" icon="check" onClick={checkAll}>J'ai mangé tout ce qui était prévu</Button>}

      {SLOTS.map((s) => {
        const plannedHere = planned.filter((e) => e.slot === s.id);
        const extras = dayLogs.filter((l) => l.slot === s.id && !l.planId);
        const orphan = dayLogs.filter((l) => l.slot === s.id && l.planId && !plannedHere.some((e) => planLogId(e.id, profile.id) === l.id));
        const total = dayLogs.filter((l) => l.slot === s.id).reduce((sum, l) => sum + l.macros.kcal, 0);
        return (
          <Card key={s.id} className="!p-0">
            <div className="flex items-center justify-between gap-2 px-4 py-2.5">
              <h2 className="font-bold">{s.label}</h2>
              <div className="flex items-center gap-2">
                {total > 0 && <span className="tnum text-sm text-soft">{kcal(total)} kcal</span>}
                <button type="button" aria-label={`Ajouter un aliment : ${s.label}`} onClick={() => setAdding(s.id)} className="flex size-9 items-center justify-center rounded-full text-brand hover:bg-brand-soft active:scale-90"><Icon name="plus" /></button>
              </div>
            </div>
            {(plannedHere.length > 0 || extras.length > 0 || orphan.length > 0) && (
              <ul className="divide-y divide-line/60 border-t border-line/70">
                {plannedHere.map((e) => {
                  const r = catalog.recipeOf(e.recipeId);
                  const m = macrosOf(e);
                  const on = dayLogs.some((l) => l.id === planLogId(e.id, profile.id));
                  return (
                    <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                      <CheckBox label={`Mangé : ${r?.title}`} checked={on} onChange={(v) => toggle(e, v)} />
                      <div className="min-w-0 flex-1">
                        <Link to={`/recettes/${e.recipeId}`} className="block truncate font-medium">{r?.title ?? 'Recette supprimée'}</Link>
                        <div className="tnum text-xs text-soft">{on ? 'Mangé' : 'Prévu'}{m ? ` · ${kcal(m.kcal)} kcal · P ${Math.round(m.p)} g` : ''}</div>
                      </div>
                    </li>
                  );
                })}
                {[...orphan, ...extras].map((l) => (
                  <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand text-white"><Icon name="check" size={16} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{l.label}</div>
                      <div className="tnum text-xs text-soft">{l.qty} · {kcal(l.macros.kcal)} kcal · P {Math.round(l.macros.p)} g</div>
                    </div>
                    <button type="button" aria-label={`Retirer ${l.label}`} onClick={() => remove(l.id)} className="flex size-9 items-center justify-center text-faint hover:text-danger"><Icon name="trash" size={18} /></button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}

      <Card>
        <CardTitle>Calories mangées cette semaine</CardTitle>
        <DayBars data={week.map((d) => ({ date: d, value: intake(logs, profile.id, d).kcal }))} goal={goal.targetKcal} unit="kcal" />
      </Card>

      {adding && <FoodSheet profileId={profile.id} date={date} slot={adding} onClose={() => setAdding(null)} />}
    </>
  );
}

// ───────────────────────── Sport et pas ─────────────────────────
function SportTab({ profile }: { profile: Profile }) {
  const workouts = useAll<Workout>('workout');
  const steps = useAll<StepsDay>('steps');
  const { kg: weightKg } = useGoal(profile)!;
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const [anchor, setAnchor] = useState(today());
  const [editing, setEditing] = useState<Workout | 'new' | null>(null);
  const [stepDate, setStepDate] = useState(today());
  const [stepInput, setStepInput] = useState<number | ''>('');

  const from = mode === 'week' ? weekStart(anchor) : monthStart(anchor);
  const to = mode === 'week' ? addDays(from, 6) : monthEnd(anchor);
  const days = range(from, to);
  const list = workoutsBetween(workouts, profile.id, from, to);
  const totalSteps = days.reduce((s, d) => s + stepsOn(steps, profile.id, d), 0);
  const daysWithSteps = days.filter((d) => stepsOn(steps, profile.id, d) > 0).length;
  const sportKcal = list.reduce((s, w) => s + w.kcal, 0);
  const current = steps.find((s) => s.profileId === profile.id && s.date === stepDate);
  const chartDays = mode === 'week' ? days : range(addDays(today(), -6), today());

  function saveSteps() {
    if (stepInput === '') return;
    put('steps', { id: stepsId(profile.id, stepDate), profileId: profile.id, date: stepDate, count: Math.max(0, Math.round(stepInput)), src: 'manual' } satisfies StepsDay);
    setStepInput('');
  }

  return (
    <>
      <Segmented value={mode} onChange={setMode} options={[{ value: 'week', label: 'Semaine' }, { value: 'month', label: 'Mois' }]} />
      <DateNav label={mode === 'week' ? `Du ${short(from)} au ${short(to)}` : monthName(from)} onPrev={() => setAnchor(addDays(from, -1))} onNext={() => setAnchor(addDays(to, 1))} onToday={() => setAnchor(today())} />

      <Card>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Séances" value={list.length} sub={`${num(list.reduce((s, w) => s + w.minutes, 0))} min`} />
          <Stat label="Sport" value={kcal(sportKcal)} sub="kcal dépensées" />
          <Stat label="Pas" value={num(totalSteps)} sub={daysWithSteps ? `${num(totalSteps / daysWithSteps)} par jour · ${kcal(stepsKcal(totalSteps, weightKg))} kcal` : 'aucun relevé'} />
        </div>
      </Card>

      <Card>
        <CardTitle>Pas</CardTitle>
        <div className="flex items-end gap-2">
          <div className="w-[9.5rem] shrink-0"><Field label="Jour"><Input type="date" value={stepDate} max={today()} onChange={(e) => e.target.value && setStepDate(e.target.value)} /></Field></div>
          <div className="min-w-0 flex-1"><Field label="Nombre de pas"><NumberInput value={stepInput} onChange={setStepInput} placeholder={current ? num(current.count) : '8 000'} suffix="pas" /></Field></div>
          <Button variant="soft" icon="check" disabled={stepInput === ''} onClick={saveSteps} aria-label="Enregistrer les pas" />
        </div>
        {current && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-soft">{stepDate === today() ? "Aujourd'hui" : short(stepDate)} · {current.src === 'health' ? 'reçu de Santé' : 'saisi à la main'}</span>
              <span className="tnum"><b>{num(current.count)}</b><span className="text-faint"> / {num(profile.stepGoal)}</span></span>
            </div>
            <Bar value={current.count} max={profile.stepGoal} color="var(--color-chart)" />
          </div>
        )}
        <div className="mt-4"><DayBars data={chartDays.map((d) => ({ date: d, value: stepsOn(steps, profile.id, d) }))} goal={profile.stepGoal} unit="pas" /></div>
        <p className="mt-2 text-xs text-faint">Pour recevoir les pas d'Apple Santé automatiquement, voir <Link to="/profil" className="font-semibold text-brand">Profil → Apple Santé</Link>.</p>
      </Card>

      <Card className="!p-0">
        <div className="flex items-center justify-between px-4 py-2.5">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-soft">Séances</h2>
          <Button small variant="soft" icon="plus" onClick={() => setEditing('new')}>Ajouter</Button>
        </div>
        {list.length === 0 ? (
          <p className="border-t border-line/70 px-4 py-5 text-center text-sm text-soft">Aucune séance sur cette période.</p>
        ) : (
          <ul className="divide-y divide-line/60 border-t border-line/70">
            {list.map((w) => (
              <li key={w.id}>
                <button type="button" onClick={() => setEditing(w)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon name="dumbbell" size={18} /></span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{sportLabel(w.type)}</span>
                      <span className="block text-xs text-soft first-letter:uppercase">{dayShort(w.date)} {short(w.date)} · {w.minutes} min · {INTENSITY[w.intensity].label.toLowerCase()}</span>
                    </span>
                  </span>
                  <span className="tnum shrink-0 font-semibold">{kcal(w.kcal)} kcal</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editing && <WorkoutSheet profile={profile} weightKg={weightKg} workout={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function WorkoutSheet({ profile, weightKg, workout, onClose }: { profile: Profile; weightKg: number; workout?: Workout; onClose: () => void }) {
  const [type, setType] = useState(workout?.type ?? 'marche-rapide');
  const [date, setDate] = useState(workout?.date ?? today());
  const [minutes, setMinutes] = useState<number | ''>(workout?.minutes ?? 45);
  const [intensity, setIntensity] = useState<Workout['intensity']>(workout?.intensity ?? 'mid');
  const [manual, setManual] = useState<number | ''>(workout && workout.kcal !== workoutKcal(workout.type, workout.minutes, workout.intensity, weightKg) ? workout.kcal : '');
  const auto = minutes === '' ? 0 : workoutKcal(type, minutes, intensity, weightKg);
  const value = manual === '' ? auto : manual;

  function save() {
    if (minutes === '' || minutes <= 0) return;
    put('workout', { id: workout?.id ?? uid(), profileId: profile.id, date, type, minutes, intensity, kcal: Math.round(value) } satisfies Workout);
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={workout ? 'Modifier la séance' : 'Nouvelle séance'}
      footer={
        <div className="flex gap-2">
          {workout && <Button variant="danger" icon="trash" onClick={() => { remove(workout.id); onClose(); }}>Supprimer</Button>}
          <Button full icon="check" disabled={minutes === '' || minutes <= 0} onClick={save}>Enregistrer</Button>
        </div>
      }>
      <div className="flex flex-col gap-4">
        <Field label="Activité"><Select value={type} onChange={setType}>{SPORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Jour"><Input type="date" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} /></Field>
          <Field label="Durée"><NumberInput value={minutes} onChange={setMinutes} suffix="min" /></Field>
        </div>
        <Field label="Intensité">
          <Segmented value={intensity} onChange={setIntensity} options={(Object.keys(INTENSITY) as Workout['intensity'][]).map((k) => ({ value: k, label: INTENSITY[k].label }))} />
        </Field>
        <Field label="Calories dépensées" hint={`Estimation pour ${kg(weightKg)} : ${kcal(auto)} kcal. Remplace-la si ta montre indique autre chose.`}>
          <NumberInput value={manual} onChange={setManual} placeholder={String(auto)} suffix="kcal" />
        </Field>
      </div>
    </Sheet>
  );
}

// ───────────────────────── Poids ─────────────────────────
function WeightTab({ profile }: { profile: Profile }) {
  const all = useAll<WeightEntry>('weight');
  const { goal, kg: currentKg } = useGoal(profile)!;
  const logs = useAll<LogEntry>('log');
  const steps = useAll<StepsDay>('steps');
  const workouts = useAll<Workout>('workout');
  const [date, setDate] = useState(today());
  const [value, setValue] = useState<number | ''>('');
  const [span, setSpan] = useState<'30' | '90' | 'all'>('all');

  const mine = useMemo(() => all.filter((w) => w.profileId === profile.id).sort((a, b) => a.date.localeCompare(b.date)), [all, profile.id]);
  const pregnant = goal.mode === 'pregnancy';
  const trend = weeklyTrend(mine, today());
  const lost = profile.startKg - currentKg;
  const expected = expectedWeight(profile, today());
  const ahead = expected - currentKg;

  const points: WeightPoint[] = useMemo(() => {
    const end = pregnant ? today() : profile.targetDate > today() ? profile.targetDate : today();
    const start = span === 'all' ? profile.startDate : addDays(today(), -Number(span));
    const stop = span === 'all' ? end : addDays(today(), Math.min(21, Math.max(0, diffDays(today(), end))));
    const smoothed = smooth(mine);
    const dates = new Set<string>([start, stop, today(), ...mine.map((w) => w.date)]);
    return [...dates].filter((d) => d >= start && d <= stop).sort().map((d) => {
      const w = smoothed.find((x) => x.date === d);
      return { date: d, kg: w?.kg, avg: w?.avg, target: d >= profile.startDate ? Math.round(expectedWeight(profile, d) * 10) / 10 : undefined };
    });
  }, [mine, profile, span, pregnant]);

  // Bilan énergétique moyen des 7 derniers jours renseignés.
  const balance = useMemo(() => {
    const days = range(addDays(today(), -6), today()).filter((d) => intake(logs, profile.id, d).kcal > 0);
    if (days.length < 3) return null;
    const eaten = days.reduce((s, d) => s + intake(logs, profile.id, d).kcal, 0) / days.length;
    const spent = days.reduce((s, d) => s + dayExpenditure(goal.bmr, stepsOn(steps, profile.id, d), workoutsBetween(workouts, profile.id, d, d).reduce((k, w) => k + w.kcal, 0), currentKg), 0) / days.length;
    return { eaten, spent, days: days.length };
  }, [logs, steps, workouts, profile.id, goal.bmr, currentKg]);

  function save() {
    if (value === '' || value < 30 || value > 300) return;
    put('weight', { id: weightId(profile.id, date), profileId: profile.id, date, kg: Math.round(value * 10) / 10 } satisfies WeightEntry);
    setValue('');
  }

  return (
    <>
      <Card>
        <CardTitle>Nouvelle pesée</CardTitle>
        <div className="flex items-end gap-2">
          <div className="w-[9.5rem] shrink-0"><Field label="Jour"><Input type="date" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} /></Field></div>
          <div className="min-w-0 flex-1"><Field label="Poids"><NumberInput value={value} onChange={setValue} suffix="kg" step="0.1" placeholder={String(currentKg).replace('.', ',')} /></Field></div>
          <Button icon="check" disabled={value === ''} onClick={save} aria-label="Enregistrer la pesée" />
        </div>
        <p className="mt-2 text-xs text-faint">Pèse-toi le matin, à jeun, toujours dans les mêmes conditions : c'est la moyenne sur 7 jours qui compte, pas la valeur d'un jour.</p>
      </Card>

      <Card>
        {pregnant ? (
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Avant grossesse" value={kg(profile.startKg)} />
            <Stat label="Aujourd'hui" value={kg(currentKg)} sub={`${currentKg - profile.startKg >= 0 ? '+' : '−'}${kg(Math.abs(currentKg - profile.startKg))}`} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Départ" value={kg(profile.startKg)} sub={short(profile.startDate)} />
              <Stat label="Aujourd'hui" value={kg(currentKg)} sub={lost >= 0 ? `−${kg(lost)}` : `+${kg(-lost)}`} />
              <Stat label="Objectif" value={kg(profile.targetKg)} sub={short(profile.targetDate)} />
            </div>
            <div className="mt-3"><Bar value={Math.max(0, lost)} max={Math.max(0.1, profile.startKg - profile.targetKg)} color="var(--color-chart)" /></div>
            <p className="mt-2 text-sm text-soft">
              {goal.toLoseKg > 0 ? <>Encore <b className="text-ink">{kg(goal.toLoseKg)}</b> à perdre. </> : <>Objectif atteint. </>}
              {mine.length >= 2 && Math.abs(ahead) >= 0.2 && goal.toLoseKg > 0 && (ahead > 0 ? <>Tu as <b className="text-brand">{kg(ahead)} d'avance</b> sur la trajectoire. </> : <>Tu as <b className="text-warm">{kg(-ahead)} de retard</b> sur la trajectoire. </>)}
              {trend !== null && <>Tendance réelle : <b className="text-ink">{trend <= 0 ? '−' : '+'}{kg(Math.abs(trend))} par semaine</b>.</>}
            </p>
          </>
        )}
      </Card>

      {!pregnant && !goal.feasible && (
        <Notice tone="gold" icon="alert">L'échéance du {full(profile.targetDate)} est trop proche pour un rythme sain. À {(Math.round(goal.weeklyLossKg * 10) / 10).toLocaleString('fr-FR')} kg par semaine, l'objectif arrive vers le {full(goal.reachDate)}.</Notice>
      )}

      <Card>
        <CardTitle right={<div className="w-44"><Segmented value={span} onChange={setSpan} options={[{ value: '30', label: '1 mois' }, { value: '90', label: '3 mois' }, { value: 'all', label: 'Tout' }]} /></div>}>Courbe</CardTitle>
        {mine.length === 0 ? <Empty icon="scale" title="Aucune pesée">Ajoute ta première pesée ci-dessus.</Empty> : <WeightChart points={points} origin={points[0].date} showTarget={!pregnant} />}
      </Card>

      {balance && !pregnant && (
        <Card>
          <CardTitle>Bilan moyen sur {balance.days} jours</CardTitle>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Mangé" value={kcal(balance.eaten)} sub="kcal par jour" />
            <Stat label="Dépensé" value={kcal(balance.spent)} sub="kcal par jour" />
            <Stat label="Écart" value={`${balance.eaten - balance.spent > 0 ? '+' : '−'}${kcal(Math.abs(balance.eaten - balance.spent))}`} sub={`≈ ${((Math.abs(balance.eaten - balance.spent) * 7) / 7700).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kg par semaine`} />
          </div>
          <p className="mt-2 text-xs text-faint">Dépense estimée : métabolisme de base, pas et séances. Ne tient compte que des jours où des repas ont été notés.</p>
        </Card>
      )}

      {mine.length > 0 && (
        <Card className="!p-0">
          <h2 className="px-4 py-2.5 text-[13px] font-semibold uppercase tracking-wide text-soft">Historique</h2>
          <ul className="divide-y divide-line/60 border-t border-line/70">
            {[...mine].reverse().slice(0, 60).map((w, i, arr) => {
              const prev = arr[i + 1];
              const delta = prev ? w.kg - prev.kg : 0;
              return (
                <li key={w.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span className="first-letter:uppercase">{dayShort(w.date)} {full(w.date)}</span>
                  <span className="flex items-center gap-3">
                    {prev && delta !== 0 && <span className="tnum text-sm text-soft">{delta > 0 ? '+' : '−'}{Math.abs(delta).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</span>}
                    <b className="tnum">{kg(w.kg)}</b>
                    <button type="button" aria-label={`Supprimer la pesée du ${full(w.date)}`} onClick={() => remove(w.id)} className="flex size-8 items-center justify-center text-faint hover:text-danger"><Icon name="trash" size={16} /></button>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}

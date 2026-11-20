import { useMemo, useState } from 'react';
import type { Profile } from '../lib/types.ts';
import { ACTIVITY_LEVELS, computeGoal } from '../lib/goals.ts';
import { addDays, today } from '../lib/dates.ts';
import { put, uid } from '../store/store.ts';
import { PROFILE_COLORS } from '../store/data.ts';
import { Button, Field, Input, Notice, NumberInput, Segmented, Select, Toggle } from './kit.tsx';
import { GoalSummary } from './goal.tsx';

type Draft = Omit<Profile, 'heightCm' | 'startKg' | 'targetKg' | 'stepGoal'> & { heightCm: number | ''; startKg: number | ''; targetKg: number | ''; stepGoal: number | '' };

export function blankProfile(index: number): Draft {
  return {
    id: uid(), name: '', sex: 'f', birth: '1990-01-01', heightCm: '', activity: 1.375,
    startKg: '', startDate: today(), targetKg: '', targetDate: addDays(today(), 120),
    pregnant: false, dueDate: addDays(today(), 150), stepGoal: 8000, color: PROFILE_COLORS[index % PROFILE_COLORS.length],
  };
}

/** Formulaire de profil avec aperçu en direct des objectifs calculés. */
export function ProfileForm({ initial, isNew, currentKg, onSaved, onCancel }: { initial: Draft | Profile; isNew: boolean; currentKg?: number; onSaved: (p: Profile) => void; onCancel?: () => void }) {
  const [d, setD] = useState<Draft>(initial);
  const patch = (p: Partial<Draft>) => setD((cur) => ({ ...cur, ...p }));
  const pregnant = d.sex === 'f' && !!d.pregnant;

  const complete = d.name.trim() !== '' && d.heightCm !== '' && d.startKg !== '' && (pregnant || d.targetKg !== '') && d.birth !== '';
  const profile: Profile | null = useMemo(() => {
    if (!complete) return null;
    return {
      ...d, name: d.name.trim(), heightCm: Number(d.heightCm), startKg: Number(d.startKg),
      targetKg: pregnant ? Number(d.startKg) : Number(d.targetKg), stepGoal: Number(d.stepGoal) || 8000, pregnant,
    };
  }, [d, complete, pregnant]);

  const plausible = profile && profile.heightCm >= 120 && profile.heightCm <= 220 && profile.startKg >= 35 && profile.startKg <= 250 && profile.targetKg >= 35;
  const goal = profile && plausible ? computeGoal(profile, isNew ? profile.startKg : (currentKg ?? profile.startKg), today()) : null;
  const bmiTarget = profile && plausible ? profile.targetKg / (profile.heightCm / 100) ** 2 : null;

  function save() {
    if (!profile) return;
    put('profile', profile);
    if (isNew) put('weight', { id: `weight:${profile.id}:${profile.startDate}`, profileId: profile.id, date: profile.startDate, kg: profile.startKg });
    onSaved(profile);
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Prénom"><Input value={d.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Ton prénom" autoComplete="given-name" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sexe"><Segmented value={d.sex} onChange={(sex) => patch({ sex })} options={[{ value: 'f', label: 'Femme' }, { value: 'm', label: 'Homme' }]} /></Field>
        <Field label="Date de naissance"><Input type="date" value={d.birth} max={today()} onChange={(e) => patch({ birth: e.target.value })} /></Field>
        <Field label="Taille"><NumberInput value={d.heightCm} onChange={(heightCm) => patch({ heightCm })} suffix="cm" placeholder="170" /></Field>
        <Field label={pregnant ? 'Poids avant grossesse' : isNew ? 'Poids actuel' : 'Poids de départ'}><NumberInput value={d.startKg} onChange={(startKg) => patch({ startKg })} suffix="kg" step="0.1" placeholder="75" /></Field>
      </div>

      {d.sex === 'f' && (
        <div className="rounded-xl border border-line bg-surface p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">Je suis enceinte</div>
              <div className="text-sm text-soft">Adapte les objectifs et signale les recettes à éviter.</div>
            </div>
            <Toggle checked={!!d.pregnant} onChange={(v) => patch({ pregnant: v })} label="Je suis enceinte" />
          </div>
          {pregnant && <div className="mt-3"><Field label="Date prévue du terme"><Input type="date" value={d.dueDate ?? ''} onChange={(e) => patch({ dueDate: e.target.value })} /></Field></div>}
        </div>
      )}

      {!pregnant && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Poids visé"><NumberInput value={d.targetKg} onChange={(targetKg) => patch({ targetKg })} suffix="kg" step="0.1" placeholder="68" /></Field>
          <Field label="Pour le"><Input type="date" value={d.targetDate} min={addDays(today(), 7)} onChange={(e) => patch({ targetDate: e.target.value })} /></Field>
        </div>
      )}

      <Field label="Niveau d'activité" hint={ACTIVITY_LEVELS.find((a) => a.value === d.activity)?.hint}>
        <Select value={String(d.activity)} onChange={(v) => patch({ activity: Number(v) })}>
          {ACTIVITY_LEVELS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </Select>
      </Field>
      <Field label="Objectif de pas par jour"><NumberInput value={d.stepGoal} onChange={(stepGoal) => patch({ stepGoal })} suffix="pas" step="500" /></Field>

      {bmiTarget !== null && !pregnant && bmiTarget < 18.5 && (
        <Notice tone="danger" icon="alert">Le poids visé correspond à un IMC de {bmiTarget.toFixed(1)}, en dessous du seuil de maigreur (18,5). Choisis une cible plus haute, ou parles-en à un médecin.</Notice>
      )}

      {goal && profile && (
        <div className="rounded-2xl border border-brand/30 bg-surface p-4">
          <div className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-brand">Tes objectifs calculés</div>
          <GoalSummary profile={profile} goal={goal} compact />
        </div>
      )}

      <div className="flex gap-2">
        {onCancel && <Button variant="ghost" onClick={onCancel}>Annuler</Button>}
        <Button full disabled={!goal} onClick={save} icon="check">{isNew ? 'Créer le profil' : 'Enregistrer'}</Button>
      </div>
    </div>
  );
}

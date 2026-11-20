import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { PlanEntry, Recipe, Slot } from '../lib/types.ts';
import { addDays, long, today } from '../lib/dates.ts';
import { SLOTS, defaultSlot } from '../lib/slots.ts';
import { scale } from '../lib/nutrition.ts';
import { all, put, putMany, remove, uid } from '../store/store.ts';
import { useCatalog, useProfiles } from '../store/data.ts';
import { Button, Field, Input, MacroLine, Notice, Select, Sheet, Stepper } from './kit.tsx';

/** Ajout d'une recette au planning, ou modification d'un repas déjà planifié. */
export function PlanSheet({ recipe, entry, date, slot, onClose }: { recipe: Recipe; entry?: PlanEntry; date?: string; slot?: Slot; onClose: () => void }) {
  const { profiles } = useProfiles();
  const catalog = useCatalog();
  const info = catalog.info(recipe);
  const [day, setDay] = useState(entry?.date ?? date ?? today());
  const [when, setWhen] = useState<Slot>(entry?.slot ?? slot ?? defaultSlot(recipe.meal));
  const [portions, setPortions] = useState<Record<string, number>>(() => entry?.portions ?? Object.fromEntries(profiles.map((p) => [p.id, 1])));
  const [extra, setExtra] = useState(entry?.extra ?? 0);
  const [repeats, setRepeats] = useState(0);

  const total = Object.values(portions).reduce((s, n) => s + n, 0) + extra;
  const maxRepeats = recipe.batch ? Math.min(6, recipe.batch.keepDays) : 0;
  const pregnantEaters = profiles.filter((p) => p.pregnant && (portions[p.id] ?? 0) > 0);

  function save() {
    const base: PlanEntry = { id: entry?.id ?? uid(), date: day, slot: when, recipeId: recipe.id, portions, extra, leftoverOf: entry?.leftoverOf };
    const leftovers: PlanEntry[] = Array.from({ length: entry ? 0 : repeats }, (_, i) => ({
      id: uid(), date: addDays(day, i + 1), slot: when, recipeId: recipe.id, portions, extra, leftoverOf: base.id,
    }));
    putMany('plan', [base, ...leftovers]);
    onClose();
  }

  function del() {
    if (!entry) return;
    // Supprimer la préparation supprime aussi les repas de restes qui en dépendent.
    const linked = all<PlanEntry>('plan').filter((e) => e.leftoverOf === entry.id).map((e) => e.id);
    remove(entry.id, ...linked);
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={entry ? 'Modifier le repas' : 'Ajouter au planning'}
      footer={
        <div className="flex gap-2">
          {entry && <Button variant="danger" icon="trash" onClick={del}>Retirer</Button>}
          <Button full icon="check" disabled={total <= 0} onClick={save}>{entry ? 'Enregistrer' : repeats > 0 ? `Planifier ${repeats + 1} repas` : 'Planifier'}</Button>
        </div>
      }>
      <div className="flex flex-col gap-4">
        <div>
          <Link to={`/recettes/${recipe.id}`} onClick={onClose} className="text-lg font-bold leading-snug text-brand underline-offset-2 hover:underline">{recipe.title}</Link>
          <div className="mt-1 text-sm text-soft">Par portion : <MacroLine m={info.per} /></div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Jour" hint={long(day)}><Input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} /></Field>
          <Field label="Repas">
            <Select value={when} onChange={(v) => setWhen(v as Slot)}>{SLOTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select>
          </Field>
        </div>

        <div>
          <div className="mb-2 text-sm font-semibold">Portions</div>
          <div className="flex flex-col gap-2">
            {profiles.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium"><span className="size-2.5 rounded-full" style={{ background: p.color }} />{p.name}</div>
                  {(portions[p.id] ?? 0) > 0 && <MacroLine m={scale(info.per, portions[p.id])} className="text-soft" />}
                </div>
                <Stepper label={`Portions de ${p.name}`} value={portions[p.id] ?? 0} step={0.5} max={4} onChange={(n) => setPortions({ ...portions, [p.id]: n })} />
              </div>
            ))}
            <div className="flex items-center justify-between gap-3">
              <div><div className="font-medium">Autres convives</div><div className="text-sm text-soft">Enfants, invités…</div></div>
              <Stepper label="Portions supplémentaires" value={extra} step={1} max={12} onChange={setExtra} />
            </div>
          </div>
        </div>

        {!entry && recipe.batch && (
          <div className="rounded-xl border border-gold/30 bg-gold-soft/60 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">Cuisiner pour plusieurs repas</div>
                <div className="text-sm text-soft">Se garde {recipe.batch.keepDays} jours au frais{recipe.batch.freeze ? ', se congèle' : ''}.</div>
              </div>
              <Stepper label="Repas supplémentaires" value={repeats} max={maxRepeats} onChange={setRepeats} />
            </div>
            {repeats > 0 && (
              <p className="mt-2 text-sm text-soft">
                Une seule préparation de <b className="text-ink">{String(total * (repeats + 1)).replace('.', ',')} portions</b>, servie aussi {repeats > 1 ? `les ${repeats} jours suivants` : 'le lendemain'} au même repas.
              </p>
            )}
          </div>
        )}

        {entry?.leftoverOf && <Notice tone="gold" icon="box">Ce repas utilise les restes d'une préparation faite un autre jour.</Notice>}

        {pregnantEaters.length > 0 && info.preg.level !== 'ok' && (
          <Notice tone={info.preg.level === 'avoid' ? 'danger' : 'gold'} icon="alert">
            <b>{info.preg.level === 'avoid' ? 'Déconseillé' : 'Prudence'} pour {pregnantEaters.map((p) => p.name).join(' et ')} :</b> {info.preg.reasons.join(' ')}
          </Notice>
        )}
      </div>
    </Sheet>
  );
}

/** Enregistre directement un repas (utilisé par les suggestions). */
export function quickPlan(recipe: Recipe, date: string, slot: Slot, profileIds: string[]): void {
  put('plan', { id: uid(), date, slot, recipeId: recipe.id, portions: Object.fromEntries(profileIds.map((id) => [id, 1])), extra: 0 } satisfies PlanEntry);
}

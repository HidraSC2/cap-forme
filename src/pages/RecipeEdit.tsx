import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { MealType, Qty, Recipe, Unit } from '../lib/types.ts';
import { INGREDIENTS, ingOf } from '../data/ingredients.ts';
import { parseLine } from '../lib/parse-ingredient.ts';
import { recipePerServing } from '../lib/nutrition.ts';
import { UNIT_LABEL, formatQty, toGrams } from '../lib/units.ts';
import { put, uid } from '../store/store.ts';
import { useCatalog } from '../store/data.ts';
import { importRecipeFromUrl, useSync } from '../store/sync.ts';
import { Button, Card, CardTitle, Field, Input, MacroLine, Notice, NumberInput, Page, Select, Toggle } from '../ui/kit.tsx';
import { Icon } from '../ui/icons.tsx';

interface Row {
  raw: string;
  n: number | '';
  unit: Unit;
  ing: string; // '' = non compté
}

const SORTED = [...INGREDIENTS].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
const toRows = (text: string): Row[] =>
  text.split('\n').map((l) => l.replace(/^[-•*\s]+/, '').trim()).filter(Boolean).map((raw) => {
    const p = parseLine(raw, INGREDIENTS);
    return { raw, n: p.qty.n, unit: p.qty.unit, ing: p.match?.id ?? '' };
  });

export default function RecipeEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const catalog = useCatalog();
  const sync = useSync();
  const existing = id ? catalog.recipeOf(id) : undefined;
  const editable = existing?.custom ? existing : undefined;

  const [title, setTitle] = useState(editable?.title ?? '');
  const [meal, setMeal] = useState<MealType>(editable?.meal ?? 'plat');
  const [servings, setServings] = useState<number | ''>(editable?.servings ?? 4);
  const [prep, setPrep] = useState<number | ''>(editable?.prep ?? 15);
  const [cook, setCook] = useState<number | ''>(editable?.cook ?? 20);
  const [batch, setBatch] = useState(!!editable?.batch);
  const [keepDays, setKeepDays] = useState<number | ''>(editable?.batch?.keepDays ?? 3);
  const [freeze, setFreeze] = useState(editable?.batch?.freeze ?? false);
  const [steps, setSteps] = useState(editable?.steps.join('\n') ?? '');
  const [sourceUrl, setSourceUrl] = useState(editable?.sourceUrl ?? '');
  const [draft, setDraft] = useState('');
  const [rows, setRows] = useState<Row[]>(() => [
    ...(editable?.ings.map((ri) => ({ raw: `${formatQty(ri.qty, ingOf(ri.ing)!)} ${ingOf(ri.ing)!.name}`, n: ri.qty.n, unit: ri.qty.unit, ing: ri.ing })) ?? []),
    ...(editable?.loose?.map((raw) => ({ raw, n: 1 as number | '', unit: 'pc' as Unit, ing: '' })) ?? []),
  ]);
  const [url, setUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [newId] = useState(uid);

  const recipe: Recipe | null = useMemo(() => {
    if (!title.trim() || servings === '' || servings < 1) return null;
    // Un même ingrédient cité deux fois est regroupé (en grammes).
    const merged = new Map<string, Qty>();
    for (const r of rows) {
      const ing = r.ing ? ingOf(r.ing) : undefined;
      if (!ing || r.n === '' || r.n <= 0) continue;
      const qty: Qty = { n: r.n, unit: r.unit };
      const prev = merged.get(ing.id);
      merged.set(ing.id, prev ? { n: toGrams(prev, ing) + toGrams(qty, ing), unit: 'g' } : qty);
    }
    return {
      id: editable?.id ?? newId, title: title.trim(), meal, servings, prep: Number(prep) || 0, cook: Number(cook) || 0,
      ings: [...merged].map(([ing, qty]) => ({ ing, qty })),
      loose: rows.filter((r) => !r.ing).map((r) => r.raw),
      steps: steps.split('\n').map((s) => s.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean),
      batch: batch ? { keepDays: Number(keepDays) || 3, freeze } : undefined,
      sourceUrl: sourceUrl.trim() || undefined, custom: true,
    };
  }, [title, meal, servings, prep, cook, rows, steps, batch, keepDays, freeze, sourceUrl, editable?.id, newId]);

  const per = recipe && recipe.ings.length ? recipePerServing(recipe, ingOf) : null;
  const unmatched = rows.filter((r) => !r.ing).length;
  const setRow = (i: number, patch: Partial<Row>) => setRows((cur) => cur.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function runImport() {
    setError('');
    setImporting(true);
    try {
      const r = await importRecipeFromUrl(url.trim());
      setTitle(r.title);
      setServings(r.servings || 4);
      setPrep(r.prep);
      setCook(r.cook);
      setRows(toRows(r.ingredients.join('\n')));
      setSteps(r.steps.join('\n'));
      setSourceUrl(r.sourceUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import impossible.');
    } finally {
      setImporting(false);
    }
  }

  function save() {
    if (!recipe) return;
    put('recipe', recipe);
    navigate(`/recettes/${recipe.id}`, { replace: true });
  }

  if (id && !editable) {
    return <Page title="Recette non modifiable"><Notice>Seules tes recettes personnelles peuvent être modifiées.</Notice><Button onClick={() => navigate(-1)}>Retour</Button></Page>;
  }

  return (
    <Page title={editable ? 'Modifier la recette' : 'Nouvelle recette'} subtitle="Les macros et le prix sont calculés depuis les ingrédients">
      {!editable && (
        <Card>
          <CardTitle>Importer depuis un lien</CardTitle>
          {sync.status === 'ready' || sync.status === 'syncing' ? (
            <>
              <div className="flex gap-2">
                <Input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… (Marmiton, 750g, Cuisine AZ…)" aria-label="Lien de la recette" />
                <Button variant="soft" icon="link" disabled={!/^https?:\/\/.+/.test(url.trim()) || importing} onClick={runImport}>{importing ? 'Lecture…' : 'Importer'}</Button>
              </div>
              <p className="mt-2 text-xs text-faint">Pour ton usage personnel : la recette reste privée dans ton foyer, avec le lien vers sa source.</p>
            </>
          ) : (
            <p className="text-sm text-soft">L'import par lien passe par le serveur du foyer : il est disponible une fois la synchronisation activée (Profil). En attendant, colle simplement la liste d'ingrédients ci-dessous.</p>
          )}
          {error && <div className="mt-2"><Notice tone="danger" icon="alert">{error}</Notice></div>}
        </Card>
      )}

      <Card>
        <div className="flex flex-col gap-3">
          <Field label="Nom de la recette"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. : Gratin de courgettes de mamie" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={meal} onChange={(v) => setMeal(v as MealType)}>
                <option value="pdj">Petit-déjeuner</option><option value="plat">Plat</option><option value="collation">Collation ou dessert</option>
              </Select>
            </Field>
            <Field label="Portions"><NumberInput value={servings} onChange={setServings} min={1} /></Field>
            <Field label="Préparation"><NumberInput value={prep} onChange={setPrep} suffix="min" /></Field>
            <Field label="Cuisson"><NumberInput value={cook} onChange={setCook} suffix="min" /></Field>
          </div>
          <div className="rounded-xl border border-line p-3">
            <div className="flex items-center justify-between gap-3">
              <div><div className="font-semibold">Recette batch cooking</div><div className="text-sm text-soft">Se prépare en avance pour plusieurs repas.</div></div>
              <Toggle label="Recette batch cooking" checked={batch} onChange={setBatch} />
            </div>
            {batch && (
              <div className="mt-3 grid grid-cols-2 items-end gap-3">
                <Field label="Conservation"><NumberInput value={keepDays} onChange={setKeepDays} suffix="jours" /></Field>
                <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><Toggle label="Se congèle" checked={freeze} onChange={setFreeze} />Se congèle</label>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Ingrédients</CardTitle>
        <Field label="Colle ou écris les ingrédients, un par ligne">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} placeholder={'200 g de pâtes\n2 c. à soupe d\'huile d\'olive\n1 oignon'}
            className="block w-full rounded-xl border border-line bg-surface px-3 py-2 placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
        </Field>
        <div className="mt-2"><Button small variant="soft" icon="plus" disabled={!draft.trim()} onClick={() => { setRows([...rows, ...toRows(draft)]); setDraft(''); }}>Ajouter à la recette</Button></div>

        {rows.length > 0 && (
          <ul className="mt-4 flex flex-col gap-3">
            {rows.map((r, i) => (
              <li key={i} className="rounded-xl bg-sunken p-2.5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="text-sm text-soft">{r.raw}</span>
                  <button type="button" aria-label={`Retirer ${r.raw}`} onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-faint hover:text-danger"><Icon name="x" size={18} /></button>
                </div>
                <div className="grid grid-cols-[5rem_7.5rem_1fr] gap-2">
                  <NumberInput value={r.n} onChange={(n) => setRow(i, { n })} aria-label="Quantité" step="0.5" />
                  <Select label="Unité" value={r.unit} onChange={(v) => setRow(i, { unit: v as Unit })}>
                    {(Object.keys(UNIT_LABEL) as Unit[]).map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}
                  </Select>
                  <Select label="Ingrédient" value={r.ing} onChange={(v) => setRow(i, { ing: v })}>
                    <option value="">— Ne pas compter —</option>
                    {SORTED.map((ing) => <option key={ing.id} value={ing.id}>{ing.name}</option>)}
                  </Select>
                </div>
                {r.ing && r.n !== '' && r.unit !== 'g' && <div className="mt-1 text-xs text-faint">≈ {Math.round(toGrams({ n: r.n, unit: r.unit }, ingOf(r.ing)!))} g</div>}
              </li>
            ))}
          </ul>
        )}
        {unmatched > 0 && (
          <div className="mt-3"><Notice icon="info">{unmatched} ligne{unmatched > 1 ? 's' : ''} non reconnue{unmatched > 1 ? 's' : ''} : choisis l'ingrédient correspondant, ou laisse « Ne pas compter » (la ligne sera reprise telle quelle dans les courses).</Notice></div>
        )}
        {per && <div className="mt-3 rounded-xl bg-brand-soft px-3 py-2.5 text-sm">Par portion : <MacroLine m={per} /></div>}
      </Card>

      <Card>
        <CardTitle>Préparation</CardTitle>
        <Field label="Une étape par ligne">
          <textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={6} placeholder={'Faire revenir l\'oignon…\nAjouter les pâtes…'}
            className="block w-full rounded-xl border border-line bg-surface px-3 py-2 placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
        </Field>
      </Card>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => navigate(-1)}>Annuler</Button>
        <Button full icon="check" disabled={!recipe || (recipe.ings.length === 0 && recipe.loose?.length === 0)} onClick={save}>Enregistrer la recette</Button>
      </div>
    </Page>
  );
}

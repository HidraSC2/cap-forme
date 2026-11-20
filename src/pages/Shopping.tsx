import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { PlanEntry, Recipe, ShoppingState } from '../lib/types.ts';
import { AISLE_ORDER, PRICES_UPDATED, ingOf } from '../data/ingredients.ts';
import { addDays, dayShort, diffDays, full, monthEnd, monthName, monthStart, short, today, weekStart } from '../lib/dates.ts';
import { buildShoppingList, cheaperSwaps, isNeeded, leftoverIdeas, listTotal, planMacros, type ShoppingLine } from '../lib/shopping.ts';
import { formatGrams } from '../lib/units.ts';
import { put, putMany, remove, uid, useAll } from '../store/store.ts';
import { useCatalog, useGoal, useProfiles, useSettings } from '../store/data.ts';
import { Badge, Bar, Button, Card, CardTitle, CheckBox, DateNav, Empty, Input, MacroLine, Notice, NumberInput, Page, Segmented, Sheet, Stat, Toggle, cx, eur, kcal } from '../ui/kit.tsx';
import { Icon } from '../ui/icons.tsx';
import type { Profile } from '../lib/types.ts';

const SRC_LABEL = { 'open-prices': 'Prix relevé (Open Prices)', moyenne: 'Prix moyen estimé', perso: 'Ton prix' };

export default function Shopping() {
  const navigate = useNavigate();
  const plan = useAll<PlanEntry>('plan');
  const lists = useAll<ShoppingState>('list');
  const catalog = useCatalog();
  const { profiles } = useProfiles();
  const settings = useSettings();
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const [anchor, setAnchor] = useState(today());
  const [detail, setDetail] = useState<string | null>(null);
  const [extraText, setExtraText] = useState('');
  const [showPantry, setShowPantry] = useState(false);
  const [copied, setCopied] = useState(false);

  const from = mode === 'week' ? weekStart(anchor) : monthStart(anchor);
  const to = mode === 'week' ? addDays(from, 6) : monthEnd(anchor);
  const nDays = diffDays(from, to) + 1;
  const listId = `list:${from}:${to}`;
  const state: ShoppingState = lists.find((l) => l.id === listId) ?? { id: listId, from, to, status: 'draft', checked: {}, need: {}, extras: [] };
  const save = (patch: Partial<ShoppingState>) => put('list', { ...state, ...patch });

  const entries = useMemo(() => plan.filter((e) => e.date >= from && e.date <= to), [plan, from, to]);
  const { lines, loose } = useMemo(() => buildShoppingList(entries, catalog.recipeOf, ingOf, catalog.eurKgOf, plan), [entries, catalog, plan]);
  const toBuy = lines.filter((l) => isNeeded(l, state.need));
  const pantry = lines.filter((l) => !isNeeded(l, state.need));
  const total = listTotal(lines, state.need);
  const budget = settings.weeklyBudget > 0 ? (settings.weeklyBudget * nDays) / 7 : 0;
  const doneCount = toBuy.filter((l) => state.checked[l.ingId]).length;
  const validated = state.status === 'validated';

  const plannedRecipes = useMemo(() => {
    const seen = new Map<string, { recipe: Recipe; dates: string[] }>();
    for (const e of [...entries].sort((a, b) => a.date.localeCompare(b.date))) {
      const recipe = catalog.recipeOf(e.recipeId);
      if (!recipe || e.leftoverOf) continue;
      const cur = seen.get(recipe.id) ?? { recipe, dates: [] };
      cur.dates.push(e.date);
      seen.set(recipe.id, cur);
    }
    return [...seen.values()];
  }, [entries, catalog]);

  const plannedIds = useMemo(() => new Set(entries.map((e) => e.recipeId)), [entries]);
  const ideas = useMemo(() => leftoverIdeas(lines, catalog.recipes, plannedIds, ingOf), [lines, catalog, plannedIds]);
  const swaps = useMemo(
    () => (budget > 0 && total > budget ? cheaperSwaps(plannedRecipes.map((p) => p.recipe), catalog.recipes, ingOf, catalog.eurKgOf) : []),
    [budget, total, plannedRecipes, catalog],
  );
  const macros = useMemo(() => planMacros(entries, catalog.recipeOf, ingOf), [entries, catalog]);

  function applySwap(fromId: string, toId: string) {
    putMany('plan', entries.filter((e) => e.recipeId === fromId).map((e) => ({ ...e, recipeId: toId })));
  }

  function addExtra() {
    const label = extraText.trim();
    if (!label) return;
    save({ extras: [...state.extras, { id: uid(), label, checked: false }] });
    setExtraText('');
  }

  async function copyList() {
    const byAisle = AISLE_ORDER.map((a) => ({ a, items: toBuy.filter((l) => l.aisle === a) })).filter((g) => g.items.length);
    const text = [
      `Courses du ${short(from)} au ${short(to)} — environ ${eur(total)}`,
      ...byAisle.flatMap((g) => ['', g.a.toUpperCase(), ...g.items.map((l) => `- ${l.name} : ${l.buyLabel}`)]),
      ...(state.extras.length || loose.length ? ['', 'AUTRES', ...loose.map((l) => `- ${l.text}`), ...state.extras.map((x) => `- ${x.label}`)] : []),
    ].join('\n');
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch { /* partage annulé */ }
  }

  const detailLine = detail ? lines.find((l) => l.ingId === detail) : undefined;

  return (
    <Page title="Courses" subtitle="Calculées à partir de ton planning">
      <Segmented value={mode} onChange={setMode} options={[{ value: 'week', label: 'Semaine' }, { value: 'month', label: 'Mois' }]} />
      <DateNav label={mode === 'week' ? `Du ${short(from)} au ${short(to)}` : monthName(from)}
        onPrev={() => setAnchor(addDays(from, -1))} onNext={() => setAnchor(addDays(to, 1))} onToday={() => setAnchor(today())} />

      {entries.length === 0 ? (
        <Empty icon="cart" title="Aucun repas planifié sur cette période" action={<Button icon="calendar" onClick={() => navigate('/planning')}>Ouvrir le planning</Button>}>
          La liste de courses se remplit toute seule dès que tu ajoutes des recettes au planning.
        </Empty>
      ) : (
        <>
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div className="grid flex-1 grid-cols-2 gap-3">
                <Stat label="Total estimé" value={eur(total)} sub={`${toBuy.length} article${toBuy.length > 1 ? 's' : ''}`} />
                <Stat label="Par jour" value={eur(total / nDays)} sub={`${plannedRecipes.length} recette${plannedRecipes.length > 1 ? 's' : ''}`} />
              </div>
              {validated ? <Badge tone="brand" icon="check">Validée</Badge> : <Badge>Brouillon</Badge>}
            </div>
            {budget > 0 ? (
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-soft">Budget {mode === 'week' ? 'de la semaine' : 'du mois'}</span>
                  <span className={cx('tnum font-semibold', total > budget ? 'text-warm' : 'text-brand')}>
                    {total > budget ? `${eur(total - budget)} au-dessus` : `${eur(budget - total)} de marge`}
                  </span>
                </div>
                <Bar value={total} max={budget} color={total > budget ? 'var(--color-warm)' : 'var(--color-brand)'} />
              </div>
            ) : (
              <p className="mt-3 text-sm text-soft">Fixe un budget hebdomadaire dans <Link to="/profil" className="font-semibold text-brand">Profil</Link> pour suivre tes dépenses.</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button small variant="soft" icon="copy" onClick={copyList}>{copied ? 'Copiée !' : 'Partager la liste'}</Button>
              {validated && <Button small variant="ghost" icon="pencil" onClick={() => save({ status: 'draft' })}>Repasser en brouillon</Button>}
            </div>
          </Card>

          {swaps.length > 0 && (
            <Card>
              <CardTitle>Pour tenir le budget</CardTitle>
              <ul className="flex flex-col gap-3">
                {swaps.map((s) => (
                  <li key={s.from.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0 text-sm">
                      <div className="truncate text-soft line-through">{s.from.title}</div>
                      <div className="truncate font-semibold">{s.to.title}</div>
                      <div className="text-brand">−{eur(s.savingPerServing)} par portion, apports proches</div>
                    </div>
                    <Button small variant="soft" icon="swap" onClick={() => applySwap(s.from.id, s.to.id)}>Remplacer</Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {validated && (
            <Card>
              <div className="mb-2 flex items-baseline justify-between text-sm">
                <span className="font-semibold">En magasin</span>
                <span className="tnum text-soft">{doneCount} / {toBuy.length} dans le panier</span>
              </div>
              <Bar value={doneCount} max={toBuy.length} />
            </Card>
          )}

          {AISLE_ORDER.map((aisle) => {
            const items = toBuy.filter((l) => l.aisle === aisle);
            if (!items.length) return null;
            return (
              <Card key={aisle} className="!p-0">
                <div className="flex items-baseline justify-between border-b border-line/70 px-4 py-2.5">
                  <h2 className="text-[13px] font-semibold uppercase tracking-wide text-soft">{aisle}</h2>
                  <span className="tnum text-sm text-faint">{eur(items.reduce((s, l) => s + l.price, 0))}</span>
                </div>
                <ul className="divide-y divide-line/60">
                  {items.map((l) => <LineRow key={l.ingId} line={l} checked={!!state.checked[l.ingId]} onCheck={(v) => save({ checked: { ...state.checked, [l.ingId]: v } })} onOpen={() => setDetail(l.ingId)} />)}
                </ul>
              </Card>
            );
          })}

          {(
            <Card>
              <CardTitle>Autres articles</CardTitle>
              <ul className="mb-3 flex flex-col gap-2">
                {loose.map((l) => <li key={l.recipeId + l.text} className="text-sm text-soft">{l.text} <span className="text-xs">— {catalog.recipeOf(l.recipeId)?.title}</span></li>)}
                {state.extras.map((x) => (
                  <li key={x.id} className="flex items-center gap-3">
                    <CheckBox label={x.label} checked={x.checked} onChange={(v) => save({ extras: state.extras.map((e) => (e.id === x.id ? { ...e, checked: v } : e)) })} />
                    <span className={cx('flex-1', x.checked && 'text-faint line-through')}>{x.label}</span>
                    <button type="button" aria-label={`Retirer ${x.label}`} onClick={() => save({ extras: state.extras.filter((e) => e.id !== x.id) })} className="text-faint hover:text-danger"><Icon name="x" size={18} /></button>
                  </li>
                ))}
              </ul>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addExtra(); }}>
                <Input value={extraText} onChange={(e) => setExtraText(e.target.value)} placeholder="Ajouter un article (café, lessive…)" aria-label="Ajouter un article" />
                <Button variant="soft" icon="plus" onClick={addExtra} aria-label="Ajouter" />
              </form>
            </Card>
          )}

          {pantry.length > 0 && (
            <Card className="!p-0">
              <button type="button" onClick={() => setShowPantry(!showPantry)} aria-expanded={showPantry} className="flex w-full items-center justify-between px-4 py-3 text-left">
                <div>
                  <div className="font-semibold">Déjà au placard ({pantry.length})</div>
                  <div className="text-sm text-soft">Huile, épices, farine… à vérifier avant de partir</div>
                </div>
                <Icon name="down" className={cx('text-soft transition', showPantry && 'rotate-180')} />
              </button>
              {showPantry && (
                <ul className="divide-y divide-line/60 border-t border-line/70">
                  {pantry.map((l) => (
                    <li key={l.ingId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0"><div className="truncate">{l.name}</div><div className="text-xs text-soft">Besoin : {formatGrams(l.needG)}</div></div>
                      <Button small variant="soft" icon="plus" onClick={() => save({ need: { ...state.need, [l.ingId]: true } })}>À acheter</Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card>
            <CardTitle>Ce que couvre cette liste</CardTitle>
            <MacroLine m={macros} className="text-base" />
            <p className="mt-1 text-sm text-soft">au total pour {entries.length} repas sur {nDays} jours.</p>
            <div className="mt-3 flex flex-col gap-3">
              {profiles.map((p) => <ProfileCoverage key={p.id} profile={p} entries={entries} nDays={nDays} />)}
            </div>
          </Card>

          <Card>
            <CardTitle>Recettes à cuisiner</CardTitle>
            <ul className="divide-y divide-line/60">
              {plannedRecipes.map(({ recipe, dates }) => (
                <li key={recipe.id}>
                  <Link to={`/recettes/${recipe.id}`} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{recipe.title}</div>
                      <div className="text-xs text-soft first-letter:uppercase">{dates.map((d) => `${dayShort(d)} ${short(d)}`).join(', ')}</div>
                    </div>
                    <span className="flex shrink-0 items-center gap-2">{recipe.batch && <Badge tone="gold" icon="box">Batch</Badge>}<Icon name="right" size={18} className="text-faint" /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          {ideas.length > 0 && (
            <Card>
              <CardTitle>Pour finir les paquets entamés</CardTitle>
              <ul className="flex flex-col gap-2.5">
                {ideas.map((idea) => (
                  <li key={idea.recipe.id}>
                    <Link to={`/recettes/${idea.recipe.id}`} className="block">
                      <div className="font-medium text-brand">{idea.recipe.title}</div>
                      <div className="text-sm text-soft">Utilise le reste de : {idea.uses.join(', ').toLowerCase()}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <p className="px-1 text-xs text-faint">
            Prix : relevés Open Prices (Open Food Facts){PRICES_UPDATED ? `, mis à jour le ${full(PRICES_UPDATED)}` : ''}, sinon moyennes estimées. Touche un article pour corriger son prix.
          </p>

          {!validated && (
            <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 px-4 pb-3">
              <div className="mx-auto max-w-2xl">
                <Button full icon="check" className="shadow-lg" onClick={() => save({ status: 'validated', validatedAt: today() })}>Valider les courses · {eur(total)}</Button>
              </div>
            </div>
          )}
        </>
      )}

      {detailLine && <LineSheet line={detailLine} state={state} onSave={save} onClose={() => setDetail(null)} />}
    </Page>
  );
}

function LineRow({ line, checked, onCheck, onOpen }: { line: ShoppingLine; checked: boolean; onCheck: (v: boolean) => void; onOpen: () => void }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <CheckBox label={`${line.name} dans le panier`} checked={checked} onChange={onCheck} />
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
        <div className="min-w-0">
          <div className={cx('truncate font-medium', checked && 'text-faint line-through')}>{line.name}</div>
          <div className="truncate text-xs text-soft">
            {line.buyLabel}
            {line.recipeIds.length > 1 && <span className="font-semibold text-brand"> · {line.recipeIds.length} recettes</span>}
          </div>
        </div>
        <span className={cx('tnum shrink-0 text-sm font-semibold', checked ? 'text-faint' : 'text-soft')}>{eur(line.price)}</span>
      </button>
    </li>
  );
}

function ProfileCoverage({ profile, entries, nDays }: { profile: Profile; entries: PlanEntry[]; nDays: number }) {
  const catalog = useCatalog();
  const goal = useGoal(profile)?.goal;
  const planned = entries.reduce((s, e) => {
    const r = catalog.recipeOf(e.recipeId);
    return s + (r ? catalog.info(r).per.kcal * (e.portions[profile.id] ?? 0) : 0);
  }, 0);
  const perDay = planned / nDays;
  if (!goal) return null;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="flex items-center gap-2 font-medium"><span className="size-2.5 rounded-full" style={{ background: profile.color }} />{profile.name}</span>
        <span className="tnum"><b>{kcal(perDay)}</b><span className="text-faint"> / {kcal(goal.targetKcal)} kcal par jour</span></span>
      </div>
      <Bar value={perDay} max={goal.targetKcal} color={profile.color} />
      {perDay < goal.targetKcal * 0.6 && <p className="mt-1 text-xs text-soft">Le planning ne couvre pas tous les repas : le reste est à compter dans Suivi.</p>}
    </div>
  );
}

function LineSheet({ line, state, onSave, onClose }: { line: ShoppingLine; state: ShoppingState; onSave: (p: Partial<ShoppingState>) => void; onClose: () => void }) {
  const catalog = useCatalog();
  const info = catalog.priceInfo(line.ingId);
  const [price, setPrice] = useState<number | ''>(Math.round(info.eurKg * 100) / 100);
  const needed = isNeeded(line, state.need);

  return (
    <Sheet open onClose={onClose} title={line.name}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Besoin" value={formatGrams(line.needG)} />
          <Stat label="À acheter" value={formatGrams(line.buyG)} sub={line.buyLabel} />
          <Stat label="Reste" value={formatGrams(line.leftoverG)} />
        </div>

        <div>
          <div className="mb-1.5 text-sm font-semibold">Utilisé dans</div>
          <ul className="flex flex-col gap-1">
            {line.recipeIds.map((id) => <li key={id}><Link to={`/recettes/${id}`} className="text-brand underline-offset-2 hover:underline">{catalog.recipeOf(id)?.title}</Link></li>)}
          </ul>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3">
          <div><div className="font-semibold">J'en ai déjà</div><div className="text-sm text-soft">Retire l'article du total à payer.</div></div>
          <Toggle label="J'en ai déjà" checked={!needed} onChange={(v) => onSave({ need: { ...state.need, [line.ingId]: !v } })} />
        </div>

        <div className="rounded-xl border border-line bg-surface p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-semibold">Prix au kilo</span>
            <Badge tone={info.src === 'moyenne' ? 'neutral' : 'brand'}>{SRC_LABEL[info.src]}{info.src === 'open-prices' ? ` · ${info.n} relevés` : ''}</Badge>
          </div>
          <div className="flex gap-2">
            <div className="flex-1"><NumberInput value={price} onChange={setPrice} suffix="€/kg" step="0.05" aria-label="Prix au kilo" /></div>
            <Button variant="soft" disabled={price === '' || price <= 0 || price === info.eurKg} onClick={() => { put('price', { id: `price:${line.ingId}`, ingId: line.ingId, eurKg: Number(price) }); onClose(); }}>Corriger</Button>
          </div>
          {info.src === 'perso' && <button type="button" className="mt-2 text-sm font-semibold text-brand" onClick={() => { remove(`price:${line.ingId}`); onClose(); }}>Revenir au prix d'origine</button>}
        </div>

        {info.src !== 'perso' && <Notice tone="brand">Ton prix corrigé s'applique à toutes les recettes et à toutes les listes.</Notice>}
      </div>
    </Sheet>
  );
}

import { useEffect, useMemo, useState } from 'react';
import type { LogEntry, Macros, Slot } from '../lib/types.ts';
import { macrosFor, round } from '../lib/nutrition.ts';
import { SLOTS } from '../lib/slots.ts';
import { portionHints } from '../data/portions.ts';
import { put, uid, useAll } from '../store/store.ts';
import { Button, Chip, Empty, Field, GradeBadge, Input, MacroLine, Notice, NumberInput, Segmented, Select, Sheet } from './kit.tsx';
import type { Grade } from '../lib/nutriscore.ts';
import { Icon } from './icons.tsx';

interface Food {
  key: string;
  name: string;
  detail?: string;
  per100: Macros;
  grade?: Grade;
}

type CiqualRow = [number, string, number, number, number, number, number, string];
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

let ciqualCache: Food[] | null = null;
async function loadCiqual(): Promise<Food[]> {
  if (!ciqualCache) {
    const rows = (await import('../generated/ciqual.json')).default as unknown as CiqualRow[];
    ciqualCache = rows.map((r) => ({ key: `c${r[0]}`, name: r[1], detail: r[7], per100: { kcal: r[2], p: r[3], c: r[4], f: r[5], fiber: r[6] } }));
  }
  return ciqualCache;
}

function searchCiqual(foods: Food[], q: string): Food[] {
  const toks = norm(q).split(/\s+/).filter(Boolean);
  if (!toks.length) return [];
  return foods
    .map((f) => ({ f, n: norm(f.name) }))
    .filter(({ n }) => toks.every((t) => n.includes(t)))
    .sort((a, b) => Number(b.n.startsWith(toks[0])) - Number(a.n.startsWith(toks[0])) || a.n.length - b.n.length)
    .slice(0, 40)
    .map(({ f }) => f);
}

async function searchOff(q: string, signal: AbortSignal): Promise<Food[]> {
  const params = new URLSearchParams({ search_terms: q, search_simple: '1', action: 'process', json: '1', page_size: '24', cc: 'fr', lc: 'fr', fields: 'code,product_name,brands,quantity,nutriments,nutriscore_grade' });
  const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`, { signal });
  if (!res.ok) throw new Error('Recherche indisponible');
  const json = (await res.json()) as { products?: { code: string; product_name?: string; brands?: string; quantity?: string; nutriscore_grade?: string; nutriments?: Record<string, number> }[] };
  return (json.products ?? [])
    .filter((p) => p.product_name && p.nutriments?.['energy-kcal_100g'] != null)
    .map((p) => ({
      key: `o${p.code}`, name: p.product_name!, detail: [p.brands?.split(',')[0], p.quantity].filter(Boolean).join(' · '),
      grade: /^[a-e]$/.test(p.nutriscore_grade ?? '') ? (p.nutriscore_grade!.toUpperCase() as Grade) : undefined,
      per100: { kcal: p.nutriments!['energy-kcal_100g'], p: p.nutriments!.proteins_100g ?? 0, c: p.nutriments!.carbohydrates_100g ?? 0, f: p.nutriments!.fat_100g ?? 0, fiber: p.nutriments!.fiber_100g ?? 0 },
    }));
}

/** Ajout d'un aliment hors planning : table CIQUAL, produits Open Food Facts ou saisie libre. */
export function FoodSheet({ profileId, date, slot, onClose }: { profileId: string; date: string; slot: Slot; onClose: () => void }) {
  const logs = useAll<LogEntry>('log');
  const [tab, setTab] = useState<'ciqual' | 'off' | 'free'>('ciqual');
  const [when, setWhen] = useState<Slot>(slot);
  const [q, setQ] = useState('');
  const [ciqual, setCiqual] = useState<Food[]>([]);
  const [offResults, setOffResults] = useState<Food[]>([]);
  const [offState, setOffState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [food, setFood] = useState<Food | null>(null);
  const [gramsValue, setGrams] = useState<number | ''>(100);
  const [free, setFree] = useState<{ name: string; kcal: number | ''; p: number | ''; c: number | ''; f: number | '' }>({ name: '', kcal: '', p: '', c: '', f: '' });

  useEffect(() => { void loadCiqual().then(setCiqual); }, []);

  useEffect(() => {
    if (tab !== 'off' || q.trim().length < 3) { setOffResults([]); setOffState('idle'); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setOffState('loading');
      searchOff(q.trim(), ctrl.signal).then((r) => { setOffResults(r); setOffState('idle'); }).catch((e) => { if (e.name !== 'AbortError') setOffState('error'); });
    }, 450);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [q, tab]);

  const results = useMemo(() => (tab === 'ciqual' ? searchCiqual(ciqual, q) : offResults), [tab, ciqual, q, offResults]);

  const recents = useMemo(() => {
    const seen = new Map<string, LogEntry>();
    for (const l of logs.filter((x) => x.profileId === profileId && !x.planId).sort((a, b) => b.date.localeCompare(a.date))) {
      const k = `${l.label}|${l.qty}`;
      if (!seen.has(k)) seen.set(k, l);
    }
    return [...seen.values()].slice(0, 6);
  }, [logs, profileId]);

  function add(label: string, qty: string, macros: Macros) {
    put('log', { id: uid(), profileId, date, slot: when, label, qty, macros: round(macros) } satisfies LogEntry);
    onClose();
  }

  const preview = food && gramsValue !== '' ? macrosFor(food.per100, gramsValue) : null;
  const freeOk = free.name.trim() !== '' && free.kcal !== '';

  return (
    <Sheet open onClose={onClose} title={food ? 'Quelle quantité ?' : 'Ajouter un aliment'}
      footer={food ? (
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setFood(null)}>Retour</Button>
          <Button full icon="check" disabled={!preview || gramsValue === '' || gramsValue <= 0} onClick={() => preview && add(food.name, `${gramsValue} g`, preview)}>Ajouter</Button>
        </div>
      ) : tab === 'free' ? (
        <Button full icon="check" disabled={!freeOk} onClick={() => add(free.name.trim(), '1 portion', { kcal: Number(free.kcal), p: Number(free.p) || 0, c: Number(free.c) || 0, f: Number(free.f) || 0, fiber: 0 })}>Ajouter</Button>
      ) : undefined}>
      {food ? (
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-start gap-2 font-semibold leading-snug">{food.grade && <span className="mt-px"><GradeBadge grade={food.grade} /></span>}{food.name}</div>
            <div className="text-sm text-soft">Pour 100 g : <MacroLine m={food.per100} /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            {portionHints(food.name).map(([label, g]) => <Chip key={label} active={gramsValue === g} onClick={() => setGrams(g)}>{label}{/\d g$/.test(label) ? '' : ` · ${g} g`}</Chip>)}
          </div>
          <Field label="Quantité"><NumberInput value={gramsValue} onChange={setGrams} suffix="g" autoFocus /></Field>
          <Field label="Repas"><Select value={when} onChange={(v) => setWhen(v as Slot)}>{SLOTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Field>
          {preview && <div className="rounded-xl bg-brand-soft px-3 py-2.5"><MacroLine m={preview} className="text-base" /></div>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Segmented value={tab} onChange={setTab} options={[{ value: 'ciqual', label: 'Aliments' }, { value: 'off', label: 'Produits' }, { value: 'free', label: 'Saisie libre' }]} />

          {tab === 'free' ? (
            <div className="flex flex-col gap-3">
              <Field label="Nom"><Input value={free.name} onChange={(e) => setFree({ ...free, name: e.target.value })} placeholder="Ex. : part de gâteau d'anniversaire" /></Field>
              <Field label="Calories"><NumberInput value={free.kcal} onChange={(kcal) => setFree({ ...free, kcal })} suffix="kcal" /></Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Protéines"><NumberInput value={free.p} onChange={(p) => setFree({ ...free, p })} suffix="g" /></Field>
                <Field label="Glucides"><NumberInput value={free.c} onChange={(c) => setFree({ ...free, c })} suffix="g" /></Field>
                <Field label="Lipides"><NumberInput value={free.f} onChange={(f) => setFree({ ...free, f })} suffix="g" /></Field>
              </div>
              <Field label="Repas"><Select value={when} onChange={(v) => setWhen(v as Slot)}>{SLOTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Field>
            </div>
          ) : (
            <>
              <div className="relative">
                <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <input type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher un aliment"
                  placeholder={tab === 'ciqual' ? 'Croissant, pomme, riz cuit…' : 'Marque ou nom du produit'}
                  className="block min-h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-3 placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
              </div>
              {tab === 'off' && <p className="text-xs text-faint">Recherche en ligne dans Open Food Facts : ta saisie est envoyée à ce service.</p>}
              {tab === 'off' && offState === 'loading' && <p className="py-4 text-center text-sm text-soft">Recherche…</p>}
              {tab === 'off' && offState === 'error' && <Notice tone="danger" icon="alert">Recherche indisponible pour le moment. Essaie l'onglet Aliments ou la saisie libre.</Notice>}

              {q.trim() === '' && recents.length > 0 && (
                <div>
                  <div className="mb-1.5 text-[13px] font-semibold uppercase tracking-wide text-soft">Ajoutés récemment</div>
                  <ul className="divide-y divide-line/60 rounded-xl border border-line bg-surface">
                    {recents.map((l) => (
                      <li key={l.id}>
                        <button type="button" onClick={() => add(l.label, l.qty, l.macros)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left">
                          <span className="min-w-0"><span className="block truncate font-medium">{l.label}</span><span className="text-xs text-soft">{l.qty} · {Math.round(l.macros.kcal)} kcal</span></span>
                          <Icon name="plus" className="text-brand" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {results.length > 0 && (
                <ul className="divide-y divide-line/60 rounded-xl border border-line bg-surface">
                  {results.map((f) => (
                    <li key={f.key}>
                      <button type="button" onClick={() => { setFood(f); setGrams(portionHints(f.name)[0][1]); }} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left">
                        <span className="min-w-0">
                          <span className="flex items-start gap-2 font-medium leading-snug">{f.grade && <span className="mt-px"><GradeBadge grade={f.grade} /></span>}{f.name}</span>
                          <span className="text-xs text-soft">{f.detail ? `${f.detail} · ` : ''}{Math.round(f.per100.kcal)} kcal pour 100 g</span>
                        </span>
                        <Icon name="right" size={18} className="text-faint" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {q.trim().length >= 3 && results.length === 0 && offState === 'idle' && (
                <Empty icon="search" title="Rien trouvé">Essaie un autre mot, l'autre onglet, ou la saisie libre.</Empty>
              )}
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

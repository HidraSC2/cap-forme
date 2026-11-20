import { useMemo, useState } from 'react';
import type { MealType, Recipe } from '../lib/types.ts';
import { useCatalog, useProfiles, type RecipeInfo } from '../store/data.ts';
import { Badge, Chip, Empty, GradeBadge, MacroLine, Select, cx, eur } from './kit.tsx';
import { Icon } from './icons.tsx';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function RecipeBadges({ recipe, info, showPreg }: { recipe: Recipe; info: RecipeInfo; showPreg: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      {info.quick && <Badge tone="brand" icon="clock">Rapide</Badge>}
      {recipe.batch && <Badge tone="gold" icon="box">Batch</Badge>}
      {info.eco && <Badge icon="euro">Éco</Badge>}
      {info.veg && <Badge icon="leaf">Végé</Badge>}
      {recipe.custom && <Badge>Perso</Badge>}
      {showPreg && info.preg.level === 'avoid' && <Badge tone="danger" icon="alert">À éviter enceinte</Badge>}
      {showPreg && info.preg.level === 'caution' && <Badge tone="gold" icon="alert">Prudence enceinte</Badge>}
    </div>
  );
}

export function RecipeCard({ recipe, info, showPreg, onClick }: { recipe: Recipe; info: RecipeInfo; showPreg: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full rounded-2xl border border-line bg-surface p-3.5 text-left shadow-card transition active:scale-[0.99]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex items-start gap-2 font-semibold leading-snug">{info.nutri && <span className="mt-px"><GradeBadge grade={info.nutri.grade} /></span>}{recipe.title}</h3>
        <span className="tnum shrink-0 text-sm font-semibold text-soft">{eur(info.cost)}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <MacroLine m={info.per} />
        <span className="inline-flex items-center gap-1 text-sm text-soft"><Icon name="clock" size={14} />{info.total} min</span>
      </div>
      <div className="mt-2"><RecipeBadges recipe={recipe} info={info} showPreg={showPreg} /></div>
    </button>
  );
}

type Flag = 'quick' | 'batch' | 'eco' | 'veg' | 'protein' | 'preg' | 'grade';
const FLAGS: { id: Flag; label: string; icon: string }[] = [
  { id: 'grade', label: 'Note A ou B', icon: 'check' },
  { id: 'quick', label: 'Rapide', icon: 'clock' },
  { id: 'batch', label: 'Batch cooking', icon: 'box' },
  { id: 'eco', label: 'Économique', icon: 'euro' },
  { id: 'protein', label: 'Protéiné', icon: 'dumbbell' },
  { id: 'veg', label: 'Végétarien', icon: 'leaf' },
  { id: 'preg', label: 'Compatible grossesse', icon: 'heart' },
];

/** Liste de recettes avec recherche, filtres et tri. Sert au catalogue et au choix d'un repas. */
export function RecipeBrowser({ onPick, defaultMeal = 'all' }: { onPick: (r: Recipe) => void; defaultMeal?: MealType | 'all' }) {
  const catalog = useCatalog();
  const { profiles } = useProfiles();
  const anyPregnant = profiles.some((p) => p.pregnant);
  const [q, setQ] = useState('');
  const [meal, setMeal] = useState<MealType | 'all'>(defaultMeal);
  const [flags, setFlags] = useState<Set<Flag>>(() => new Set(anyPregnant ? ['preg'] : []));
  const [sort, setSort] = useState('default');

  const toggle = (f: Flag) => setFlags((cur) => { const next = new Set(cur); if (next.has(f)) next.delete(f); else next.add(f); return next; });

  const list = useMemo(() => {
    const needle = norm(q.trim());
    const rows = catalog.recipes
      .map((recipe) => ({ recipe, info: catalog.info(recipe) }))
      .filter(({ recipe, info }) => {
        if (meal !== 'all' && recipe.meal !== meal) return false;
        if (needle && !norm(recipe.title).includes(needle) && !recipe.ings.some((i) => norm(i.ing).includes(needle))) return false;
        if (flags.has('quick') && !info.quick) return false;
        if (flags.has('batch') && !recipe.batch) return false;
        if (flags.has('eco') && !info.eco) return false;
        if (flags.has('veg') && !info.veg) return false;
        if (flags.has('protein') && !info.protein) return false;
        if (flags.has('preg') && info.preg.level === 'avoid') return false;
        if (flags.has('grade') && !(info.nutri && (info.nutri.grade === 'A' || info.nutri.grade === 'B'))) return false;
        return true;
      });
    const by: Record<string, (a: (typeof rows)[0], b: (typeof rows)[0]) => number> = {
      kcal: (a, b) => a.info.per.kcal - b.info.per.kcal,
      protein: (a, b) => b.info.per.p - a.info.per.p,
      price: (a, b) => a.info.cost - b.info.cost,
      time: (a, b) => a.info.total - b.info.total,
      grade: (a, b) => (a.info.nutri?.score ?? 99) - (b.info.nutri?.score ?? 99),
    };
    return by[sort] ? [...rows].sort(by[sort]) : rows;
  }, [catalog, q, meal, flags, sort]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher une recette ou un ingrédient" aria-label="Chercher une recette"
          className="block min-h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-3 placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {([['all', 'Tout'], ['pdj', 'Petits-déj'], ['plat', 'Plats'], ['collation', 'Collations']] as const).map(([v, label]) => (
          <Chip key={v} active={meal === v} onClick={() => setMeal(v)}>{label}</Chip>
        ))}
        <span className="mx-1 w-px shrink-0 bg-line" />
        {FLAGS.map((f) => <Chip key={f.id} icon={f.icon} active={flags.has(f.id)} onClick={() => toggle(f.id)}>{f.label}</Chip>)}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-soft">{list.length} recette{list.length > 1 ? 's' : ''}</span>
        <div className="w-48">
          <Select label="Trier" value={sort} onChange={setSort}>
            <option value="default">Tri par défaut</option>
            <option value="kcal">Moins caloriques</option>
            <option value="protein">Plus protéinées</option>
            <option value="price">Moins chères</option>
            <option value="time">Plus rapides</option>
            <option value="grade">Meilleure note</option>
          </Select>
        </div>
      </div>
      {list.length === 0 ? (
        <Empty icon="search" title="Aucune recette ne correspond">Retire un filtre ou change ta recherche.</Empty>
      ) : (
        <div className={cx('grid gap-2.5 sm:grid-cols-2')}>
          {list.map(({ recipe, info }) => <RecipeCard key={recipe.id} recipe={recipe} info={info} showPreg={anyPregnant || flags.has('preg')} onClick={() => onPick(recipe)} />)}
        </div>
      )}
    </div>
  );
}

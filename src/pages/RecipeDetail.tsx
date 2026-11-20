import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ingOf } from '../data/ingredients.ts';
import { formatQty } from '../lib/units.ts';
import { MEAL_LABEL } from '../lib/slots.ts';
import { remove } from '../store/store.ts';
import { useCatalog, useProfiles } from '../store/data.ts';
import { Button, Card, CardTitle, Empty, IconButton, MacroTiles, Notice, Stepper, eur, kcal } from '../ui/kit.tsx';
import { Icon } from '../ui/icons.tsx';
import { RecipeBadges } from '../ui/recipe-browser.tsx';
import { NutriCard } from '../ui/nutri-card.tsx';
import { PlanSheet } from '../ui/plan-sheet.tsx';

const PRICE_SRC = { 'open-prices': 'prix relevé Open Prices', moyenne: 'prix moyen estimé', perso: 'ton prix' };

export default function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const catalog = useCatalog();
  const { profiles } = useProfiles();
  const recipe = id ? catalog.recipeOf(id) : undefined;
  const [servings, setServings] = useState(recipe?.servings ?? 2);
  const [planning, setPlanning] = useState(false);

  if (!recipe) {
    return <div className="mx-auto max-w-2xl p-4"><Empty icon="book" title="Recette introuvable" action={<Button onClick={() => navigate('/recettes')}>Voir les recettes</Button>} /></div>;
  }

  const info = catalog.info(recipe);
  const factor = servings / recipe.servings;
  const anyPregnant = profiles.some((p) => p.pregnant);
  const m = info.per;
  const realPrices = recipe.ings.filter((ri) => catalog.priceInfo(ri.ing).src === 'open-prices').length;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-32 pt-3">
      <div className="mb-1 flex items-center justify-between">
        <button type="button" onClick={() => navigate(-1)} className="-ml-2 inline-flex min-h-10 items-center gap-1 rounded-full px-2 text-sm font-semibold text-soft hover:bg-sunken">
          <Icon name="left" size={18} />Retour
        </button>
        {recipe.custom && (
          <div className="flex">
            <IconButton name="pencil" label="Modifier la recette" onClick={() => navigate(`/recettes/${recipe.id}/modifier`)} />
            <IconButton name="trash" label="Supprimer la recette" onClick={() => { if (confirm(`Supprimer « ${recipe.title} » ?`)) { remove(recipe.id); navigate('/recettes'); } }} />
          </div>
        )}
      </div>

      <p className="text-sm font-semibold uppercase tracking-wide text-brand">{MEAL_LABEL[recipe.meal]}</p>
      <h1 className="mt-0.5 text-[26px] font-bold leading-tight tracking-tight">{recipe.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-soft">
        <span className="inline-flex items-center gap-1"><Icon name="clock" size={15} />{recipe.prep} min de préparation{recipe.cook > 0 ? ` · ${recipe.cook} min de cuisson` : ''}</span>
      </div>
      <div className="mt-2"><RecipeBadges recipe={recipe} info={info} showPreg={anyPregnant} /></div>

      <div className="mt-4 flex flex-col gap-3">
        <Card>
          <CardTitle right={<span className="text-sm font-semibold text-soft">{eur(info.cost)} la portion</span>}>Par portion</CardTitle>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded-xl bg-sunken py-2"><b className="tnum text-lg">{kcal(m.kcal)}</b><div className="text-xs text-soft">kcal</div></div>
            <MacroTiles p={m.p} c={m.c} f={m.f} />
          </div>
          <p className="mt-2 text-xs text-faint">Fibres : {Math.round(m.fiber)} g · Prix calculé sur les quantités utilisées ({realPrices} ingrédient{realPrices > 1 ? 's' : ''} sur {recipe.ings.length} au prix relevé).</p>
        </Card>

        {info.nutri && <NutriCard result={info.nutri} />}

        {anyPregnant && info.preg.level !== 'ok' && (
          <Notice tone={info.preg.level === 'avoid' ? 'danger' : 'gold'} icon="alert">
            <b>{info.preg.level === 'avoid' ? 'Déconseillée pendant la grossesse.' : 'À adapter pendant la grossesse.'}</b> {info.preg.reasons.join(' ')}
          </Notice>
        )}

        {recipe.batch && (
          <Notice tone="gold" icon="box">
            <b>Idéale en batch cooking.</b> Se conserve {recipe.batch.keepDays} jours au réfrigérateur{recipe.batch.freeze ? ' et se congèle très bien' : ' (ne se congèle pas)'}.
          </Notice>
        )}

        <Card>
          <CardTitle right={<Stepper label="Nombre de portions" value={servings} min={1} max={20} onChange={setServings} />}>Ingrédients pour {servings}</CardTitle>
          <ul className="divide-y divide-line/70">
            {recipe.ings.map((ri) => {
              const ing = ingOf(ri.ing);
              if (!ing) return null;
              const price = catalog.priceInfo(ri.ing);
              return (
                <li key={ri.ing} className="flex items-baseline justify-between gap-3 py-2">
                  <span title={`${eur(price.eurKg)} le kilo — ${PRICE_SRC[price.src]}`}>{ing.name}</span>
                  <span className="tnum shrink-0 font-semibold">{formatQty(ri.qty, ing, factor)}</span>
                </li>
              );
            })}
            {recipe.loose?.map((line) => <li key={line} className="py-2 text-soft">{line} <span className="text-xs">(non compté dans les macros)</span></li>)}
          </ul>
        </Card>

        <Card>
          <CardTitle>Préparation</CardTitle>
          <ol className="flex flex-col gap-3">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="tnum flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">{i + 1}</span>
                <p className="pt-0.5 leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </Card>

        {recipe.sourceUrl && (
          <a href={recipe.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand"><Icon name="link" size={16} />Voir la recette d'origine</a>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 px-4 pb-3">
        <div className="mx-auto max-w-2xl"><Button full icon="calendar" className="shadow-lg" onClick={() => setPlanning(true)}>Ajouter au planning</Button></div>
      </div>
      {planning && <PlanSheet recipe={recipe} onClose={() => setPlanning(false)} />}
    </div>
  );
}

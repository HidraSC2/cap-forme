import { useState } from 'react';
import { GRADE_TEXT, highlights, type Highlight, type NutriResult } from '../lib/nutriscore.ts';
import { Card, CardTitle, GradeScale, Sheet, cx } from './kit.tsx';
import { Icon } from './icons.tsx';

const TONE = {
  good: { dot: '#038141', label: 'Qualité' },
  mid: { dot: '#ee8100', label: 'Défaut modéré' },
  bad: { dot: '#e63e11', label: 'Défaut' },
};

function Row({ h }: { h: Highlight }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span aria-label={TONE[h.tone].label} className="size-3 shrink-0 rounded-full" style={{ background: TONE[h.tone].dot }} />
      <span className="min-w-0 flex-1 font-medium">{h.label}</span>
      <span className="tnum shrink-0 text-sm text-soft">{h.value}</span>
    </li>
  );
}

/** Note nutritionnelle d'une recette, avec qualités et défauts pour 100 g. */
export function NutriCard({ result }: { result: NutriResult }) {
  const [open, setOpen] = useState(false);
  const { defects, qualities } = highlights(result);

  return (
    <Card>
      <CardTitle right={<button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-sm font-semibold text-brand"><Icon name="info" size={16} />Calcul</button>}>Note nutritionnelle</CardTitle>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <GradeScale grade={result.grade} />
        <p className="text-sm font-semibold">{GRADE_TEXT[result.grade]}</p>
      </div>

      {defects.length > 0 && (
        <div className="mt-4">
          <div className="text-[13px] font-semibold uppercase tracking-wide text-soft">Défauts</div>
          <ul className="divide-y divide-line/60">{defects.map((h) => <Row key={h.key} h={h} />)}</ul>
        </div>
      )}
      {qualities.length > 0 && (
        <div className="mt-3">
          <div className="text-[13px] font-semibold uppercase tracking-wide text-soft">Qualités</div>
          <ul className="divide-y divide-line/60">{qualities.map((h) => <Row key={h.key} h={h} />)}</ul>
        </div>
      )}
      <p className="mt-2 text-xs text-faint">Valeurs pour 100 g de plat. Le sel ajouté en cuisine n'est pas compté.</p>

      <Sheet open={open} onClose={() => setOpen(false)} title="Comment la note est calculée">
        <div className="flex flex-col gap-4 text-sm">
          <p className="text-soft">
            La note applique l'algorithme <b className="text-ink">Nutri-Score 2023</b> (aliments généraux) à la recette entière, ramenée à 100 g de plat.
            Le Nutri-Score officiel concerne les produits emballés : pour une recette maison, c'est une estimation.
          </p>
          <PointsTable title="Points défavorables" rows={result.negative.map((c) => ({ label: LABELS[c.key], value: valueOf(c.key, c.value), points: c.points, max: c.max }))} sign="+" />
          <PointsTable title="Points favorables" rows={result.positive.map((c) => ({ label: LABELS[c.key], value: valueOf(c.key, c.value), points: c.points, max: c.max }))} sign="−" />
          <div className="flex items-center justify-between rounded-xl bg-sunken px-3 py-2.5">
            <span className="font-semibold">Score final</span>
            <span className="tnum font-bold">{result.score} → {result.grade}</span>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-soft">
            <li>Barème : A jusqu'à 0, B de 1 à 2, C de 3 à 10, D de 11 à 18, E au-delà.</li>
            {!result.proteinCounted && <li>Les protéines ne sont pas comptées, car les points défavorables atteignent 11 ou plus.</li>}
            {result.redMeatCap && <li>Plat à base de viande rouge ou de charcuterie : les protéines sont plafonnées à 2 points.</li>}
            <li>Féculents et légumineuses secs comptés à leur poids cuit (eau absorbée).</li>
            <li>Sources : valeurs Ciqual (Anses), seuils de l'implémentation open source d'Open Food Facts.</li>
          </ul>
        </div>
      </Sheet>
    </Card>
  );
}

const LABELS = { energy: 'Énergie', sugars: 'Sucres', sat: 'Graisses saturées', salt: 'Sel', fvl: 'Fruits, légumes, légumineuses', fiber: 'Fibres', protein: 'Protéines' } as const;

function valueOf(key: keyof typeof LABELS, v: number): string {
  if (key === 'energy') return `${Math.round(v)} kJ`;
  if (key === 'fvl') return `${Math.round(v)} %`;
  return `${v.toLocaleString('fr-FR', { maximumFractionDigits: key === 'salt' ? 2 : 1 })} g`;
}

function PointsTable({ title, rows, sign }: { title: string; rows: { label: string; value: string; points: number; max: number }[]; sign: string }) {
  return (
    <table className="w-full text-left">
      <caption className="mb-1 text-left text-[13px] font-semibold uppercase tracking-wide text-soft">{title}</caption>
      <tbody className="divide-y divide-line/60">
        {rows.map((r) => (
          <tr key={r.label}>
            <th scope="row" className="py-1.5 font-medium">{r.label}</th>
            <td className="tnum py-1.5 text-right text-soft">{r.value}</td>
            <td className={cx('tnum w-20 py-1.5 text-right font-semibold')}>{r.points > 0 ? `${sign}${r.points}` : '0'}<span className="font-normal text-faint"> / {r.max}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

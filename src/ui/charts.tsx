// Graphiques (Recharts). Une seule teinte de série, validée pour le contraste et le daltonisme ;
// les repères (objectif, trajectoire) sont en gris neutre. Le texte reste toujours en couleur d'encre.
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { addDays, dayShort, diffDays, long, short } from '../lib/dates.ts';

const SERIES = 'var(--color-chart)';
const TICK = { fill: 'var(--color-soft)', fontSize: 12 };
const GRID = 'var(--color-line)';

function TipBox({ title, rows }: { title: string; rows: { key: 'line' | 'dot' | 'dash' | 'bar'; label: string; value: string }[] }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-card">
      <div className="mb-1 text-xs font-semibold text-soft first-letter:uppercase">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-soft"><Key kind={r.key} />{r.label}</span>
          <b className="tnum">{r.value}</b>
        </div>
      ))}
    </div>
  );
}

function Key({ kind }: { kind: 'line' | 'dot' | 'dash' | 'bar' }) {
  if (kind === 'dot') return <span className="inline-block size-2 rounded-full" style={{ background: SERIES }} />;
  if (kind === 'bar') return <span className="inline-block h-2.5 w-2 rounded-sm" style={{ background: SERIES }} />;
  if (kind === 'dash') return <span className="inline-block w-4 border-t-2 border-dashed border-faint" />;
  return <span className="inline-block w-4 border-t-2" style={{ borderColor: SERIES }} />;
}

// ── Barres par jour (pas, calories) avec ligne d'objectif ──
export function DayBars({ data, goal, unit, goalLabel = 'Objectif' }: { data: { date: string; value: number }[]; goal?: number; unit: string; goalLabel?: string }) {
  const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');
  const max = Math.max(goal ?? 0, ...data.map((d) => d.value), 1);
  return (
    <div role="img" aria-label={`${unit} par jour : ${data.map((d) => `${dayShort(d.date)} ${fmt(d.value)}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={data} margin={{ top: 16, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="date" tickFormatter={(d: string) => dayShort(d).replace('.', '')} tick={TICK} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis width={44} tick={TICK} tickLine={false} axisLine={false} tickCount={4} domain={[0, Math.ceil((max * 1.1) / 100) * 100]}
            tickFormatter={(n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : fmt(n))} />
          <Tooltip cursor={{ fill: 'var(--color-sunken)' }} isAnimationActive={false}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as { date: string; value: number } | undefined;
              return active && p ? <TipBox title={long(p.date)} rows={[{ key: 'bar', label: unit, value: fmt(p.value) }, ...(goal ? [{ key: 'dash' as const, label: goalLabel, value: fmt(goal) }] : [])]} /> : null;
            }} />
          {goal ? <ReferenceLine y={goal} stroke="var(--color-faint)" strokeDasharray="5 4" label={{ value: `${goalLabel} ${fmt(goal)}`, position: 'insideTopRight', fill: 'var(--color-soft)', fontSize: 11, dy: -14 }} /> : null}
          <Bar dataKey="value" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Courbe de poids : pesées, moyenne lissée, trajectoire cible ──
export interface WeightPoint {
  date: string;
  kg?: number;
  avg?: number;
  target?: number;
}

export function WeightChart({ points, origin, showTarget }: { points: WeightPoint[]; origin: string; showTarget: boolean }) {
  const data = points.map((p) => ({ ...p, t: diffDays(origin, p.date) }));
  const values = data.flatMap((d) => [d.kg, d.avg, showTarget ? d.target : undefined]).filter((v): v is number => v != null);
  const lo = Math.floor(Math.min(...values) - 1);
  const hi = Math.ceil(Math.max(...values) + 1);
  const tMin = Math.min(...data.map((d) => d.t));
  const tMax = Math.max(...data.map((d) => d.t));
  const kgFmt = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kg`;
  const weighIns = data.filter((d) => d.kg != null);

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-soft">
        <span className="flex items-center gap-1.5"><Key kind="line" />Moyenne sur 7 jours</span>
        <span className="flex items-center gap-1.5"><Key kind="dot" />Pesées</span>
        {showTarget && <span className="flex items-center gap-1.5"><Key kind="dash" />Trajectoire cible</span>}
      </div>
      <div role="img" aria-label={`Courbe de poids, de ${weighIns.length ? kgFmt(weighIns[0].kg!) : '—'} à ${weighIns.length ? kgFmt(weighIns[weighIns.length - 1].kg!) : '—'}`}>
        <ResponsiveContainer width="100%" height={230}>
          <ComposedChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="t" type="number" domain={[tMin, tMax]} tick={TICK} tickLine={false} axisLine={{ stroke: GRID }} tickCount={5}
              tickFormatter={(t: number) => short(addDays(origin, t))} />
            <YAxis width={44} domain={[lo, hi]} tick={TICK} tickLine={false} axisLine={false} tickCount={5} allowDecimals={false} />
            <Tooltip isAnimationActive={false} cursor={{ stroke: 'var(--color-faint)', strokeWidth: 1 }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as (WeightPoint & { t: number }) | undefined;
                if (!active || !p) return null;
                const rows = [
                  ...(p.kg != null ? [{ key: 'dot' as const, label: 'Pesée', value: kgFmt(p.kg) }] : []),
                  ...(p.avg != null ? [{ key: 'line' as const, label: 'Moyenne', value: kgFmt(p.avg) }] : []),
                  ...(showTarget && p.target != null ? [{ key: 'dash' as const, label: 'Cible', value: kgFmt(p.target) }] : []),
                ];
                return rows.length ? <TipBox title={long(p.date)} rows={rows} /> : null;
              }} />
            {showTarget && <Line dataKey="target" stroke="var(--color-faint)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} activeDot={false} connectNulls isAnimationActive={false} />}
            <Line dataKey="avg" stroke={SERIES} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dot={false} activeDot={false} connectNulls isAnimationActive={false} />
            <Scatter dataKey="kg" fill={SERIES} stroke="var(--color-surface)" strokeWidth={2} isAnimationActive={false}
              shape={(props: { cx?: number; cy?: number; payload?: { kg?: number } }) => (props.payload?.kg == null || props.cx == null || props.cy == null ? <g /> : <circle cx={props.cx} cy={props.cy} r={4.5} fill={SERIES} stroke="var(--color-surface)" strokeWidth={2} />)} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

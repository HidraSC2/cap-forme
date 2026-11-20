import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PlanEntry, Recipe, Slot } from '../lib/types.ts';
import { addDays, dayName, dayNum, dayShort, long, monthEnd, monthName, monthStart, range, short, today, weekStart } from '../lib/dates.ts';
import { SLOTS, mealForSlot } from '../lib/slots.ts';
import { entryServings } from '../lib/shopping.ts';
import { putMany, remove, uid, useAll } from '../store/store.ts';
import { useCatalog, useGoal, useProfiles } from '../store/data.ts';
import { Button, Card, DateNav, Empty, Page, Segmented, Sheet, cx, kcal } from '../ui/kit.tsx';
import { Icon } from '../ui/icons.tsx';
import { RecipeBrowser } from '../ui/recipe-browser.tsx';
import { PlanSheet } from '../ui/plan-sheet.tsx';

export default function Planning() {
  const navigate = useNavigate();
  const plan = useAll<PlanEntry>('plan');
  const catalog = useCatalog();
  const { profiles, active } = useProfiles();
  const goal = useGoal(active)?.goal;
  const [view, setView] = useState<'week' | 'month'>('week');
  const [anchor, setAnchor] = useState(today());
  const [adding, setAdding] = useState<{ date: string; slot: Slot } | null>(null);
  const [picked, setPicked] = useState<Recipe | null>(null);
  const [editing, setEditing] = useState<PlanEntry | null>(null);

  const start = weekStart(anchor);
  const days = range(start, addDays(start, 6));
  const byDay = useMemo(() => {
    const map = new Map<string, PlanEntry[]>();
    for (const e of plan) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return map;
  }, [plan]);

  const kcalFor = (e: PlanEntry) => {
    const r = catalog.recipeOf(e.recipeId);
    return r && active ? catalog.info(r).per.kcal * (e.portions[active.id] ?? 0) : 0;
  };
  const dayKcal = (d: string) => (byDay.get(d) ?? []).reduce((s, e) => s + kcalFor(e), 0);

  const weekEntries = days.flatMap((d) => byDay.get(d) ?? []);
  const prevWeek = range(addDays(start, -7), addDays(start, -1)).flatMap((d) => byDay.get(d) ?? []);

  function copyPreviousWeek() {
    const ids = new Map(prevWeek.map((e) => [e.id, uid()]));
    putMany('plan', prevWeek.map((e) => ({ ...e, id: ids.get(e.id)!, date: addDays(e.date, 7), leftoverOf: e.leftoverOf ? ids.get(e.leftoverOf) : undefined })));
  }

  function clearWeek() {
    if (confirm(`Retirer les ${weekEntries.length} repas de cette semaine ?`)) remove(...weekEntries.map((e) => e.id));
  }

  const closeAll = () => { setAdding(null); setPicked(null); setEditing(null); };

  return (
    <Page title="Planning" subtitle="Quoi manger, et quand">
      <Segmented value={view} onChange={setView} options={[{ value: 'week', label: 'Semaine' }, { value: 'month', label: 'Mois' }]} />

      {view === 'week' ? (
        <>
          <DateNav label={`Semaine du ${short(start)} au ${short(addDays(start, 6))}`} onPrev={() => setAnchor(addDays(start, -7))} onNext={() => setAnchor(addDays(start, 7))} onToday={() => setAnchor(today())} />

          {weekEntries.length === 0 ? (
            <Empty icon="calendar" title="Rien de prévu cette semaine"
              action={prevWeek.length > 0 ? <Button variant="soft" icon="copy" onClick={copyPreviousWeek}>Reprendre la semaine précédente</Button> : undefined}>
              Touche un « + » ci-dessous pour ajouter un repas, ou pars d'une recette.
            </Empty>
          ) : (
            <div className="flex items-center justify-between gap-2 px-1 text-sm">
              <span className="text-soft">{weekEntries.length} repas planifiés</span>
              <div className="flex gap-1">
                <Button small variant="ghost" icon="trash" onClick={clearWeek}>Vider</Button>
                <Button small variant="soft" icon="cart" onClick={() => navigate('/courses')}>Courses</Button>
              </div>
            </div>
          )}

          {days.map((d) => {
            const entries = byDay.get(d) ?? [];
            const total = dayKcal(d);
            const isToday = d === today();
            return (
              <Card key={d} className={cx('!p-0', isToday && 'ring-2 ring-brand/40')}>
                <div className="flex items-baseline justify-between gap-2 border-b border-line/70 px-4 py-2.5">
                  <h2 className="font-bold first-letter:uppercase">{dayName(d)} {dayNum(d)}{isToday && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white">Aujourd'hui</span>}</h2>
                  {total > 0 && active && (
                    <span className="tnum text-sm text-soft"><b className="text-ink">{kcal(total)}</b>{goal ? ` / ${kcal(goal.targetKcal)}` : ''} kcal{profiles.length > 1 ? ` · ${active.name}` : ''}</span>
                  )}
                </div>
                <div className="divide-y divide-line/60">
                  {SLOTS.map((s) => {
                    const here = entries.filter((e) => e.slot === s.id);
                    return (
                      <div key={s.id} className="flex items-start gap-2 px-4 py-2">
                        <span className="w-[74px] shrink-0 pt-2 text-xs font-semibold uppercase tracking-wide text-faint">{s.short}</span>
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          {here.map((e) => {
                            const r = catalog.recipeOf(e.recipeId);
                            return (
                              <button key={e.id} type="button" onClick={() => setEditing(e)} className="w-full rounded-xl bg-sunken px-3 py-2 text-left transition active:scale-[0.99]">
                                <div className="flex items-start justify-between gap-2">
                                  <span className="font-medium leading-snug">{r?.title ?? 'Recette supprimée'}</span>
                                  {e.leftoverOf && <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold"><Icon name="box" size={11} />Restes</span>}
                                </div>
                                <div className="tnum mt-0.5 text-xs text-soft">
                                  {String(entryServings(e)).replace('.', ',')} portion{entryServings(e) > 1 ? 's' : ''}
                                  {kcalFor(e) > 0 && ` · ${kcal(kcalFor(e))} kcal pour toi`}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        <button type="button" aria-label={`Ajouter un repas : ${s.label}, ${long(d)}`} onClick={() => setAdding({ date: d, slot: s.id })}
                          className="flex size-9 shrink-0 items-center justify-center rounded-full text-brand transition hover:bg-brand-soft active:scale-90">
                          <Icon name="plus" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </>
      ) : (
        <MonthView anchor={anchor} byDay={byDay} onMove={setAnchor} onOpen={(d) => { setAnchor(d); setView('week'); }} />
      )}

      {adding && !picked && (
        <Sheet open onClose={closeAll} title={`${SLOTS.find((s) => s.id === adding.slot)!.label} · ${dayShort(adding.date)} ${short(adding.date)}`}>
          <RecipeBrowser defaultMeal={mealForSlot(adding.slot)} onPick={setPicked} />
        </Sheet>
      )}
      {adding && picked && <PlanSheet recipe={picked} date={adding.date} slot={adding.slot} onClose={closeAll} />}
      {editing && catalog.recipeOf(editing.recipeId) && <PlanSheet recipe={catalog.recipeOf(editing.recipeId)!} entry={editing} onClose={closeAll} />}
      {editing && !catalog.recipeOf(editing.recipeId) && (
        <Sheet open onClose={closeAll} title="Recette supprimée" footer={<Button full variant="danger" icon="trash" onClick={() => { remove(editing.id); closeAll(); }}>Retirer du planning</Button>}>
          <p className="text-soft">Cette recette n'existe plus. Tu peux retirer ce repas du planning.</p>
        </Sheet>
      )}
    </Page>
  );
}

function MonthView({ anchor, byDay, onMove, onOpen }: { anchor: string; byDay: Map<string, PlanEntry[]>; onMove: (d: string) => void; onOpen: (d: string) => void }) {
  const first = monthStart(anchor);
  const last = monthEnd(anchor);
  const gridStart = weekStart(first);
  const gridEnd = addDays(weekStart(last), 6);
  const cells = range(gridStart, gridEnd);
  const count = range(first, last).reduce((s, d) => s + (byDay.get(d)?.length ?? 0), 0);

  return (
    <>
      <DateNav label={monthName(anchor)} onPrev={() => onMove(addDays(first, -1))} onNext={() => onMove(addDays(last, 1))} onToday={() => onMove(today())} />
      <Card className="!p-2">
        <div className="grid grid-cols-7 text-center text-xs font-semibold uppercase text-faint">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <div key={i} className="py-1.5">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d) => {
            const n = byDay.get(d)?.length ?? 0;
            const inMonth = d >= first && d <= last;
            return (
              <button key={d} type="button" onClick={() => onOpen(d)} aria-label={`${long(d)} : ${n} repas`}
                className={cx('flex aspect-square flex-col items-center justify-center gap-1 rounded-xl text-sm transition active:scale-95',
                  inMonth ? 'text-ink' : 'text-faint/60', d === today() ? 'bg-brand font-bold text-white' : n > 0 ? 'bg-brand-soft' : 'hover:bg-sunken')}>
                <span className="tnum">{dayNum(d)}</span>
                <span className="flex h-1.5 gap-0.5">
                  {Array.from({ length: Math.min(4, n) }, (_, i) => <span key={i} className={cx('size-1.5 rounded-full', d === today() ? 'bg-white' : 'bg-brand')} />)}
                </span>
              </button>
            );
          })}
        </div>
      </Card>
      <p className="px-1 text-sm text-soft">{count} repas planifiés ce mois-ci. Touche un jour pour ouvrir sa semaine.</p>
    </>
  );
}

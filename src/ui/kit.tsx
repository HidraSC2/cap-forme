import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './icons.tsx';
import type { Macros } from '../lib/types.ts';
import type { Grade } from '../lib/nutriscore.ts';

// ── Formatage ──
export const kcal = (n: number) => Math.round(n).toLocaleString('fr-FR');
export const grams = (n: number) => `${Math.round(n)} g`;
export const eur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: n >= 100 ? 0 : 2 });
export const kg = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} kg`;
export const num = (n: number) => Math.round(n).toLocaleString('fr-FR');

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

// ── Mise en page ──
export function Page({ title, subtitle, action, children }: { title: string; subtitle?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-5">
      <header className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-soft">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const base = 'rounded-2xl border border-line bg-surface p-4 shadow-card text-left';
  if (onClick) return <button type="button" onClick={onClick} className={cx(base, 'w-full transition active:scale-[0.99]', className)}>{children}</button>;
  return <section className={cx(base, className)}>{children}</section>;
}

export function CardTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-soft">{children}</h2>
      {right}
    </div>
  );
}

// ── Boutons ──
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'soft' | 'ghost' | 'danger'; icon?: string; full?: boolean; small?: boolean };

export function Button({ variant = 'primary', icon, full, small, className = '', children, ...rest }: BtnProps) {
  const styles = {
    primary: 'bg-brand text-white hover:bg-brand-dark',
    soft: 'bg-brand-soft text-brand hover:bg-[#d5e7df]',
    ghost: 'bg-transparent text-soft hover:bg-sunken',
    danger: 'bg-danger-soft text-danger hover:bg-[#f6d3ce]',
  }[variant];
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100',
        small ? 'min-h-9 px-3 text-sm' : 'min-h-11 px-4 text-[15px]',
        full && 'w-full', styles, className,
      )}
    >
      {icon && <Icon name={icon} size={small ? 16 : 18} />}
      {children}
    </button>
  );
}

export function IconButton({ name, label, onClick, className = '' }: { name: string; label: string; onClick?: () => void; className?: string }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={cx('inline-flex size-10 items-center justify-center rounded-full text-soft transition hover:bg-sunken active:scale-95', className)}>
      <Icon name={name} />
    </button>
  );
}

// ── Sélecteurs ──
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div role="tablist" className="flex rounded-xl bg-sunken p-1">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cx('min-h-9 flex-1 rounded-lg px-2 text-sm font-semibold transition', value === o.value ? 'bg-surface text-ink shadow-card' : 'text-soft')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ active, onClick, children, icon }: { active?: boolean; onClick?: () => void; children: ReactNode; icon?: string }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={cx('inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition active:scale-95',
        active ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-soft')}>
      {icon && <Icon name={icon} size={15} />}
      {children}
    </button>
  );
}

export function Badge({ children, tone = 'neutral', icon }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'warm' | 'gold' | 'danger'; icon?: string }) {
  const tones = { neutral: 'bg-sunken text-soft', brand: 'bg-brand-soft text-brand', warm: 'bg-warm-soft text-warm', gold: 'bg-gold-soft text-gold', danger: 'bg-danger-soft text-danger' };
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold', tones[tone])}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

// ── Formulaires ──
export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-soft">{hint}</span>}
    </label>
  );
}

const inputCls = 'block min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-ink placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}

export function NumberInput({ value, onChange, suffix, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: number | ''; onChange: (n: number | '') => void; suffix?: string }) {
  return (
    <div className="relative">
      <input {...rest} type="number" inputMode="decimal" value={value}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className={cx(inputCls, suffix && 'pr-12', rest.className)} />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-faint">{suffix}</span>}
    </div>
  );
}

export function Select({ value, onChange, children, label }: { value: string; onChange: (v: string) => void; children: ReactNode; label?: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={cx(inputCls, 'appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9')}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2355625c' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m5 9 7 7 7-7'/%3E%3C/svg%3E\")" }}>
      {children}
    </select>
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 99, label }: { value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number; label: string }) {
  const set = (n: number) => onChange(Math.min(max, Math.max(min, Math.round(n * 100) / 100)));
  return (
    <div className="inline-flex items-center gap-1 rounded-xl bg-sunken p-1" role="group" aria-label={label}>
      <button type="button" aria-label="Moins" disabled={value <= min} onClick={() => set(value - step)} className="flex size-9 items-center justify-center rounded-lg bg-surface text-ink shadow-card disabled:opacity-40"><Icon name="minus" size={16} /></button>
      <span className="tnum min-w-9 text-center text-[15px] font-semibold">{String(value).replace('.', ',')}</span>
      <button type="button" aria-label="Plus" disabled={value >= max} onClick={() => set(value + step)} className="flex size-9 items-center justify-center rounded-lg bg-surface text-ink shadow-card disabled:opacity-40"><Icon name="plus" size={16} /></button>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cx('relative h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-brand' : 'bg-line')}>
      <span className={cx('absolute top-0.5 size-6 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

export function CheckBox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={cx('flex size-7 shrink-0 items-center justify-center rounded-lg border-2 transition active:scale-90', checked ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-transparent')}>
      <Icon name="check" size={16} />
    </button>
  );
}

// ── Fenêtre modale (feuille en bas sur mobile) ──
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="anim-fade absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="anim-sheet relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-paper shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="truncate text-lg font-bold">{title}</h2>
          <IconButton name="x" label="Fermer" onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
        {footer && <div className="safe-bottom border-t border-line bg-surface px-4 pt-3 [&>*]:mb-3">{footer}</div>}
      </div>
    </div>
  );
}

// ── Indicateurs ──
export function Ring({ value, max, size = 132, stroke = 12, color = 'var(--color-brand)', children }: { value: number; max: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const over = max > 0 && value > max * 1.05;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${Math.round(value)} sur ${Math.round(max)}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-sunken)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={over ? 'var(--color-warm)' : color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - ratio)} style={{ transition: 'stroke-dashoffset .5s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function Bar({ value, max, color = 'var(--color-brand)', height = 8 }: { value: number; max: number; color?: string; height?: number }) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div className="w-full overflow-hidden rounded-full bg-sunken" style={{ height }}>
      <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, background: color, transition: 'width .4s ease' }} />
    </div>
  );
}

export function MacroBars({ value, target }: { value: Macros; target: { p: number; c: number; f: number } }) {
  const rows = [
    { key: 'p', label: 'Protéines', v: value.p, t: target.p, color: 'var(--color-protein)' },
    { key: 'c', label: 'Glucides', v: value.c, t: target.c, color: 'var(--color-carb)' },
    { key: 'f', label: 'Lipides', v: value.f, t: target.f, color: 'var(--color-fat)' },
  ];
  return (
    <div className="flex w-full flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.key}>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="inline-flex items-center gap-1.5 font-medium text-soft"><Dot color={r.color} />{r.label}</span>
            <span className="tnum"><b>{Math.round(r.v)}</b><span className="text-faint"> / {Math.round(r.t)} g</span></span>
          </div>
          <Bar value={r.v} max={r.t} color={r.color} />
        </div>
      ))}
    </div>
  );
}

export function Dot({ color }: { color: string }) {
  return <span aria-hidden="true" className="inline-block size-2 shrink-0 rounded-full" style={{ background: color }} />;
}

/** Trois tuiles protéines / glucides / lipides. */
export function MacroTiles({ p, c, f, tone = 'sunken' }: { p: number; c: number; f: number; tone?: 'sunken' | 'plain' }) {
  const rows = [
    { label: 'Protéines', v: p, color: 'var(--color-protein)' },
    { label: 'Glucides', v: c, color: 'var(--color-carb)' },
    { label: 'Lipides', v: f, color: 'var(--color-fat)' },
  ];
  return (
    <>
      {rows.map((r) => (
        <div key={r.label} className={cx('rounded-xl py-2 text-center', tone === 'sunken' && 'bg-sunken')}>
          <b className="tnum text-lg">{Math.round(r.v)} g</b>
          <div className="flex items-center justify-center gap-1 text-xs text-soft"><Dot color={r.color} />{r.label}</div>
        </div>
      ))}
    </>
  );
}

// Échelle de couleurs A → E. Texte blanc ou encre selon la clarté du fond.
export const GRADE_STYLE: Record<Grade, { bg: string; fg: string }> = {
  A: { bg: '#038141', fg: '#ffffff' },
  B: { bg: '#85bb2f', fg: '#1b2622' },
  C: { bg: '#fecb02', fg: '#1b2622' },
  D: { bg: '#ee8100', fg: '#1b2622' },
  E: { bg: '#e63e11', fg: '#ffffff' },
};

export function GradeBadge({ grade, size = 'sm' }: { grade: Grade; size?: 'sm' | 'lg' }) {
  const s = GRADE_STYLE[grade];
  return (
    <span aria-label={`Note nutritionnelle ${grade}`} title={`Note nutritionnelle ${grade}`}
      className={cx('inline-flex shrink-0 items-center justify-center rounded-md font-extrabold leading-none', size === 'lg' ? 'size-12 text-2xl rounded-xl' : 'h-5 min-w-5 px-1 text-xs')}
      style={{ background: s.bg, color: s.fg }}>
      {grade}
    </span>
  );
}

/** Échelle A à E, la note obtenue mise en avant. */
export function GradeScale({ grade }: { grade: Grade }) {
  return (
    <div className="flex items-center gap-1" role="img" aria-label={`Note nutritionnelle ${grade} sur une échelle de A à E`}>
      {(['A', 'B', 'C', 'D', 'E'] as Grade[]).map((g) => {
        const s = GRADE_STYLE[g];
        const on = g === grade;
        return (
          <span key={g} className={cx('flex items-center justify-center rounded-lg font-extrabold transition', on ? 'h-11 w-11 text-xl shadow-card' : 'h-8 w-8 text-sm opacity-35')}
            style={{ background: s.bg, color: s.fg }}>{g}</span>
        );
      })}
    </div>
  );
}

/** Ligne compacte kcal + P/G/L. */
export function MacroLine({ m, className = '' }: { m: Macros; className?: string }) {
  return (
    <span className={cx('tnum inline-flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-sm', className)}>
      <b>{kcal(m.kcal)} kcal</b>
      <span className="inline-flex items-center gap-1"><Dot color="var(--color-protein)" />P {Math.round(m.p)}</span>
      <span className="inline-flex items-center gap-1"><Dot color="var(--color-carb)" />G {Math.round(m.c)}</span>
      <span className="inline-flex items-center gap-1"><Dot color="var(--color-fat)" />L {Math.round(m.f)}</span>
    </span>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium text-soft">{label}</div>
      <div className="tnum truncate text-xl font-bold leading-tight">{value}</div>
      {sub && <div className="text-xs text-faint">{sub}</div>}
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-8 text-center">
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon name={icon} size={24} /></span>
      <p className="font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-xs text-sm text-soft">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({ tone = 'gold', icon = 'info', children }: { tone?: 'gold' | 'danger' | 'brand'; icon?: string; children: ReactNode }) {
  const tones = { gold: 'bg-gold-soft text-[#6f5208]', danger: 'bg-danger-soft text-danger', brand: 'bg-brand-soft text-brand-dark' };
  return (
    <div className={cx('flex gap-2.5 rounded-xl px-3 py-2.5 text-sm', tones[tone])}>
      <Icon name={icon} size={18} className="mt-0.5" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function DateNav({ label, onPrev, onNext, onToday }: { label: string; onPrev: () => void; onNext: () => void; onToday?: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-line bg-surface px-1 py-1 shadow-card">
      <IconButton name="left" label="Précédent" onClick={onPrev} />
      <button type="button" onClick={onToday} className="min-h-10 flex-1 px-2 text-center text-[15px] font-semibold first-letter:uppercase">{label}</button>
      <IconButton name="right" label="Suivant" onClick={onNext} />
    </div>
  );
}

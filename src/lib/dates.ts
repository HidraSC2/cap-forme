// Dates manipulées sous forme de chaînes locales « AAAA-MM-JJ ».

export function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parse(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(): string {
  return iso(new Date());
}

export function addDays(s: string, n: number): string {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}

/** Lundi de la semaine contenant `s`. */
export function weekStart(s: string): string {
  const d = parse(s);
  const dow = (d.getDay() + 6) % 7;
  return addDays(s, -dow);
}

export function monthStart(s: string): string {
  return s.slice(0, 8) + '01';
}

export function monthEnd(s: string): string {
  const d = parse(s);
  return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function range(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const DAYS_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export const dayName = (s: string) => DAYS[parse(s).getDay()];
export const dayShort = (s: string) => DAYS_SHORT[parse(s).getDay()];
export const dayNum = (s: string) => parse(s).getDate();
export const monthName = (s: string) => `${MONTHS[parse(s).getMonth()]} ${parse(s).getFullYear()}`;

/** « 14 nov. » */
export function short(s: string): string {
  const d = parse(s);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** « samedi 14 novembre » */
export function long(s: string): string {
  const d = parse(s);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** « 14 novembre 2026 » */
export function full(s: string): string {
  const d = parse(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function ageOn(birth: string, on: string): number {
  const b = parse(birth);
  const d = parse(on);
  let age = d.getFullYear() - b.getFullYear();
  if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) age--;
  return age;
}

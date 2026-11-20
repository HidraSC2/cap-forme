// Stockage local-first : toutes les données vivent dans le navigateur (localStorage) et sont,
// si la synchronisation est configurée, poussées vers Supabase (voir sync.ts).
import { useSyncExternalStore } from 'react';

export type Kind = 'profile' | 'plan' | 'list' | 'log' | 'workout' | 'steps' | 'weight' | 'recipe' | 'price' | 'settings';

export interface Rec {
  id: string;
  kind: Kind;
  data: unknown;
  updated: number; // horodatage de la dernière modification (ms)
  deleted?: boolean;
  dirty?: boolean; // modifié localement, pas encore envoyé
}

const KEY = 'capforme:v1';
const recs = new Map<string, Rec>();
const listeners = new Set<() => void>();
const cache = new Map<Kind, unknown[]>();
let changeHook: (() => void) | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function flush() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(KEY, JSON.stringify([...recs.values()]));
  } catch {
    /* stockage plein ou indisponible : les données restent en mémoire */
  }
}

if (typeof localStorage !== 'undefined') {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) for (const r of JSON.parse(raw) as Rec[]) recs.set(r.id, r);
  } catch {
    /* données illisibles : on repart d'une base vide */
  }
  window.addEventListener('pagehide', flush);
}

function emit(local: boolean) {
  cache.clear();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 50);
  listeners.forEach((l) => l());
  if (local) changeHook?.();
}

export const uid = (): string => crypto.randomUUID();

export function all<T>(kind: Kind): T[] {
  let list = cache.get(kind);
  if (!list) {
    list = [...recs.values()].filter((r) => r.kind === kind && !r.deleted).map((r) => r.data);
    cache.set(kind, list);
  }
  return list as T[];
}

export function get<T>(id: string): T | undefined {
  const r = recs.get(id);
  return r && !r.deleted ? (r.data as T) : undefined;
}

export function put<T extends { id: string }>(kind: Kind, data: T): T {
  recs.set(data.id, { id: data.id, kind, data, updated: Date.now(), dirty: true });
  emit(true);
  return data;
}

export function putMany<T extends { id: string }>(kind: Kind, list: T[]): void {
  const now = Date.now();
  for (const data of list) recs.set(data.id, { id: data.id, kind, data, updated: now, dirty: true });
  emit(true);
}

export function remove(...ids: string[]): void {
  const now = Date.now();
  for (const id of ids) {
    const r = recs.get(id);
    if (r) recs.set(id, { ...r, deleted: true, updated: now, dirty: true });
  }
  emit(true);
}

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAll<T>(kind: Kind): T[] {
  return useSyncExternalStore(subscribe, () => all<T>(kind));
}

// ── Interface utilisée par la synchronisation ──

export function onLocalChange(fn: (() => void) | null): void {
  changeHook = fn;
}

export function dirtyRecords(): Rec[] {
  return [...recs.values()].filter((r) => r.dirty);
}

/** Marque comme envoyés les enregistrements qui n'ont pas été modifiés depuis l'envoi. */
export function markClean(sent: { id: string; updated: number }[]): void {
  for (const s of sent) {
    const r = recs.get(s.id);
    if (r && r.updated === s.updated) recs.set(s.id, { ...r, dirty: false });
  }
  emit(false);
}

/** Fusionne des enregistrements distants : le plus récent gagne. */
export function applyRemote(remote: Rec[]): void {
  let changed = false;
  for (const r of remote) {
    const local = recs.get(r.id);
    if (local && local.updated > r.updated) continue;
    if (local && local.updated === r.updated && !local.dirty) continue;
    recs.set(r.id, { ...r, dirty: false });
    changed = true;
  }
  if (changed) emit(false);
}

export function markAllDirty(): void {
  for (const [id, r] of recs) recs.set(id, { ...r, dirty: true });
  emit(true);
}

export function exportAll(): Rec[] {
  return [...recs.values()].filter((r) => !r.deleted);
}

export function importAll(list: Rec[]): void {
  const now = Date.now();
  for (const r of list) if (r?.id && r.kind) recs.set(r.id, { id: r.id, kind: r.kind, data: r.data, updated: now, dirty: true });
  emit(true);
}

export function wipeLocal(): void {
  recs.clear();
  emit(false);
  flush();
}

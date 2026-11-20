// Synchronisation du foyer avec Supabase (facultative).
// Sans variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, l'application fonctionne en local uniquement.
import { useSyncExternalStore } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { applyRemote, dirtyRecords, markAllDirty, markClean, onLocalChange, type Rec } from './store.ts';
import { normalizeRecipe, type ImportedRecipe } from '../lib/recipe-import.ts';

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY_ = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const syncConfigured = !!(URL_ && KEY_);
/** Adresse appelée par le Raccourci iOS (fonction SQL ingest_health) et clé publique à joindre en en-tête « apikey ». */
export const healthEndpoint = URL_ ? `${URL_}/rest/v1/rpc/ingest_health` : '';
export const publicApiKey = KEY_ ?? '';

export interface Household {
  id: string;
  name: string;
  join_code: string;
}

export interface SyncState {
  status: 'off' | 'loading' | 'signed-out' | 'no-household' | 'ready' | 'syncing' | 'error';
  email?: string;
  household?: Household;
  error?: string;
  lastSync?: number;
}

let state: SyncState = { status: syncConfigured ? 'loading' : 'off' };
const listeners = new Set<() => void>();
function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
export const getSyncState = (): SyncState => state;
export function useSync(): SyncState {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
}

let client: SupabaseClient | null = null;
async function sb(): Promise<SupabaseClient> {
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(URL_!, KEY_!);
  }
  return client;
}

const cursorKey = (h: string) => `capforme:cursor:${h}`;
let running = false;
let again = false;
let pushTimer: ReturnType<typeof setTimeout> | undefined;

async function refresh(): Promise<void> {
  const s = await sb();
  const { data } = await s.auth.getSession();
  const session = data.session;
  if (!session) return set({ status: 'signed-out', email: undefined, household: undefined, error: undefined });
  const { data: rows, error } = await s.from('household_members').select('households(id, name, join_code)').limit(1);
  if (error) return set({ status: 'error', email: session.user.email, error: error.message });
  const embedded = (rows?.[0] as unknown as { households?: Household | Household[] } | undefined)?.households;
  const household = Array.isArray(embedded) ? embedded[0] : embedded;
  if (!household) return set({ status: 'no-household', email: session.user.email, household: undefined, error: undefined });
  set({ status: 'ready', email: session.user.email, household, error: undefined });
  void syncNow();
}

export async function syncNow(): Promise<void> {
  const household = state.household;
  if (!household || !navigator.onLine) return;
  if (running) { again = true; return; }
  running = true;
  set({ status: 'syncing' });
  try {
    const s = await sb();
    // 1. Récupérer ce qui a changé côté serveur depuis la dernière fois.
    let cursor = localStorage.getItem(cursorKey(household.id)) ?? '1970-01-01T00:00:00Z';
    for (;;) {
      const { data, error } = await s.from('records').select('id, kind, data, updated, deleted, synced_at')
        .eq('household_id', household.id).gt('synced_at', cursor).order('synced_at').limit(500);
      if (error) throw error;
      if (!data?.length) break;
      applyRemote(data.map((r) => ({ id: r.id, kind: r.kind, data: r.data, updated: Number(r.updated), deleted: r.deleted }) as Rec));
      cursor = data[data.length - 1].synced_at;
      localStorage.setItem(cursorKey(household.id), cursor);
      if (data.length < 500) break;
    }
    // 2. Envoyer les modifications locales.
    const dirty = dirtyRecords();
    for (let i = 0; i < dirty.length; i += 200) {
      const chunk = dirty.slice(i, i + 200);
      const { error } = await s.from('records').upsert(
        chunk.map((r) => ({ household_id: household.id, id: r.id, kind: r.kind, data: r.data, updated: r.updated, deleted: !!r.deleted })),
        { onConflict: 'household_id,id' },
      );
      if (error) throw error;
      markClean(chunk.map((r) => ({ id: r.id, updated: r.updated })));
    }
    set({ status: 'ready', lastSync: Date.now(), error: undefined });
  } catch (e) {
    set({ status: 'error', error: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e) });
  } finally {
    running = false;
    if (again) { again = false; void syncNow(); }
  }
}

/** À appeler une fois au démarrage. Retourne la fonction de nettoyage. */
export function startSync(): () => void {
  if (!syncConfigured) return () => {};
  let unsub: (() => void) | undefined;
  void sb().then((s) => {
    const { data } = s.auth.onAuthStateChange(() => { void refresh(); });
    unsub = () => data.subscription.unsubscribe();
  });
  void refresh();
  onLocalChange(() => {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void syncNow(), 1500);
  });
  const onVisible = () => { if (document.visibilityState === 'visible') void syncNow(); };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onVisible);
  const timer = setInterval(() => void syncNow(), 60_000);
  return () => {
    unsub?.();
    onLocalChange(null);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onVisible);
    clearInterval(timer);
  };
}

const fail = (error: { message: string } | null) => { if (error) throw new Error(error.message); };

export async function signUp(email: string, password: string): Promise<'confirm' | 'ok'> {
  const { data, error } = await (await sb()).auth.signUp({ email, password });
  fail(error);
  return data.session ? 'ok' : 'confirm';
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await (await sb()).auth.signInWithPassword({ email, password });
  fail(error);
}

export async function signOut(): Promise<void> {
  await (await sb()).auth.signOut();
}

export async function createHousehold(name: string): Promise<void> {
  const { error } = await (await sb()).rpc('create_household', { p_name: name });
  fail(error);
  markAllDirty(); // tout ce qui existe déjà sur l'appareil part dans le foyer
  await refresh();
}

export async function joinHousehold(code: string): Promise<void> {
  const { error } = await (await sb()).rpc('join_household', { p_code: code.trim().toUpperCase() });
  fail(error);
  markAllDirty();
  await refresh();
}

/** Crée le jeton personnel utilisé par le Raccourci iOS pour envoyer pas et poids. */
export async function createHealthToken(profileId: string): Promise<string> {
  if (!state.household) throw new Error('Aucun foyer synchronisé.');
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const token = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  const s = await sb();
  await s.from('health_tokens').delete().eq('household_id', state.household.id).eq('profile_id', profileId);
  const { error } = await s.from('health_tokens').insert({ token, household_id: state.household.id, profile_id: profileId });
  fail(error);
  return token;
}

/** La base lit la page et renvoie le bloc schema.org/Recipe ; l'application le met en forme. */
export async function importRecipeFromUrl(url: string): Promise<ImportedRecipe> {
  const { data, error } = await (await sb()).rpc('import_recipe', { p_url: url });
  if (error) throw new Error('Impossible de lire cette page. Vérifie le lien ou colle les ingrédients à la main.');
  const res = data as { error?: string; recipe?: Record<string, unknown>; url?: string };
  if (res?.error || !res?.recipe) throw new Error(res?.error ?? 'Aucune recette trouvée sur cette page.');
  return normalizeRecipe(res.recipe, res.url ?? url);
}

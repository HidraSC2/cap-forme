// Deux appareils d'un même foyer synchronisés à travers un faux serveur qui reproduit la base Supabase :
// la version la plus récente gagne (déclencheur records_before_write) et chaque écriture repasse en tête de file (synced_at).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface Row { household_id: string; id: string; kind: string; data: unknown; updated: number; deleted: boolean; synced_at: string }

const server = { rows: new Map<string, Row>(), seq: 0 };
const HOUSEHOLD = { id: 'h1', name: 'Foyer test', join_code: 'ABCD1234' };
const stamp = () => new Date(Date.UTC(2026, 0, 1) + ++server.seq).toISOString();

function query(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let max = Infinity;
  const q = {
    select: () => q,
    eq: (col: keyof Row, v: unknown) => { filters.push((r) => r[col] === v); return q; },
    gt: (col: keyof Row, v: string) => { filters.push((r) => (r[col] as string) > v); return q; },
    order: () => q,
    limit: (n: number) => { max = n; return q; },
    then(resolve: (x: unknown) => void) {
      if (table === 'household_members') return resolve({ data: [{ households: HOUSEHOLD }], error: null });
      const data = [...server.rows.values()].filter((r) => filters.every((f) => f(r))).sort((a, b) => a.synced_at.localeCompare(b.synced_at)).slice(0, max);
      resolve({ data: structuredClone(data), error: null });
    },
    upsert: async (rows: Omit<Row, 'synced_at'>[]) => {
      for (const r of rows) {
        const key = `${r.household_id}/${r.id}`;
        const old = server.rows.get(key);
        if (old && r.updated < old.updated) continue; // version plus ancienne ignorée
        server.rows.set(key, { ...structuredClone(r), synced_at: stamp() });
      }
      return { error: null };
    },
  };
  return q;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { user: { email: 'test@exemple.fr' } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: (t: string) => query(t),
  }),
}));

class MemoryStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

type Store = typeof import('../src/store/store.ts');
type Sync = typeof import('../src/store/sync.ts');
interface Device { storage: MemoryStorage; store: Store; sync: Sync; stop: () => void }

let clock = 1_000_000;
const devices: Device[] = [];

/** Ouvre l'application sur un nouvel appareil (modules et stockage propres). */
async function openDevice(storage = new MemoryStorage()): Promise<Device> {
  vi.resetModules();
  vi.stubGlobal('localStorage', storage);
  const store = await import('../src/store/store.ts');
  const sync = await import('../src/store/sync.ts');
  const stop = sync.startSync();
  for (let i = 0; i < 50 && sync.getSyncState().status !== 'ready'; i++) await new Promise((r) => setTimeout(r, 5));
  const d = { storage, store, sync, stop };
  devices.push(d);
  return d;
}

/** Bascule le stockage global sur l'appareil puis synchronise. */
async function syncOn(d: Device) {
  vi.stubGlobal('localStorage', d.storage);
  await d.sync.syncNow();
}

const names = (d: Device) => d.store.all<{ id: string; name: string }>('profile').map((p) => p.name).sort();

beforeEach(() => {
  server.rows.clear();
  server.seq = 0;
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} });
  vi.stubGlobal('document', { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible' });
  vi.stubGlobal('navigator', { onLine: true });
  vi.spyOn(Date, 'now').mockImplementation(() => (clock += 1000));
});

afterEach(() => {
  devices.splice(0).forEach((d) => d.stop());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('synchronisation du foyer', () => {
  it('est configurée par le fichier .env', async () => {
    const a = await openDevice();
    expect(a.sync.syncConfigured).toBe(true);
    expect(a.sync.getSyncState().status).toBe('ready');
    expect(a.sync.getSyncState().household?.join_code).toBe('ABCD1234');
  });

  it("transmet les ajouts, modifications et suppressions d'un appareil à l'autre", async () => {
    const a = await openDevice();
    a.store.put('profile', { id: 'p1', name: 'Baptiste' });
    a.store.put('plan', { id: 'm1', date: '2026-11-16', recipeId: 'chili-con-carne' });
    await syncOn(a);
    expect(server.rows.size).toBe(2);
    expect(a.store.dirtyRecords()).toHaveLength(0);

    const b = await openDevice();
    await syncOn(b);
    expect(names(b)).toEqual(['Baptiste']);
    expect(b.store.all('plan')).toHaveLength(1);

    b.store.put('profile', { id: 'p2', name: 'Compagne' });
    b.store.put('profile', { id: 'p1', name: 'Baptiste (modifié)' });
    b.store.remove('m1');
    await syncOn(b);
    await syncOn(a);
    expect(names(a)).toEqual(['Baptiste (modifié)', 'Compagne']);
    expect(a.store.all('plan')).toHaveLength(0);
  });

  it('garde la modification la plus récente quand les deux appareils modifient hors ligne', async () => {
    const a = await openDevice();
    a.store.put('weight', { id: 'w1', kg: 90 });
    await syncOn(a);
    const b = await openDevice();
    await syncOn(b);

    // Hors ligne : A modifie, puis B modifie plus tard ; A synchronise en dernier.
    vi.stubGlobal('localStorage', a.storage);
    a.store.put('weight', { id: 'w1', kg: 89.5 });
    vi.stubGlobal('localStorage', b.storage);
    b.store.put('weight', { id: 'w1', kg: 89.2 });
    await syncOn(b);
    await syncOn(a);
    await syncOn(b);

    const kg = (d: Device) => d.store.get<{ kg: number }>('w1')?.kg;
    expect(kg(a)).toBe(89.2);
    expect(kg(b)).toBe(89.2);
    expect((server.rows.get('h1/w1')!.data as { kg: number }).kg).toBe(89.2);
  });

  it("ne laisse pas une version plus ancienne écraser une modification locale pas encore envoyée", async () => {
    const a = await openDevice();
    a.store.put('weight', { id: 'w1', kg: 90 });
    await syncOn(a);
    const b = await openDevice();
    await syncOn(b);

    // B modifie en premier et synchronise ; A modifie plus tard sans réseau, puis récupère la version de B.
    vi.stubGlobal('localStorage', b.storage);
    b.store.put('weight', { id: 'w1', kg: 89.8 });
    await syncOn(b);
    vi.stubGlobal('localStorage', a.storage);
    a.store.put('weight', { id: 'w1', kg: 89.1 });
    await syncOn(a);
    await syncOn(b);

    const kg = (d: Device) => d.store.get<{ kg: number }>('w1')?.kg;
    expect(kg(a)).toBe(89.1);
    expect(kg(b)).toBe(89.1);
  });

  it("reçoit les pas envoyés par le Raccourci iOS et ne retélécharge que ce qui a changé", async () => {
    const a = await openDevice();
    a.store.put('profile', { id: 'p1', name: 'Baptiste' });
    await syncOn(a);
    // Écriture faite côté serveur par la fonction ingest_health.
    server.rows.set('h1/steps:p1:2026-11-14', {
      household_id: 'h1', id: 'steps:p1:2026-11-14', kind: 'steps', updated: (clock += 1000), deleted: false, synced_at: stamp(),
      data: { id: 'steps:p1:2026-11-14', profileId: 'p1', date: '2026-11-14', count: 8421, src: 'health' },
    });
    const before = server.seq;
    await syncOn(a);
    expect(a.store.get<{ count: number }>('steps:p1:2026-11-14')?.count).toBe(8421);
    expect(server.seq).toBe(before); // rien renvoyé : la donnée reçue n'est pas marquée « à envoyer »
    expect(a.store.dirtyRecords()).toHaveLength(0);
  });

  it("envoie au foyer les données saisies avant d'avoir activé la synchro, après rechargement de la page", async () => {
    const storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);
    vi.resetModules();
    const offline = await import('../src/store/store.ts');
    offline.put('profile', { id: 'p1', name: 'Saisi hors ligne' });
    offline.put('log', { id: 'l1', label: 'Croissant' });
    await new Promise((r) => setTimeout(r, 80)); // écriture différée dans le stockage

    const a = await openDevice(storage);
    await syncOn(a);
    expect([...server.rows.keys()].sort()).toEqual(['h1/l1', 'h1/p1']);
  });
});

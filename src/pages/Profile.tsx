import { useRef, useState } from 'react';
import type { Profile as ProfileT, Settings } from '../lib/types.ts';
import { PRICES_UPDATED } from '../data/ingredients.ts';
import { full, today } from '../lib/dates.ts';
import { exportAll, importAll, put, remove, type Rec } from '../store/store.ts';
import { useGoal, useProfiles, useSettings } from '../store/data.ts';
import { createHealthToken, createHousehold, healthEndpoint, publicApiKey, joinHousehold, signIn, signOut, signUp, syncConfigured, syncNow, useSync } from '../store/sync.ts';
import { Button, Card, CardTitle, Field, Input, Notice, NumberInput, Page, Segmented, Select, Sheet, cx } from '../ui/kit.tsx';
import { GoalSummary } from '../ui/goal.tsx';
import { ProfileForm, blankProfile } from '../ui/profile-form.tsx';

export default function Profile() {
  const { profiles, active, setActive } = useProfiles();
  const computed = useGoal(active);
  const settings = useSettings();
  const [editing, setEditing] = useState<ProfileT | 'new' | null>(null);
  const [budget, setBudget] = useState<number | ''>(settings.weeklyBudget || '');

  return (
    <Page title="Profil" subtitle="Objectifs, foyer et réglages">
      {profiles.length > 1 && (
        <Segmented value={active?.id ?? ''} onChange={setActive} options={profiles.map((p) => ({ value: p.id, label: p.name }))} />
      )}

      {active && computed && (
        <Card>
          <CardTitle right={<Button small variant="soft" icon="pencil" onClick={() => setEditing(active)}>Modifier</Button>}>Objectifs de {active.name}</CardTitle>
          <GoalSummary profile={active} goal={computed.goal} />
        </Card>
      )}

      <Card>
        <CardTitle>Foyer</CardTitle>
        <ul className="mb-3 flex flex-col gap-2">
          {profiles.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2.5 font-medium">
                <span className="flex size-8 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: p.color }}>{p.name.slice(0, 1).toUpperCase()}</span>
                {p.name}{p.pregnant && <span className="text-sm font-normal text-soft">· enceinte</span>}
              </span>
              <span className="flex gap-1">
                <Button small variant="ghost" onClick={() => setEditing(p)}>Modifier</Button>
                {profiles.length > 1 && <Button small variant="ghost" icon="trash" aria-label={`Supprimer le profil de ${p.name}`} onClick={() => { if (confirm(`Supprimer le profil de ${p.name} ? Son suivi ne sera plus visible.`)) remove(p.id); }} />}
              </span>
            </li>
          ))}
        </ul>
        <Button variant="soft" icon="plus" onClick={() => setEditing('new')}>Ajouter une personne</Button>
        <p className="mt-2 text-xs text-faint">Le planning et les courses sont communs. Les objectifs, les portions et le suivi sont propres à chacun.</p>
      </Card>

      <Card>
        <CardTitle>Budget courses</CardTitle>
        <div className="flex items-end gap-2">
          <div className="flex-1"><Field label="Budget par semaine pour le foyer"><NumberInput value={budget} onChange={setBudget} suffix="€" placeholder="80" /></Field></div>
          <Button variant="soft" icon="check" disabled={(budget || 0) === settings.weeklyBudget} onClick={() => put('settings', { id: 'settings', weeklyBudget: Number(budget) || 0 } satisfies Settings)}>Enregistrer</Button>
        </div>
        <p className="mt-2 text-xs text-faint">Au-delà du budget, l'écran Courses propose des recettes moins chères aux apports proches.</p>
      </Card>

      <SyncPanel />
      <HealthPanel />
      <BackupPanel />

      <Card>
        <CardTitle>Sources des données</CardTitle>
        <ul className="list-disc space-y-1 pl-5 text-sm text-soft">
          <li>Valeurs nutritionnelles : table Ciqual 2025 de l'Anses (Licence Ouverte 2.0).</li>
          <li>Prix : Open Prices, projet Open Food Facts (ODbL){PRICES_UPDATED ? `, relevés du ${full(PRICES_UPDATED)}` : ''}.</li>
          <li>Produits du commerce : Open Food Facts (ODbL).</li>
          <li>Les calories dépensées et les objectifs sont des estimations, pas un avis médical.</li>
        </ul>
      </Card>

      {editing && (
        <Sheet open onClose={() => setEditing(null)} title={editing === 'new' ? 'Nouvelle personne' : `Profil de ${editing.name}`}>
          <ProfileForm
            initial={editing === 'new' ? blankProfile(profiles.length) : editing}
            isNew={editing === 'new'}
            currentKg={editing !== 'new' && editing.id === active?.id ? computed?.kg : undefined}
            onSaved={(p) => { if (editing === 'new') setActive(p.id); setEditing(null); }}
            onCancel={() => setEditing(null)} />
        </Sheet>
      )}
    </Page>
  );
}

// ───────────────────────── Synchronisation ─────────────────────────
export function SyncPanel() {
  const sync = useSync();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('Notre foyer');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'danger' | 'brand'; text: string } | null>(null);

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fn();
      if (r === 'confirm') setMsg({ tone: 'brand', text: 'Compte créé. Clique sur le lien reçu par e-mail, puis connecte-toi ici.' });
      else if (ok) setMsg({ tone: 'brand', text: ok });
    } catch (e) {
      setMsg({ tone: 'danger', text: e instanceof Error ? e.message : 'Une erreur est survenue.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle right={sync.status === 'ready' || sync.status === 'syncing' ? <span className={cx('text-xs font-semibold', sync.status === 'syncing' ? 'text-soft' : 'text-brand')}>{sync.status === 'syncing' ? 'Synchronisation…' : 'À jour'}</span> : undefined}>Synchronisation du foyer</CardTitle>

      {!syncConfigured && (
        <p className="text-sm text-soft">
          Pas encore activée : les données restent sur cet appareil. Pour partager le foyer entre iPhone et ordinateur, crée un projet Supabase gratuit puis suis le fichier <b className="text-ink">README.md</b> du projet (5 minutes).
        </p>
      )}

      {sync.status === 'loading' && <p className="text-sm text-soft">Connexion…</p>}

      {sync.status === 'signed-out' && (
        <div className="flex flex-col gap-3">
          <Field label="E-mail"><Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Mot de passe" hint="8 caractères minimum."><Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <div className="flex gap-2">
            <Button full disabled={busy || !email || password.length < 8} onClick={() => run(() => signIn(email, password))}>Se connecter</Button>
            <Button full variant="soft" disabled={busy || !email || password.length < 8} onClick={() => run(() => signUp(email, password))}>Créer un compte</Button>
          </div>
        </div>
      )}

      {sync.status === 'no-household' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-soft">Connecté en tant que {sync.email}. Crée le foyer, ou rejoins celui de ton conjoint avec son code.</p>
          <div className="flex items-end gap-2">
            <div className="flex-1"><Field label="Créer un foyer"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field></div>
            <Button disabled={busy || !name.trim()} onClick={() => run(() => createHousehold(name.trim()))}>Créer</Button>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1"><Field label="Rejoindre avec un code"><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="AB12CD34" autoCapitalize="characters" /></Field></div>
            <Button variant="soft" disabled={busy || code.trim().length < 6} onClick={() => run(() => joinHousehold(code))}>Rejoindre</Button>
          </div>
          <button type="button" className="self-start text-sm font-semibold text-soft" onClick={() => run(signOut)}>Se déconnecter</button>
        </div>
      )}

      {(sync.status === 'ready' || sync.status === 'syncing' || (sync.status === 'error' && sync.household)) && sync.household && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-soft"><b className="text-ink">{sync.household.name}</b> · {sync.email}</p>
          <div className="rounded-xl bg-sunken px-3 py-2.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-soft">Code à donner pour rejoindre le foyer</div>
            <div className="tnum select-all text-xl font-bold tracking-widest">{sync.household.join_code}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button small variant="soft" icon="sync" disabled={sync.status === 'syncing'} onClick={() => void syncNow()}>Synchroniser</Button>
            <Button small variant="ghost" onClick={() => run(signOut)}>Se déconnecter</Button>
          </div>
        </div>
      )}

      {sync.status === 'error' && <div className="mt-3"><Notice tone="danger" icon="alert">Synchronisation impossible : {sync.error}</Notice></div>}
      {msg && <div className="mt-3"><Notice tone={msg.tone} icon={msg.tone === 'danger' ? 'alert' : 'check'}>{msg.text}</Notice></div>}
    </Card>
  );
}

// ───────────────────────── Apple Santé ─────────────────────────
function HealthPanel() {
  const sync = useSync();
  const { profiles, active } = useProfiles();
  const [profileId, setProfileId] = useState(active?.id ?? '');
  const [token, setToken] = useState(() => localStorage.getItem(`capforme:healthToken:${active?.id}`) ?? '');
  const [error, setError] = useState('');
  const ready = sync.status === 'ready' || sync.status === 'syncing';

  function pick(id: string) {
    setProfileId(id);
    setToken(localStorage.getItem(`capforme:healthToken:${id}`) ?? '');
  }

  async function generate() {
    setError('');
    try {
      const t = await createHealthToken(profileId);
      localStorage.setItem(`capforme:healthToken:${profileId}`, t);
      setToken(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Création du lien impossible.');
    }
  }

  return (
    <Card>
      <CardTitle>Apple Santé (pas et poids)</CardTitle>
      {!ready ? (
        <p className="text-sm text-soft">
          Une application web ne peut pas lire Apple Santé directement. Une fois la synchronisation du foyer activée, un Raccourci iOS enverra tes pas chaque soir, tout seul. En attendant, les pas se saisissent dans Suivi → Sport.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {profiles.length > 1 && <Field label="Pour qui ?"><Select value={profileId} onChange={pick}>{profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>}
          {!token ? (
            <Button variant="soft" icon="link" onClick={generate}>Créer mon lien personnel</Button>
          ) : (
            <>
              <div className="rounded-xl bg-sunken p-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-soft">Adresse</div>
                <div className="select-all break-all font-mono text-[13px]">{healthEndpoint}</div>
                <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-soft">Clé publique (en-tête apikey)</div>
                <div className="select-all break-all font-mono text-[13px]">{publicApiKey}</div>
                <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-soft">Jeton (à garder pour toi)</div>
                <div className="select-all break-all font-mono text-[13px]">{token}</div>
              </div>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm text-soft">
                <li>Sur l'iPhone, ouvre <b className="text-ink">Raccourcis</b> et crée un raccourci « Pas vers Cap Forme ».</li>
                <li>Ajoute l'action <b className="text-ink">Rechercher des échantillons de santé</b> : type <i>Pas</i>, filtre « Date de début : aujourd'hui ».</li>
                <li>Ajoute <b className="text-ink">Calculer des statistiques</b> : <i>Somme</i> des échantillons.</li>
                <li>Ajoute <b className="text-ink">Obtenir le contenu de l'URL</b> : colle l'adresse ci-dessus, méthode <i>POST</i>. En-têtes : <code>apikey</code> = la clé publique, <code>Content-Type</code> = <code>application/json</code>. Corps <i>JSON</i> avec deux champs — <code>p_token</code> (texte : ton jeton) et <code>p_steps</code> (nombre : le résultat des statistiques).</li>
                <li>Onglet <b className="text-ink">Automatisation</b> → « Heure de la journée », 22 h, tous les jours, « Exécuter immédiatement » → lance ce raccourci.</li>
                <li>Facultatif : même principe avec le type <i>Poids</i> (dernier échantillon) envoyé dans un champ <code>p_weight</code>.</li>
              </ol>
              <p className="text-xs text-faint">Le nom exact des actions peut varier légèrement selon la version d'iOS. Au premier lancement, autorise le raccourci à lire Santé.</p>
              <button type="button" className="self-start text-sm font-semibold text-soft" onClick={generate}>Régénérer le jeton (invalide l'ancien)</button>
            </>
          )}
          {error && <Notice tone="danger" icon="alert">{error}</Notice>}
        </div>
      )}
    </Card>
  );
}

// ───────────────────────── Sauvegarde ─────────────────────────
function BackupPanel() {
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

  function download() {
    const blob = new Blob([JSON.stringify({ app: 'cap-forme', version: 1, exported: today(), records: exportAll() })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cap-forme-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function restore(file: File) {
    try {
      const json = JSON.parse(await file.text()) as { app?: string; records?: Rec[] };
      if (json.app !== 'cap-forme' || !Array.isArray(json.records)) throw new Error();
      importAll(json.records);
      setMsg(`${json.records.length} éléments restaurés.`);
    } catch {
      setMsg("Ce fichier n'est pas une sauvegarde Cap Forme.");
    }
  }

  return (
    <Card>
      <CardTitle>Sauvegarde</CardTitle>
      <div className="flex flex-wrap gap-2">
        <Button small variant="soft" onClick={download}>Télécharger mes données</Button>
        <Button small variant="ghost" onClick={() => input.current?.click()}>Restaurer une sauvegarde</Button>
        <input ref={input} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void restore(f); e.target.value = ''; }} />
      </div>
      {msg && <p className="mt-2 text-sm text-soft">{msg}</p>}
    </Card>
  );
}

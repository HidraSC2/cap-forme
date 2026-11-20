import { useState } from 'react';
import { Icon } from '../ui/icons.tsx';
import { Button } from '../ui/kit.tsx';
import { ProfileForm, blankProfile } from '../ui/profile-form.tsx';
import { useLocal } from '../store/data.ts';
import { syncConfigured } from '../store/sync.ts';
import { SyncPanel } from './Profile.tsx';

export default function Onboarding() {
  const [, setActive] = useLocal('activeProfile', '');
  const [existing, setExisting] = useState(false);
  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg px-5 pb-12 pt-10">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-brand text-white"><Icon name="leaf" size={26} /></span>
      <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight">Bienvenue sur Cap Forme</h1>

      {existing ? (
        <>
          <p className="mt-2 text-soft">
            Connecte-toi : le foyer, les profils et le planning arrivent sur cet appareil. Pour une nouvelle personne, connecte-toi avec son propre compte et rejoins le foyer avec son code.
          </p>
          <div className="mt-6"><SyncPanel /></div>
          <p className="mt-4 text-sm text-soft">Une fois le foyer rejoint, si cette personne n'a pas encore de profil, reviens ici et crée-le.</p>
          <div className="mt-4"><Button variant="ghost" icon="left" onClick={() => setExisting(false)}>Créer un profil</Button></div>
        </>
      ) : (
        <>
          <p className="mt-2 text-soft">
            Repas, courses, sport et poids au même endroit. Commence par ton profil : l'application en déduit tes objectifs de calories et de macros.
          </p>
          {syncConfigured && (
            <button type="button" onClick={() => setExisting(true)} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
              <Icon name="sync" size={16} />J'ai déjà un compte ou un foyer Cap Forme
            </button>
          )}
          <div className="mt-7">
            <ProfileForm initial={blankProfile(0)} isNew onSaved={(p) => setActive(p.id)} />
          </div>
          <p className="mt-6 text-center text-xs text-faint">
            {syncConfigured ? 'Tes données sont enregistrées sur cet appareil, puis partagées avec ton foyer une fois connecté (Profil).' : 'Tes données restent sur cet appareil.'}
          </p>
        </>
      )}
    </div>
  );
}

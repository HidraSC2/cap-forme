import { lazy, Suspense, useEffect } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Icon } from './ui/icons.tsx';
import { cx } from './ui/kit.tsx';
import { useProfiles } from './store/data.ts';
import { startSync } from './store/sync.ts';
import Onboarding from './pages/Onboarding.tsx';
import Home from './pages/Home.tsx';
import Recipes from './pages/Recipes.tsx';
import RecipeDetail from './pages/RecipeDetail.tsx';
import Planning from './pages/Planning.tsx';
import Shopping from './pages/Shopping.tsx';
import Profile from './pages/Profile.tsx';

const RecipeEdit = lazy(() => import('./pages/RecipeEdit.tsx'));
const Tracking = lazy(() => import('./pages/Tracking.tsx'));

const NAV = [
  { to: '/', label: 'Accueil', icon: 'home' },
  { to: '/recettes', label: 'Recettes', icon: 'book' },
  { to: '/planning', label: 'Planning', icon: 'calendar' },
  { to: '/courses', label: 'Courses', icon: 'cart' },
  { to: '/suivi', label: 'Suivi', icon: 'chart' },
];

function TopBar() {
  const { profiles, active, setActive } = useProfiles();
  return (
    <div className="sticky top-0 z-30 border-b border-line/70 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-2xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight text-brand">
          <span className="flex size-7 items-center justify-center rounded-lg bg-brand text-white"><Icon name="leaf" size={16} /></span>
          Cap Forme
        </Link>
        <div className="flex items-center gap-1.5">
          {profiles.length > 1 && profiles.map((p) => (
            <button key={p.id} type="button" onClick={() => setActive(p.id)} aria-pressed={p.id === active?.id} title={`Voir en tant que ${p.name}`}
              className={cx('flex h-8 items-center rounded-full px-2.5 text-sm font-semibold transition', p.id === active?.id ? 'text-white' : 'bg-sunken text-soft')}
              style={p.id === active?.id ? { background: p.color } : undefined}>
              {p.name}
            </button>
          ))}
          <Link to="/profil" aria-label="Profil et réglages" title="Profil et réglages" className="flex size-9 items-center justify-center rounded-full text-soft hover:bg-sunken">
            <Icon name="user" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function BottomNav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur" aria-label="Navigation principale">
      <div className="mx-auto flex max-w-2xl">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}
            className={({ isActive }) => cx('flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition', isActive ? 'text-brand' : 'text-faint')}>
            <Icon name={n.icon} size={22} />
            {n.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const { profiles } = useProfiles();
  useEffect(() => startSync(), []);

  if (profiles.length === 0) return <Onboarding />;

  return (
    <div className="min-h-dvh">
      <ScrollTop />
      <TopBar />
      <Suspense fallback={<div className="p-8 text-center text-soft">Chargement…</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/recettes" element={<Recipes />} />
          <Route path="/recettes/nouvelle" element={<RecipeEdit />} />
          <Route path="/recettes/:id" element={<RecipeDetail />} />
          <Route path="/recettes/:id/modifier" element={<RecipeEdit />} />
          <Route path="/planning" element={<Planning />} />
          <Route path="/courses" element={<Shopping />} />
          <Route path="/suivi" element={<Tracking />} />
          <Route path="/profil" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <BottomNav />
    </div>
  );
}

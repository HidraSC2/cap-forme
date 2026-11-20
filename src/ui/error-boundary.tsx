import { Component, type ReactNode } from 'react';

/** Évite la page blanche : affiche un message et permet de recharger. Les données restent enregistrées. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-xl font-bold">Oups, cet écran a planté</h1>
        <p className="mt-2 text-soft">Tes données sont enregistrées. Recharge la page pour reprendre.</p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-sunken p-3 text-left text-xs text-soft">{this.state.error.message}</pre>
        <button type="button" onClick={() => { location.hash = '#/'; location.reload(); }} className="mt-5 min-h-11 rounded-xl bg-brand px-5 font-semibold text-white">Recharger</button>
      </div>
    );
  }
}

// 📁 src/components/ErrorBoundary.tsx
// ============================================================
// 🛡️ FILET DE SÉCURITÉ REACT
// ============================================================
//
// POURQUOI CE FICHIER
// -------------------
// L'application n'avait AUCUN ErrorBoundary. En React, une exception non
// capturée pendant le rendu démonte tout l'arbre de composants : l'utilisateur
// se retrouve devant une page entièrement blanche, sans message ni moyen de
// s'en sortir. Un simple `patient.adresse.ville` sur une adresse absente
// suffisait à faire disparaître l'application.
//
// Ce composant intercepte l'erreur, affiche un écran de secours lisible et
// propose de réessayer sans perdre la session.
//
// ⚠️ Un ErrorBoundary ne capture PAS :
//    - les erreurs dans les gestionnaires d'événements (onClick…)
//    - les erreurs asynchrones (setTimeout, promesses)
//    - les erreurs de rendu côté serveur
// Ces cas-là restent à traiter avec try/catch localement.
//
// Le design reprend la palette existante (variables CSS du thème) pour rester
// cohérent avec le reste de l'application.
// ============================================================

import { Component, ErrorInfo, ReactNode } from 'react';
import { reportError } from '@/lib/sentry';

interface Props {
  children: ReactNode;
  /** Écran de secours personnalisé (optionnel). */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('❌ [ErrorBoundary] Erreur de rendu interceptée :', error, errorInfo);

    // ✅ Remontée à Sentry avec la pile de composants React.
    // `componentStack` indique QUEL composant a planté — c'est l'information
    // la plus utile pour diagnostiquer un écran blanc.
    reportError(error, {
      componentStack: errorInfo.componentStack,
      source: 'ErrorBoundary',
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    // On repart proprement sur l'accueil plutôt que de rester bloqué.
    window.location.href = '/app';
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return <>{this.props.fallback}</>;

    const isDev = import.meta.env.DEV;

    return (
      <div
        className="min-h-screen w-full flex items-center justify-center p-6"
        style={{ background: 'var(--color-background, #f5f0e8)' }}
      >
        <div className="max-w-md w-full text-center">
          <div
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: 'var(--color-primary, #1a4a3a)', opacity: 0.1 }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-primary, #1a4a3a)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>

          <h1
            className="mb-3 text-xl font-semibold"
            style={{ color: 'var(--color-primary, #1a4a3a)' }}
          >
            Une erreur inattendue est survenue
          </h1>

          <p className="mb-8 text-sm leading-relaxed text-gray-600">
            Nous sommes désolés pour la gêne occasionnée. Vos données sont en
            sécurité. Vous pouvez recharger la page pour reprendre là où vous
            en étiez.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={this.handleReload}
              className="rounded-xl px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--color-primary, #1a4a3a)' }}
            >
              Recharger la page
            </button>
            <button
              onClick={this.handleGoHome}
              className="rounded-xl border px-6 py-3 text-sm font-medium transition-colors hover:bg-gray-50"
              style={{
                borderColor: 'var(--color-primary, #1a4a3a)',
                color: 'var(--color-primary, #1a4a3a)',
              }}
            >
              Retour à l'accueil
            </button>
          </div>

          {/* Détail technique : en développement uniquement.
              En production, afficher une stack trace exposerait la structure
              interne de l'application et inquiéterait l'utilisateur. */}
          {isDev && this.state.error && (
            <pre className="mt-8 max-h-48 overflow-auto rounded-lg bg-red-50 p-4 text-left text-xs text-red-800">
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;

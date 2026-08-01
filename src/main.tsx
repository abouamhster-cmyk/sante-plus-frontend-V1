// 📁 src/main.tsx

import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// ============================================================
// ✅ ErrorBoundary au niveau racine
// ============================================================
// Sans lui, la moindre exception pendant le rendu laissait l'utilisateur
// devant une page blanche, sans explication ni moyen de récupérer.
//
// 💡 OPTIONNEL — <React.StrictMode>
// Vous pouvez envelopper <App /> dans <React.StrictMode> pour détecter les
// effets de bord douteux. Attention : en développement, StrictMode monte
// chaque composant DEUX fois. Vos abonnements Realtime Supabase et vos gardes
// `useRef` d'initialisation dans App.tsx s'exécuteraient donc en double.
// C'est un comportement de développement uniquement (aucun impact en prod),
// mais il faut le tester avant de l'activer — d'où sa désactivation ici.
// ============================================================
// 🛡️ FILET DE SÉCURITÉ — CHEMINS À DOUBLE SLASH
// ============================================================
// Un service externe (FedaPay, un email, un lien partagé) peut renvoyer
// l'utilisateur sur une URL du type :
//     https://mon-app.vercel.app//payment/confirm?status=approved
//
// React Router ne reconnaît pas "//payment/confirm" comme la route
// "/payment/confirm" : la navigation tombe sur la route attrape-tout
// (path="*") et l'utilisateur se retrouve à l'accueil, en perdant tous
// ses paramètres — c'est ce qui cassait le retour de paiement.
//
// La cause a été corrigée à la source côté backend, mais on normalise
// aussi ici : ce cas peut resurgir de n'importe quel lien externe, et
// une redirection silencieuse vers l'accueil est très difficile à
// diagnostiquer. `replaceState` conserve la query string et n'ajoute
// pas d'entrée dans l'historique.
if (window.location.pathname.includes('//')) {
  const cleanPath = window.location.pathname.replace(/\/{2,}/g, '/');
  window.history.replaceState(
    null,
    '',
    cleanPath + window.location.search + window.location.hash
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

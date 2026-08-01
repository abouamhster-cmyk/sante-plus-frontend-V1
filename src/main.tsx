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
ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

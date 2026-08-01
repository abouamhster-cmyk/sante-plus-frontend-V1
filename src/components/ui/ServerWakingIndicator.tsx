// 📁 src/components/ui/ServerWakingIndicator.tsx
// ============================================================
// 🌙 INDICATEUR DE RÉVEIL DU SERVEUR
// ============================================================
//
// POURQUOI CE FICHIER
// -------------------
// Le backend tourne sur Render en plan gratuit : après une période
// d'inactivité, l'instance s'endort et met jusqu'à 50 secondes à repartir.
//
// Sans retour visuel, l'utilisateur voit un écran figé. Il en conclut que
// l'application est cassée : il appuie plusieurs fois sur le bouton, quitte,
// revient, et finit par abandonner. Pour un service payant, c'est fatal.
//
// Dire simplement « le serveur démarre, patientez » change complètement
// la perception : l'attente devient explicable au lieu d'être un bug.
//
// 👉 À terme, la vraie correction est de passer Render en plan payant.
//    Ce composant devient alors inutile — mais inoffensif, puisqu'il ne
//    s'affiche que si une requête dépasse 4 secondes.
// ============================================================

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { onServerWaking } from '@/lib/api';

export const ServerWakingIndicator = () => {
  const [waking, setWaking] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => onServerWaking(setWaking), []);

  // Compteur : voir le temps défiler rassure davantage qu'un texte figé,
  // qui donne l'impression que l'application est bloquée.
  useEffect(() => {
    if (!waking) {
      setSeconds(0);
      return;
    }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [waking]);

  if (!waking) return null;

  return (
    <div
      className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-[9998] w-[92vw] max-w-sm animate-slideUp"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-lg border border-gray-100">
        <Loader2
          size={18}
          className="animate-spin shrink-0"
          style={{ color: 'var(--color-primary, #1a4a3a)' }}
        />
        <div className="min-w-0">
          <p
            className="text-[12px] font-bold leading-tight"
            style={{ color: 'var(--color-text, #1f2937)' }}
          >
            Démarrage du serveur...
          </p>
          <p className="text-[10px] text-gray-500 leading-tight mt-0.5">
            Première connexion depuis un moment. Cela peut prendre jusqu'à
            une minute{seconds > 3 ? ` (${seconds} s)` : ''}.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ServerWakingIndicator;

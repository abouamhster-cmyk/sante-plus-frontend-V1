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
// l'application est cassée. Une simple barre de progression qui avance
// de 0 à 100 % — puis disparaît dès que le serveur répond — suffit à
// rendre l'attente compréhensible sans être intrusive.
//
// 👉 À terme, la vraie correction est de passer Render en plan payant.
//    Ce composant devient alors inutile — mais inoffensif, puisqu'il ne
//    s'affiche que si une requête dépasse 4 secondes.
// ============================================================

import { useEffect, useState, useRef } from 'react';
import { onServerWaking } from '@/lib/api';

// Durée estimée du réveil serveur, utilisée pour calibrer la progression.
// La barre ralentit après ~80% pour ne jamais sembler bloquée si ça prend
// plus longtemps que prévu (comportement classique d'une fausse jauge).
const ESTIMATED_WAKE_MS = 50000;

export const ServerWakingIndicator = () => {
  const [waking, setWaking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>();

  useEffect(() => onServerWaking(setWaking), []);

  useEffect(() => {
    if (waking) {
      setVisible(true);
      startRef.current = Date.now();
      setProgress(0);

      const tick = () => {
        const elapsed = Date.now() - startRef.current;
        // Courbe qui ralentit en approchant 90% pour ne jamais paraître figée
        const raw = elapsed / ESTIMATED_WAKE_MS;
        const eased = raw < 0.9 ? raw : 0.9 + (raw - 0.9) * 0.1;
        setProgress(Math.min(eased * 100, 97));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    } else {
      // Le serveur a répondu : on complète la barre à 100% puis on
      // la fait disparaître, plutôt que de la couper net à mi-course.
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setProgress(100);
      const hideTimer = setTimeout(() => setVisible(false), 400);
      return () => clearTimeout(hideTimer);
    }
  }, [waking]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9998] transition-opacity duration-300"
      style={{ opacity: waking ? 1 : 0 }}
      role="status"
      aria-live="polite"
      aria-label="Démarrage du serveur en cours"
    >
      <div className="h-[3px] w-full bg-transparent overflow-hidden">
        <div
          className="h-full transition-[width] duration-200 ease-out"
          style={{
            width: `${progress}%`,
            background: 'var(--color-primary, #1a4a3a)',
          }}
        />
      </div>
    </div>
  );
};

export default ServerWakingIndicator;

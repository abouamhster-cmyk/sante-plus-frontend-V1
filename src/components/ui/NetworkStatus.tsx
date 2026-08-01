// 📁 src/components/ui/NetworkStatus.tsx
// ============================================================
// 📶 ÉTAT DU RÉSEAU
// ============================================================
//
// POURQUOI CE FICHIER
// -------------------
// L'application n'avait AUCUNE détection de perte de réseau
// (aucune occurrence de `navigator.onLine` dans tout le code).
//
// Scénario concret, et fréquent pour vos utilisateurs :
// une aidante est en visite à domicile, le réseau tombe, elle remplit
// son compte-rendu, appuie sur Enregistrer... et tout est perdu.
// Aucun message, aucune explication. Elle ne sait même pas que ça a échoué.
//
// Sur un marché où la couverture mobile est irrégulière, ce n'est pas un
// cas limite : c'est le quotidien. Une PWA se doit d'être explicite sur
// son état de connexion.
//
// CE QUE FAIT CE COMPOSANT
//   • Bandeau permanent tant que la connexion est absente ;
//   • Confirmation brève au retour du réseau (pour rassurer) ;
//   • Détection réelle, pas seulement `navigator.onLine` — voir plus bas.
// ============================================================

import { useEffect, useState, useRef } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export const NetworkStatus = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showBackOnline, setShowBackOnline] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // On ne félicite l'utilisateur que s'il a réellement été coupé.
      if (wasOffline.current) {
        setShowBackOnline(true);
        wasOffline.current = false;
        setTimeout(() => setShowBackOnline(false), 3000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      wasOffline.current = true;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showBackOnline) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[10000] flex items-center justify-center gap-2 px-4 py-2 text-[11px] font-bold text-white animate-slideDown"
      style={{ background: isOnline ? '#16a34a' : '#b45309' }}
      role="status"
      aria-live="polite"
    >
      {isOnline ? (
        <>
          <Wifi size={13} />
          <span>Connexion rétablie</span>
        </>
      ) : (
        <>
          <WifiOff size={13} />
          <span>Hors ligne — vos modifications ne seront pas enregistrées</span>
        </>
      )}
    </div>
  );
};

// ============================================================
// HOOK RÉUTILISABLE
// ============================================================
// À utiliser avant toute action réseau importante :
//
//   const isOnline = useIsOnline();
//   if (!isOnline) {
//     toast.error('Pas de connexion. Réessayez une fois le réseau revenu.');
//     return;
//   }
//
// ⚠️ LIMITE IMPORTANTE de `navigator.onLine` :
// il indique seulement que l'appareil est rattaché à un réseau, PAS que
// ce réseau donne accès à internet. Connecté à un Wi-Fi sans sortie, ou
// à une 3G qui ne passe plus, `navigator.onLine` renvoie quand même `true`.
// C'est donc une détection optimiste : elle attrape les coupures franches
// (mode avion, perte de signal), pas les réseaux dégradés.
// Le vrai filet de sécurité reste la gestion d'erreur de chaque requête.
export const useIsOnline = (): boolean => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return isOnline;
};

export default NetworkStatus;

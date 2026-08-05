// 📁 src/components/ui/StaleDataBanner.tsx
// ============================================================
// 🕐 BANDEAU « DONNÉES HORS LIGNE »
// ============================================================
//
// Quand l'application affiche des données issues du cache — parce que
// le réseau est coupé ou que la requête a échoué — l'utilisateur doit
// le savoir. Sinon il prend une décision (annuler une visite, appeler
// un aidant) sur des informations peut-être périmées.
//
// Le bandeau reste discret : une ligne, pas de modale bloquante.
// Il indique l'ancienneté réelle des données et propose de réessayer.
// ============================================================

import { CloudOff, RefreshCw } from 'lucide-react';
import { formatCacheAge } from '@/lib/cache';
import { useBranding } from '@/hooks/useBranding';

interface StaleDataBannerProps {
  /** Affiche le bandeau uniquement si true */
  show: boolean;
  /** Date du cache affiché */
  timestamp: number | null;
  /** Action de rechargement manuel */
  onRetry?: () => void;
  isRetrying?: boolean;
}

export const StaleDataBanner = ({
  show,
  timestamp,
  onRetry,
  isRetrying = false,
}: StaleDataBannerProps) => {
  const brand = useBranding();
  const colors = brand.colors;

  if (!show || !timestamp) return null;

  return (
    <div
      className="flex items-center gap-2.5 rounded-xl px-3 py-2 border text-[11px]"
      style={{
        background: '#f59e0b0d',
        borderColor: '#f59e0b33',
        color: colors.text,
      }}
      role="status"
    >
      <CloudOff size={13} className="shrink-0" style={{ color: '#f59e0b' }} />
      <span className="flex-1 min-w-0 font-medium">
        Données enregistrées {formatCacheAge(timestamp)}
      </span>
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="flex items-center gap-1 font-bold shrink-0 px-2 py-1 rounded-lg transition hover:bg-black/5 disabled:opacity-50"
          style={{ color: '#f59e0b' }}
        >
          <RefreshCw size={11} className={isRetrying ? 'animate-spin' : ''} />
          Actualiser
        </button>
      )}
    </div>
  );
};

export default StaleDataBanner;

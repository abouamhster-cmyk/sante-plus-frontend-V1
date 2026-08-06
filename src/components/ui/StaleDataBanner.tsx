// 📁 src/components/ui/StaleDataBanner.tsx
// ============================================================
// 🕐 MENTION « DONNÉES HORS LIGNE »
// ============================================================
//
// Quand l'application affiche des données issues du cache — réseau
// coupé ou requête échouée — l'utilisateur doit pouvoir le constater
// s'il le cherche, sans être interrompu s'il ne le cherche pas.
//
// D'où le parti pris : une seule ligne de texte discrète, pas de
// bandeau coloré ni d'encadré. L'information est là pour qui la
// remarque ; elle ne réclame pas l'attention.
//
// SEUIL D'AFFICHAGE (1 h)
// -----------------------
// Le cache expire au bout d'une minute et se rafraîchit tout seul.
// Signaler « périmé » dans ce cas ferait clignoter la mention en
// usage tout à fait normal, pour rien. On n'affiche donc quelque
// chose qu'au-delà d'une heure : à ce stade, l'écart avec la réalité
// devient assez large pour mériter d'être signalé.
// ============================================================

import { CloudOff } from 'lucide-react';
import { formatCacheAge } from '@/lib/cache';
import { useBranding } from '@/hooks/useBranding';
import { cn } from '@/utils/helpers';

/** En deçà d'une heure, on ne dit rien : le cache se rafraîchit seul. */
const SEUIL_AFFICHAGE_MS = 60 * 60 * 1000;

interface StaleDataBannerProps {
  /** Vrai quand les données affichées proviennent d'un cache périmé */
  show: boolean;
  /** Date du cache affiché */
  timestamp: number | null;
  className?: string;
}

export const StaleDataBanner = ({
  show,
  timestamp,
  className,
}: StaleDataBannerProps) => {
  const brand = useBranding();

  if (!show || !timestamp) return null;
  if (Date.now() - timestamp < SEUIL_AFFICHAGE_MS) return null;

  return (
    <p
      className={cn('flex items-center gap-1.5 text-[10px] font-medium', className)}
      style={{ color: brand.colors.textLight }}
      role="status"
    >
      <CloudOff size={10} className="shrink-0" />
      Données de {formatCacheAge(timestamp)}
    </p>
  );
};

export default StaleDataBanner;

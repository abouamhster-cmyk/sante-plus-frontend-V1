// 📁 src/components/ui/PageHeader.tsx
// En-tête de page cohérent sur toute l'application.
// Gère le bouton retour, le titre, le sous-titre et un slot d'action droite.

import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/utils/helpers';
import { useBranding } from '@/hooks/useBranding';

// ============================================================
// TYPES
// ============================================================

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Affiche ← et navigue en arrière (ou vers `backTo` si fourni) */
  showBack?: boolean;
  backTo?: string;
  backLabel?: string;
  /** Slot d'action en haut à droite (bouton, lien…) */
  action?: ReactNode;
  /** Slot d'icône / avatar en haut à gauche (à côté du titre) */
  icon?: ReactNode;
  className?: string;
}

// ============================================================
// COMPOSANT
// ============================================================

export const PageHeader = ({
  title,
  subtitle,
  showBack = false,
  backTo,
  backLabel,
  action,
  icon,
  className,
}: PageHeaderProps) => {
  const navigate = useNavigate();
  const brand = useBranding();
  const colors = brand.colors;

  const handleBack = () => {
    if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

  return (
    <header className={cn('mb-4', className)}>
      {/* Bouton retour */}
      {showBack && (
        <button
          onClick={handleBack}
          className="flex items-center gap-1 mb-2 text-[11px] font-bold transition-opacity hover:opacity-70 -ml-0.5"
          style={{ color: colors.primary }}
        >
          <ChevronLeft size={14} strokeWidth={2.5} />
          {backLabel || 'Retour'}
        </button>
      )}

      {/* Titre + action */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-white"
              style={{ background: colors.gradient }}
            >
              {icon}
            </div>
          )}

          <div className="min-w-0">
            <h1
              className="font-extrabold text-base leading-tight truncate"
              style={{ color: colors.text }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                className="text-[11px] mt-0.5 truncate"
                style={{ color: colors.textLight }}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {action && (
          <div className="shrink-0">
            {action}
          </div>
        )}
      </div>
    </header>
  );
};

// ============================================================
// VARIANTE SECTION (sous-titre de section dans une page)
// ============================================================

export const SectionTitle = ({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) => {
  const brand = useBranding();
  const colors = brand.colors;

  return (
    <div className={cn('flex items-center justify-between gap-2 mb-2', className)}>
      <h2
        className="text-xs font-black uppercase tracking-wider"
        style={{ color: colors.textLight }}
      >
        {children}
      </h2>
      {action}
    </div>
  );
};

export default PageHeader;

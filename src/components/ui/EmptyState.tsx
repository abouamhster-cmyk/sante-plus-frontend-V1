// 📁 src/components/ui/EmptyState.tsx
// État vide cohérent sur toute l'application.
// Chaque page avait sa propre version — unifiée ici.

import { ReactNode } from 'react';
import { cn } from '@/utils/helpers';
import { useBranding } from '@/hooks/useBranding';
import { Illustration } from './Illustration';
import { Button, ButtonVariant } from './Button';

// ============================================================
// TYPES
// ============================================================

interface EmptyAction {
  label: string;
  onClick: () => void;
  variant?: ButtonVariant;
  icon?: ReactNode;
}

interface EmptyStateProps {
  /** Type d'illustration — map vers les images existantes */
  illustration?: 'visit' | 'order' | 'search' | 'calendar' | 'notification' | 'general';
  icon?: ReactNode;
  title: string;
  description?: string;
  primaryAction?: EmptyAction;
  secondaryAction?: EmptyAction;
  className?: string;
  compact?: boolean;
}

// ============================================================
// COMPOSANT
// ============================================================

export const EmptyState = ({
  illustration = 'general',
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
  compact = false,
}: EmptyStateProps) => {
  const brand = useBranding();
  const colors = brand.colors;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center rounded-2xl border',
        compact ? 'py-8 px-4' : 'py-14 px-6',
        'max-w-sm mx-auto',
        className
      )}
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border + '60',
      }}
    >
      {/* Illustration ou icône */}
      {icon ? (
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: colors.primary + '12', color: colors.primary }}
        >
          {icon}
        </div>
      ) : (
        <Illustration
          type={illustration as any}
          size={compact ? 'sm' : 'md'}
          className="opacity-40 mb-4"
        />
      )}

      {/* Texte */}
      <h3
        className="font-extrabold text-sm mb-1"
        style={{ color: colors.text }}
      >
        {title}
      </h3>

      {description && (
        <p
          className="text-xs leading-relaxed max-w-[22ch] mb-5"
          style={{ color: colors.textLight }}
        >
          {description}
        </p>
      )}

      {/* Actions */}
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-col items-center gap-2 w-full mt-2">
          {primaryAction && (
            <Button
              variant={primaryAction.variant || 'primary'}
              size="sm"
              onClick={primaryAction.onClick}
              iconLeft={primaryAction.icon}
              fullWidth
            >
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant={secondaryAction.variant || 'ghost'}
              size="sm"
              onClick={secondaryAction.onClick}
              iconLeft={secondaryAction.icon}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;

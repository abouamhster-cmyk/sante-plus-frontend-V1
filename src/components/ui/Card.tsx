// 📁 src/components/ui/Card.tsx
// Conteneur carte unique. Remplace les dizaines de div
// avec className="bg-white rounded-2xl p-4 shadow-sm border..." codées à la main.

import { ReactNode, HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/helpers';
import { useBranding } from '@/hooks/useBranding';

// ============================================================
// TYPES
// ============================================================

export type CardVariant = 'default' | 'soft' | 'elevated' | 'flat' | 'primary';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  children: ReactNode;
  /** Remplace le border par un border coloré primary */
  highlighted?: boolean;
  /** Désactive le hover lift */
  noHover?: boolean;
}

// ============================================================
// CONSTANTES
// ============================================================

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5 sm:p-6',
};

// ============================================================
// COMPOSANT
// ============================================================

export const Card = forwardRef<HTMLDivElement, CardProps>(({
  variant = 'default',
  padding = 'md',
  children,
  highlighted = false,
  noHover = false,
  className,
  style,
  ...props
}, ref) => {
  const brand = useBranding();
  const colors = brand.colors;

  const getVariantStyle = (): React.CSSProperties => {
    switch (variant) {
      case 'default':
        return {
          backgroundColor: colors.surface,
          borderColor: highlighted ? colors.primary + '50' : colors.border + '80',
          boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
        };
      case 'soft':
        return {
          backgroundColor: colors.surfaceSoft,
          borderColor: highlighted ? colors.primary + '40' : colors.border + '40',
        };
      case 'elevated':
        return {
          backgroundColor: colors.surface,
          borderColor: highlighted ? colors.primary + '50' : 'transparent',
          boxShadow: highlighted
            ? `0 0 0 2px ${colors.primary}30, ${colors.shadow}`
            : colors.shadow,
        };
      case 'flat':
        return {
          backgroundColor: colors.surfaceSoft,
          borderColor: 'transparent',
        };
      case 'primary':
        return {
          background: colors.gradient,
          borderColor: 'transparent',
          color: '#ffffff',
        };
    }
  };

  return (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl border',
        PADDING_CLASSES[padding],
        !noHover && variant !== 'primary' && 'transition-all duration-200',
        className,
      )}
      style={{ ...getVariantStyle(), ...style }}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

// ============================================================
// SOUS-COMPOSANTS (composition pattern)
// ============================================================

export const CardHeader = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex items-center justify-between gap-3 mb-3', className)}
    {...props}
  >
    {children}
  </div>
);

export const CardTitle = ({
  children,
  className,
  style,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) => {
  const brand = useBranding();
  return (
    <h3
      className={cn('font-extrabold text-sm', className)}
      style={{ color: brand.colors.text, ...style }}
      {...props}
    >
      {children}
    </h3>
  );
};

export const CardDivider = ({ className }: { className?: string }) => {
  const brand = useBranding();
  return (
    <hr
      className={cn('my-3', className)}
      style={{ borderColor: brand.colors.border + '60' }}
    />
  );
};

export default Card;

// 📁 src/components/ui/Button.tsx
// Composant Button unique pour toute l'application.
// Remplace les 90+ boutons codés à la main dans les features.

import { ReactNode, ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/helpers';
import { useBranding } from '@/hooks/useBranding';

// ============================================================
// TYPES
// ============================================================

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gold';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  children?: ReactNode;
}

// ============================================================
// CONSTANTES DE STYLE (ne dépendent pas du thème)
// ============================================================

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-[10px] gap-1 rounded-lg',
  sm: 'h-8 px-3 text-[11px] gap-1.5 rounded-xl',
  md: 'h-10 px-4 text-xs gap-1.5 rounded-xl',
  lg: 'h-12 px-5 text-sm gap-2 rounded-2xl',
};

const ICON_SIZE: Record<ButtonSize, number> = {
  xs: 11,
  sm: 12,
  md: 13,
  lg: 15,
};

// ============================================================
// COMPOSANT
// ============================================================

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  iconLeft,
  iconRight,
  fullWidth = false,
  children,
  className,
  disabled,
  style,
  ...props
}, ref) => {
  const brand = useBranding();
  const colors = brand.colors;

  // Les styles dynamiques (couleur du thème) sont appliqués via style={}
  // Les utilitaires fixes (padding, taille, radius) via className
  const getVariantStyle = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          background: colors.primary,
          color: '#ffffff',
          boxShadow: `0 2px 8px -2px ${colors.primary}60`,
        };
      case 'secondary':
        return {
          background: colors.primary + '15',
          color: colors.primary,
        };
      case 'outline':
        return {
          background: 'transparent',
          color: colors.primary,
          border: `2px solid ${colors.primary}`,
        };
      case 'ghost':
        return {
          background: 'transparent',
          color: colors.textLight,
        };
      case 'danger':
        return {
          background: '#EF4444',
          color: '#ffffff',
          boxShadow: '0 2px 8px -2px rgba(239,68,68,0.4)',
        };
      case 'gold':
        return {
          background: colors.gold,
          color: '#ffffff',
          boxShadow: `0 2px 8px -2px ${colors.gold}60`,
        };
    }
  };

  const isDisabled = disabled || isLoading;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center font-bold transition-all duration-200',
        'active:scale-[0.97] select-none',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        SIZE_CLASSES[size],
        variant === 'primary' && 'hover:opacity-90',
        variant === 'secondary' && 'hover:opacity-80',
        variant === 'outline' && 'hover:bg-current/5',
        variant === 'ghost' && 'hover:bg-black/5 dark:hover:bg-white/5',
        variant === 'danger' && 'hover:opacity-90',
        variant === 'gold' && 'hover:opacity-90',
        fullWidth && 'w-full',
        className,
      )}
      style={{ ...getVariantStyle(), ...style }}
      {...props}
    >
      {isLoading ? (
        <Loader2 size={ICON_SIZE[size]} className="animate-spin shrink-0" />
      ) : (
        iconLeft && <span className="shrink-0">{iconLeft}</span>
      )}
      {children && <span className="truncate">{children}</span>}
      {!isLoading && iconRight && <span className="shrink-0">{iconRight}</span>}
    </button>
  );
});

Button.displayName = 'Button';

// ============================================================
// VARIANTES RACCOURCIES (ergonomie)
// ============================================================

export const PrimaryButton = (props: ButtonProps) => <Button variant="primary" {...props} />;
export const OutlineButton = (props: ButtonProps) => <Button variant="outline" {...props} />;
export const GhostButton = (props: ButtonProps) => <Button variant="ghost" {...props} />;
export const DangerButton = (props: ButtonProps) => <Button variant="danger" {...props} />;

export default Button;

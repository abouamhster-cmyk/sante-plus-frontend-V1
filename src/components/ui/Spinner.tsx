// 📁 src/components/ui/Spinner.tsx
// Spinner et Skeleton unifiés.
// Le LoadingSkeleton existant était utilisé 0 fois — on repart proprement.

import { cn } from '@/utils/helpers';
import { useBranding } from '@/hooks/useBranding';

// ============================================================
// SPINNER — indicateur de chargement ponctuel
// ============================================================

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SPINNER_SIZES = {
  xs: 'w-3 h-3 border',
  sm: 'w-4 h-4 border',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-2',
};

export const Spinner = ({ size = 'md', className }: SpinnerProps) => {
  const brand = useBranding();
  const colors = brand.colors;

  return (
    <span
      className={cn(
        'inline-block rounded-full animate-spin',
        'border-current border-t-transparent',
        SPINNER_SIZES[size],
        className
      )}
      style={{ color: colors.primary }}
      role="status"
      aria-label="Chargement…"
    />
  );
};

// ============================================================
// SKELETON — placeholder de chargement (remplace le contenu)
// ============================================================

interface SkeletonProps {
  className?: string;
  rounded?: 'sm' | 'md' | 'full';
}

export const Skeleton = ({ className, rounded = 'md' }: SkeletonProps) => {
  const brand = useBranding();
  return (
    <div
      className={cn(
        'animate-pulse',
        rounded === 'sm' && 'rounded-lg',
        rounded === 'md' && 'rounded-xl',
        rounded === 'full' && 'rounded-full',
        className
      )}
      style={{ backgroundColor: brand.colors.primary + '10' }}
    />
  );
};

// ============================================================
// SKELETON CARD — placeholder de carte complète
// ============================================================

export const SkeletonCard = ({ className }: { className?: string }) => {
  const brand = useBranding();
  return (
    <div
      className={cn('rounded-2xl p-4 border space-y-3 animate-pulse', className)}
      style={{
        backgroundColor: brand.colors.surface,
        borderColor: brand.colors.border + '60',
      }}
    >
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 shrink-0" rounded="md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-2.5 w-full" />
      <Skeleton className="h-2.5 w-2/3" />
    </div>
  );
};

// ============================================================
// SKELETON LIST — placeholder de liste
// ============================================================

export const SkeletonList = ({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) => (
  <div className={cn('space-y-3', className)}>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

// ============================================================
// PAGE LOADING — pleine page avec spinner centré
// ============================================================

export const PageLoading = ({ label }: { label?: string }) => {
  const brand = useBranding();
  const colors = brand.colors;

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
      <Spinner size="lg" />
      {label && (
        <p className="text-xs font-medium" style={{ color: colors.textLight }}>
          {label}
        </p>
      )}
    </div>
  );
};

export default Spinner;

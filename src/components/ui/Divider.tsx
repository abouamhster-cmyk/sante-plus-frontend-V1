// 📁 src/components/ui/Divider.tsx
// Séparateur horizontal et lignes d'information cohérentes.

import { ReactNode } from 'react';
import { cn } from '@/utils/helpers';
import { useBranding } from '@/hooks/useBranding';

// ============================================================
// DIVIDER
// ============================================================

export const Divider = ({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) => {
  const brand = useBranding();
  const colors = brand.colors;

  if (label) {
    return (
      <div className={cn('flex items-center gap-3 my-4', className)}>
        <hr className="flex-1" style={{ borderColor: colors.border + '60' }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: colors.textLight }}>
          {label}
        </span>
        <hr className="flex-1" style={{ borderColor: colors.border + '60' }} />
      </div>
    );
  }

  return (
    <hr
      className={cn('my-3', className)}
      style={{ borderColor: colors.border + '60' }}
    />
  );
};

// ============================================================
// INFO ROW — ligne étiquette / valeur (profil, récap…)
// ============================================================

interface DataRowProps {
  label: string;
  value?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export const DataRow = ({ label, value, icon, className }: DataRowProps) => {
  const brand = useBranding();
  const colors = brand.colors;

  return (
    <div className={cn('flex items-start gap-3 py-2', className)}>
      {icon && (
        <span
          className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: colors.primary + '12', color: colors.primary }}
        >
          {icon}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: colors.textLight }}>
          {label}
        </p>
        <div className="text-xs font-medium break-words" style={{ color: colors.text }}>
          {value ?? <span style={{ color: colors.textLight }}>—</span>}
        </div>
      </div>
    </div>
  );
};

export default Divider;

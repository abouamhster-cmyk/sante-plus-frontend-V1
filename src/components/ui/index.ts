// 📁 src/components/ui/index.ts
// ============================================================
// DESIGN SYSTEM — exports centralisés
// Importer depuis '@/components/ui' pour tout composant UI.
// ============================================================

// ─── Composants fondation (nouveaux) ────────────────────────
export { Button, PrimaryButton, OutlineButton, GhostButton, DangerButton } from './Button';
export type { ButtonVariant, ButtonSize } from './Button';

export { Input, Textarea } from './Input';

export { Card, CardHeader, CardTitle, CardDivider } from './Card';
export type { CardVariant, CardPadding } from './Card';

export { PageHeader, SectionTitle } from './PageHeader';

export { EmptyState } from './EmptyState';

export { Spinner, Skeleton, SkeletonCard, SkeletonList, PageLoading } from './Spinner';

export { StaleDataBanner } from './StaleDataBanner';

export { Divider, DataRow } from './Divider';

// ─── Composants existants ────────────────────────────────────
export { Modal, ModalActions, ModalWithConfirm, ModalWithForm } from './Modal';
export { InfoModal } from './InfoModal';
export { InfoRow } from './InfoRow';
export { LoadingSkeleton } from './LoadingSkeleton';
export { LoadingSpinner } from './LoadingSpinner';
export { Logo } from './Logo';
export { Illustration } from './Illustration';
export { RoleBanner } from './RoleBanner';
export { StatusBadge } from './StatusBadge';
export { confirmDialog, ConfirmDialogHost } from './ConfirmDialog';

// ─── Exports default (compatibilité) ────────────────────────
export { default as ModalDefault } from './Modal';
export { default as InfoRowDefault } from './InfoRow';
export { default as ModalFullScreenDefault } from './ModalFullScreen';
export { default as LoadingSpinnerDefault } from './LoadingSpinner';
export { default as LogoDefault } from './Logo';


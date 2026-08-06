// 📁 src/features/visits/components/TargetContextPanel.tsx
// ============================================================
// 👤 CONTEXTE DE LA CIBLE — aidant permanent & forfait
// ============================================================
//
// POURQUOI CE COMPOSANT
// ---------------------
// Deux défauts du formulaire de création qu'il corrige :
//
// 1. L'aidant permanent n'apparaissait nulle part pendant la saisie.
//    Le choix d'aidant ne surgissait qu'APRÈS un échec de création
//    (le backend répondait 422 WIZARD_REQUIRED, ce qui ouvrait le
//    wizard). L'utilisateur remplissait tout, cliquait, puis se
//    faisait interrompre — d'où l'impression qu'il fallait « créer la
//    visite puis cliquer sur un autre bouton pour assigner ».
//
// 2. Le nombre de visites restantes affiché venait du forfait de
//    l'UTILISATEUR CONNECTÉ. Comme la planification est désormais
//    réservée à l'administration, elle voyait son propre forfait au
//    lieu de celui de la famille concernée. Le chiffre était faux.
//
// Ce panneau interroge /visits/target-context dès qu'une cible est
// choisie et affiche la situation réelle AVANT toute validation.
// ============================================================

import { useEffect, useState } from 'react';
import { UserCheck, UserX, AlertTriangle, Ticket, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useBranding } from '@/hooks/useBranding';

// ── Types ────────────────────────────────────────────────────

interface AidantInfo {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  is_available: boolean;
  unavailable_reason: string | null;
}

interface SubscriptionInfo {
  hasActiveSubscription: boolean;
  remainingVisits: number;
  totalVisits: number;
  usedVisits: number;
  endDate: string | null;
}

export interface TargetContext {
  accountUserId: string | null;
  aidant: AidantInfo | null;
  hasPermanentAidant: boolean;
  subscription: SubscriptionInfo;
  availableAidants: any[];
}

interface Props {
  targetType: 'patient' | 'personal_account' | null;
  targetId: string | null;
  /** Remonte le contexte au formulaire parent (pour pré-remplir aidant_id). */
  onContextLoaded?: (ctx: TargetContext | null) => void;
}

// ── Composant ────────────────────────────────────────────────

export const TargetContextPanel = ({ targetType, targetId, onContextLoaded }: Props) => {
  const brand = useBranding();
  const colors = brand.colors;

  const [ctx, setCtx] = useState<TargetContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!targetType || !targetId) {
      setCtx(null);
      onContextLoaded?.(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    api
      .get('/visits/target-context', { params: { targetType, targetId } })
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data || null;
        setCtx(data);
        onContextLoaded?.(data);
      })
      .catch(() => {
        // Échec silencieux : ce panneau est une aide à la décision,
        // il ne doit jamais empêcher de créer une visite.
        if (cancelled) return;
        setCtx(null);
        onContextLoaded?.(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [targetType, targetId]);

  if (!targetType || !targetId) return null;

  if (isLoading) {
    return (
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2.5 border text-[11px]"
        style={{ borderColor: colors.border + '60', color: colors.textLight }}
      >
        <Loader2 size={12} className="animate-spin" />
        Vérification de l'aidant et du forfait…
      </div>
    );
  }

  if (!ctx) return null;

  const { aidant, subscription } = ctx;

  return (
    <div className="space-y-2">
      {/* ── AIDANT ─────────────────────────────────────────── */}
      {aidant ? (
        <div
          className="rounded-xl px-3 py-2.5 border"
          style={{
            borderColor: aidant.is_available ? colors.primary + '35' : '#f59e0b45',
            background: aidant.is_available ? colors.primary + '08' : '#f59e0b0d',
          }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: aidant.is_available ? colors.primary + '18' : '#f59e0b20',
                color: aidant.is_available ? colors.primary : '#b45309',
              }}
            >
              {aidant.is_available ? <UserCheck size={14} /> : <UserX size={14} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: colors.textLight }}>
                Aidant assigné en permanence
              </p>
              <p className="text-xs font-bold truncate" style={{ color: colors.text }}>
                {aidant.full_name}
              </p>
            </div>
          </div>

          {aidant.is_available ? (
            <p className="text-[10px] mt-1.5 pl-[42px]" style={{ color: colors.textLight }}>
              La visite lui sera attribuée automatiquement.
            </p>
          ) : (
            <p className="text-[10px] mt-1.5 pl-[42px] flex items-start gap-1 font-medium" style={{ color: '#b45309' }}>
              <AlertTriangle size={10} className="mt-0.5 shrink-0" />
              {aidant.unavailable_reason} — un remplaçant devra être désigné.
            </p>
          )}
        </div>
      ) : (
        <div
          className="rounded-xl px-3 py-2.5 border text-[11px] flex items-start gap-2"
          style={{ borderColor: colors.border + '60', color: colors.textLight }}
        >
          <UserX size={12} className="mt-0.5 shrink-0" />
          <span>
            Aucun aidant permanent.{' '}
            {ctx.availableAidants?.length > 0
              ? `${ctx.availableAidants.length} aidant(s) disponible(s) — le choix sera proposé à la validation.`
              : 'La visite partira en attente d\'attribution.'}
          </span>
        </div>
      )}

      {/* ── FORFAIT DU COMPTE CIBLE ────────────────────────── */}
      <div
        className="rounded-xl px-3 py-2.5 border flex items-center gap-2.5"
        style={{
          borderColor: subscription.remainingVisits > 0 ? '#16a34a35' : '#f59e0b45',
          background: subscription.remainingVisits > 0 ? '#16a34a08' : '#f59e0b0d',
        }}
      >
        <span
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: subscription.remainingVisits > 0 ? '#16a34a18' : '#f59e0b20',
            color: subscription.remainingVisits > 0 ? '#15803d' : '#b45309',
          }}
        >
          <Ticket size={14} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: colors.textLight }}>
            Forfait du compte concerné
          </p>
          {subscription.hasActiveSubscription ? (
            <p className="text-xs font-bold" style={{ color: colors.text }}>
              {subscription.remainingVisits} visite{subscription.remainingVisits > 1 ? 's' : ''} restante
              {subscription.remainingVisits > 1 ? 's' : ''}
              <span className="font-medium" style={{ color: colors.textLight }}>
                {' '}sur {subscription.totalVisits}
              </span>
            </p>
          ) : (
            <p className="text-xs font-bold" style={{ color: '#b45309' }}>
              Aucun forfait actif — visite payante
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TargetContextPanel;

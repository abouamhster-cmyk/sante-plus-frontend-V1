// 📁 src/components/ui/ConfirmDialog.tsx
// ============================================================
// 🎨 DIALOGUE DE CONFIRMATION AUX COULEURS DE LA MARQUE
// ============================================================
//
// POURQUOI CE FICHIER
// -------------------
// L'application utilisait `window.confirm()` à 18 endroits. Problèmes :
//   • Boîte grise native du navigateur — aucun rapport avec votre design ;
//   • En PWA installée sur mobile, elle affiche souvent le nom de domaine,
//     ce qui fait « site web » et casse l'illusion d'application ;
//   • Impossible de distinguer une action anodine d'une suppression
//     définitive : même apparence pour tout ;
//   • Bloque le thread principal du navigateur ;
//   • Textes des boutons non traduisibles (« OK » / « Cancel »).
//
// UTILISATION — identique à window.confirm, en asynchrone :
//
//   if (!(await confirmDialog('Supprimer cette offre ?'))) return;
//
// Version enrichie :
//
//   const ok = await confirmDialog({
//     title: 'Supprimer cette offre ?',
//     message: 'Cette action est définitive.',
//     confirmLabel: 'Supprimer',
//     variant: 'danger',
//   });
//
// ============================================================

import { useEffect, useState } from 'react';
import { AlertTriangle, Trash2, HelpCircle, X } from 'lucide-react';

export type ConfirmVariant = 'default' | 'danger' | 'warning';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

type PendingConfirm = ConfirmOptions & { resolve: (v: boolean) => void };

// ------------------------------------------------------------
// Petit bus d'événements : permet d'appeler confirmDialog() depuis
// n'importe où (y compris hors composant React), comme window.confirm.
// ------------------------------------------------------------
let listener: ((c: PendingConfirm | null) => void) | null = null;

/**
 * Remplaçant de window.confirm.
 * @returns true si l'utilisateur confirme, false sinon.
 */
export const confirmDialog = (options: string | ConfirmOptions): Promise<boolean> => {
  const opts: ConfirmOptions =
    typeof options === 'string' ? { title: options } : options;

  return new Promise<boolean>((resolve) => {
    // Filet de sécurité : si l'hôte n'est pas monté, on retombe sur le
    // confirm natif plutôt que de bloquer l'utilisateur indéfiniment.
    if (!listener) {
      resolve(window.confirm(opts.message ? `${opts.title}\n\n${opts.message}` : opts.title));
      return;
    }
    listener({ ...opts, resolve });
  });
};

// ------------------------------------------------------------
// Hôte à monter UNE SEULE FOIS, à la racine de l'application.
// ------------------------------------------------------------
export const ConfirmDialogHost = () => {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  useEffect(() => {
    listener = setPending;
    return () => {
      listener = null;
    };
  }, []);

  // Fermeture au clavier (Échap = annuler, Entrée = confirmer).
  // Le confirm natif le faisait ; il ne faut pas régresser sur ce point.
  useEffect(() => {
    if (!pending) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    };
    document.addEventListener('keydown', onKey);

    // Empêche le défilement de l'arrière-plan pendant l'ouverture.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const close = (result: boolean) => {
    if (!pending) return;
    pending.resolve(result);
    setPending(null);
  };

  if (!pending) return null;

  const variant: ConfirmVariant = pending.variant || 'default';

  const palette = {
    default: {
      accent: 'var(--color-primary, #1a4a3a)',
      soft: 'rgba(26, 74, 58, 0.08)',
      Icon: HelpCircle,
    },
    warning: {
      accent: '#b45309',
      soft: 'rgba(180, 83, 9, 0.10)',
      Icon: AlertTriangle,
    },
    danger: {
      accent: '#dc2626',
      soft: 'rgba(220, 38, 38, 0.10)',
      Icon: Trash2,
    },
  }[variant];

  const Icon = palette.Icon;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      {/* Fond assombri — un clic dessus annule, comme attendu partout ailleurs */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-fadeIn"
        onClick={() => close(false)}
      />

      {/* Feuille en bas sur mobile (pouce accessible), carte centrée sur desktop */}
      <div className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-xl p-5 animate-slideUp">
        <button
          type="button"
          onClick={() => close(false)}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Fermer"
        >
          <X size={18} />
        </button>

        <div
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: palette.soft }}
        >
          <Icon size={22} style={{ color: palette.accent }} />
        </div>

        <h2
          id="confirm-title"
          className="text-center text-sm font-extrabold mb-1.5"
          style={{ color: 'var(--color-text, #1f2937)' }}
        >
          {pending.title}
        </h2>

        {pending.message && (
          <p className="text-center text-[11px] leading-relaxed text-gray-500 mb-4">
            {pending.message}
          </p>
        )}

        {/* Annuler à GAUCHE et en secondaire : l'action destructrice ne doit
            jamais être celle qu'on touche par réflexe. */}
        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={() => close(false)}
            className="flex-1 h-11 rounded-2xl border text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
            style={{ borderColor: '#e5e7eb' }}
          >
            {pending.cancelLabel || 'Annuler'}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => close(true)}
            className="flex-1 h-11 rounded-2xl text-white text-xs font-bold hover:opacity-90 transition-opacity"
            style={{ background: palette.accent }}
          >
            {pending.confirmLabel || 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialogHost;

// 📁 src/lib/sentry.ts
// ============================================================
// 🔍 SUPERVISION DES ERREURS — SENTRY
// ============================================================
//
// POURQUOI CE FICHIER
// -------------------
// Jusqu'ici, aucune erreur survenue chez un utilisateur n'était remontée.
// Les bugs se découvraient un par un, en fouillant les logs, et uniquement
// ceux que vous rencontriez vous-même. Tous les autres — création de visite
// bloquée, assignation d'aidant en échec, redirection de paiement cassée —
// échouaient EN SILENCE chez vos utilisateurs.
//
// Sentry renverse ça : vous recevez un email avec la ligne exacte, la trace
// complète et le nombre d'utilisateurs touchés, dans la minute.
//
// ⚠️ DONNÉES DE SANTÉ — TRÈS IMPORTANT
// -------------------------------------
// Un outil de supervision capture par défaut BEAUCOUP de contexte : URLs,
// corps de requêtes, saisies clavier, contenu de l'écran. Sur une
// application de santé, cela reviendrait à exporter des données médicales
// vers un service tiers.
//
// Ce fichier est donc configuré de façon volontairement restrictive :
//   • `sendDefaultPii: false`  → pas d'IP, pas d'identité utilisateur brute
//   • `beforeSend`             → masque mots de passe, jetons, données patients
//   • Replay désactivé         → aucun enregistrement d'écran
//   • URLs nettoyées           → les identifiants sont retirés des chemins
//
// Vos DSN pointent vers `ingest.de.sentry.io` : les données restent
// hébergées dans l'Union européenne. C'est le bon choix ici.
// ============================================================

import * as Sentry from '@sentry/react';

// Le DSN n'est PAS un secret : il ne permet que d'ENVOYER des erreurs,
// jamais d'en lire. Il est de toute façon présent dans le bundle public.
const SENTRY_DSN =
  import.meta.env.VITE_SENTRY_DSN ||
  'https://0f451f70278111feaa8e8172432786fc@o4511837233807360.ingest.de.sentry.io/4511838087675984';

// Champs à masquer avant tout envoi.
const SENSITIVE_KEYS = [
  'password', 'motdepasse', 'mot_de_passe', 'pass', 'pwd',
  'token', 'access_token', 'refresh_token', 'authorization', 'auth', 'apikey', 'api_key',
  'secret', 'key', 'pin', 'cvv', 'card', 'iban',
  'email', 'phone', 'telephone', 'adresse', 'address',
  'birth_date', 'date_naissance', 'age',
  'allergies', 'treatments', 'conditions', 'medical_history', 'notes',
  'diagnostic', 'report', 'prescription_url', 'first_name', 'last_name', 'full_name',
];

const isSensitive = (key: string) =>
  SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k));

/** Masque récursivement les champs sensibles d'un objet. */
const redact = (value: any, depth = 0): any => {
  if (depth > 4 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 10).map((v) => redact(v, depth + 1));
  if (typeof value !== 'object') return value;

  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = isSensitive(k) ? '[MASQUÉ]' : redact(v, depth + 1);
  }
  return out;
};

/**
 * Retire les identifiants des URLs.
 * /app/visits/1f4dd0f9-5e5a-4cc4-819f-dc870a1a5835 → /app/visits/:id
 * Cela permet de REGROUPER les erreurs d'une même page au lieu d'en créer
 * une nouvelle pour chaque visite, et évite de transmettre des identifiants.
 */
const anonymizeUrl = (url: string): string =>
  url
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\?.*$/, '');

export const initSentry = () => {
  // En développement, on ne pollue pas le quota ni le tableau de bord.
  if (import.meta.env.DEV) {
    console.log('ℹ️ Sentry désactivé en développement');
    return;
  }

  if (!SENTRY_DSN) {
    console.warn('⚠️ VITE_SENTRY_DSN absent — supervision désactivée');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,

    // 🔒 Aucune donnée personnelle par défaut (IP, identité...).
    sendDefaultPii: false,

    // Échantillonnage des traces de performance. 10 % suffit largement et
    // préserve votre quota gratuit (5 000 événements/mois).
    tracesSampleRate: 0.1,

    // ⚠️ Session Replay volontairement NON activé : il enregistre l'écran
    // de l'utilisateur. Sur une app de santé, cela capturerait des dossiers
    // patients. Ne l'activez pas sans analyse juridique préalable.

    // Erreurs à ignorer : bruit sans valeur diagnostique.
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
      // Coupures réseau : fréquentes en mobilité, déjà gérées par l'interface
      'Network Error',
      'Failed to fetch',
      'NetworkError when attempting to fetch resource',
      'Load failed',
      // Extensions de navigateur
      'top.GLOBALS',
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
    ],

    // 🔒 Dernier filtre avant envoi.
    beforeSend(event) {
      // 1. Anonymiser l'URL
      if (event.request?.url) {
        event.request.url = anonymizeUrl(event.request.url);
      }

      // 2. Ne jamais transmettre le corps des requêtes ni les cookies
      if (event.request) {
        delete event.request.cookies;
        delete (event.request as any).data;
        delete event.request.headers;
      }

      // 3. Masquer les champs sensibles du contexte additionnel
      if (event.extra) event.extra = redact(event.extra);
      if (event.contexts) event.contexts = redact(event.contexts);

      // 4. Ne garder que l'identifiant utilisateur — jamais email ni nom.
      //    Il permet de mesurer combien de personnes sont touchées sans
      //    exposer leur identité.
      if (event.user) {
        event.user = { id: event.user.id };
      }

      // 5. Nettoyer le fil d'Ariane (navigation, appels réseau)
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((b) => {
          if (b.data?.url) b.data.url = anonymizeUrl(String(b.data.url));
          if (b.data) b.data = redact(b.data);
          return b;
        });
      }

      return event;
    },
  });

  console.log('✅ Supervision Sentry active');
};

/**
 * Associe l'utilisateur courant aux erreurs — UNIQUEMENT son identifiant.
 * À appeler après connexion.
 */
export const setSentryUser = (userId: string | null, role?: string) => {
  if (import.meta.env.DEV) return;
  if (!userId) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: userId });
  if (role) Sentry.setTag('role', role);
};

/** Signale une erreur manuellement, avec un contexte assaini. */
export const reportError = (error: unknown, context?: Record<string, any>) => {
  if (import.meta.env.DEV) {
    console.error('❌ [dev]', error, context);
    return;
  }
  Sentry.captureException(error, context ? { extra: redact(context) } : undefined);
};

export { Sentry };

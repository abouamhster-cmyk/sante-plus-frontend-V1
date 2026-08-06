// 📁 src/lib/cache.ts
// ============================================================
// 🗄️ GESTION CENTRALISÉE DU CACHE LOCAL
// ============================================================
//
// POURQUOI CE FICHIER
// -------------------
// Chaque store réimplémentait son propre cache localStorage avec sa
// propre clé, sa propre durée et son propre try/catch. Résultat :
//
//   1. Aucun cache n'était supprimé à la déconnexion (sauf 'auth-storage').
//      Sur un téléphone partagé — courant au Bénin — l'utilisateur suivant
//      pouvait lire les noms, adresses et données de santé du précédent
//      via localStorage. C'est le problème le plus grave corrigé ici.
//
//   2. Hors ligne, le cache n'était utilisé que s'il avait moins de 60 s.
//      Passé ce délai, l'app affichait une page vide alors que les données
//      étaient là. Inutilisable dans le train, l'ascenseur ou en zone blanche.
//
//   3. Rien n'indiquait à l'utilisateur qu'il regardait des données périmées.
//
// PRINCIPE RETENU : « stale-while-revalidate »
// --------------------------------------------
//   • Cache FRAIS (< durée définie)  → on l'affiche, on ne recharge pas.
//   • Cache PÉRIMÉ mais EN LIGNE     → on l'affiche IMMÉDIATEMENT, puis on
//                                      recharge en fond et on remplace.
//                                      L'utilisateur ne voit jamais de page vide.
//   • Cache PÉRIMÉ et HORS LIGNE     → on l'affiche quand même, avec la date
//                                      de dernière mise à jour.
//   • Pas de cache et HORS LIGNE     → message clair, pas d'écran blanc.
//
// Le cache ne bloque JAMAIS l'arrivée de données fraîches : dès qu'une
// requête réseau réussit, elle écrase le cache.
// ============================================================

// ─── Préfixe commun : permet de tout purger d'un coup ────────
const CACHE_PREFIX = 'sante_plus_';

// ─── Durées de fraîcheur par type de donnée ──────────────────
// Une offre commerciale change rarement ; une notification, souvent.
export const CACHE_TTL = {
  SHORT: 30 * 1000,        // 30 s  — notifications
  DEFAULT: 60 * 1000,      // 1 min — visites, commandes, patients
  LONG: 5 * 60 * 1000,     // 5 min — offres, paramètres
} as const;

// ─── Structure stockée ───────────────────────────────────────
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  /** Identifiant du propriétaire : empêche de servir le cache
   *  d'un utilisateur à un autre si la purge a échoué. */
  userId?: string;
}

export interface CacheResult<T> {
  data: T;
  timestamp: number;
  /** true si la donnée a dépassé sa durée de fraîcheur */
  isStale: boolean;
}

// ============================================================
// LECTURE
// ============================================================

/**
 * Lit une entrée de cache.
 * Retourne toujours la donnée si elle existe, avec un indicateur
 * `isStale` — c'est à l'appelant de décider quoi en faire.
 * Ne retourne jamais le cache d'un autre utilisateur.
 */
export const readCache = <T>(
  key: string,
  ttl: number = CACHE_TTL.DEFAULT,
  userId?: string
): CacheResult<T> | null => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);
    if (!entry || entry.data === undefined) return null;

    // Sécurité : ne jamais servir le cache d'un autre compte.
    if (userId && entry.userId && entry.userId !== userId) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    return {
      data: entry.data,
      timestamp: entry.timestamp,
      isStale: Date.now() - entry.timestamp > ttl,
    };
  } catch {
    // JSON corrompu ou localStorage indisponible (mode privé Safari) :
    // on se comporte comme s'il n'y avait pas de cache.
    return null;
  }
};

// ============================================================
// ÉCRITURE
// ============================================================

/**
 * Écrit une entrée de cache. Silencieux en cas d'échec :
 * un quota localStorage plein ne doit jamais casser l'application.
 */
export const writeCache = <T>(key: string, data: T, userId?: string): void => {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      userId,
    };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch (err: any) {
    // QuotaExceededError : on fait de la place en supprimant les caches
    // les plus anciens, puis on réessaie une fois.
    if (err?.name === 'QuotaExceededError') {
      evictOldestCaches();
      try {
        localStorage.setItem(
          CACHE_PREFIX + key,
          JSON.stringify({ data, timestamp: Date.now(), userId })
        );
      } catch {
        /* on abandonne : l'app fonctionne sans cache */
      }
    }
  }
};

// ============================================================
// SUPPRESSION
// ============================================================

/** Supprime une entrée précise (ex. après une mutation). */
export const invalidateCache = (key: string): void => {
  try {
    localStorage.removeItem(CACHE_PREFIX + key);
  } catch {
    /* ignore */
  }
};

/**
 * Supprime TOUS les caches de données applicatives.
 * ⚠️ À appeler impérativement à la déconnexion : sans cela, les données
 * de santé du compte précédent restent lisibles sur un appareil partagé.
 *
 * Les préférences d'appareil (son des notifications, thème) sont
 * volontairement conservées : ce sont des réglages du téléphone,
 * pas des données personnelles, et les réinitialiser à chaque
 * déconnexion serait pénible pour l'utilisateur.
 */
const PRESERVED_KEYS = ['sante_plus_preferences', 'sante_plus_theme'];

export const clearAllCaches = (): void => {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (PRESERVED_KEYS.includes(k)) continue;
      if (k.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
};

/** Supprime les 3 entrées les plus anciennes pour libérer du quota. */
const evictOldestCaches = (): void => {
  try {
    const entries: { key: string; timestamp: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(CACHE_PREFIX)) continue;
      try {
        const parsed = JSON.parse(localStorage.getItem(k) || '{}');
        entries.push({ key: k, timestamp: parsed.timestamp || 0 });
      } catch {
        entries.push({ key: k, timestamp: 0 });
      }
    }
    entries
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, 3)
      .forEach((e) => localStorage.removeItem(e.key));
  } catch {
    /* ignore */
  }
};

// ============================================================
// ÉTAT RÉSEAU
// ============================================================

/**
 * `navigator.onLine` ment : il indique seulement qu'une interface réseau
 * existe, pas qu'Internet est joignable. Un wifi capté sans connexion
 * réelle renvoie `true`. On s'en sert uniquement comme signal négatif :
 * quand il dit `false`, on est certainement hors ligne.
 */
export const isOffline = (): boolean =>
  typeof navigator !== 'undefined' && navigator.onLine === false;

// ============================================================
// AFFICHAGE
// ============================================================

/** Formate l'ancienneté d'un cache pour l'utilisateur. */
export const formatCacheAge = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "à l'instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'hier' : `il y a ${days} jours`;
};

// ─── Clés utilisées par les stores ───────────────────────────
export const CACHE_KEYS = {
  VISITS: 'visits_cache',
  ORDERS: 'orders_cache',
  PATIENTS: 'patients_cache',
  NOTIFICATIONS: 'notifications_cache',
  OFFERS: 'offers_cache',
  JOURNAL_ENTRIES: 'journal_entries_cache',
  JOURNAL_STATS: 'journal_stats_cache',
  SUBSCRIPTIONS: 'subscriptions_cache',
  DISCHARGES: 'discharges_cache',
} as const;

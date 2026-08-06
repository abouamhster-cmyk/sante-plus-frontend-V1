// 📁 src/stores/offerStore.ts

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Offer } from '@/types';
import {
  readCache,
  writeCache,
  invalidateCache,
  isOffline,
  CACHE_KEYS,
  CACHE_TTL,
} from '@/lib/cache';

 
interface OfferState {
  offers: Offer[];
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
  lastUpdated: number | null;

  // Actions
  fetchOffers: () => Promise<void>;
  getOfferById: (id: string) => Offer | undefined;
  getOffersByCategory: (category: Offer['category']) => Offer[];
  getPonctualOffers: () => Offer[];
  getSubscriptionOffers: () => Offer[];
  refresh: () => Promise<void>;
  clearCache: () => void;
}


// ✅ URL UNIQUE
const API_URL = import.meta.env.VITE_API_URL || 'https://app-react-back.onrender.com/api';

export const useOfferStore = create<OfferState>((set, get) => ({
  offers: [],
  isLoading: false,
  error: null,
  isInitialized: false,
  lastUpdated: null,

  // ✅ fetchOffers - SANS TOAST
  // ============================================================
  // CHARGEMENT DES OFFRES — « stale-while-revalidate »
  // ============================================================
  // Les offres ne sont pas liées à un utilisateur (catalogue public),
  // le cache n'est donc pas cloisonné par compte.
  fetchOffers: async () => {
    const { isInitialized, lastUpdated } = get();

    const cached = readCache<Offer[]>(CACHE_KEYS.OFFERS, CACHE_TTL.LONG);

    // ── 1. Cache mémoire encore frais ────────────────────────
    if (isInitialized && lastUpdated && Date.now() - lastUpdated < CACHE_TTL.LONG) {
      return;
    }

    // ── 2. Cache disque frais ────────────────────────────────
    if (cached && !cached.isStale) {
      set({
        offers: cached.data,
        isLoading: false,
        isInitialized: true,
        lastUpdated: cached.timestamp,
        error: null,
      });
      return;
    }

    // ── 3. Hors ligne : servir le cache quel que soit son âge ──
    if (isOffline()) {
      if (cached) {
        set({
          offers: cached.data,
          isLoading: false,
          isInitialized: true,
          lastUpdated: cached.timestamp,
          error: null,
        });
      } else {
        set({
          isLoading: false,
          isInitialized: true,
          error: 'Catalogue indisponible hors ligne.',
        });
      }
      return;
    }

    // ── 4. Cache périmé mais en ligne : affichage immédiat ────
    if (cached && cached.data.length > 0) {
      set({
        offers: cached.data,
        isLoading: false,
        isInitialized: true,
        lastUpdated: cached.timestamp,
      });
    } else {
      set({ isLoading: true });
    }

    // ── 5. Rechargement réseau ───────────────────────────────
    try {
      set({ error: null });

      const response = await fetch(`${API_URL}/offers`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors du chargement des offres');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Erreur inconnue');
      }

      const offers: Offer[] = result.data || [];
      writeCache(CACHE_KEYS.OFFERS, offers);

      set({
        offers,
        isLoading: false,
        isInitialized: true,
        lastUpdated: Date.now(),
        error: null,
      });

    } catch (error: any) {
      // On garde le catalogue affiché plutôt que de vider l'écran.
      if (cached && cached.data.length > 0) {
        set({
          offers: cached.data,
          isLoading: false,
          isInitialized: true,
          lastUpdated: cached.timestamp,
          error: null,
        });
        return;
      }

      set({
        error: error.message,
        isLoading: false,
        isInitialized: true,
      });
    }
  },

  getOfferById: (id: string) => {
    const { offers } = get();
    return offers.find(offer => offer.id === id);
  },

  getOffersByCategory: (category: Offer['category']) => {
    const { offers } = get();
    return offers.filter(offer => offer.category === category);
  },

  getPonctualOffers: () => {
    const { offers } = get();
    return offers.filter(offer =>
      offer.category === 'ponctuelle' ||
      offer.type === 'ponctuelle' ||
      offer.id?.startsWith('ponctual-') ||
      offer.id === 'b4b01a84-1b0c-4973-9e58-43945c1c4991' ||
      offer.id === '6e4ba26d-98c5-4e29-a129-f33a828f0b44'
    );
  },

  getSubscriptionOffers: () => {
    const { offers } = get();
    return offers.filter(offer =>
      offer.category !== 'ponctuelle' &&
      offer.type !== 'ponctuelle' &&
      !offer.id?.startsWith('ponctual-')
    );
  },

  refresh: async () => {
    // ✅ Forcer le rechargement (vider le cache)
    invalidateCache(CACHE_KEYS.OFFERS);
    await get().fetchOffers();
  },

  clearCache: () => {
    invalidateCache(CACHE_KEYS.OFFERS);
    set({
      offers: [],
      isInitialized: false,
      lastUpdated: null,
    });
  },
}));

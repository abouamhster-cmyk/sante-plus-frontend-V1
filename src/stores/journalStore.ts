// 📁 src/stores/journalStore.ts

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { JournalEntry, JournalStats } from '@/types';
import { useAuthStore } from './authStore';
import {
  readCache,
  writeCache,
  invalidateCache as removeCacheEntry,
  isOffline,
  CACHE_KEYS,
  CACHE_TTL,
} from '@/lib/cache';

 
// =============================================
// HELPERS DE CACHE
// =============================================

// Cache délégué au module centralisé src/lib/cache.ts

const getCachedEntries = (userId?: string) =>
  readCache<JournalEntry[]>(CACHE_KEYS.JOURNAL_ENTRIES, CACHE_TTL.DEFAULT, userId);

const setCachedEntries = (entries: JournalEntry[], userId?: string) =>
  writeCache(CACHE_KEYS.JOURNAL_ENTRIES, entries, userId);

const clearCachedEntries = () => removeCacheEntry(CACHE_KEYS.JOURNAL_ENTRIES);

const getCachedStats = (userId?: string) =>
  readCache<JournalStats>(CACHE_KEYS.JOURNAL_STATS, CACHE_TTL.DEFAULT, userId);

const setCachedStats = (stats: JournalStats, userId?: string) =>
  writeCache(CACHE_KEYS.JOURNAL_STATS, stats, userId);

const clearCachedStats = () => removeCacheEntry(CACHE_KEYS.JOURNAL_STATS);

// =============================================
// STORE
// =============================================

interface JournalState {
  entries: JournalEntry[];
  stats: JournalStats | null;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
  lastFetch: number | null;
  isStaleData: boolean;
  cacheTimestamp: number | null;
  isCacheInvalidated: boolean;
  
  fetchEntries: (force?: boolean, patientId?: string) => Promise<void>;
  fetchStats: (force?: boolean, patientId?: string) => Promise<void>;
  addRating: (visitId: string, rating: number, feedback: string) => Promise<void>;
  getEntriesByDate: (date: string) => JournalEntry[];
  getEntriesByWeek: () => { week: string; entries: JournalEntry[] }[];
  
  invalidateCache: () => void;
  refresh: () => Promise<void>;
  clearError: () => void;
}

export const useJournalStore = create<JournalState>((set, get) => ({
  entries: [],
  stats: null,
  isLoading: false,
  error: null,
  isInitialized: false,
  lastFetch: null,
  isStaleData: false,
  cacheTimestamp: null,
  isCacheInvalidated: false,

  invalidateCache: () => {
    clearCachedEntries();
    clearCachedStats();
    set({ 
      isCacheInvalidated: true,
      isInitialized: false,
      lastFetch: null,
    });
    console.log('🔄 Cache journal invalidé');
  },

  refresh: async () => {
    get().invalidateCache();
    await get().fetchEntries(true);
    await get().fetchStats(true);
  },

  // =============================================
  // FETCH ENTRIES - AVEC CACHE ET AIDANTS - SANS TOAST
  // =============================================
  fetchEntries: async (force = false, patientId?: string) => {
    const state = get();
    
    if (state.isLoading) {
      console.log('ℹ️ Déjà en cours de chargement, skip...');
      return;
    }

    if (state.isCacheInvalidated) {
      force = true;
    }

    if (patientId) {
      force = true;
    }

    const { user, profile } = useAuthStore.getState();
    if (!user) {
      set({ entries: [], isLoading: false, isInitialized: true });
      return;
    }

    const cached = getCachedEntries(user.id);

    // ── 1. Cache frais ───────────────────────────────────────
    if (!force && cached && !cached.isStale) {
      set({
        entries: cached.data,
        isLoading: false,
        isInitialized: true,
        lastFetch: cached.timestamp,
        cacheTimestamp: cached.timestamp,
        isStaleData: false,
        isCacheInvalidated: false,
      });
      return;
    }

    // ── 2. Hors ligne : servir le cache quel que soit son âge ──
    if (isOffline()) {
      if (cached) {
        set({
          entries: cached.data,
          isLoading: false,
          isInitialized: true,
          cacheTimestamp: cached.timestamp,
          isStaleData: true,
          error: null,
        });
      } else {
        set({ isLoading: false, isInitialized: true, error: 'Aucune donnée disponible hors ligne.' });
      }
      return;
    }

    // ── 3. Cache périmé mais en ligne : affichage immédiat ────
    if (cached && cached.data.length > 0) {
      set({
        entries: cached.data,
        cacheTimestamp: cached.timestamp,
        isStaleData: true,
        isInitialized: true,
        isLoading: false,
      });
    } else {
      set({ isLoading: true });
    }

    try {
      set({ error: null, isCacheInvalidated: false });

      // ✅ ÉTAPE 1 : Récupérer les visites
      let query = supabase
        .from('visites')
        .select('*')
        .in('status', ['terminee', 'validee']);

      if (profile?.role === 'family') {
        const { data: links } = await supabase
          .from('patient_family_links')
          .select('patient_id')
          .eq('family_id', user.id);

        const patientIds = links?.map(l => l.patient_id) || [];
        if (patientIds.length > 0) {
          query = query.in('patient_id', patientIds);
        } else {
          set({ entries: [], isLoading: false, isInitialized: true });
          return;
        }
      }

      if (patientId) {
        query = query.eq('patient_id', patientId);
      }

      const { data: visits, error } = await query
        .order('scheduled_date', { ascending: false })
        .order('scheduled_time', { ascending: false });

      if (error) throw error;

      // ✅ ÉTAPE 2 : Récupérer les patients
      const patientIds = [...new Set(visits?.map(v => v.patient_id).filter(Boolean))];
      let patientMap: Record<string, any> = {};

      if (patientIds.length > 0) {
        const { data: patients } = await supabase
          .from('patients')
          .select('*')
          .in('id', patientIds);
        if (patients) {
          patientMap = patients.reduce((acc, p) => {
            acc[p.id] = p;
            return acc;
          }, {} as Record<string, any>);
        }
      }

      // ✅ ÉTAPE 3 : Récupérer les aidants AVEC LEURS PROFILS
      const aidantIds = [...new Set(visits?.map(v => v.aidant_id).filter(Boolean))];
      let aidantMap: Record<string, any> = {};

      if (aidantIds.length > 0) {
        // aidants_catalog : vue sans données sensibles, accessible famille + aidant
        const { data: aidants, error: aidantsError } = await supabase
          .from('aidants_catalog')
          .select(`
            id,
            user_id,
            specialties,
            available,
            rating,
            total_missions,
            completed_missions,
            cancelled_missions,
            user:profiles (
              id,
              full_name,
              email,
              phone,
              avatar_url
            )
          `)
          .in('id', aidantIds);

        if (aidantsError) {
          console.error('❌ Erreur récupération aidants:', aidantsError);
        }

        if (aidants) {
          aidantMap = aidants.reduce((acc, a) => {
            acc[a.id] = a;
            return acc;
          }, {} as Record<string, any>);
        }
      }

      // ✅ ÉTAPE 4 : Récupérer les photos
      const visitIds = visits?.map(v => v.id) || [];
      let photosMap: Record<string, any[]> = {};

      if (visitIds.length > 0) {
        const { data: photos, error: photosError } = await supabase
          .from('visite_photos')
          .select('*')
          .in('visite_id', visitIds);
        
        if (photosError) {
          console.error('❌ Erreur récupération photos:', photosError);
        }

        if (photos) {
          photosMap = photos.reduce((acc, p) => {
            if (!acc[p.visite_id]) acc[p.visite_id] = [];
            acc[p.visite_id].push(p);
            return acc;
          }, {} as Record<string, any[]>);
        }
      }

      // ✅ ÉTAPE 5 : Fusionner toutes les données
      const entries: JournalEntry[] = (visits || []).map((visit: any) => {
        const photos = photosMap[visit.id] || [];
        return {
          id: visit.id,
          visit_id: visit.id,
          visit: visit,
          patient_id: visit.patient_id,
          proche_id: visit.patient_id,
          patient: visit.patient_id ? patientMap[visit.patient_id] || null : null,
          proche: visit.patient_id ? patientMap[visit.patient_id] || null : null,
          aidant_id: visit.aidant_id,
          aidant: visit.aidant_id ? aidantMap[visit.aidant_id] || null : null,
          date: visit.scheduled_date,
          time: visit.scheduled_time,
          actions: visit.actions || [],
          notes: visit.notes || visit.report || null,
          photos: photos.map((p: any) => p.photo_url) || [],
          audio_url: visit.metadata?.audio_url || null,
          status: visit.status,
          rating: visit.family_rating || null,
          feedback: visit.family_feedback || null,
          created_at: visit.created_at,
          updated_at: visit.updated_at,
        };
      });

      // ✅ Mettre en cache
      setCachedEntries(entries, user.id);
      
      set({ 
        entries, 
        isLoading: false,
        isInitialized: true,
        lastFetch: Date.now(),
        cacheTimestamp: Date.now(),
        isStaleData: false,
        isCacheInvalidated: false,
      });
    } catch (error: any) {
      
      if (cached && cached.data.length > 0) {
        set({
          entries: cached.data,
          isLoading: false,
          isInitialized: true,
          cacheTimestamp: cached.timestamp,
          isStaleData: true,
          error: null,
        });
      } else {
        set({ error: error.message, isLoading: false, isInitialized: true });
      }
    }
  },

  // =============================================
  // FETCH STATS - SANS TOAST
  // =============================================
  fetchStats: async (force = false, patientId?: string) => {
    const state = get();
    
    if (state.isLoading) {
      console.log('ℹ️ Déjà en cours de chargement, skip...');
      return;
    }

    if (state.isCacheInvalidated) {
      force = true;
    }

    if (patientId) {
      force = true;
    }

    const cachedStats = getCachedStats();

    // Cache frais, ou hors ligne : on sert le cache.
    if (cachedStats && (!force && !cachedStats.isStale || isOffline())) {
      set({
        stats: cachedStats.data,
        isLoading: false,
        isInitialized: true,
        lastFetch: cachedStats.timestamp,
        cacheTimestamp: cachedStats.timestamp,
        isStaleData: cachedStats.isStale,
        isCacheInvalidated: false,
      });
      return;
    }

    try {
      const { entries } = get();
      
      const validatedEntries = entries.filter(e => e.status === 'validee');
      const totalVisits = entries.length;
      const validatedVisits = validatedEntries.length;
      const pendingVisits = entries.filter(e => e.status === 'terminee').length;
      
      const ratings = validatedEntries.filter(e => e.rating !== null).map(e => e.rating || 0);
      const averageRating = ratings.length > 0 
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length 
        : 0;

      const aidants = new Set(entries.map(e => e.aidant_id).filter(Boolean));
      
      const weeks: Record<string, number> = {};
      entries.forEach(entry => {
        const date = new Date(entry.date);
        const week = `${date.getFullYear()}-W${getWeekNumber(date)}`;
        weeks[week] = (weeks[week] || 0) + 1;
      });

      const visitsByWeek = Object.entries(weeks).map(([week, count]) => ({
        week,
        count,
      }));

      const actionsFreq: Record<string, number> = {};
      entries.forEach(entry => {
        entry.actions.forEach(action => {
          actionsFreq[action] = (actionsFreq[action] || 0) + 1;
        });
      });

      const actionsFrequency = Object.entries(actionsFreq)
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const stats: JournalStats = {
        total_visits: totalVisits,
        validated_visits: validatedVisits,
        pending_visits: pendingVisits,
        average_rating: averageRating,
        total_aidants: aidants.size,
        visits_by_week: visitsByWeek,
        actions_frequency: actionsFrequency,
      };

      setCachedStats(stats, user.id);
      
      set({
        stats,
        isLoading: false,
        isInitialized: true,
        lastFetch: Date.now(),
        isCacheInvalidated: false,
      });
    } catch (error: any) {
      console.error('❌ Fetch stats error:', error);
      
      if (cachedStats && cachedStats.data) {
        set({
          stats: cachedStats.data,
          isLoading: false,
          isInitialized: true,
          cacheTimestamp: cachedStats.timestamp,
          isStaleData: true,
          error: null,
        });
      } else {
        set({ error: error.message, isLoading: false, isInitialized: true });
      }
    }
  },

  // =============================================
  // ADD RATING - SANS TOAST
  // =============================================
  addRating: async (visitId: string, rating: number, feedback: string) => {
    try {
      const { user } = useAuthStore.getState();
      if (!user) throw new Error('Non connecté');

      const { error } = await supabase
        .from('visites')
        .update({
          family_rating: rating,
          family_feedback: feedback,
          updated_at: new Date().toISOString(),
        })
        .eq('id', visitId);

      if (error) throw error;

      get().invalidateCache();
      await get().fetchEntries(true);
      await get().fetchStats(true);

      set((state) => ({
        entries: state.entries.map(entry =>
          entry.visit_id === visitId
            ? { ...entry, rating, feedback }
            : entry
        ),
      }));

      // ✅ SUPPRIMÉ : toast.success('Merci pour votre évaluation !');
    } catch (error: any) {
      console.error('❌ Add rating error:', error);
      set({ error: error.message });
      throw error;
    }
  },

  getEntriesByDate: (date: string) => {
    const { entries } = get();
    return entries.filter(entry => entry.date === date);
  },

  getEntriesByWeek: () => {
    const { entries } = get();
    const weeks: Record<string, JournalEntry[]> = {};
    
    entries.forEach(entry => {
      const date = new Date(entry.date);
      const week = `${date.getFullYear()}-W${getWeekNumber(date)}`;
      if (!weeks[week]) weeks[week] = [];
      weeks[week].push(entry);
    });

    return Object.entries(weeks)
      .map(([week, entries]) => ({ week, entries }))
      .sort((a, b) => b.week.localeCompare(a.week));
  },

  clearError: () => set({ error: null }),
}));

function getWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

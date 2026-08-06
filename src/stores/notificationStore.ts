// 📁 src/stores/notificationStore.ts

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Notification } from '@/types';
import { useAuthStore } from './authStore';
import { playNotificationSound, updateNotificationBadge } from '@/services/notificationService';
import {
  readCache,
  writeCache,
  invalidateCache as removeCacheEntry,
  isOffline,
  CACHE_KEYS,
  CACHE_TTL,
} from '@/lib/cache';

 
// ============================================================
// CACHE — délégué au module centralisé src/lib/cache.ts
// ============================================================

const getCachedNotifications = (userId?: string) =>
  readCache<Notification[]>(CACHE_KEYS.NOTIFICATIONS, CACHE_TTL.SHORT, userId);

const setCachedNotifications = (notifications: Notification[], userId?: string) =>
  writeCache(CACHE_KEYS.NOTIFICATIONS, notifications, userId);

const clearCachedNotifications = () => removeCacheEntry(CACHE_KEYS.NOTIFICATIONS);

// ✅ AFFICHER LA NOTIFICATION SYSTÈME 
async function showSystemNotification(notification: Notification) {
  if (Notification.permission !== 'granted') {
    console.warn('⚠️ Permission notifications non accordée');
    return;
  }

  try {
    const title = notification.title || 'Santé Plus';
    const body = notification.body || 'Nouvelle notification';

    const options: NotificationOptions = {
      body: body,
      icon: '/icon-192.png',
      badge: '/icon-72.png',
      tag: notification.id || `notif_${Date.now()}`,
      requireInteraction: true,
      silent: false,
      data: {
        url: '/app/notifications',
        notificationId: notification.id,
      },
    };

    // ✅ Utilisation du Service Worker pour mobile et fallback desktop
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
      console.log('🔔 Notification temps réel affichée via Service Worker');
    } else {
      const notif = new Notification(title, options);
      notif.onclick = () => {
        window.focus();
        const url = (notif as any).data?.url || '/app/notifications';
        window.location.href = url;
        notif.close();
      };
      console.log('🔔 Notification temps réel affichée via constructeur classique');
    }
  } catch (error) {
    console.error('❌ Erreur affichage notification:', error);
  }
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  subscription: any | null;
  notificationsEnabled: boolean;
  isInitialized: boolean;
  lastFetch: number | null;
  isStaleData: boolean;
  cacheTimestamp: number | null;
  isCacheInvalidated: boolean;
  error: string | null;

  subscribe: () => void;
  unsubscribe: () => void;
  fetchNotifications: (force?: boolean) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  addNotification: (notification: Notification) => void;
  clearNotifications: () => void;
  toggleNotifications: () => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  getUnreadCount: () => number;

  invalidateCache: () => void;
  refresh: () => Promise<void>;
}

const initializeNotifications = () => {
  const saved = localStorage.getItem('sante_plus_preferences');
  if (saved) {
    try {
      const prefs = JSON.parse(saved);
      return prefs.notifications !== false;
    } catch (e) {
      console.error('Erreur chargement préférences:', e);
      return true;
    }
  }
  return true;
};

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  subscription: null,
  notificationsEnabled: initializeNotifications(),
  isInitialized: false,
  lastFetch: null,
  isStaleData: false,
  cacheTimestamp: null,
  isCacheInvalidated: false,
  error: null,

  invalidateCache: () => {
    clearCachedNotifications();
    set({
      isCacheInvalidated: true,
      isInitialized: false,
      lastFetch: null,
    });
    console.log('🔄 Cache notifications invalidé');
  },

  refresh: async () => {
    get().invalidateCache();
    await get().fetchNotifications(true);
  },

  subscribe: () => {
    const { user } = useAuthStore.getState();
    const { notificationsEnabled } = get();

    if (!user) {
      console.log('ℹ️ [Realtime] Utilisateur non connecté');
      return;
    }

    if (!notificationsEnabled) {
      console.log('ℹ️ [Realtime] Notifications désactivées');
      return;
    }

    get().unsubscribe();

    console.log(`📡 [Realtime] Création du canal pour l'utilisateur ${user.id}`);

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('📨 [Realtime] NOUVELLE NOTIFICATION REÇUE !', payload);

          const notification = payload.new as Notification;

          if (notification.user_id === user.id) {
            get().addNotification(notification);
            playNotificationSound();
            showSystemNotification(notification);

            const { unreadCount } = get();
            updateNotificationBadge(unreadCount);

            if (unreadCount > 0) {
              document.title = `(${unreadCount}) Santé Plus Services`;
            }
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 [Realtime] Statut: ${status}`);
        if (status === 'SUBSCRIBED') {
          console.log('✅ [Realtime] Canal actif et prêt !');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('⚠️ [Realtime] Erreur canal, reconnexion dans 5s...');
          setTimeout(() => get().subscribe(), 5000);
        }
      });

    set({ subscription: channel });
    console.log('✅ [Realtime] Canal créé');
  },

  unsubscribe: () => {
    const { subscription } = get();
    if (subscription) {
      try {
        console.log('📡 [Realtime] Désabonnement...');
        supabase.removeChannel(subscription);
        set({ subscription: null });
        console.log('✅ [Realtime] Désabonné');
      } catch (error) {
        console.error('❌ [Realtime] Erreur désabonnement:', error);
      }
    }
  },

  // ============================================================
  // CHARGEMENT DES NOTIFICATIONS — « stale-while-revalidate »
  // ============================================================
  // Voir src/lib/cache.ts pour le détail de la stratégie.
  fetchNotifications: async (force = false) => {
    const state = get();
    if (state.isLoading) return;

    if (state.isCacheInvalidated) force = true;

    const { user } = useAuthStore.getState();
    if (!user) {
      set({ notifications: [], unreadCount: 0, isLoading: false, isInitialized: true });
      return;
    }

    const cached = getCachedNotifications(user.id);

    const applyCached = (isStale: boolean) => {
      if (!cached) return;
      const unread = cached.data.filter((n) => !n.is_read).length || 0;
      updateNotificationBadge(unread);
      set({
        notifications: cached.data,
        unreadCount: unread,
        isLoading: false,
        isInitialized: true,
        lastFetch: cached.timestamp,
        cacheTimestamp: cached.timestamp,
        isStaleData: isStale,
        isCacheInvalidated: false,
        error: null,
      });
    };

    // ── 1. Cache frais ───────────────────────────────────────
    if (!force && cached && !cached.isStale) {
      applyCached(false);
      return;
    }

    // ── 2. Hors ligne : servir le cache quel que soit son âge ──
    if (isOffline()) {
      if (cached) {
        applyCached(true);
      } else {
        set({ isLoading: false, isInitialized: true, error: 'Aucune donnée disponible hors ligne.' });
      }
      return;
    }

    // ── 3. Cache périmé mais en ligne : affichage immédiat ────
    if (cached && cached.data.length > 0) {
      applyCached(true);
    } else {
      set({ isLoading: true });
    }

    // ── 4. Rechargement réseau ───────────────────────────────
    try {
      set({ error: null, isCacheInvalidated: false });

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const notifications = data || [];
      const unread = notifications.filter((n) => !n.is_read).length || 0;

      updateNotificationBadge(unread);
      setCachedNotifications(notifications, user.id);

      set({
        notifications,
        unreadCount: unread,
        isLoading: false,
        isInitialized: true,
        lastFetch: Date.now(),
        cacheTimestamp: Date.now(),
        isStaleData: false,
        isCacheInvalidated: false,
        error: null,
      });
    } catch (error) {
      if (cached && cached.data.length > 0) {
        applyCached(true);
      } else {
        set({
          isLoading: false,
          isInitialized: true,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        });
      }
    }
  },

  markAsRead: async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      get().invalidateCache();
      await get().fetchNotifications(true);

      set((state) => {
        const target = state.notifications.find((n) => n.id === id);
        const wasUnread = target ? !target.is_read : false;
        const newUnreadCount = wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount;

        updateNotificationBadge(newUnreadCount);

        if (newUnreadCount > 0) {
          document.title = `(${newUnreadCount}) Santé Plus Services`;
        } else {
          document.title = 'Santé Plus Services';
        }

        return {
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
          ),
          unreadCount: newUnreadCount,
        };
      });
    } catch (error) {
      console.error('❌ Mark as read error:', error);
    }
  },

  markAllRead: async () => {
    try {
      const { user } = useAuthStore.getState();
      if (!user) return;

      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      get().invalidateCache();
      await get().fetchNotifications(true);

      updateNotificationBadge(0);
      document.title = 'Santé Plus Services';

      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          is_read: true,
          read_at: n.read_at || new Date().toISOString(),
        })),
        unreadCount: 0,
      }));
    } catch (error) {
      console.error('❌ Mark all read error:', error);
    }
  },

  // ✅ addNotification - SANS TOAST
  addNotification: (notification) => {
    const { notificationsEnabled } = get();

    if (!notificationsEnabled) {
      console.log('ℹ️ Notifications désactivées, ajout ignoré');
      return;
    }

    set((state) => {
      const alreadyExistsById = state.notifications.some((n) => n.id === notification.id);
      if (alreadyExistsById) {
        return state;
      }

      const newUnreadCount = state.unreadCount + 1;

      updateNotificationBadge(newUnreadCount);

      if (newUnreadCount > 0) {
        document.title = `(${newUnreadCount}) Santé Plus Services`;
      }

      // ✅ SUPPRIMÉ : toast.success('🔔 Nouvelle notification');

      return {
        notifications: [notification, ...state.notifications].slice(0, 50),
        unreadCount: newUnreadCount,
      };
    });
  },

  clearNotifications: () => {
    get().invalidateCache();
    updateNotificationBadge(0);
    document.title = 'Santé Plus Services';
    set({
      notifications: [],
      unreadCount: 0,
    });
  },

  toggleNotifications: () => {
    const { notificationsEnabled } = get();
    const newState = !notificationsEnabled;

    try {
      const savedPrefs = localStorage.getItem('sante_plus_preferences');
      const prefs = savedPrefs ? JSON.parse(savedPrefs) : {};
      prefs.notifications = newState;
      localStorage.setItem('sante_plus_preferences', JSON.stringify(prefs));
    } catch (e) {
      console.error('Erreur sauvegarde préférences:', e);
    }

    set({ notificationsEnabled: newState });

    if (!newState) {
      get().unsubscribe();
      updateNotificationBadge(0);
      document.title = 'Santé Plus Services';
    } else {
      get().subscribe();
    }
  },

  setNotificationsEnabled: (enabled: boolean) => {
    try {
      const savedPrefs = localStorage.getItem('sante_plus_preferences');
      const prefs = savedPrefs ? JSON.parse(savedPrefs) : {};
      prefs.notifications = enabled;
      localStorage.setItem('sante_plus_preferences', JSON.stringify(prefs));
    } catch (e) {
      console.error('Erreur sauvegarde préférences:', e);
    }

    set({ notificationsEnabled: enabled });

    if (!enabled) {
      get().unsubscribe();
      updateNotificationBadge(0);
      document.title = 'Santé Plus Services';
    } else {
      get().subscribe();
    }
  },

  getUnreadCount: () => {
    return get().unreadCount;
  },
}));

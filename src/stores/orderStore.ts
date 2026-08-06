// 📁 src/stores/orderStore.ts
 
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Order, OrderStatus } from '@/types';
import { useAuthStore } from './authStore';
import api from '@/lib/api';
import {
  readCache,
  writeCache,
  invalidateCache as removeCacheEntry,
  isOffline,
  CACHE_KEYS,
  CACHE_TTL,
} from '@/lib/cache';

// ✅ URL UNIQUE
const API_URL = import.meta.env.VITE_API_URL || 'https://app-react-back.onrender.com/api';

// =============================================
// CONSTANTES
// =============================================

const MAX_ORDERS_IN_PROGRESS = 2;

// =============================================
// HELPERS DE CACHE
// =============================================
// Délégués au module centralisé src/lib/cache.ts.
// ⚠️ Ces fonctions écrivaient sur la clé brute 'sante_plus_orders_cache'
// tandis que fetchOrders lit désormais via CACHE_KEYS.ORDERS : sans cette
// redirection, `clearCachedOrders()` — appelé après chaque création,
// annulation ou changement de statut — aurait vidé une clé inexistante
// et le cache ne se serait jamais invalidé après une modification.

const getCachedOrders = (userId?: string) =>
  readCache<Order[]>(CACHE_KEYS.ORDERS, CACHE_TTL.DEFAULT, userId);

const setCachedOrders = (orders: Order[], userId?: string) =>
  writeCache(CACHE_KEYS.ORDERS, orders, userId);

const clearCachedOrders = () => removeCacheEntry(CACHE_KEYS.ORDERS);

// =============================================
// ORDER STORE
// =============================================

interface OrderState {
  orders: Order[];
  currentOrder: Order | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  isInitialized: boolean;
  lastFetch: number | null;
  /** true quand les données viennent d'un cache périmé (hors ligne). */
  isStaleData: boolean;
  /** Date du cache affiché, pour l'indiquer à l'utilisateur. */
  cacheTimestamp: number | null;
  isCacheInvalidated: boolean;
  total: number;
  hasMore: boolean;

  fetchOrders: (force?: boolean) => Promise<void>;
  loadMoreOrders: () => Promise<void>;
  fetchOrderById: (id: string) => Promise<void>;
  createOrder: (data: any) => Promise<Order>;
  updateOrder: (id: string, data: Partial<Order>) => Promise<void>;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  confirmPayment: (id: string, transactionId: string) => Promise<void>;
  takeOrder: (id: string, lat?: number | null, lng?: number | null) => Promise<any>;
  acceptOrder: (id: string) => Promise<void>;
  prepareOrder: (id: string) => Promise<void>;
  markOrderReady: (id: string) => Promise<void>;
  startDelivery: (id: string, location?: { lat: number; lng: number }) => Promise<void>;
  completeDelivery: (id: string, data: {
    proof_url: string | null;
    delivery_fee: number;
    payment_method: 'online' | 'cash';
    cash_amount_received?: number;
    lat?: number | null;
    lng?: number | null;
  }) => Promise<void>;
  confirmCashPayment: (id: string, isConfirmed: boolean) => Promise<void>;
  getAssignedOrders: () => Order[];
  getAvailableOrders: () => Promise<Order[]>;
  getDeliveryOrders: () => Order[];
  canManageOrders: () => boolean;
  invalidateCache: () => void;
  refresh: () => Promise<void>;
  clearError: () => void;
  
  checkOrderQuota: () => Promise<{ current: number; max: number; available: number; canTake: boolean }>;
  getQuotaInfo: () => { current: number; max: number; available: number; canTake: boolean };
  autoValidateOrder: (id: string) => Promise<void>;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  currentOrder: null,
  isLoading: false,
  isLoadingMore: false,
  error: null,
  isInitialized: false,
  lastFetch: null,
  isStaleData: false,
  cacheTimestamp: null,
  isCacheInvalidated: false,
  total: 0,
  hasMore: false,

  canManageOrders: () => {
    const { profile } = useAuthStore.getState();
    return profile?.role === 'admin' || profile?.role === 'coordinator';
  },

  invalidateCache: () => {
    clearCachedOrders();
    set({ 
      isCacheInvalidated: true,
      isInitialized: false,
      lastFetch: null,
    });
  },

  refresh: async () => {
    get().invalidateCache();
    await get().fetchOrders(true);
  },

  checkOrderQuota: async () => {
    try {
      const { user } = useAuthStore.getState();
      if (!user) {
        return { current: 0, max: MAX_ORDERS_IN_PROGRESS, available: 0, canTake: false };
      }

      const { data: aidant } = await supabase
        .from('aidants')
        .select('current_orders, max_orders')
        .eq('user_id', user.id)
        .single();

      if (!aidant) {
        return { current: 0, max: MAX_ORDERS_IN_PROGRESS, available: 0, canTake: false };
      }

      const current = aidant.current_orders || 0;
      const max = aidant.max_orders || MAX_ORDERS_IN_PROGRESS;
      const available = max - current;

      return {
        current,
        max,
        available,
        canTake: current < max,
      };
    } catch (error) {
      console.error('❌ checkOrderQuota error:', error);
      return { current: 0, max: MAX_ORDERS_IN_PROGRESS, available: 0, canTake: false };
    }
  },

  getQuotaInfo: () => {
    const state = get();
    const { user } = useAuthStore.getState();
    
    const inProgressOrders = state.orders.filter(
      (o: any) => o.status === 'en_cours' && o.aidant_id === user?.id
    );
    
    const current = inProgressOrders.length;
    const max = MAX_ORDERS_IN_PROGRESS;
    const available = max - current;

    return {
      current,
      max,
      available,
      canTake: current < max,
    };
  },

  // ============================================================
  // CHARGEMENT DES COMMANDES — « stale-while-revalidate »
  // ============================================================
  // Ce store n'avait AUCUN cache local : hors ligne, la liste des
  // commandes était entièrement vide, même celles déjà consultées.
  // Voir src/lib/cache.ts pour le détail de la stratégie.
  fetchOrders: async (force = false) => {
    const state = get();
    if (state.isLoading && !force) return;

    if (state.isCacheInvalidated) force = true;

    const { user } = useAuthStore.getState();
    if (!user) {
      set({ orders: [], isLoading: false, isInitialized: true });
      return;
    }

    const cached = readCache<Order[]>(CACHE_KEYS.ORDERS, CACHE_TTL.DEFAULT, user.id);

    // ── 1. Cache frais ───────────────────────────────────────
    if (!force && cached && !cached.isStale) {
      set({
        orders: cached.data,
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
          orders: cached.data,
          isLoading: false,
          isInitialized: true,
          cacheTimestamp: cached.timestamp,
          isStaleData: true,
          error: null,
        });
      } else {
        set({
          isLoading: false,
          isInitialized: true,
          error: 'Aucune donnée disponible hors ligne.',
        });
      }
      return;
    }

    // ── 3. Cache périmé mais en ligne : affichage immédiat ────
    if (cached && cached.data.length > 0) {
      set({
        orders: cached.data,
        cacheTimestamp: cached.timestamp,
        isStaleData: true,
        isInitialized: true,
        isLoading: false,
      });
    } else {
      set({ isLoading: true });
    }

    // ── 4. Rechargement réseau ───────────────────────────────
    try {
      set({ error: null, isCacheInvalidated: false });

      const response = await api.get('/orders', { params: { limit: 20, offset: 0 } });
      const ordersData = response.data || [];
      const total = parseInt(response.headers['x-total-count'] || '0', 10);

      writeCache(CACHE_KEYS.ORDERS, ordersData, user.id);

      set({
        orders: ordersData,
        total,
        hasMore: ordersData.length < total,
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
          orders: cached.data,
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

  loadMoreOrders: async () => {
    const state = get();
    if (!state.hasMore || state.isLoadingMore) return;

    try {
      set({ isLoadingMore: true });
      const offset = state.orders.length;
      const response = await api.get('/orders', { params: { limit: 20, offset } });
      const newOrders = response.data || [];
      const total = parseInt(response.headers['x-total-count'] || '0', 10);
      const merged = [...state.orders, ...newOrders];

      set({
        orders: merged,
        total,
        hasMore: merged.length < total,
        isLoadingMore: false,
      });
    } catch (error: any) {
      set({ isLoadingMore: false });
    }
  },

  fetchOrderById: async (id: string) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.get(`/orders/${id}`);
      set({ currentOrder: response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  createOrder: async (data: any): Promise<Order> => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.post('/orders', data);
      const newOrder = response.data?.order || response.data;

      get().invalidateCache();
      await get().fetchOrders(true);

      set({ isLoading: false });

      return newOrder;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // ✅ METHODE DE MISE À JOUR GLOBAL DE COMMANDE
  updateOrder: async (id: string, data: Partial<Order>) => {
    try {
      set({ isLoading: true, error: null });
      await api.put(`/orders/${id}`, data);
      
      clearCachedOrders();
      await get().fetchOrders(true);
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  confirmPayment: async (id: string, transactionId: string) => {
    try {
      set({ isLoading: true, error: null });
      await api.post(`/orders/${id}/confirm-payment`, { transaction_id: transactionId });
      get().invalidateCache();
      await get().fetchOrders(true);
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  takeOrder: async (id: string, lat?: number | null, lng?: number | null) => {
    try {
      set({ isLoading: true, error: null });
      
      const { user } = useAuthStore.getState();
      if (!user) throw new Error('Utilisateur non connecté');

      const response = await api.post(`/orders/${id}/take`, { lat, lng });
      const order = response.data?.order || response.data;

      if (!order) {
        throw new Error('Erreur lors de la prise de commande');
      }

      set((state) => ({
        orders: state.orders.map(o => o.id === id ? order : o),
        currentOrder: state.currentOrder?.id === id ? order : state.currentOrder
      }));

      clearCachedOrders();
      await get().fetchOrders(true);

      set({ isLoading: false });
      return order;
    } catch (error: any) {
      console.error('❌ Take order error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  acceptOrder: async (id: string) => {
    let startLat: number | null = null;
    let startLng: number | null = null;

    try {
      if (navigator.geolocation) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        startLat = position.coords.latitude;
        startLng = position.coords.longitude;
      }
    } catch (e) {
      console.warn("⚠️ Impossible de récupérer le GPS");
    }

    return get().takeOrder(id, startLat, startLng);
  },

  prepareOrder: async (id: string) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.post(`/orders/${id}/prepare`);
      const order = response.data?.order || response.data;
      
      set((state) => ({ orders: state.orders.map(o => o.id === id ? order : o) }));

      clearCachedOrders();
      await get().fetchOrders(true);
      set({ isLoading: false });
    } catch (error: any) {
      console.error('❌ Prepare order error:', error);
      set({ isLoading: false });
    }
  },

  markOrderReady: async (id: string) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.post(`/orders/${id}/status`, { status: 'disponible' });
      const order = response.data?.order || response.data;
      
      set((state) => ({ orders: state.orders.map(o => o.id === id ? order : o) }));

      clearCachedOrders();
      await get().fetchOrders(true);
      set({ isLoading: false });
    } catch (error: any) {
      console.error('❌ Mark ready error:', error);
      set({ isLoading: false });
    }
  },

  startDelivery: async (id: string, location?: { lat: number; lng: number }) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.post(`/orders/${id}/deliver`, { location });
      const order = response.data?.order || response.data;
      
      set((state) => ({ orders: state.orders.map(o => o.id === id ? order : o) }));

      clearCachedOrders();
      await get().fetchOrders(true);
      set({ isLoading: false });
    } catch (error: any) {
      console.error('❌ Start delivery error:', error);
      set({ isLoading: false });
    }
  },

  completeDelivery: async (id: string, data: {
    proof_url: string | null;
    delivery_fee: number;
    payment_method: 'online' | 'cash';
    cash_amount_received?: number;
    lat?: number | null;
    lng?: number | null;
  }) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.post(`/orders/${id}/deliver`, data);
      const order = response.data?.order || response.data;
      
      set((state) => ({ 
        orders: state.orders.map(o => o.id === id ? order : o),
        currentOrder: state.currentOrder?.id === id ? order : state.currentOrder
      }));

      clearCachedOrders();
      await get().fetchOrders(true);
      set({ isLoading: false });
    } catch (error: any) {
      console.error('❌ Complete delivery error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  confirmCashPayment: async (id: string, isConfirmed: boolean) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.post(`/orders/${id}/confirm-cash`, { is_confirmed: isConfirmed });
      const order = response.data?.order || response.data;
      
      set((state) => ({ 
        orders: state.orders.map(o => o.id === id ? order : o),
        currentOrder: state.currentOrder?.id === id ? order : state.currentOrder
      }));

      clearCachedOrders();
      await get().fetchOrders(true);
      set({ isLoading: false });
    } catch (error: any) {
      console.error('❌ Confirm cash payment error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  autoValidateOrder: async (id: string) => {
    try {
      set({ isLoading: true, error: null });
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      const response = await fetch(`${API_URL}/orders/${id}/auto-validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();
      const order = result?.order || result;
      
      set((state) => ({ orders: state.orders.map(o => o.id === id ? order : o) }));

      clearCachedOrders();
      await get().fetchOrders(true);
      set({ isLoading: false });
    } catch (error: any) {
      console.error('❌ Auto-validate error:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  updateOrderStatus: async (id: string, status: OrderStatus) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.post(`/orders/${id}/status`, { status });
      const order = response.data?.order || response.data;

      set((state) => ({
        orders: state.orders.map(o => o.id === id ? order : o),
        currentOrder: state.currentOrder?.id === id ? order : state.currentOrder
      }));

      clearCachedOrders();
      await get().fetchOrders(true);
      set({ isLoading: false });
    } catch (error: any) {
      console.error('❌ Update order status error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  deleteOrder: async (id: string) => {
    try {
      set({ isLoading: true, error: null });
      await api.delete(`/orders/${id}`);

      clearCachedOrders();
      await get().fetchOrders(true);
      set({ isLoading: false });
    } catch (error: any) {
      console.error('❌ Delete order error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  getAvailableOrders: async (): Promise<Order[]> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      const response = await fetch(`${API_URL}/orders/available`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      return result.data || [];
    } catch (error: any) {
      console.error('❌ Get available orders error:', error);
      return [];
    }
  },

  getAssignedOrders: () => {
    const { user } = useAuthStore.getState();
    const state = get();
    return state.orders.filter((o: any) => o.aidant_id === user?.id);
  },

  getDeliveryOrders: () => {
    const state = get();
    return state.orders.filter((o: any) => o.status === 'en_cours');
  },

  clearError: () => set({ error: null }),
}));

export default useOrderStore;

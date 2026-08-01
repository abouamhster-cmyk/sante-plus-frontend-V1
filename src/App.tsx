// 📁 src/App.tsx
 
import { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { InstallPrompt } from '@/components/PWA/InstallPrompt';
import { ConfirmDialogHost } from '@/components/ui/ConfirmDialog';
import { NetworkStatus } from '@/components/ui/NetworkStatus';
import { ServerWakingIndicator } from '@/components/ui/ServerWakingIndicator';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import MainLayout from '@/components/layout/MainLayout';
import { AuthLayout } from '@/components/layout/AuthLayout'; 

import { supabase } from '@/lib/supabase';
import { useVisitStore } from '@/stores/visitStore';
import { useOrderStore } from '@/stores/orderStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useAuthStore } from '@/stores/authStore';
import { useOfferStore } from '@/stores/offerStore';
import { useContractStore } from '@/stores/contractStore';

// AUTH PAGES
import LoginPage from '@/features/auth/pages/LoginPage';
import RegisterPage from '@/features/auth/pages/RegisterPage';
import ForgotPasswordPage from '@/features/auth/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/features/auth/pages/ResetPasswordPage';
import AdminSetupPage from '@/features/admin/pages/AdminSetupPage';

// DASHBOARD & MAIN PAGES
import DashboardPage from '@/features/dashboard/pages/DashboardPage';
import PatientsPage from '@/features/patients/pages/PatientsPage';
import PatientDetailPage from '@/features/patients/pages/PatientDetailPage';
import VisitsPage from '@/features/visits/pages/VisitsPage';
import VisitDetailPage from '@/features/visits/pages/VisitDetailPage';
import OrdersPage from '@/features/orders/pages/OrdersPage';
import CreateOrderPage from '@/features/orders/pages/CreateOrderPage';
import OrderDetailPage from '@/features/orders/pages/OrderDetailPage';
import BillingPage from '@/features/billing/pages/BillingPage';
import MapPage from '@/features/map/pages/MapPage';
import NotificationsPage from '@/features/notifications/pages/NotificationsPage';
import ProfilePage from '@/features/profile/pages/ProfilePage';
import EducationPage from '@/features/education/pages/EducationPage';
import JournalPage from '@/features/journal/pages/JournalPage';
import DischargePage from '@/features/discharge/pages/DischargePage';

// REDIRECTION DE PAIEMENT
import PaymentConfirmPage from '@/features/billing/pages/PaymentConfirmPage';

// AIDANT / HELP PAGES
import MissionsPage from '@/features/help/pages/MissionsPage'; 
import PlanningPage from '@/features/help/pages/PlanningPage';
import HistoryPage from '@/features/help/pages/HistoryPage';

// ADMIN PAGES
import AdminDashboardPage from '@/features/admin/pages/AdminDashboardPage';
import AdminPaymentsPage from '@/features/admin/pages/AdminPaymentsPage';
import AdminSubscriptionsPage from '@/features/admin/pages/AdminSubscriptionsPage';
import AdminNotificationsPage from '@/features/admin/pages/AdminNotificationsPage';
import AdminVisitValidationPage from '@/features/admin/pages/AdminVisitValidationPage';
import RegistrationsPage from '@/features/admin/pages/RegistrationsPage';
import RegistrationDetailsPage from '@/features/admin/pages/RegistrationDetailsPage';
import AidantsPage from '@/features/admin/pages/AidantsPage';
import AidantCandidatesPage from '@/features/admin/pages/AidantCandidatesPage';
import UsersPage from '@/features/admin/pages/UsersPage';
import OffersPage from '@/features/admin/pages/OffersPage';
import SettingsPage from '@/features/admin/pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

function App() {
  const { initialize, isLoading: isAuthLoading, isAuthenticated, isInitialized: isAuthInitialized, profile } = useAuthStore();
  const { fetchNotifications, subscribe, unsubscribe, unreadCount } = useNotificationStore();
  const { fetchOffers, isInitialized: isOffersInitialized } = useOfferStore();
  const { checkContract } = useContractStore();

  const hasInitialized = useRef(false);
  const hasLoadedOffers = useRef(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('👀 Page visible - Rafraîchissement automatique des notifications...');
        useNotificationStore.getState().fetchNotifications(true);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R' || e.key === 'f5')) {
        console.log('🔄 Rechargement manuel d’application détecté');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !isAuthInitialized) return;

    console.log('📡 [Realtime] Initialisation du canal temps réel unique...');

    // ============================================================
    // ⚡ OPTIMISATION DES RECHARGEMENTS TEMPS RÉEL
    // ============================================================
    // AVANT : chaque événement Realtime déclenchait un rechargement COMPLET
    // de la liste, après seulement 300 ms de regroupement — même si l'onglet
    // était en arrière-plan.
    //
    // Concrètement, avec 1 000 utilisateurs connectés, UNE seule visite créée
    // provoquait jusqu'à 1 000 rechargements simultanés de listes entières.
    // C'est une amplification qui tient à quelques centaines d'utilisateurs,
    // puis fait exploser la charge Supabase.
    //
    // DEUX CORRECTIFS, sans aucun risque sur l'exactitude des données :
    //
    //   1. Ne rien recharger quand l'onglet est en arrière-plan.
    //      On note simplement qu'un rafraîchissement est dû, et on l'effectue
    //      au retour de l'utilisateur. Un onglet ouvert en arrière-plan toute
    //      la journée ne génère plus une seule requête.
    //
    //   2. Regroupement porté de 300 ms à 1500 ms. Lors d'une rafale (un admin
    //      qui valide 10 visites d'affilée), on effectue UN rechargement au
    //      lieu de 10. Le délai reste imperceptible à l'usage.
    const REALTIME_DEBOUNCE_MS = 1500;

    // Rafraîchissements en attente pendant que l'onglet est masqué.
    const pending = { visits: false, orders: false };

    const runFetchVisits = () => {
      console.log('🔄 [Realtime] Rechargement des visites...');
      useVisitStore.getState().invalidateCache();
      useVisitStore.getState().fetchVisits(true);
    };

    const runFetchOrders = () => {
      console.log('🔄 [Realtime] Rechargement des commandes...');
      useOrderStore.getState().invalidateCache();
      useOrderStore.getState().fetchOrders(true);
    };

    let visitTimeout: any;
    const debouncedFetchVisits = () => {
      clearTimeout(visitTimeout);
      visitTimeout = setTimeout(() => {
        if (document.hidden) {
          pending.visits = true;
          console.log('💤 [Realtime] Onglet masqué — rechargement des visites différé');
          return;
        }
        runFetchVisits();
      }, REALTIME_DEBOUNCE_MS);
    };

    let orderTimeout: any;
    const debouncedFetchOrders = () => {
      clearTimeout(orderTimeout);
      orderTimeout = setTimeout(() => {
        if (document.hidden) {
          pending.orders = true;
          console.log('💤 [Realtime] Onglet masqué — rechargement des commandes différé');
          return;
        }
        runFetchOrders();
      }, REALTIME_DEBOUNCE_MS);
    };

    // Au retour de l'utilisateur, on rattrape ce qui a été différé.
    const handleRealtimeVisibility = () => {
      if (document.hidden) return;
      if (pending.visits) {
        pending.visits = false;
        runFetchVisits();
      }
      if (pending.orders) {
        pending.orders = false;
        runFetchOrders();
      }
    };
    document.addEventListener('visibilitychange', handleRealtimeVisibility);

    const visitsChannel = supabase
      .channel('realtime_visites_consolidated')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visites' },
        (payload) => {
          console.log('🔄 [Realtime] Changement détecté sur Visites:', payload.eventType);
          debouncedFetchVisits();
        }
      )
      .subscribe();

    const ordersChannel = supabase
      .channel('realtime_commandes_consolidated')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'commandes' },
        (payload) => {
          console.log('🔄 [Realtime] Changement détecté sur Commandes:', payload.eventType);
          debouncedFetchOrders();
        }
      )
      .subscribe();

    return () => {
      clearTimeout(visitTimeout);
      clearTimeout(orderTimeout);
      document.removeEventListener('visibilitychange', handleRealtimeVisibility);
      supabase.removeChannel(visitsChannel);
      supabase.removeChannel(ordersChannel);
    };
  }, [isAuthenticated, isAuthInitialized]);

  const isSubscribedNotification = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !isAuthInitialized || !profile) return;
    if (isSubscribedNotification.current) return;

    fetchNotifications();
    subscribe();
    isSubscribedNotification.current = true;

    return () => {
      if (isSubscribedNotification.current) {
        unsubscribe();
        isSubscribedNotification.current = false;
      }
    };
  }, [isAuthenticated, isAuthInitialized, profile, fetchNotifications, subscribe, unsubscribe]);

  useEffect(() => {
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${import.meta.env.VITE_APP_NAME || 'Santé Plus Services'}`;
    } else {
      document.title = import.meta.env.VITE_APP_NAME || 'Santé Plus Services';
    }
  }, [unreadCount]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (hasInitialized.current) return;
      hasInitialized.current = true;
      console.log('🔄 App mount - initializing auth...');
      
      if (mounted) {
        await initialize();
      }
    };

    init();
    return () => {
      mounted = false;
    };
  }, [initialize]);

  useEffect(() => {
    if (isAuthInitialized && !isOffersInitialized && !hasLoadedOffers.current) {
      hasLoadedOffers.current = true;
      fetchOffers();
    }
  }, [isAuthInitialized, isOffersInitialized, fetchOffers]);

  useEffect(() => {
    if (isAuthenticated && isAuthInitialized) {
      checkContract();
    }
  }, [isAuthenticated, isAuthInitialized, checkContract]);

  if (!isAuthInitialized || isAuthLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center animate-pulse" style={{ background: 'var(--color-background, #f5f0e8)' }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {/* ============================================================
          ✅ CORRECTIF MAJEUR — ThemeProvider
          ============================================================
          Il était importé mais JAMAIS rendu. C'est lui qui applique les
          variables CSS de la marque (--color-primary, etc.) sur la page.
          Sans lui, tout élément stylé via var(--color-*) retombait sur des
          valeurs par défaut au lieu des couleurs de votre thème. */}
      <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* ROUTES PUBLIQUES D'AUTHENTIFICATION */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/admin-setup" element={<AdminSetupPage />} />
          </Route>

          {/* ✅ LA ROUTE DE REDIRECTION DE PAIEMENT FEDAPAY UNIQUE (HORS LAYOUT AVEC EN-TÊTE) */}
          <Route path="/payment/confirm" element={<PaymentConfirmPage />} />

          {/* ROUTES PROTÉGÉES SÉCURISÉES */}
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/app" element={<DashboardPage />} />
            <Route path="/app/dashboard" element={<DashboardPage />} />
            <Route path="/app/patients" element={<PatientsPage />} />
            <Route path="/app/patients/:id" element={<PatientDetailPage />} />
            <Route path="/app/visits" element={<VisitsPage />} />
            <Route path="/app/visits/:id" element={<VisitDetailPage />} />
            <Route path="/app/orders" element={<OrdersPage />} />
            <Route path="/app/orders/create" element={<CreateOrderPage />} />
            <Route path="/app/orders/:id" element={<OrderDetailPage />} />
            <Route path="/app/billing" element={<BillingPage />} />
            <Route path="/app/map" element={<MapPage />} />
            <Route path="/app/notifications" element={<NotificationsPage />} />
            <Route path="/app/profile" element={<ProfilePage />} />
            <Route path="/app/missions" element={<MissionsPage />} />
            <Route path="/app/planning" element={<PlanningPage />} />
            <Route path="/app/history" element={<HistoryPage />} />
            <Route path="/app/education" element={<EducationPage />} />
            <Route path="/app/journal" element={<JournalPage />} />
            <Route path="/app/discharge" element={<DischargePage />} />

            {/* ROUTES ADMIN */}
            <Route 
              path="/app/admin" 
              element={
                <RoleGuard allowedRoles={['admin', 'coordinator']}>
                  <AdminDashboardPage />
                </RoleGuard>
              } 
            />
            <Route 
              path="/app/admin-payments" 
              element={
                <RoleGuard allowedRoles={['admin', 'coordinator']}>
                  <AdminPaymentsPage />
                </RoleGuard>
              } 
            />
            <Route 
              path="/app/admin-subscriptions" 
              element={
                <RoleGuard allowedRoles={['admin', 'coordinator']}>
                  <AdminSubscriptionsPage />
                </RoleGuard>
              } 
            />
            <Route 
              path="/app/admin-notifications" 
              element={
                <RoleGuard allowedRoles={['admin', 'coordinator']}>
                  <AdminNotificationsPage />
                </RoleGuard>
              } 
            />
            <Route 
              path="/app/admin/visits/validation" 
              element={
                <RoleGuard allowedRoles={['admin', 'coordinator']}>
                  <AdminVisitValidationPage />
                </RoleGuard>
              } 
            />
            <Route 
              path="/app/registrations" 
              element={
                <RoleGuard allowedRoles={['admin', 'coordinator']}>
                  <RegistrationsPage />
                </RoleGuard>
              } 
            />
            <Route 
              path="/app/registrations/:id" 
              element={
                <RoleGuard allowedRoles={['admin', 'coordinator']}>
                  <RegistrationDetailsPage />
                </RoleGuard>
              } 
            />
            <Route 
              path="/app/aidants" 
              element={
                <RoleGuard allowedRoles={['admin', 'coordinator']}>
                  <AidantsPage />
                </RoleGuard>
              } 
            />
            <Route 
              path="/app/aidant-candidates" 
              element={
                <RoleGuard allowedRoles={['admin', 'coordinator']}>
                  <AidantCandidatesPage />
                </RoleGuard>
              } 
            />
            <Route 
              path="/app/assign-aidants" 
              element={
                <RoleGuard allowedRoles={['admin', 'coordinator']}>
                  <Navigate to="/app/patients" replace />
                </RoleGuard>
              } 
            />
             <Route 
              path="/app/users" 
              element={
                <RoleGuard allowedRoles={['admin', 'coordinator']}>
                  <UsersPage />
                </RoleGuard>
              } 
            />
            <Route 
              path="/app/offers" 
              element={
                <RoleGuard allowedRoles={['admin', 'coordinator']}>
                  <OffersPage />
                </RoleGuard>
              } 
            />
            <Route 
              path="/app/settings" 
              element={
                <RoleGuard allowedRoles={['admin']}>
                  <SettingsPage />
                </RoleGuard>
              } 
            />
          </Route>

          {/* REDIRECTIONS */}
          <Route path="/" element={<Navigate to={isAuthenticated ? '/app' : '/login'} replace />} />
          <Route path="*" element={<Navigate to={isAuthenticated ? '/app' : '/login'} replace />} />
        </Routes>

        <InstallPrompt />

        {/* ✅ Hôte des dialogues de confirmation.
            Remplace les 18 window.confirm() natifs par une modale aux
            couleurs de la marque, cohérente sur mobile comme sur desktop. */}
        <ConfirmDialogHost />

        {/* 📶 Bandeau hors-ligne : l'app n'avait AUCUNE détection réseau.
            Indispensable pour des aidants en visite à domicile. */}
        <NetworkStatus />

        {/* 🌙 Réveil du serveur Render (plan gratuit, jusqu'à 50 s).
            Sans ce message, l'utilisateur croit l'application cassée. */}
        <ServerWakingIndicator />

        {/* ============================================================
            ✅ CORRECTIF MAJEUR — Toaster
            ============================================================
            `Toaster` était importé mais JAMAIS rendu. Conséquence : les
            361 appels toast.error() / toast.success() de l'application
            ne produisaient STRICTEMENT AUCUN affichage.
            C'est la raison pour laquelle un mot de passe incorrect ne
            renvoyait aucun message : le code appelait bien toast.error(),
            mais il n'y avait aucun conteneur pour l'afficher.

            Position `top-center` : sur mobile, un toast en bas est souvent
            masqué par la barre d'onglets. */}
        <Toaster
          position="top-center"
          reverseOrder={false}
          gutter={8}
          toastOptions={{
            duration: 4000,
            style: {
              background: '#ffffff',
              color: '#1f2937',
              fontSize: '13px',
              fontWeight: 500,
              padding: '12px 16px',
              borderRadius: '14px',
              boxShadow: '0 6px 24px rgba(0,0,0,0.10)',
              maxWidth: '92vw',
            },
            success: {
              duration: 3000,
              iconTheme: { primary: '#1a4a3a', secondary: '#ffffff' },
            },
            error: {
              // Les erreurs restent plus longtemps : l'utilisateur doit
              // avoir le temps de lire ce qui n'a pas fonctionné.
              duration: 5000,
              iconTheme: { primary: '#dc2626', secondary: '#ffffff' },
              style: {
                background: '#fef2f2',
                color: '#991b1b',
                border: '1px solid #fecaca',
                fontSize: '13px',
                fontWeight: 500,
                padding: '12px 16px',
                borderRadius: '14px',
                maxWidth: '92vw',
              },
            },
            loading: {
              iconTheme: { primary: '#1a4a3a', secondary: '#ffffff' },
            },
          }}
        />
       </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;

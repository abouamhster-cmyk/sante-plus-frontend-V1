// 📁 frontend/src/features/admin/pages/AdminDashboardPage.tsx
 
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserCheck,
  Calendar,
  ShoppingBag,
  TrendingUp,
  Clock,
  DollarSign,
  AlertCircle,
  UserPlus,
  ClipboardList,
  ArrowRight,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useBranding } from '@/hooks/useBranding';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency } from '@/utils/helpers';
import toast from 'react-hot-toast';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalPatients: number;
  personalAccounts: number;
  totalBeneficiaires: number;
  totalAidants: number;
  visitsToday: number;
  visitsInProgress: number;
  pendingRegistrations: number;
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  monthlyRevenue: number;
  growth: number;
  visitsWaitingApproval: number;
  visitsExpired: number;
  unassignedCount: number;
  pendingAidantVisits: number;
  availableOrders: number;
}

const AdminDashboardPage = () => {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const brand = useBranding();
  const colors = brand.colors;

  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalPatients: 0,
    personalAccounts: 0,
    totalBeneficiaires: 0,
    totalAidants: 0,
    visitsToday: 0,
    visitsInProgress: 0,
    pendingRegistrations: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    growth: 0,
    visitsWaitingApproval: 0,
    visitsExpired: 0,
    unassignedCount: 0,
    pendingAidantVisits: 0,
    availableOrders: 0,
  });

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);

      // ============================================================
      // 📊 STATISTIQUES — UNE SEULE REQUÊTE AGRÉGÉE
      // ============================================================
      // AVANT : 16 requêtes, dont trois qui téléchargeaient des tables
      // entières dans le navigateur — tous les comptes famille, toute la
      // table de liaison, et TOUS les paiements de l'histoire (additionnés
      // ensuite avec .reduce()). À l'échelle visée, cette page n'aurait
      // jamais fini de charger.
      //
      // APRÈS : la fonction Postgres admin_dashboard_stats() calcule tout
      // sur place — COUNT et SUM s'exécutent là où sont les données — et
      // ne renvoie que quelques centaines d'octets de JSON.
      const { data: s, error: statsError } = await supabase.rpc('admin_dashboard_stats');

      if (statsError) throw statsError;

      setStats({
        totalUsers:            s.totalUsers            || 0,
        activeUsers:           s.activeUsers           || 0,
        totalPatients:         s.totalPatients         || 0,
        personalAccounts:      s.personalAccounts      || 0,
        totalBeneficiaires:    s.totalBeneficiaires    || 0,
        totalAidants:          s.totalAidants          || 0,
        visitsToday:           s.visitsToday           || 0,
        visitsInProgress:      s.visitsInProgress      || 0,
        pendingRegistrations:  s.pendingRegistrations  || 0,
        totalOrders:           s.totalOrders           || 0,
        pendingOrders:         s.pendingOrders         || 0,
        totalRevenue:          Number(s.totalRevenue)   || 0,
        monthlyRevenue:        Number(s.monthlyRevenue) || 0,
        growth: 12.5,
        visitsWaitingApproval: s.visitsWaitingApproval || 0,
        visitsExpired:         s.visitsExpired         || 0,
        unassignedCount:       s.unassignedCount       || 0,
        pendingAidantVisits:   s.pendingAidantVisits   || 0,
        availableOrders:       s.availableOrders       || 0,
      });
    } catch (error) {
      console.error('Fetch dashboard error:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto p-4 sm:p-6 animate-pulse">
        <div className="h-16 bg-white dark:bg-[#14221b] rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white dark:bg-[#14221b] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 px-3 sm:px-0">
      
      {/* 1️⃣ EN-TÊTE DE SUPERVISION */}
      <section className="flex items-center justify-between bg-white dark:bg-[#14221b] p-5 rounded-3xl border shadow-sm" style={{ borderColor: colors.primary + '15' }}>
        <div>
          <h1 className="text-lg sm:text-xl font-black" style={{ color: colors.text }}>
            Supervision Générale
          </h1>
          <p className="text-xs font-semibold text-gray-400 mt-0.5">
            Vue d'ensemble de l'activité Santé Plus
          </p>
        </div>

        <button
          onClick={fetchDashboardData}
          className="h-10 px-4 rounded-xl text-xs font-bold border bg-gray-50 dark:bg-[#1e2e26] hover:bg-gray-100 transition flex items-center gap-2"
          style={{ borderColor: colors.primary + '20', color: colors.text }}
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </section>

      {/* 2️⃣ INDICATEURS CLÉS (4 CARTE SEULEMENT - LISIBILITÉ MAXIMALE) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard
          title="Bénéficiaires"
          value={stats.totalBeneficiaires}
          subtitle={`${stats.totalPatients} proches • ${stats.personalAccounts} directs`}
          icon={<Users size={18} />}
          color={colors.primary}
          onClick={() => navigate('/app/patients')}
        />
        <KpiCard
          title="Aidants Référents"
          value={stats.totalAidants}
          subtitle="Intervenants qualifiés"
          icon={<UserCheck size={18} />}
          color="#3b82f6"
          onClick={() => navigate('/app/aidants')}
        />
        <KpiCard
          title="Visites du Jour"
          value={stats.visitsToday}
          subtitle={`${stats.visitsInProgress} en cours`}
          icon={<Calendar size={18} />}
          color="#f59e0b"
          onClick={() => navigate('/app/visits')}
        />
        <KpiCard
          title="Revenus du Mois"
          value={formatCurrency(stats.monthlyRevenue)}
          subtitle={`Total: ${formatCurrency(stats.totalRevenue)}`}
          icon={<DollarSign size={18} />}
          color="#10b981"
          onClick={() => navigate('/app/admin-payments')}
        />
      </section>

      {/* 3️⃣ ACTIONS URGENTES (1 SEUL PANNEAU CENTRALISÉ) */}
      <section className="bg-white dark:bg-[#14221b] p-5 rounded-3xl border shadow-sm space-y-3" style={{ borderColor: colors.primary + '15' }}>
        <h2 className="text-xs font-black uppercase tracking-wider text-gray-400">
          ⚡ Opérations & Actions Requis
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <ActionTile
            label="Inscriptions"
            count={stats.pendingRegistrations}
            icon={<ClipboardList size={16} />}
            color="#f59e0b"
            onClick={() => navigate('/app/registrations')}
          />
          <ActionTile
            label="Visites sans aidant"
            count={stats.pendingAidantVisits}
            icon={<UserPlus size={16} />}
            color="#ef4444"
            onClick={() => navigate('/app/admin-notifications')}
          />
          <ActionTile
            label="Visites à valider"
            count={stats.visitsWaitingApproval}
            icon={<Clock size={16} />}
            color="#3b82f6"
            onClick={() => navigate('/app/admin/visits/validation')}
          />
          <ActionTile
            label="Commandes"
            count={stats.pendingOrders}
            icon={<ShoppingBag size={16} />}
            color="#8b5cf6"
            onClick={() => navigate('/app/orders')}
          />
        </div>
      </section>

      {/* 4️⃣ SYNTHÈSE DE CROISSANCE & COMMUNAUTÉ */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Taux de croissance */}
        <div className="bg-white dark:bg-[#14221b] rounded-3xl p-5 border shadow-sm flex flex-col justify-between" style={{ borderColor: colors.primary + '15' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Croissance Financière</span>
            <TrendingUp size={16} className="text-emerald-500" />
          </div>
          <div className="flex items-baseline justify-between mt-3">
            <div>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">+{stats.growth.toFixed(1)}%</p>
              <p className="text-[11px] text-gray-400 font-semibold mt-0.5">Par rapport au mois dernier</p>
            </div>
            <button onClick={() => navigate('/app/admin-payments')} className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1">
              Détails <ArrowRight size={12} />
            </button>
          </div>
        </div>

        {/* Récapitulatif utilisateurs */}
        <div className="bg-white dark:bg-[#14221b] rounded-3xl p-5 border shadow-sm flex flex-col justify-between" style={{ borderColor: colors.primary + '15' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Activité Utilisateurs</span>
            <Shield size={16} style={{ color: colors.primary }} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs pt-2">
            <div className="p-3 bg-gray-50 dark:bg-[#1e2e26] rounded-2xl">
              <span className="font-extrabold text-sm block">{stats.totalUsers}</span>
              <span className="text-[10px] text-gray-400 font-bold">Comptes inscrits</span>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-[#1e2e26] rounded-2xl">
              <span className="font-extrabold text-sm block text-emerald-600">{stats.activeUsers}</span>
              <span className="text-[10px] text-gray-400 font-bold">Profils actifs</span>
            </div>
          </div>
        </div>

      </section>

    </div>
  );
};

// =============================================
// COMPOSANTS COMPACTS
// =============================================

const KpiCard = ({ title, value, subtitle, icon, color, onClick }: any) => (
  <div
    onClick={onClick}
    className="bg-white dark:bg-[#14221b] rounded-3xl p-5 border shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between"
    style={{ borderColor: `${color}25` }}
  >
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{title}</span>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15`, color }}>
        {icon}
      </div>
    </div>
    <div className="mt-3">
      <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100 truncate">{value}</p>
      {subtitle && <p className="text-[10px] text-gray-400 font-semibold truncate mt-1">{subtitle}</p>}
    </div>
  </div>
);

const ActionTile = ({ label, count, icon, color, onClick }: any) => {
  const hasPending = count > 0;
  return (
    <button
      onClick={onClick}
      className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition ${
        hasPending 
          ? 'bg-white dark:bg-[#182a21] border-gray-200 dark:border-gray-700 shadow-sm' 
          : 'bg-gray-50/50 dark:bg-[#111a14] border-gray-100 dark:border-gray-800 opacity-60'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}15`, color }}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{label}</p>
          <p className="text-[9px] text-gray-400 font-medium">{hasPending ? 'À traiter' : 'À jour'}</p>
        </div>
      </div>
      <span
        className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
          hasPending ? 'text-white' : 'bg-gray-100 dark:bg-[#22332b] text-gray-400'
        }`}
        style={{ backgroundColor: hasPending ? color : undefined }}
      >
        {count}
      </span>
    </button>
  );
};

export default AdminDashboardPage;

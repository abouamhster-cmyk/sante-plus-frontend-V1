// 📁 src/features/profile/pages/ProfilePage.tsx

import { useState, useEffect } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Phone, Camera, LogOut, Lock, Bell, Trash2,
  AlertCircle, ShieldCheck, User, Key, ChevronRight,
} from 'lucide-react';

import { useAuthStore }         from '@/stores/authStore';
import { usePatientStore }      from '@/stores/patientStore';
import { useVisitStore }        from '@/stores/visitStore';
import { useOrderStore }        from '@/stores/orderStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useBranding }          from '@/hooks/useBranding';
import { supabase }             from '@/lib/supabase';
import toast                    from 'react-hot-toast';

import { Button, DangerButton }        from '@/components/ui/Button';
import { Input }                        from '@/components/ui/Input';
import { Card, CardDivider }            from '@/components/ui/Card';
import { SectionTitle }                 from '@/components/ui/PageHeader';
import { DataRow }                      from '@/components/ui/Divider';
import { Modal, ModalActions }          from '@/components/ui/Modal';

// ─── Helpers ─────────────────────────────────────────────────
const getInitials = (name: string) =>
  name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'U';

const sanitizeFileName = (name: string) =>
  name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9.-]/g, '_');

// ============================================================
// PAGE
// ============================================================

const ProfilePage = () => {
  const navigate     = useNavigate();
  const brand        = useBranding();
  const colors       = brand.colors;

  const { profile, role, logout, updateProfile, refreshProfile } = useAuthStore();

  const handleLogout = async () => {
    const id = toast.loading('Déconnexion...');
    try { await logout(); toast.success('À bientôt !', { id }); }
    catch { toast.dismiss(id); }
    finally { navigate('/login', { replace: true }); }
  };

  const { patients, fetchPatients }    = usePatientStore();
  const { visits,   fetchVisits }      = useVisitStore();
  const { orders,   fetchOrders }      = useOrderStore();
  const toggleNotifications            = useNotificationStore(s => s.toggleNotifications);
  const notificationsEnabled           = useNotificationStore(s => s.notificationsEnabled);

  const [isEditing, setIsEditing]             = useState(false);
  const [isLoading, setIsLoading]             = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal,   setShowDeleteModal]   = useState(false);
  const [avatarFile,   setAvatarFile]   = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [imageError,   setImageError]   = useState(false);

  const [formData, setFormData] = useState({
    full_name: '', phone: '', email: '', notifications: true,
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '', newPassword: '', confirmPassword: '',
  });

  useEffect(() => {
    fetchPatients(); fetchVisits(); fetchOrders();
    setFormData(p => ({ ...p, notifications: notificationsEnabled }));
  }, [fetchPatients, fetchVisits, fetchOrders, notificationsEnabled]);

  useEffect(() => {
    if (!profile) return;
    setFormData(p => ({ ...p, full_name: profile.full_name || '', phone: profile.phone || '', email: profile.email || '' }));
    setAvatarPreview(profile.avatar_url || null);
    setImageError(false);
  }, [profile]);

  // ─── Handlers ───────────────────────────────────────────────

  const handleSaveProfile = async () => {
    if (!formData.full_name.trim()) return toast.error('Le nom est obligatoire');
    if (!profile?.id) return toast.error('Profil introuvable');
    setIsLoading(true);
    try {
      let avatarUrl = profile.avatar_url || null;
      if (avatarFile) {
        const cleanName = sanitizeFileName(avatarFile.name);
        const fileExt   = cleanName.split('.').pop() || 'png';
        const fileName  = `${profile.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, avatarFile, { upsert: true, contentType: avatarFile.type });
        if (uploadError) throw new Error(uploadError.message);
        avatarUrl = `${supabase.storage.from('avatars').getPublicUrl(fileName).data.publicUrl}?v=${Date.now()}`;
      }
      await updateProfile({ full_name: formData.full_name.trim(), phone: formData.phone.trim(), avatar_url: avatarUrl });
      setAvatarPreview(avatarUrl); setAvatarFile(null); setIsEditing(false);
      if (refreshProfile) await refreshProfile();
      toast.success('Profil mis à jour');
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de la mise à jour');
    } finally { setIsLoading(false); }
  };

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Veuillez sélectionner une image');
    if (file.size > 5 * 1024 * 1024) return toast.error("L'image ne doit pas dépasser 5 Mo");
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = ev => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!passwordData.currentPassword) return toast.error('Mot de passe actuel requis');
    if (passwordData.newPassword !== passwordData.confirmPassword) return toast.error('Les mots de passe ne correspondent pas');
    if (passwordData.newPassword.length < 6) return toast.error('Minimum 6 caractères requis');
    setIsLoading(true);
    try {
      const { user } = useAuthStore.getState();
      if (!user) throw new Error('Utilisateur non connecté');
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email!, password: passwordData.currentPassword });
      if (signInError) return toast.error('Mot de passe actuel incorrect');
      const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
      if (error) throw error;
      toast.success('Mot de passe mis à jour');
      setShowPasswordModal(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors du changement de mot de passe');
    } finally { setIsLoading(false); }
  };

  const handleDeleteAccount = async () => {
    setIsLoading(true);
    try {
      const { user } = useAuthStore.getState();
      if (!user) throw new Error('Utilisateur non trouvé');
      const { data: links } = await supabase.from('patient_family_links').select('patient_id').eq('family_id', user.id);
      const patientIds = links?.map(l => l.patient_id) || [];
      if (patientIds.length > 0) await supabase.from('patients').delete().in('id', patientIds);
      await supabase.from('patient_family_links').delete().eq('family_id', user.id);
      await supabase.from('inscriptions').delete().eq('user_id', user.id);
      await supabase.from('notifications').delete().eq('user_id', user.id);
      await supabase.from('profiles').delete().eq('id', user.id);
      await supabase.auth.signOut();
      toast.success('Compte supprimé');
      navigate('/login');
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de la suppression');
    } finally { setIsLoading(false); }
  };

  const getRoleLabel = () => {
    if (role === 'admin') return 'Administrateur';
    if (role === 'coordinator') return 'Coordinateur';
    if (role === 'aidant') return 'Aidant';
    return 'Famille';
  };

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-20 px-3 sm:px-0">

      {/* ── EN-TÊTE AVATAR + STATS ─────────────────────────── */}
      <Card padding="lg">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Avatar */}
          <div className="relative mx-auto sm:mx-0">
            <div
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center text-2xl font-black text-white overflow-hidden shadow-sm"
              style={{ backgroundColor: colors.primary }}
            >
              {avatarPreview && !imageError ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" onError={() => setImageError(true)} />
              ) : getInitials(profile?.full_name || '')}
            </div>
            {isEditing && (
              <label
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-2xl bg-white shadow-md flex items-center justify-center cursor-pointer border hover:scale-105 transition"
                style={{ color: colors.primary, borderColor: colors.border }}
              >
                <Camera size={15} />
                <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              </label>
            )}
          </div>

          {/* Infos */}
          <div className="flex-1 text-center sm:text-left min-w-0">
            <h1 className="text-xl font-extrabold truncate" style={{ color: colors.text }}>
              {profile?.full_name || 'Utilisateur'}
            </h1>
            <p className="text-[11px] font-bold uppercase tracking-wider flex items-center justify-center sm:justify-start gap-1 mt-1" style={{ color: colors.textLight }}>
              <ShieldCheck size={12} /> {getRoleLabel()}
            </p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-3 mt-1.5" style={{ color: colors.textLight }}>
              <span className="text-[11px] flex items-center gap-1"><Mail size={11} /> {profile?.email || '—'}</span>
              {profile?.phone && <span className="text-[11px] flex items-center gap-1"><Phone size={11} /> {profile.phone}</span>}
            </div>
          </div>

          <Button
            variant={isEditing ? 'ghost' : 'outline'}
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? 'Annuler' : 'Modifier'}
          </Button>
        </div>

        {/* Stats mini */}
        <CardDivider className="mt-4" />
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Proches',   value: patients.length },
            { label: 'Visites',   value: visits.length },
            { label: 'Commandes', value: orders.length },
          ].map(stat => (
            <div key={stat.label}>
              <span className="text-[11px] font-semibold block" style={{ color: colors.textLight }}>{stat.label}</span>
              <span className="text-base font-extrabold" style={{ color: colors.primary }}>{stat.value}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* ── ÉDITEUR ────────────────────────────────────────── */}
      {isEditing && (
        <Card padding="md">
          <SectionTitle className="mb-3">
            <User size={12} className="inline mr-1" />
            Modifier mes coordonnées
          </SectionTitle>
          <div className="space-y-3">
            <Input
              label="Nom complet"
              value={formData.full_name}
              onChange={e => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="Votre nom complet"
              iconLeft={<User size={13} />}
              required
            />
            <Input
              label="Téléphone"
              type="tel"
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+229 00 00 00 00"
              iconLeft={<Phone size={13} />}
            />
            <Button
              variant="primary"
              size="md"
              fullWidth
              isLoading={isLoading}
              onClick={handleSaveProfile}
            >
              Enregistrer les modifications
            </Button>
          </div>
        </Card>
      )}

      {/* ── INFORMATIONS + PRÉFÉRENCES + SÉCURITÉ ─────────── */}
      <Card padding="md">

        {/* Informations */}
        <SectionTitle><User size={12} className="inline mr-1.5" />Informations du compte</SectionTitle>
        <div className="space-y-1 mt-2">
          <DataRow label="Inscrit le" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR') : '—'} />
          <DataRow label="Statut" value={<span className="text-emerald-600 font-bold">Actif ●</span>} />
          <DataRow label="Rôle" value={getRoleLabel()} />
        </div>

        <CardDivider />

        {/* Préférences */}
        <SectionTitle><Bell size={12} className="inline mr-1.5" />Préférences</SectionTitle>
        <button
          onClick={() => { toggleNotifications?.(); setFormData(p => ({ ...p, notifications: !p.notifications })); toast.success(!formData.notifications ? 'Notifications activées' : 'Notifications désactivées'); }}
          className="w-full flex items-center justify-between p-3.5 border rounded-2xl hover:bg-black/[0.02] transition mt-2"
          style={{ borderColor: colors.border + '60' }}
        >
          <div className="flex items-center gap-3" style={{ color: colors.text }}>
            <Bell size={15} />
            <span className="text-xs font-bold">Notifications Push</span>
          </div>
          <span
            className="text-[10px] font-bold px-2.5 py-1 rounded-full"
            style={formData.notifications
              ? { background: '#dcfce7', color: '#16a34a' }
              : { background: colors.border + '40', color: colors.textLight }}
          >
            {formData.notifications ? 'Activées' : 'Désactivées'}
          </span>
        </button>

        <CardDivider />

        {/* Sécurité */}
        <SectionTitle><Lock size={12} className="inline mr-1.5" />Sécurité & Accès</SectionTitle>
        <div className="space-y-2 mt-2">
          <button
            onClick={() => setShowPasswordModal(true)}
            className="w-full flex items-center justify-between p-3.5 border rounded-2xl hover:bg-black/[0.02] transition"
            style={{ borderColor: colors.border + '60', color: colors.text }}
          >
            <div className="flex items-center gap-3 text-xs font-bold">
              <Key size={15} /> Changer le mot de passe
            </div>
            <ChevronRight size={15} style={{ color: colors.textLight }} />
          </button>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full flex items-center justify-between p-3.5 border rounded-2xl transition text-xs font-bold"
            style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#dc2626' }}
          >
            <div className="flex items-center gap-3">
              <Trash2 size={15} /> Supprimer définitivement le compte
            </div>
          </button>
        </div>
      </Card>

      {/* ── DÉCONNEXION ────────────────────────────────────── */}
      <button
        onClick={handleLogout}
        className="w-full py-4 rounded-2xl border text-xs font-bold flex justify-center items-center gap-2 transition hover:bg-red-50"
        style={{ borderColor: '#fecaca', color: '#ef4444' }}
      >
        <LogOut size={15} /> Se déconnecter
      </button>

      {/* ── MODALE MOT DE PASSE ────────────────────────────── */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Changer le mot de passe"
        icon={<Key size={18} />}
        maxWidth="sm"
        actions={
          <ModalActions>
            <Button variant="ghost" size="sm" onClick={() => setShowPasswordModal(false)}>Annuler</Button>
            <Button variant="primary" size="sm" type="submit" form="password-form" isLoading={isLoading}>Changer</Button>
          </ModalActions>
        }
      >
        <form id="password-form" onSubmit={handleChangePassword} className="space-y-3">
          <Input
            label="Mot de passe actuel"
            type="password"
            value={passwordData.currentPassword}
            onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
            placeholder="••••••••"
            required
          />
          <Input
            label="Nouveau mot de passe"
            type="password"
            value={passwordData.newPassword}
            onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
            placeholder="6 caractères minimum"
            helper="Au moins 6 caractères"
            required
          />
          <Input
            label="Confirmer le nouveau mot de passe"
            type="password"
            value={passwordData.confirmPassword}
            onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
            placeholder="••••••••"
            required
          />
        </form>
      </Modal>

      {/* ── MODALE SUPPRESSION ─────────────────────────────── */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Supprimer le compte ?"
        icon={<AlertCircle size={18} />}
        maxWidth="sm"
        actions={
          <ModalActions>
            <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(false)}>Annuler</Button>
            <DangerButton size="sm" isLoading={isLoading} onClick={handleDeleteAccount}>
              Supprimer définitivement
            </DangerButton>
          </ModalActions>
        }
      >
        <p className="text-sm leading-relaxed" style={{ color: '#6b7280' }}>
          Cette action supprimera <strong>définitivement</strong> votre profil, vos bénéficiaires et toutes vos données. Elle est <strong>irréversible</strong>.
        </p>
      </Modal>
    </div>
  );
};

export default ProfilePage;

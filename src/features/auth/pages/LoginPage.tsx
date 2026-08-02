// 📁 src/features/auth/pages/LoginPage.tsx

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useBranding } from '@/hooks/useBranding';
import toast from 'react-hot-toast';

// ─── Traduction des erreurs Supabase ────────────────────────
const traduireErreurAuth = (message: string): string => {
  const m = (message || '').toLowerCase();
  if (m.includes('invalid login credentials') || m.includes('invalid credentials'))
    return 'E-mail ou mot de passe incorrect. Vérifiez vos identifiants.';
  if (m.includes('email not confirmed'))
    return "Votre adresse e-mail n'a pas encore été confirmée. Consultez votre boîte de réception.";
  if (m.includes('too many requests') || m.includes('rate limit'))
    return 'Trop de tentatives. Patientez quelques minutes avant de réessayer.';
  if (m.includes('user not found'))
    return "Aucun compte n'est associé à cette adresse e-mail.";
  if (m.includes('network') || m.includes('fetch'))
    return 'Connexion au serveur impossible. Vérifiez votre connexion internet.';
  if (m.includes('user is banned') || m.includes('disabled'))
    return "Ce compte a été désactivé. Contactez l'administration.";
  return message || 'Une erreur est survenue. Veuillez réessayer.';
};

// ============================================================
// PAGE
// ============================================================

const LoginPage = () => {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const brand = useBranding();
  const colors = brand.colors;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) { toast.error('Veuillez saisir votre adresse e-mail'); return; }
    if (!password)   { toast.error('Veuillez saisir votre mot de passe');   return; }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error)      { toast.error(traduireErreurAuth(error.message)); return; }
      if (!data?.user) { toast.error('E-mail ou mot de passe incorrect');    return; }

      const { data: profile, error: profileError } = await supabase
        .from('profiles').select('*').eq('id', data.user.id).maybeSingle();

      if (profileError) { toast.error('Erreur lors de la récupération du profil'); return; }

      if (!profile) {
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({ id: data.user.id, full_name: data.user.user_metadata?.full_name || 'Utilisateur', email: data.user.email, phone: data.user.user_metadata?.phone || null, role: 'family', is_active: true })
          .select('*').single();
        if (createError) { toast.error('Erreur lors de la création du profil'); return; }
        localStorage.setItem('sante_plus_theme', 'senior');
        setUser(data.user, newProfile);
        toast.success('Bienvenue sur Santé Plus !');
        navigate('/app', { replace: true });
        return;
      }

      if (profile.role === 'aidant' && !profile.is_active) {
        toast.error("⏳ Votre compte aidant est en attente de validation par l'administration.");
        await supabase.auth.signOut();
        return;
      }

      localStorage.setItem('sante_plus_theme',
        profile.role === 'family' && profile.patient_category === 'maman_bebe' ? 'maman' : 'senior'
      );
      setUser(data.user, profile);
      const prenom = (profile.full_name || '').split(' ')[0];
      toast.success(prenom ? `Bon retour, ${prenom} !` : 'Bienvenue !');
      navigate('/app', { replace: true });

    } catch (error: any) {
      toast.error(error.message || 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{ background: colors.background }}
    >
      <div className="w-full max-w-sm">

        {/* Logo + nom centré au-dessus de la carte */}
        <div className="flex flex-col items-center mb-6 gap-3">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-md"
            style={{ background: colors.gradient }}
          >
            <Logo size="sm" showText={false} whiteBg={false} />
          </div>
          <div className="text-center">
            <h1 className="text-base font-extrabold" style={{ color: colors.text }}>
              Santé Plus Services
            </h1>
            <p className="text-[11px] mt-0.5" style={{ color: colors.textLight }}>
              Coordination de soins à domicile
            </p>
          </div>
        </div>

        {/* Carte formulaire */}
        <div
          className="rounded-2xl p-6 shadow-sm border"
          style={{ backgroundColor: colors.surface, borderColor: colors.border + '60' }}
        >
          <p className="text-sm font-extrabold mb-4" style={{ color: colors.text }}>
            Connexion à votre espace
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              label="Adresse e-mail"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="exemple@email.com"
              iconLeft={<Mail size={13} />}
              autoComplete="email"
              disabled={isLoading}
              required
            />

            <Input
              label="Mot de passe"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              iconLeft={<Lock size={13} />}
              autoComplete="current-password"
              disabled={isLoading}
              required
            />

            <div className="text-right -mt-1">
              <Link
                to="/forgot-password"
                className="text-[11px] font-semibold hover:underline"
                style={{ color: colors.primary }}
              >
                Mot de passe oublié ?
              </Link>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isLoading}
              iconRight={!isLoading ? <ArrowRight size={15} /> : undefined}
            >
              Se connecter
            </Button>
          </form>

          {/* Lien inscription */}
          <div
            className="mt-4 pt-4 text-center text-[11px] border-t"
            style={{ borderColor: colors.border + '40' }}
          >
            <p style={{ color: colors.textLight }}>
              Nouveau sur Santé Plus ?{' '}
              <Link
                to="/register"
                className="font-bold hover:underline"
                style={{ color: colors.primary }}
              >
                Créer un compte
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

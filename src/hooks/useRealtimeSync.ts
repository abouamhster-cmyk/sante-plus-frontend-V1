// 📁 src/hooks/useRealtimeSync.ts
// ============================================================
// 🔄 SYNCHRONISATION TEMPS RÉEL — FILTRÉE CÔTÉ SERVEUR
// ============================================================
//
// LE PROBLÈME CORRIGÉ ICI
// -----------------------
// L'ancienne version souscrivait ainsi :
//
//     { event: '*', schema: 'public', table: 'visites' }    // aucun filtre
//
// Sans filtre, Supabase pousse vers CHAQUE navigateur connecté un événement
// pour CHAQUE modification de visite de TOUTE la plateforme. Chaque
// navigateur réagit en rechargeant sa propre liste.
//
// Le coût ne croît donc pas avec le nombre d'utilisateurs (N), mais avec
// N × M (M = modifications par seconde). Avec 10 000 personnes connectées et
// une visite modifiée par seconde, c'est 10 000 requêtes simultanées sur
// /api/visits — pour un seul changement qui ne concernait qu'une personne.
// C'est le schéma du « thundering herd » : le système s'auto-alimente
// jusqu'à saturation. Il ne ralentit pas, il s'effondre d'un coup.
//
// LA CORRECTION
// -------------
// On déclare le filtre CÔTÉ SERVEUR, dans la souscription elle-même.
// Supabase n'envoie alors au navigateur que les événements qui le
// concernent. Un utilisateur reçoit quelques événements par jour au lieu
// de plusieurs par seconde.
//
// Filtres acceptés par Supabase Realtime : eq, neq, lt, lte, gt, gte, in.
// Pas de jointure possible — d'où la nécessité de connaître à l'avance
// les identifiants à filtrer (patientIds, aidantId).
//
// CORRESPONDANCE AVEC LA LOGIQUE MÉTIER
// -------------------------------------
// Les filtres reproduisent exactement ce que fait le backend dans
// GET /visits (voir visit.routes.js) :
//
//   famille  →  user_id = uid  OU  patient_id ∈ (ses bénéficiaires)
//   aidant   →  aidant_id = aidants.id   ⚠️ PAS auth.uid()
//   admin    →  tout (aucun filtre possible, mais ils sont peu nombreux)
//
// Un canal Supabase accepte plusieurs `.on()` : c'est ainsi qu'on exprime
// le « OU » de la famille, un filtre ne pouvant porter que sur une colonne.
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useVisitStore } from '@/stores/visitStore';
import { useOrderStore } from '@/stores/orderStore';
import { usePatientStore } from '@/stores/patientStore';

// Regroupement des rafales : un admin qui valide 10 visites d'affilée
// ne déclenche qu'un seul rechargement. 1,5 s reste imperceptible.
const REALTIME_DEBOUNCE_MS = 1500;

export const useRealtimeSync = (enabled: boolean) => {
  const { user, profile } = useAuthStore();
  const patients = usePatientStore((s) => s.patients);

  // Identifiant dans la table `aidants` — distinct de auth.uid().
  // visites.aidant_id référence aidants(id) : comparer à auth.uid()
  // donnerait toujours faux (c'était la cause de plusieurs bugs RLS).
  const [aidantId, setAidantId] = useState<string | null>(null);

  const role = profile?.role;
  const userId = user?.id;

  // Clé stable : ne recrée les canaux que si la liste change réellement,
  // pas à chaque rendu (un tableau est une nouvelle référence à chaque fois).
  const patientIdsKey = patients.map((p: any) => p.id).sort().join(',');

  // ── Récupération de l'identifiant aidant ────────────────────
  useEffect(() => {
    if (!enabled || role !== 'aidant' || !userId) {
      setAidantId(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('aidants')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setAidantId(data?.id ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, role, userId]);

  // ── Souscriptions ───────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !userId || !role) return;
    // Un aidant sans identifiant résolu ne peut pas être filtré :
    // mieux vaut ne rien souscrire que de tout écouter.
    if (role === 'aidant' && !aidantId) return;

    const pending = { visits: false, orders: false };

    const runFetchVisits = () => {
      useVisitStore.getState().invalidateCache();
      useVisitStore.getState().fetchVisits(true);
    };
    const runFetchOrders = () => {
      useOrderStore.getState().invalidateCache();
      useOrderStore.getState().fetchOrders(true);
    };

    let visitTimeout: ReturnType<typeof setTimeout>;
    const debouncedFetchVisits = () => {
      clearTimeout(visitTimeout);
      visitTimeout = setTimeout(() => {
        // Onglet en arrière-plan : on note la dette, on ne recharge pas.
        // Un onglet ouvert toute la journée ne génère aucune requête.
        if (document.hidden) {
          pending.visits = true;
          return;
        }
        runFetchVisits();
      }, REALTIME_DEBOUNCE_MS);
    };

    let orderTimeout: ReturnType<typeof setTimeout>;
    const debouncedFetchOrders = () => {
      clearTimeout(orderTimeout);
      orderTimeout = setTimeout(() => {
        if (document.hidden) {
          pending.orders = true;
          return;
        }
        runFetchOrders();
      }, REALTIME_DEBOUNCE_MS);
    };

    // Au retour de l'utilisateur, on rattrape ce qui a été différé.
    const handleVisibility = () => {
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
    document.addEventListener('visibilitychange', handleVisibility);

    const isStaff = role === 'admin' || role === 'coordinator';
    const patientIds = patientIdsKey ? patientIdsKey.split(',') : [];

    // ────────────────────────────────────────────────────────
    // CANAL VISITES
    // ────────────────────────────────────────────────────────
    const visitsChannel = supabase.channel(`rt_visites_${userId}`);

    if (isStaff) {
      // Admins et coordinateurs ont besoin d'une vue globale et sont peu
      // nombreux : l'amplification reste négligeable pour eux.
      visitsChannel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visites' },
        debouncedFetchVisits
      );
    } else if (role === 'aidant') {
      visitsChannel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visites', filter: `aidant_id=eq.${aidantId}` },
        debouncedFetchVisits
      );
    } else {
      // Famille — deux souscriptions pour exprimer le « OU » métier.
      visitsChannel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visites', filter: `user_id=eq.${userId}` },
        debouncedFetchVisits
      );
      if (patientIds.length > 0) {
        visitsChannel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'visites',
            filter: `patient_id=in.(${patientIds.join(',')})`,
          },
          debouncedFetchVisits
        );
      }
    }
    visitsChannel.subscribe();

    // ────────────────────────────────────────────────────────
    // CANAL COMMANDES
    // ────────────────────────────────────────────────────────
    const ordersChannel = supabase.channel(`rt_commandes_${userId}`);

    if (isStaff) {
      ordersChannel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'commandes' },
        debouncedFetchOrders
      );
    } else if (role === 'aidant') {
      // Ses propres commandes assignées.
      ordersChannel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'commandes', filter: `aidant_id=eq.${aidantId}` },
        debouncedFetchOrders
      );
      // ⚠️ COMPROMIS ASSUMÉ : un aidant doit aussi voir apparaître les
      // commandes du pool commun, qui ont aidant_id = NULL. Aucun filtre
      // Realtime ne permet d'exprimer « aidant_id IS NULL », on filtre donc
      // sur le statut. Un aidant reçoit donc encore les événements de toutes
      // les commandes disponibles de la plateforme.
      //
      // C'est acceptable aujourd'hui : les aidants sont bien moins nombreux
      // que les familles, et ce pool partagé est au cœur du métier.
      // Si le nombre d'aidants devient important, la solution propre est une
      // colonne dénormalisée (par exemple `zone`) permettant de filtrer
      // `zone=eq.${zoneAidant}`.
      ordersChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'commandes',
          filter: 'status=in.(creee,en_attente,disponible)',
        },
        debouncedFetchOrders
      );
    } else {
      // Famille — la table `commandes` possède user_id ET family_id
      // (les deux uuid). On couvre les deux.
      ordersChannel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'commandes', filter: `user_id=eq.${userId}` },
        debouncedFetchOrders
      );
      ordersChannel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'commandes', filter: `family_id=eq.${userId}` },
        debouncedFetchOrders
      );
    }
    ordersChannel.subscribe();

    return () => {
      clearTimeout(visitTimeout);
      clearTimeout(orderTimeout);
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.removeChannel(visitsChannel);
      supabase.removeChannel(ordersChannel);
    };
  }, [enabled, userId, role, aidantId, patientIdsKey]);
};

export default useRealtimeSync;

// 📁 src/lib/firebase.ts

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import { getAnalytics, isSupported as isAnalyticsSupported, Analytics } from 'firebase/analytics';

// ============================================================
// CONFIGURATION FIREBASE
// ============================================================
// Ces valeurs étaient codées en dur. Elles sont désormais lues depuis les
// variables d'environnement, avec un REPLI sur les anciennes valeurs pour ne
// rien casser si les variables ne sont pas encore définies sur Vercel.
//
// ℹ️ À savoir : une clé API Firebase côté web N'EST PAS un secret. Elle est
// forcément visible dans le bundle JavaScript livré au navigateur — l'externaliser
// ne la « cache » donc pas. Ce qui protège réellement vos données, ce sont :
//    1. les règles de sécurité Firebase (Firestore/Storage Rules) ;
//    2. la restriction de la clé par domaine (Google Cloud Console →
//       Identifiants → Restrictions de référents HTTP).
//
// 🚨 ACTION REQUISE : vérifiez ces deux points. Une clé Firebase publique
// combinée à des règles ouvertes (`allow read, write: if true`) laisserait
// n'importe qui lire ou écrire vos données.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD9a_D_5nQCwUH9LJssDdyOFGCRHm8VvcU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "sante-plus-services-react.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "sante-plus-services-react",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "sante-plus-services-react.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "418910358878",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:418910358878:web:419cf684292515e17953cf",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-7WGYHF8R7M"
};

// Clé VAPID publique — publique par nature (elle sert à identifier votre
// serveur auprès du navigateur). La clé PRIVÉE, elle, reste côté backend.
const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "BOpnRL7xQjAbTUpp54ICOabzXZNWHmLqLYAEA0uKubtvDrJNHteoxE7UGnLlPbvgCWPYlwcwQdPGRfShNBBi0Bc";

let app: FirebaseApp | undefined;
let messaging: Messaging | undefined;
let analytics: Analytics | undefined;

try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    console.log('✅ Firebase initialisé');
  } else {
    app = getApp();
    console.log('✅ Firebase déjà initialisé');
  }

  if (typeof window !== 'undefined') {
    isAnalyticsSupported().then((supported) => {
      if (supported && app) {
        analytics = getAnalytics(app);
        console.log('✅ Firebase Analytics activé');
      }
    });
  }
} catch (error) {
  console.error('❌ Erreur initialisation Firebase:', error);
}

// ✅ Attendre que le SW soit prêt ET pleinement actif (Évite l'erreur 'no active Service Worker')
const waitForServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) return null;

  try {
    // 1️⃣ On attend que l'API native confirme que le Service Worker est prêt
    const reg = await navigator.serviceWorker.ready;

    // 2️⃣ Double sécurité : si pour une raison quelconque reg.active est temporairement null,
    // on attend par petits paliers que l'activation soit complétée par le navigateur
    let attempts = 0;
    while (!reg.active && attempts < 15) {
      console.log(`⏳ Attente de l'activation du Service Worker (Tentative ${attempts + 1})...`);
      await new Promise(resolve => setTimeout(resolve, 200));
      attempts++;
    }

    if (!reg.active) {
      console.warn("⚠️ Le Service Worker est prêt mais n'a pas pu être activé à temps.");
    } else {
      console.log('📡 Service Worker actif et prêt pour Firebase :', reg);
    }

    return reg;
  } catch (error) {
    console.error('❌ Erreur attente SW:', error);
    return null;
  }
};

// ✅ Obtenir le token FCM
export const getFCMToken = async (): Promise<string | null> => {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn('⚠️ Firebase Messaging non supporté');
      return null;
    }

    if (!messaging && app) {
      messaging = getMessaging(app);
    }

    if (!messaging) {
      console.warn('⚠️ Messaging non initialisé');
      return null;
    }

    const swRegistration = await waitForServiceWorker();
    if (!swRegistration) {
      console.warn('⚠️ Aucun Service Worker disponible');
      return null;
    }

    console.log('📡 SW Registration pour getToken:', swRegistration);

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (token) {
      console.log('✅ FCM Token obtenu:', token.substring(0, 30) + '...');
      return token;
    } else {
      console.warn('⚠️ Aucun token FCM');
      return null;
    }
  } catch (error) {
    console.error('❌ Erreur getFCMToken:', error);
    return null;
  }
};

export const onFCMessage = (callback: (payload: any) => void) => {
  try {
    if (!messaging && app) {
      messaging = getMessaging(app);
    }
    if (messaging) {
      onMessage(messaging, callback);
      console.log('✅ Écoute FCM activée (foreground)');
    }
  } catch (error) {
    console.error('❌ Erreur onFCMessage:', error);
  }
};

export const getMessagingInstance = (): Messaging | undefined => {
  if (!messaging && app) {
    messaging = getMessaging(app);
  }
  return messaging;
};

export { app, messaging, analytics, VAPID_KEY };

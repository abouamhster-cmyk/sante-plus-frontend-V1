# Santé Plus — Frontend

PWA React 18 + TypeScript + Vite pour l'application Santé Plus.

---

## Installation

```bash
npm install
cp .env.example .env.local
# Renseignez les valeurs dans .env.local
npm run dev
```

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement (port 5173) |
| `npm run build` | Build de production (`tsc` + `vite build`) |
| `npm run preview` | Prévisualise le build |
| `npm run typecheck` | Vérifie les types sans générer de fichiers |

---

## ⚠️ Règle absolue sur les variables `VITE_`

Tout ce qui commence par `VITE_` est **intégré au bundle JavaScript** envoyé au
navigateur. C'est donc **public** : n'importe quel visiteur peut le lire via
`F12 → Sources`.

**Ne mettez JAMAIS dans le front :**

- ❌ `SUPABASE_SERVICE_ROLE_KEY`
- ❌ `FEDAPAY_SECRET_KEY`
- ❌ `VAPID_PRIVATE_KEY`
- ❌ toute clé privée

Ces secrets restent exclusivement côté backend.

### À propos de la clé Firebase

La clé API Firebase côté web **n'est pas un secret** — elle est forcément visible
dans le bundle. Ce qui protège réellement vos données :

1. Les **Security Rules** Firebase (Firestore / Storage)
2. La **restriction par domaine** de la clé
   (Google Cloud Console → Identifiants → Restrictions de référents HTTP)

> 🚨 **Action requise** : vérifiez ces deux points. Une clé publique combinée à des
> règles ouvertes (`allow read, write: if true`) laisse n'importe qui lire et
> écrire vos données.

---

## Architecture

```
src/
├── components/     Composants transverses (UI, layout, guards, PWA…)
├── features/       Organisation par domaine métier
│   ├── admin/  aidants/  auth/  billing/  dashboard/  discharge/
│   ├── education/  help/  journal/  map/  messages/
│   └── notifications/  orders/  patients/  profile/  visits/
├── hooks/          Hooks React réutilisables
├── lib/            Clients (api, supabase, firebase), utilitaires
├── stores/         État global Zustand (15 stores)
├── types/          Types TypeScript partagés
└── utils/          Helpers, validateurs, PWA
```

**Note :** le routeur est défini directement dans `src/App.tsx`.
Les anciens `src/app/Router.tsx` et `src/app/Providers.tsx` étaient du code mort
(jamais importés) et ont été supprimés.

---

## Ce qui a été corrigé dans cette version

| Correction | Détail |
|---|---|
| **ErrorBoundary** | Une erreur de rendu affichait un **écran blanc total**. Un écran de secours s'affiche désormais, avec bouton de reprise. |
| **Logs de production** | Plus de 500 `console.*` exposaient identifiants et données patients dans la console navigateur. Supprimés du bundle prod ; le code source est inchangé. |
| **Config Firebase** | Externalisée en variables d'environnement, **avec repli** sur les anciennes valeurs — rien ne casse si les variables ne sont pas encore définies sur Vercel. |
| **En-têtes de sécurité** | `X-Frame-Options`, `X-Content-Type-Options`, `HSTS`, `Referrer-Policy`, `Permissions-Policy`. |
| **Sourcemaps** | Désactivées en production (elles exposaient tout le code source original). |
| **Code mort** | 5 fichiers orphelins supprimés, après vérification qu'aucun import ne les référence. |

Le **design n'a pas été modifié** : l'ErrorBoundary reprend les variables CSS du
thème existant, et aucun composant d'interface n'a été touché.

---

## Points d'attention restants

- **Taille du bundle** : ~611 KB gzippés (`vendor` 428 KB + `index` 183 KB).
  C'est lourd pour des connexions mobiles. Piste : `React.lazy()` sur les pages
  admin, et découpage plus fin de `maplibre-gl` et `firebase`.
- **486 usages de `any`** : `strict: true` est actif, mais ces `any` en annulent
  une bonne partie du bénéfice. À réduire progressivement.
- **Aucun test** ni monitoring d'erreurs (brancher Sentry dans `ErrorBoundary.tsx`,
  l'emplacement est indiqué en commentaire).
- **`React.StrictMode`** est volontairement désactivé : il double-monte les
  composants en développement, ce qui perturberait vos abonnements Realtime
  Supabase et les gardes `useRef` d'`App.tsx`. À tester avant activation.

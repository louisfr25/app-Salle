# Guide de déploiement — Salle iOS

## 1. Supabase (base de données)

### a) Créer le projet
1. Va sur [supabase.com](https://supabase.com) → New project
2. Nom : `salle-app`, région : Europe West

### b) Appliquer le schéma
Dans **SQL Editor** de Supabase, exécute dans l'ordre :
```
supabase/schema.sql   ← structure + RLS + fonctions
supabase/seed.sql     ← exercices + achievements de base
```

### c) Récupérer les clés
Settings → API → copie :
- `Project URL` → `EXPO_PUBLIC_SUPABASE_URL`
- `anon public` → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### d) Configurer `.env.local`
```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## 2. Développement local

```bash
cd salle-app
npm install
npx expo start
```

Scan le QR code avec **Expo Go** sur ton iPhone (même réseau Wi-Fi).

---

## 3. Déploiement iOS (App Store)

### Option A — EAS Build (recommandé, depuis Windows)

```bash
# 1. Installer EAS CLI
npm install -g eas-cli

# 2. Se connecter à Expo
eas login

# 3. Configurer EAS
eas build:configure

# 4. Build iOS (cloud, ne nécessite pas de Mac)
eas build --platform ios --profile preview

# 5. Soumettre à l'App Store
eas submit --platform ios
```

### Option B — Xcode (nécessite un Mac)

```bash
# 1. Générer le projet natif
npx expo prebuild --platform ios

# 2. Ouvrir dans Xcode
open ios/SalleApp.xcworkspace

# 3. Archive → Distribute App dans Xcode
```

---

## 4. Variables d'environnement EAS

Dans `eas.json` (créé par `eas build:configure`), ajoute les secrets :

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://..."
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ..."
```

---

## 5. Structure du projet

```
salle-app/
├── app/                        # Expo Router (file-based routing)
│   ├── _layout.tsx             # Root (auth check + Supabase init)
│   ├── index.tsx               # Redirect auth/tabs
│   ├── (auth)/index.tsx        # Landing + Login + Signup
│   ├── (tabs)/
│   │   ├── _layout.tsx         # Tab bar navigation
│   │   ├── index.tsx           # Dashboard
│   │   ├── calendar.tsx        # Planning / calendrier
│   │   ├── train.tsx           # Hub entraînement
│   │   ├── stats.tsx           # Performances / records
│   │   └── profile.tsx         # Profil + settings
│   ├── train/active.tsx        # Mode entraînement actif
│   ├── program/
│   │   ├── index.tsx           # Mon programme (voir + modifier)
│   │   └── generate.tsx        # Créer programme (IA ou manuel)
│   ├── body.tsx                # Analyse musculaire
│   ├── daily.tsx               # Suivi quotidien
│   ├── rankings.tsx            # Classements
│   └── settings.tsx            # Paramètres
├── components/ui/              # Composants réutilisables
├── constants/
│   ├── theme.ts                # Palettes Volt/Pulse/Mono
│   └── exercises.ts            # Bibliothèque d'exercices
├── lib/
│   ├── supabase.ts             # Client Supabase
│   ├── database.types.ts       # Types TypeScript (schema)
│   └── store/
│       ├── useAppStore.ts      # State global (profil, palette)
│       └── useWorkoutStore.ts  # State séance active
└── supabase/
    ├── schema.sql              # Schéma PostgreSQL + RLS
    └── seed.sql                # Données de test
```

---

## 6. Schéma BDD (résumé)

| Table | Description |
|-------|-------------|
| `profiles` | Utilisateurs (étend auth.users) |
| `exercises` | Bibliothèque d'exercices |
| `programs` | Plans d'entraînement |
| `program_sessions` | Séances dans un programme |
| `session_exercises` | Exercices dans une séance |
| `workout_logs` | Séances complétées |
| `set_logs` | Séries individuelles |
| `daily_logs` | Suivi poids/macros/pas |
| `personal_records` | Records personnels |
| `achievements` | Badges disponibles |
| `user_achievements` | Badges débloqués |
| `muscle_volume_weeks` | Volume musculaire hebdo |

Toutes les tables ont **Row Level Security** — les utilisateurs ne voient que leurs propres données.

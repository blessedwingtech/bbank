# 🏦 B-Bank - Application de Gestion Bancaire & Micro-Crédit

B-Bank est une application web bancaire et de micro-crédit développée de zéro avec **NestJS**, **TypeScript (Strict Mode)**, **Prisma ORM**, **PostgreSQL**, **EJS**, **HTMX** et **Bootstrap 5**.

---

## 🛠️ Stack Technique

### Backend
- **Framework** : NestJS (dernière version stable)
- **Langage** : TypeScript (mode strict activé)
- **Base de données & ORM** : PostgreSQL avec **Prisma ORM**
- **Validation** : `class-validator` + `class-transformer` (ValidationPipe global avec `whitelist`, `forbidNonWhitelisted`, `transform`)
- **Sessions** : `express-session` avec store PostgreSQL persistant (`connect-pg-simple`)
- **Sécurité** :
  - Hachage fort des mots de passe : `bcrypt` (12 salt rounds)
  - Protection CSRF : `csurf` sur tous les formulaires POST/DELETE
  - En-têtes HTTP de sécurité : `helmet`
  - Limitation du débit : `@nestjs/throttler` (5 requêtes/min max sur l'authentification)
  - Contrôle d'accès basé sur les rôles : `RolesGuard` (`admin`, `manager`, `user`)
  - Contrôle anti-IDOR : vérification d'appartenance systématique sur chaque ressource accessible par ID
- **Planification (Cron)** : `@nestjs/schedule` pour le calcul automatique mensuel des intérêts sur comptes d'épargne (0.5% / mois)
- **Génération PDF** : `PDFKit` pour les relevés de compte officiels téléchargeables
- **Logging** : `Winston` avec rotation quotidienne (`winston-daily-rotate-file`) et masquage automatique des données sensibles (`password`, `token`, `secret`)
- **Tests** : Jest (tests unitaires complets) + Supertest (tests E2E)

### Frontend
- **Moteur de templates** : EJS avec layouts et partials dynamiques
- **Interactivité & Expérience SPA** : **HTMX v2** (transitions sans rechargement complet de page, formulaires asynchrones, recherche en temps réel)
- **Design & UI** : Bootstrap 5 + FontAwesome 6
- **Tableaux de données** : DataTables avec tri, recherche, pagination et boutons d'export (Excel, PDF, Impression)
- **Alertes & Confirmations** : SweetAlert2 (confirmations avant suppression, gel/dégel de compte)

---

## 📁 Architecture du Projet

```text
src/
├── main.ts                          # Bootstrap NestJS, Helmet, CSRF, EJS, Sessions
├── app.module.ts                    # Module racine, injection globale des Guards & Interceptors
├── app.controller.ts                # Redirection racine
├── app.service.ts
├── config/
│   ├── app.config.ts                # Configuration globale depuis .env
│   ├── session.config.ts            # Configuration des sessions PostgreSQL
│   └── winston.config.ts            # Configuration du logger Winston sécurisé
├── prisma/
│   ├── prisma.service.ts            # Service PrismaClient OnModuleInit/Destroy
│   └── prisma.module.ts             # Module global Prisma
├── common/
│   ├── decorators/                  # @Roles(), @CurrentUser(), @Public()
│   ├── guards/                      # AuthGuard (global), RolesGuard
│   ├── interceptors/                # SerializeInterceptor (masquage données sensibles)
│   ├── filters/                     # HttpExceptionFilter (gestion pages 403, 404, 500)
│   ├── middleware/                  # session-locals, csrf, audit-log
│   └── pipes/                       # parse-positive-int.pipe.ts
└── modules/
    ├── auth/                        # Inscription, connexion, déconnexion, rate limiting
    ├── user/                        # Gestion utilisateurs (admin/manager), soft delete
    ├── account/                     # Comptes bancaires (BB-XXXXXXXX), gel/dégel, InterestService
    ├── transaction/                 # Dépôts (0.9% frais), Retraits (1% frais), atomicité DB
    ├── transfer/                    # Virements internes atomiques & virements externes SEPA
    ├── fee/                         # Traçabilité des frais bancaires
    ├── statement/                   # Relevés bancaires avec filtres de date et export PDF
    ├── audit-log/                   # Logs de sécurité et requêtes HTTP (admin only)
    └── dashboard/                   # Tableau de bord dynamique avec statistiques en temps réel
```

---

## 🚀 Installation & Démarrage

### 1. Cloner le dépôt et installer les dépendances
```bash
git clone https://github.com/blessedwingtech/bbank.git
cd bbank
npm install
```

### 2. Configuration des variables d'environnement
Créez un fichier `.env` basé sur `.env.example` :
```env
APP_PORT=3000
NODE_ENV=development

# Base de données PostgreSQL
DATABASE_URL="postgresql://postgres:VOTRE_MOT_DE_PASSE@localhost:5432/banking?schema=public"

# Sessions
SESSION_SECRET=bbank_super_secret_session_key_64_characters_long_banking_secure_2025
SESSION_MAX_AGE=86400000

# Base de données pour le store de session
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=VOTRE_MOT_DE_PASSE
DB_DATABASE=banking

# Sécurité & Taux d'intérêt
BCRYPT_SALT_ROUNDS=12
THROTTLE_TTL=60
THROTTLE_LIMIT=10
SAVINGS_INTEREST_RATE=0.005
```

### 3. Créer la base de données PostgreSQL
```bash
psql -U postgres -c "CREATE DATABASE banking;"
```

### 4. Générer le client Prisma et appliquer les migrations
```bash
npx prisma generate
npx prisma migrate dev --name init_postgresql
```

### 5. Insérer les données par défaut (Seed)
```bash
npm run db:seed
```

### 6. Lancer les tests
```bash
# Tests unitaires
npm test

# Tests E2E
npm run test:e2e
```

### 7. Démarrer l'application
```bash
# Mode développement
npm run start:dev

# Mode production
npm run build
npm run start:prod
```

Accédez à l'application sur [http://localhost:3000](http://localhost:3000).

---

## 🔑 Comptes de Démonstration (Seed)

| Rôle | Email | Mot de passe | Permissions |
| :--- | :--- | :--- | :--- |
| **Administrateur** | `admin@bbank.com` | `Admin@2024!` | Accès total, gestion utilisateurs, gel/dégel de comptes, journaux d'audit, déclenchement manuel des intérêts |
| **Manager** | `manager@bbank.com` | `Admin@2024!` | Gestion des comptes, consultation des transactions et virements |
| **Client** | `user@bbank.com` | `Admin@2024!` | Consultation de ses comptes, nouveaux virements, dépôts/retraits, relevés PDF |

---

## 📜 Licence
Projet privé - Tous droits réservés.

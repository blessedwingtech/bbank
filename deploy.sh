#!/bin/bash
set -e

echo "=========================================="
echo "🚀 Déploiement de B-Bank en cours..."
echo "=========================================="

# 1. Vérification du fichier .env
if [ ! -f .env ]; then
  echo "❌ ERREUR : Le fichier .env n'existe pas sur le serveur !"
  echo "Créez-le à partir de .env.example avant de continuer."
  exit 1
fi

# 2. Récupérer le dernier code depuis GitHub
echo "📥 Récupération du code depuis GitHub (main)..."
git pull origin main

# 3. Installer les dépendances
echo "📦 Installation des dépendances npm..."
npm install

# 4. Régénérer le client Prisma
echo "⚙️ Génération du client Prisma..."
npx prisma generate

# 5. Appliquer les migrations de production
echo "🗄️ Application des migrations PostgreSQL..."
npx prisma migrate deploy

# 6. Compiler l'application NestJS
echo "🔨 Compilation de l'application..."
npm run build

# 7. Redémarrer l'application avec PM2 sans interruption
echo "🔄 Rechargement du processus PM2..."
if pm2 describe bbank-app > /dev/null 2>&1; then
  pm2 reload ecosystem.config.js --update-env
else
  pm2 start ecosystem.config.js
fi

# 8. Sauvegarder la liste PM2 pour redémarrage auto au reboot du VPS
pm2 save

echo "=========================================="
echo "✅ Déploiement B-Bank terminé avec succès !"
echo "=========================================="
pm2 status bbank-app

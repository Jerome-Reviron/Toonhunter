# 🚀 ToonHunter - Chasse aux trésors en RA (IA)

ToonHunter est une application web innovante de chasse aux trésors utilisant l'IA (Google Gemini) pour matérialiser des personnages 3D (Toons) dans le monde réel via la caméra de l'utilisateur.

## ✨ Fonctionnalités

- **📍 Géolocalisation** : Trouvez des points de capture précis grâce au GPS.
- **📸 Réalité Augmentée par IA** : Prenez une photo d'un objet réel, et Gemini intègre intelligemment un personnage 3D dans la scène.
- **🏆 Collection** : Album photo des trophées capturés avec répliques personnalisées.
- **🔐 Authentification** : Système complet de connexion (Mode démo inclus).
- **🛠️ Panel Admin** : Gérez les points de capture, les raretés et les prompts de l'IA.

## 🛠️ Stack Technique

- **Frontend** : React 19, Tailwind CSS, Lucide React.
- **IA** : Google Gemini API (`gemini-2.5-flash-image` & `gemini-3-flash-preview`).
- **Backend (Optionnel)** : Compatible avec une API PHP/MySQL (Laragon).

## 🌿 Gestion du projet (Git Flow)

Le projet utilise deux branches principales :

- **`develop`** : C'est ici que vous travaillez au quotidien.
- **`main`** : C'est la version stable "officielle".

---

### 🛠️ Workflow Complet : Du développement à la mise en ligne

Suivez ces commandes dans l'ordre pour un projet propre :

#### 1. Travail quotidien (sur la branche `develop`)

Une fois vos modifications terminées et testées localement :

```bash
# Vérifier que vous êtes bien sur develop
git branch

# Ajouter vos modifications
git add .

# Créer le point de sauvegarde (commit)
git commit -m "Description de vos changements"

# Envoyer sur GitHub (branche develop)
git push origin develop
```

#### 2. Fusion vers la version stable (sur la branche `main`)

Quand vous êtes satisfait de votre version sur `develop` et que vous voulez mettre à jour `main` :

```bash
# 1. Basculer sur la branche principale
git checkout main

# 2. Récupérer les éventuelles modifs du serveur (sécurité)
git pull origin main

# 3. Fusionner le travail de develop dans main
git merge develop

# 4. Envoyer la version stable sur GitHub
git push origin main

# 5. Revenir sur develop pour continuer à coder
git checkout develop
```

---

## 🚀 Installation Locale

1. Clonez le dépôt :
   ```bash
   git clone https://github.com/Jerome-Reviron/Toonhunter.git
   ```
2. Basculez sur la branche de développement :
   ```bash
   git checkout develop
   ```
3. Ouvrez `index.html` avec l'extension **Live Server** de VS Code.
4. Configurez votre clé API dans les variables d'environnement.

## 💰 Estimation des coûts API

- **Génération d'image** : ~0,03 € par capture.
- **Génération de texte** : Virtuellement gratuit.

---

_Développé avec passion pour l'aventure numérique._

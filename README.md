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

## 🌿 Stratégie de Branches

Ce projet utilise une structure de branches simple et efficace :

- **`main`** : Version stable et déployable de l'application.
- **`develop`** : Branche principale de développement. Toutes les nouvelles fonctionnalités sont testées ici.

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

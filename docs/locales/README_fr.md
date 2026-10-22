# DevLens

<p align="center">
  <img src="../assets/lensy.svg" alt="Lensy" width="260" />
</p>

DevLens est un navigateur pour développeurs orienté workflow.

Il affiche une même URL dans des cadres mobile et bureau, avec console et réseau en direct, intercepteur et répétiteur HTTP, édition de design, rapports de reconnaissance, assistant IA et accès direct à l’éditeur.

## Fonctionnalités

- Thèmes de workspace immersifs pour les onglets, la navigation et la barre latérale.
- Aperçu double viewport avec synchronisation du défilement.
- Tab Groups avec noms, couleurs, glisser-déposer, menu contextuel et repliage.
- Split View pour afficher deux onglets existants sans les recharger.
- Protection WImH avec protection du contenu et overlay de menaces.
- DevTools intégré : Elements, Console, Network et Application.
- Omnibox intelligente avec historique, marque-pages, trafic et complétion.
- Isolation par workspace et profil avec partitions Electron.

## Pile technique

- Electron 44
- Vite 7
- React 19
- TypeScript (strict)
- Tailwind CSS 4

## Démarrage

Exécutez ces commandes depuis `outputs/devlens` :

| Script | Description |
| --- | --- |
| `npm install` | Installer les dépendances |
| `npm run dev` | Démarrer Vite et Electron avec HMR |
| `npm run build` | Vérifier les types et construire out/ |
| `npm run start` | Exécuter l’application construite |
| `npm run typecheck` | Exécuter tsc --noEmit |

## Raccourcis

| Action | Raccourci |
| --- | --- |
| Nouvel onglet | `Ctrl+T` |
| Fermer l’onglet | `Ctrl+W` |
| Recharger la page | `Ctrl+R` |
| Rechercher dans la page | `Ctrl+F` |
| Ouvrir les réglages | `Ctrl+,` |
| Onglet privé | `Ctrl+Shift+P` |
| DevTools du shell | `F12` |
| Panneau Elements | `Ctrl+Shift+I` |
| Panneau Console | `Ctrl+Shift+J` |
| Panneau Network | `Ctrl+Shift+E` |
| Barre latérale | `Ctrl+Shift+B` |
| Mode Ghost | `Ctrl+Shift+G` |
| Protection WImH | `Ctrl+Shift+H` |
| Onglet récent | `Ctrl+Tab` |

## Licence

Publié sous [licence MIT](../../LICENSE).

## Contribuer

Issues et pull requests sont bienvenues. Exécutez `npm run typecheck` avant d’envoyer des modifications.


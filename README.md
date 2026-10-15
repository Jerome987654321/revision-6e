# Révisions 6e

Web-app installable (PWA) : on photographie une leçon, l'app prépare un package (photos + consigne)
pour ChatGPT, dont la réponse donne un quiz joué dans l'app (cartes, QCM, vrai/faux, textes à trous)
et/ou une fiche à imprimer avec corrigé. Révision espacée (boîtes de Leitner), XP, niveaux, objectif
du jour, badges et suivi par matière.

Tout reste sur l'appareil (IndexedDB du navigateur) : leçons, photos, progression.
Aucune clé d'API : la génération se fait dans ChatGPT, avec l'abonnement de l'utilisateur.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | toute l'application (HTML, CSS, JS) |
| `sw.js` | fonctionnement hors ligne |
| `manifest.webmanifest`, `icon*.png`, `icon.svg` | installation comme une app |

## Publier (une seule fois) — GitHub Pages

1. Créer un compte sur github.com, puis un dépôt **public** `revision-6e`.
2. « Add file » → « Upload files » → déposer les 6 fichiers (pas besoin du README) → « Commit changes ».
3. « Settings » → « Pages » → Source : « Deploy from a branch », branche `main`, dossier `/ (root)` → « Save ».
4. Après une minute, l'app est en ligne sur `https://<ton-pseudo>.github.io/revision-6e/`.

Le dépôt ne contient ni la clé ni aucune donnée : elles ne vivent que sur l'appareil.

## Installer

- **Tablette Android** : ouvrir l'adresse dans Chrome → ⋮ → « Ajouter à l'écran d'accueil » / « Installer l'application ».
- **Windows** : ouvrir l'adresse dans Edge ou Chrome → icône « Installer » dans la barre d'adresse.

Puis ⚙️ Réglages : prénom de l'enfant et objectif du jour.

## Mettre à jour

Remplacer `index.html` dans le dépôt. La nouvelle version est prise au lancement suivant
(au besoin, fermer et rouvrir l'app deux fois). Si `sw.js` change, incrémenter `CACHE`.

## Tester sur le PC sans publier

```
cd D:\perso\revision-6e
py -m http.server 8080
```
puis ouvrir http://localhost:8080 (fonctionne seulement sur ce PC : la tablette a besoin de l'adresse HTTPS publiée).

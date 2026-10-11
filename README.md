# Révisions 6e

Web-app installable (PWA) : on photographie une leçon, Gemini (clé gratuite Google AI Studio)
prépare une fiche résumé, des cartes, des QCM, des vrai/faux et des textes à trous ; l'enfant
révise avec la répétition espacée (boîtes de Leitner).

Tout reste sur l'appareil (IndexedDB du navigateur) : leçons, photos, progression, clé.
Seule la génération passe par internet, directement de l'appareil vers Google.

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

Puis ⚙️ Réglages → coller la clé de https://aistudio.google.com/apikey → « Vérifier la clé » → « Enregistrer ».

## Mettre à jour

Remplacer `index.html` dans le dépôt. La nouvelle version est prise au lancement suivant
(au besoin, fermer et rouvrir l'app deux fois). Si `sw.js` change, incrémenter `CACHE`.

## Tester sur le PC sans publier

```
cd D:\perso\revision-6e
py -m http.server 8080
```
puis ouvrir http://localhost:8080 (fonctionne seulement sur ce PC : la tablette a besoin de l'adresse HTTPS publiée).

# PDF Compressor

PDF Compressor est une application web en une page pour compresser des fichiers PDF avec Ghostscript.

L'utilisateur envoie un PDF, choisit un niveau de compression, attend le traitement, puis télécharge le fichier compressé via un lien temporaire. L'application est prévue pour fonctionner dans Docker afin que Ghostscript soit fourni par l'image, sans dépendre de la machine hôte.

## Fonctionnalités

- Upload d'un PDF jusqu'à 50 MB.
- Compression avec les presets Ghostscript `screen`, `ebook`, `printer`, `prepress` et `default`.
- Mode expert désactivé par défaut, avec options Ghostscript validées côté serveur.
- File d'attente FIFO: une seule compression tourne à la fois.
- Suppression automatique des fichiers source et compressés 10 minutes après génération.
- Interface en français.

## Prérequis

Pour l'utilisation recommandée:

- Docker
- Docker Compose

Pour lancer l'application hors Docker:

- Node.js 22 ou compatible
- npm
- Ghostscript installé localement et disponible via la commande `gs`

## Installation

Clonez le projet puis placez-vous dans le dossier:

```bash
git clone <url-du-depot>
cd pdf-compressor
```

Installez les dépendances JavaScript si vous voulez utiliser les commandes npm hors Docker:

```bash
npm install
```

Avec Docker, l'installation des dépendances et de Ghostscript est faite pendant le build de l'image.

## Lancement en développement

La commande recommandée démarre l'application dans Docker sur le port `3350`:

```bash
docker compose up --build
```

Ouvrez ensuite:

```text
http://localhost:3350
```

Le port de développement est publié uniquement sur `127.0.0.1`.

## Lancement en production locale

Pour lancer l'image de production locale sur le port `3351`:

```bash
docker compose -f compose.yml -f compose.prod.yml up --build
```

Ouvrez ensuite:

```text
http://localhost:3351
```

## Commandes hors Docker

Ces commandes sont utiles pour développer ou vérifier le frontend localement. Elles nécessitent que Ghostscript soit installé sur la machine si vous utilisez la compression.

```bash
npm run dev
```

Démarre le serveur en mode développement sur le port `3350`.

```bash
npm run build
```

Construit le frontend dans `dist/`.

```bash
npm run start
```

Démarre le serveur en mode production sur le port `3351`. Lancez `npm run build` avant cette commande pour servir le frontend compilé.

## Utilisation

1. Ouvrez l'application dans le navigateur.
2. Sélectionnez un fichier PDF de 50 MB maximum.
3. Choisissez un niveau de compression.
4. Optionnellement, activez le mode expert et ajustez les options proposées.
5. Cliquez sur `Compresser`.
6. Attendez la fin du traitement.
7. Téléchargez le PDF compressé avant l'expiration du lien.

Si plusieurs fichiers sont envoyés en même temps, les compressions sont traitées dans l'ordre d'arrivée.

## Stockage temporaire

Les fichiers sont stockés dans `runtime/` pendant le traitement. En Docker, ce dossier est monté en `tmpfs` dans le conteneur.

Les fichiers source et compressés ne doivent pas être versionnés. Ils sont supprimés automatiquement 10 minutes après la génération du PDF compressé.

## API

L'interface utilise les routes suivantes:

- `GET /api/presets`: liste les presets de compression.
- `GET /api/expert-options`: liste les options du mode expert.
- `POST /api/jobs`: crée une compression à partir d'un champ fichier `pdf`.
- `GET /api/jobs/:id`: lit le statut d'une compression.
- `GET /api/jobs/:id/download`: télécharge le PDF compressé quand il est prêt.

## Configuration

Les principales variables d'environnement sont:

- `NODE_ENV`: `development` ou `production`.
- `PORT`: port d'écoute du serveur.
- `RUNTIME_DIR`: dossier temporaire utilisé par l'application.
- `MAX_UPLOAD_MB`: taille maximale d'un upload PDF, par défaut `50`.
- `FILE_TTL_MINUTES`: durée de conservation des fichiers générés, par défaut `10`.

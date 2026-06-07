# PDF Compressor

PDF Compressor est une application web en une page pour compresser des fichiers PDF avec Ghostscript.

L'utilisateur envoie un PDF, choisit un niveau de compression, attend le traitement, puis télécharge le fichier compressé via un lien temporaire. L'application est prévue pour fonctionner dans Docker afin que Ghostscript soit fourni par l'image, sans dépendre de la machine hôte.

## Fonctionnalités

- Upload d'un PDF jusqu'à 50 MB.
- Compression avec les presets Ghostscript `screen`, `ebook`, `printer`, `prepress` et `default`.
- Mode expert désactivé par défaut, avec options Ghostscript validées côté serveur.
- File d'attente FIFO: une seule compression tourne à la fois.
- File d'attente bornée et limite d'envois par adresse IP.
- Timeout d'exécution Ghostscript pour éviter qu'un PDF bloque le service.
- Validation serveur de la signature PDF avant compression.
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

Le compose de production publie le service uniquement sur `127.0.0.1:3351`. Pour une mise en ligne, exposez l'application via un frontal HTTPS placé sur la même machine ou le même réseau privé, et gardez le conteneur applicatif non exposé directement sur Internet.

La surcharge `compose.prod.yml` applique aussi les recommandations suivantes:

- Exécution avec l'utilisateur non privilégié `node`.
- Filesystem conteneur en lecture seule.
- Suppression des capabilities Linux avec `cap_drop: ALL`.
- `no-new-privileges` activé.
- Limites CPU, mémoire et nombre de processus.
- Stockage temporaire en `tmpfs` avec taille bornée.
- Healthcheck HTTP sur `/healthz`.

Pour le frontal HTTPS, configurez au minimum:

- Une limite d'upload cohérente avec `MAX_UPLOAD_MB`, par défaut 50 MB.
- Des timeouts suffisants pour laisser passer une compression normale, mais bornés.
- La transmission correcte des en-têtes `X-Forwarded-For` et `X-Forwarded-Proto`.
- Des journaux d'accès et, si nécessaire, une authentification ou une allowlist IP.

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

En production, le `tmpfs` `/app/runtime` est limité à 256 MB et `/tmp` à 64 MB. Ajustez ces tailles si vous augmentez `MAX_UPLOAD_MB`, `MAX_QUEUE_SIZE` ou si vos PDF produisent temporairement des sorties plus volumineuses.

Les fichiers source et compressés ne doivent pas être versionnés. Ils sont supprimés automatiquement 10 minutes après la génération du PDF compressé. Les fichiers d'un job en échec sont supprimés immédiatement, tandis que le statut du job reste consultable jusqu'à expiration.

## API

L'interface utilise les routes suivantes:

- `GET /api/presets`: liste les presets de compression.
- `GET /api/expert-options`: liste les options du mode expert.
- `POST /api/jobs`: crée une compression à partir d'un champ fichier `pdf`.
- `GET /api/jobs/:id`: lit le statut d'une compression.
- `GET /api/jobs/:id/download`: télécharge le PDF compressé quand il est prêt.
- `GET /healthz`: vérifie que le serveur répond.

## Configuration

Les principales variables d'environnement sont:

- `NODE_ENV`: `development` ou `production`.
- `PORT`: port d'écoute du serveur.
- `RUNTIME_DIR`: dossier temporaire utilisé par l'application.
- `MAX_UPLOAD_MB`: taille maximale d'un upload PDF, par défaut `50`.
- `FILE_TTL_MINUTES`: durée de conservation des fichiers générés, par défaut `10`.
- `MAX_QUEUE_SIZE`: nombre maximal de jobs en attente, par défaut `20`.
- `MAX_JOB_SECONDS`: durée maximale d'une compression Ghostscript, par défaut `120`.
- `RATE_LIMIT_WINDOW_SECONDS`: fenêtre de rate limit des uploads, par défaut `60`.
- `RATE_LIMIT_MAX_JOBS`: nombre maximal d'uploads par IP dans la fenêtre, par défaut `5`.
- `MAX_GS_STDERR_BYTES`: taille maximale de stderr Ghostscript conservée pour les logs internes, par défaut `8192`.

## Recommandations Docker Compose

Pour la production, gardez les protections présentes dans `compose.prod.yml`:

- Publier le port applicatif sur l'adresse locale seulement: `127.0.0.1:3351:3351`.
- Conserver `read_only: true`; seuls les chemins déclarés en `tmpfs` doivent être inscriptibles.
- Conserver `cap_drop: ["ALL"]` et `security_opt: ["no-new-privileges:true"]`.
- Conserver des limites explicites: `pids_limit`, `mem_limit`, `cpus`, tailles `tmpfs`.
- Garder `RUNTIME_DIR=/app/runtime` sur un `tmpfs` non persistant.
- Ne pas monter de volume persistant contenant des PDF utilisateurs.
- Ne pas exécuter le service en `root`.
- Rebuilder régulièrement l'image pour récupérer les correctifs Node.js, Debian et Ghostscript.

# AGENTS.md

## Projet

PDF Compressor est une one-page app Dockerisée qui reçoit un PDF utilisateur, le compresse avec Ghostscript, puis fournit un lien de téléchargement temporaire.

## Commandes

- Développement: `docker compose up --build`
- Production locale: `docker compose -f compose.yml -f compose.prod.yml up --build`
- Build frontend hors Docker: `npm run build`
- Serveur dev hors Docker: `npm run dev`
- Serveur prod hors Docker: `npm run start`

## Ports

- Dev: `3350`
- Prod: `3351`

## Contraintes Fonctionnelles

- Les PDF uploadés sont limités à 50 MB.
- Les presets Ghostscript exposés sont `screen`, `ebook`, `printer`, `prepress` et `default`.
- Une seule compression tourne à la fois; les jobs suivants attendent en FIFO.
- Les PDF source et compressés sont supprimés 10 minutes après la génération.
- Ghostscript doit être fourni par l’image Docker, pas par la machine hôte.

## Architecture

- `server/index.js`: API Express, file d’attente FIFO, exécution Ghostscript, nettoyage des fichiers.
- `src/`: application React.
- `runtime/`: fichiers temporaires locaux, ignorés par Git et montés sur un volume Docker nommé.
- `compose.yml`: environnement de développement.
- `compose.prod.yml`: surcharge production.

## Règles Pour Agents

- Ne jamais versionner de PDF utilisateur ou de fichier généré.
- Préserver le comportement FIFO sauf demande explicite.
- Toute modification de l’expiration des fichiers doit être reflétée dans `LLM_MEMORY.md`.
- Garder l’interface en français.
- Le mode expert Ghostscript doit rester désactivé par défaut et ne jamais accepter de flags libres non validés.
- Vérifier les changements via Docker quand l’environnement le permet.


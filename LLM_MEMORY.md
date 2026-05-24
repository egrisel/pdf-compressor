# LLM_MEMORY.md

## Décisions Initiales

- Stack: Node.js, Express, Vite, React.
- Distribution: Docker Compose obligatoire.
- Image: conteneur unique servant l’API et le frontend.
- Dev: port `3350`.
- Prod: port `3351`.
- Compression: Ghostscript via commande `gs`.
- Presets exposés: `screen`, `ebook`, `printer`, `prepress`, `default`.
- Upload maximal: `50 MB`.
- Queue: FIFO avec une seule compression active.
- Stockage temporaire: `tmpfs` Docker monté dans `/app/runtime` avec `uid=1000,gid=1000,mode=700`.
- Rétention: suppression des fichiers source et compressés 10 minutes après génération.
- Interface et documentation: français.
- Hôte dev autorisé par Vite: `fouinaki-srv.gwap.ch`.
- Mode expert Ghostscript ajouté: désactivé par défaut, options envoyées en JSON et validées côté backend avant construction des flags `gs`.
- Utilisateur Docker non privilégié: le service tourne avec l’utilisateur `node`, pas `root`; le runtime temporaire est un `tmpfs` accessible à cet utilisateur.

## Historique

- Initialisation du projet avec MVP Dockerisé.
- Ajout des documents `AGENTS.md`, `LLM_MEMORY.md` et `DESIGN.md`.
- Mise en place du backend Express, du frontend React et de Docker Compose.
- Ajout du mode expert Ghostscript avec listes déroulantes et validation serveur.
- Dockerfile et Compose ajustés pour exécuter l’application avec l’utilisateur non-root `node`.

## À Surveiller

- La commande Ghostscript dépend de `gs` dans le conteneur.
- Le nettoyage est basé sur un timer en mémoire; un redémarrage du conteneur doit aussi balayer les fichiers runtime au démarrage.
- La file FIFO est en mémoire; elle convient au MVP mono-conteneur.


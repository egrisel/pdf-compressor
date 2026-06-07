# LLM_MEMORY.md

## Décisions Initiales

- Stack: Node.js, Express, Vite, React.
- Distribution: Docker Compose obligatoire.
- Image: conteneur unique servant l’API et le frontend.
- Dev: port `3350`, publié uniquement sur `127.0.0.1`.
- Prod: port `3351`.
- Compression: Ghostscript via commande `gs`.
- Presets exposés: `screen`, `ebook`, `printer`, `prepress`, `default`.
- Upload maximal: `50 MB`.
- Queue: FIFO avec une seule compression active.
- Stockage temporaire: `tmpfs` Docker monté dans `/app/runtime` avec `uid=1000,gid=1000,mode=700`.
- Rétention: suppression des fichiers source et compressés 10 minutes après génération.
- Interface et documentation: français.
- Hôte dev autorisé par Vite: `pdf-compressor.e-grisel.net`.
- Mode expert Ghostscript ajouté: désactivé par défaut, options envoyées en JSON et validées côté backend avant construction des flags `gs`.
- Utilisateur Docker non privilégié: le service tourne avec l’utilisateur `node`, pas `root`; le runtime temporaire est un `tmpfs` accessible à cet utilisateur.
- Sécurité production: le port `3351` est publié uniquement sur `127.0.0.1` car l’exposition publique passe par un reverse proxy Nginx.
- Sécurité applicative: les uploads sont limités par IP, la file d’attente est bornée, Ghostscript a un timeout, `-dSAFER` est explicite, et les fichiers uploadés doivent commencer par la signature `%PDF-`.
- Sécurité conteneur: le compose production utilise un filesystem en lecture seule, supprime les capabilities Linux, active `no-new-privileges`, borne PID/RAM/CPU et limite les tmpfs runtime/tmp.

## Historique

- Initialisation du projet avec MVP Dockerisé.
- Ajout des documents `AGENTS.md`, `LLM_MEMORY.md` et `DESIGN.md`.
- Mise en place du backend Express, du frontend React et de Docker Compose.
- Ajout du mode expert Ghostscript avec listes déroulantes et validation serveur.
- Dockerfile et Compose ajustés pour exécuter l’application avec l’utilisateur non-root `node`.
- Durcissement sécurité: ajout de headers HTTP, validation de signature PDF, rate limiting, limite de file, timeout Ghostscript, erreurs publiques génériques et durcissement du compose production.

## À Surveiller

- La commande Ghostscript dépend de `gs` dans le conteneur.
- Le nettoyage est basé sur un timer en mémoire; un redémarrage du conteneur doit aussi balayer les fichiers runtime au démarrage.
- La file FIFO est en mémoire; elle convient au MVP mono-conteneur.
- Le reverse proxy Nginx doit gérer HTTPS, taille maximale des uploads côté proxy, logs d’accès et éventuellement authentification/allowlist si le service n’est pas public.

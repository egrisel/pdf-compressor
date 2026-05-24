# DESIGN.md

## Direction

L’interface est un outil sobre et direct. L’utilisateur doit comprendre immédiatement comment déposer un PDF, choisir un niveau de compression, attendre son tour et télécharger le résultat.

## Principes

- Pas de page marketing ni de hero décoratif.
- Langue unique: français.
- Une seule tâche principale visible: compresser un PDF.
- États explicites: prêt, fichier sélectionné, upload, attente FIFO, compression, succès, expiration, erreur.
- Le mode expert doit rester secondaire: accessible par un contrôle dédié, mais fermé par défaut.
- Texte court, concret, sans jargon technique inutile.
- Responsive desktop et mobile.

## UI

- Utiliser une mise en page centrée avec une zone principale de travail.
- Les presets Ghostscript sont présentés comme des choix clairs avec une courte description.
- Le bouton principal change selon l’état: compresser, envoi, traitement, télécharger.
- Les erreurs doivent être visibles près de l’action concernée.
- Les informations de queue et d’expiration doivent être affichées sans bloquer la lecture.

## Couleurs Et Formes

- Palette neutre avec contrastes nets et une couleur d’action.
- Rayon de bordure maximum: 8px pour cartes et contrôles.
- Pas de décorations abstraites, blobs ou gradients dominants.
- Les contrôles doivent garder des dimensions stables pendant les changements d’état.


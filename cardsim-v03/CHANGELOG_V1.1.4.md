# VOX Card Sim — V1.1.4

## Pourquoi
- La V1.1.3 pouvait encore afficher la Boutique 2026 en mode Créatif : sur Android, un ancien boot V1.1 pouvait rester servi assez longtemps pour que la couche 1.1.3 ne soit pas encore installée.
- Pendant l'ouverture, la couche d'usure ajoutait une règle `position:relative` sur les cartes ; elle annulait la pile absolue et plusieurs cartes apparaissaient verticalement en même temps.
- L'import universel TCGdex mélangeait les collections physiques avec les extensions numériques Pokémon TCG Pocket (`seriesId=tcgp`), incompatibles avec la simulation de boosters physiques, d'usure et de grading.

## Changements
- Ajout de `v114early.js`, chargé directement par `index.html`, pour appliquer immédiatement la géométrie correcte de la pile et garantir le chargement des correctifs 1.1.3/1.1.4 même si un ancien boot WebView est encore présent.
- `v114fix.js` force chaque `.reveal-card` de `#cardStack` à rester absolument superposée.
- En Créatif, toutes les collections physiques du catalogue restent accessibles. Lorsqu'aucun packaging physique vérifié n'est disponible, le jeu expose uniquement un `Pack créatif` explicitement présenté comme produit de simulation au lieu d'inventer un booster officiel.
- Ajout de `import_physical_collections_release.py` : la série numérique `tcgp` est exclue du catalogue Card Sim, sans liste de sets physiques codée en dur.
- La génération release nettoie le dossier `catalog/fr` avant import pour qu'aucun ancien JSON numérique ne reste embarqué dans l'APK.
- Android passe en `versionCode 40` / `versionName 1.1.4`.

## État précédent
- V1.1.3 dépendait uniquement de la chaîne de boot dynamique V1.1 pour installer sa Boutique Créative.
- V1.1.0 ajoutait les dégâts visuels avec une règle CSS qui pouvait sortir les cartes de la pile d'ouverture.
- V1.1.0–1.1.3 importaient 200 entrées TCGdex, dont 15 collections Pokémon TCG Pocket purement numériques.

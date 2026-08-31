# VOX Card Sim — V1.1.2

## Pourquoi

La V1.1.1 embarquait bien les 200 fichiers JSON du catalogue français et savait les lire nativement depuis l'APK, mais toutes les collections ne passaient pas réellement par ce chemin au runtime. `v111RegisterCatalogShells()` s'arrêtait dès qu'un ID existait déjà dans l'ancien objet `SETS`. Ces extensions conservaient donc l'ancien chargeur et pouvaient réafficher « données incomplètes » de façon intermittente. Un ancien `state.metaReady=true` pouvait également court-circuiter le nouveau chargeur.

Le menu de réinitialisation forcée hérité de V0.6/V0.8 utilisait par ailleurs la modale de vente et pouvait apparaître sous d'autres couches de l'interface. Il n'est plus utile et est retiré.

## Changements

- Ajout de `v112fix.js`, chargé en dernier après les couches V1.1 existantes.
- Les 200 IDs de `V111_COLLECTION_INDEX` deviennent la source d'autorité, y compris lorsqu'une configuration `SETS[id]` existait déjà avant l'import universel.
- `v111File`, hash, statut, année, date et compteurs sont réconciliés sur les anciennes configurations.
- `v111HydrateSet()` possède désormais un seul chemin canonique : lecture directe avec `VOXOffline.readCatalogFile()` depuis `AssetManager`, validation du nombre exact de cartes, puis construction de `state.sets` et `state.meta`.
- Un ancien `metaReady` ne suffit plus à déclarer une collection chargée : le marqueur V1.1.2 `v112CatalogHydrated` et le compte exact de cartes sont requis.
- Le Marketplace utilise le même chargeur canonique.
- Les quinze scans Nuit Noire `075–089` restent forcés vers les fichiers WebP locaux lors d'une hydratation canonique.
- Les cartes dont TCGdex FR ne fournit pas de scan utilisent le placeholder local `img/missing-card.svg` plutôt qu'une image cassée/`undefined`.
- Les rares collections dont TCGdex FR ne fournit actuellement aucune carte restent visibles dans le catalogue, mais le clic indique explicitement que la source française est indisponible au lieu de signaler à tort une corruption de l'APK.
- Le bouton `Réinitialiser la progression` est retiré des Réglages et l'ancien callback de force-reset est neutralisé.

## État précédent

- V1.1.1 : une collection déjà connue d'une ancienne version pouvait ne jamais recevoir `v111Imported`/`v111File` et retomber dans l'ancien chargeur.
- V1.1.1 : `state.metaReady` pouvait faire gagner un dataset hérité sur le JSON canonique empaqueté.
- V1.1.1 : une absence de scan pouvait encore remonter jusqu'au composant image sous forme d'URL vide ou invalide.
- V1.1.1 : le force-reset restait injecté par `v06SettingsExtras()` et ouvrait une modale réutilisée par d'autres écrans.

## Validation release

La CI V1.1.2 vérifie avant signature : les 200 entrées uniques, les 200 JSON présents, le nombre de cartes exact pour chaque JSON, les shells source-vide explicitement `partial`, les années historiques, les scans Nuit Noire locaux, le placeholder local, la présence du chargeur V1.1.2 dans l'APK, la compilation Android puis la signature APK.

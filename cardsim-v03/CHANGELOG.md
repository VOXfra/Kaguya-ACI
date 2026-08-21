# Changelog — VOX Card Sim

## 2026-08-21 — V1.0.9 : boutique réellement liée à la collection, visuels 2026 embarqués et Nuit Noire hors ligne

### Pourquoi
- La V1.0.8 avait bien limité la rotation commerciale aux collections 2026, mais le rendu historique de la boutique continuait d'ignorer la collection cliquée en mode Réaliste/Ludique : sélectionner une extension 2024 ou 2025 pouvait laisser affichés les produits de la collection 2026 de rotation, donnant l'impression que les mêmes boosters étaient utilisés partout.
- Les onglets d'années historiques restaient visibles dans la boutique alors que ces collections doivent être réservées au Marketplace ou aux rares offres Archive.
- Les visuels produits 2026 restaient chargés depuis des boutiques externes au runtime, ce qui exposait encore l'application aux liens cassés, anti-hotlink et changements d'images.
- Le téléchargement hors ligne de Héros Transcendants signalait encore une erreur et Nuit Noire jusqu'à seize erreurs.
- Le diagnostic CI a identifié précisément les erreurs Nuit Noire : les scans français TCGdex `075` à `089` renvoient tous `404`, et le logo TCGdex de `me05` renvoie lui aussi `404`. Le vieux manifeste pouvait également ajouter une URL `META_BASE/undefined` inutile parce que Nuit Noire n'utilise pas le même fichier metadata historique que les anciens sets.

### Quoi
- Ajout de `app/src/main/assets/v109boot.js` :
  - attend la fin de la couche V1.0.8 puis charge la correction V1.0.9,
  - conserve le garde-fou de changement de mode déjà chargé très tôt par V1.0.8.
- Ajout de `app/src/main/assets/v109fix.js` :
  - la boutique possède désormais son propre choix de collection 2026, indépendant du sélecteur global utilisé par l'accueil et les classeurs,
  - les onglets 2024/2025/2023/2021 ne sont plus présentés comme des collections achetables dans la boutique,
  - un accès explicite `Archives · Marketplace` remplace cette ambiguïté,
  - `renderProducts()` affiche réellement les produits de la collection 2026 choisie et ne retombe plus automatiquement sur la collection de rotation,
  - chaque extension 2026 utilise son propre visuel de booster pour la boutique et l'ouverture,
  - boosters, bundles, ETB, displays, portfolios, Build & Battle Nuit Noire et logo Nuit Noire sont des ressources locales `img/v109/*` embarquées dans l'APK,
  - le manifeste hors ligne Nuit Noire est reconstruit spécialement et ne reprend plus les anciennes URL produits, le logo TCGdex cassé ni `META_BASE/undefined`,
  - les 15 scans français Nuit Noire absents de TCGdex (`075` à `089`) sont téléchargés depuis des scans français vérifiés pendant le build, embarqués dans l'APK puis injectés dans `pitch_black_embed.js`,
  - les 105 autres scans Nuit Noire et les images d'énergie utilisées hors ligne sont vérifiés par la CI avant signature.
- `app/src/main/assets/index.html` charge maintenant `v109boot.js` juste après le garde-fou V1.0.8.
- `app/build.gradle.kts` passe à `versionCode 35` / `versionName 1.0.9`.
- Le workflow Android V1.0.9 :
  - télécharge les visuels produits 2026 au build et les embarque dans l'APK,
  - vérifie que les quatre boosters 2026 ont quatre fichiers réellement distincts,
  - contrôle que chaque ressource produit téléchargée est bien une image,
  - embarque et contrôle exactement les 15 scans Nuit Noire manquants,
  - vérifie toutes les ressources réseau restantes utilisées par Nuit Noire hors ligne,
  - contrôle la présence des ressources V1.0.9 dans l'APK,
  - construit, signe et vérifie `VOX_CardSim_v1.0.9.apk` avec la clé de release existante.

### Comment
1. Reproduction à partir des captures V1.0.8 : sélection d'une extension 2024 dans la barre de collection alors que `renderProducts()` continuait de prendre `v08HourInfo().setId`, donc Chaos Ascendant restait affiché.
2. Séparation du contexte `collection consultée` et du contexte `collection achetée en boutique`, avec un état dédié `voxCardSimV109_shopSet2026`.
3. Remplacement du rendu boutique hérité par un rendu V1.0.9 explicitement limité aux collections 2026 disponibles.
4. Épinglage des visuels produits au moment du build pour supprimer la dépendance runtime aux photos de marchands.
5. Premier contrôle exhaustif Nuit Noire : détection des quinze `404` TCGdex continus sur `075–089`.
6. Ajout des quinze scans français de remplacement dans l'APK, puis second contrôle exhaustif : détection du logo TCGdex `me05` lui aussi en `404`.
7. Embarquement d'un logo Nuit Noire local et suppression de ce dernier endpoint du manifeste hors ligne.
8. Nouvelle validation complète : génération des données, quatre boosters distincts, quinze scans FR locaux, toutes les ressources Nuit Noire restantes, contrats JS, build Android, inspection APK, signature et vérification ont tous réussi.

### Passages modifiés — état précédent
- Avant V1.0.9, le `renderProducts()` hérité de V0.8 masquait le sélecteur boutique en mode non créatif et choisissait toujours `v08HourInfo().setId` ; un clic sur une extension historique pouvait donc modifier `state.activeSet` sans modifier les produits affichés.
- Avant V1.0.9, `v107fix.js` injectait le même sélecteur année/collection dans tous les écrans, y compris la boutique, alors que les collections antérieures à 2026 ne sont pas censées y être vendues librement.
- Avant V1.0.9, V1.0.8 utilisait encore des URL HTTP externes dans `V108_OPENING_PACK_ART`, `V108_BINDER_ART` et dans les photos produits héritées de V1.0.6.
- Avant V1.0.9, le manifeste hors ligne V1.0.8 ajoutait des ressources externes qui n'étaient pas nécessaires au pack hors ligne et reposait sur des endpoints TCGdex FR inexistants pour une partie de Nuit Noire.

## 2026-08-21 — V1.0.8 : boutique 2026, produits réels, offres Archive rares et changement de mode robuste

### Pourquoi
- Les collections antérieures à 2026 ne doivent pas être disponibles librement dans la boutique : elles restent des collections d'archive, accessibles par le Marketplace et, exceptionnellement, par une offre du jour.
- Les visuels produits 2026 mélangeaient photos boutique, logos d'extension et placeholders générés. Le même visuel pouvait aussi servir à la boutique et à l'animation d'ouverture, ce qui affichait parfois un blister/carton ou un grand fond blanc à la place du sachet.
- Les classeurs des nouvelles collections étaient majoritairement des SVG génériques alors que des portfolios 9 poches officiels existent.
- Héros Transcendants était traité comme une extension standard, avec notamment un faux display 36 boosters généré par le catalogue générique.
- Après un changement de difficulté/mode, il pouvait arriver que l'utilisateur voie le vieux menu de réglages avant le chargement des couches UI récentes, ce qui supprimait temporairement le sélecteur de mode et pouvait bloquer un nouveau changement.
- L'ancien workflow V0.9.1 se déclenchait encore sur chaque modification de `cardsim-v03/**` et échouait mécaniquement dès que la version Android n'était plus `0.9.1`, créant un faux échec CI sur les versions modernes.

### Quoi
- Ajout de `app/src/main/assets/v108boot.js` :
  - chargé de façon synchrone juste après `v063pre.js`,
  - injecte un sélecteur de mode de secours dans les Réglages avant le chargement asynchrone de l'UI récente,
  - écrit le slot cible et le mode actif de façon explicite avant le reload,
  - charge `v108fix.js` uniquement après confirmation que la couche V1.0.7 est prête.
- Ajout de `app/src/main/assets/v108fix.js` :
  - rotation normale de boutique limitée aux collections de l'année 2026,
  - collections antérieures à 2026 traitées comme Archives,
  - en Créatif, les Archives n'exposent plus librement boosters et produits scellés ; le classeur reste disponible pour ranger les cartes acquises autrement,
  - ajout d'une offre Archive déterministe et rare, environ un jour sur huit, limitée à 24 h et à un achat,
  - remplacement des classeurs 2026 générés par les visuels des portfolios Ultra PRO 9 poches correspondants,
  - séparation du visuel de vente et du visuel `packArt` utilisé pendant l'ouverture pour Héros Transcendants, Équilibre Parfait, Chaos Ascendant et Nuit Noire,
  - ajout de `packArt` au manifeste hors-ligne afin que le vrai sachet reste disponible sans réseau,
  - Héros Transcendants : booster unitaire retiré de la vente directe, bundle converti en produit scellé ×6 et faux display 36 boosters retiré de la boutique comme du Marketplace,
  - Équilibre Parfait, Chaos Ascendant et Nuit Noire : les anciens `lot6` sont désormais des Booster Bundles scellés qui donnent six boosters à l'ouverture,
  - filtrage Marketplace répercuté aussi sur l'alias historique `v4MarketAssetResults`, pour que les écrans hérités ne puissent pas réintroduire un produit retiré,
  - reconstruction systématique du sélecteur de mode actuel dans les Réglages,
  - `v08SwitchMode` délègue au commutateur de boot robuste au lieu de dépendre d'une ancienne couche UI.
- `app/src/main/assets/index.html` charge maintenant `v108boot.js` de façon synchrone.
- `app/build.gradle.kts` passe à `versionCode 34` / `versionName 1.0.8`.
- Le workflow Android V1.0.8 valide les nouveaux scripts, la restriction 2026, la cadence Archive, les vrais produits 2026, le visuel d'ouverture séparé, le mode hors-ligne et le garde-fou de mode, puis produit un APK signé `VOX_CardSim_v1.0.8.apk`.
- Suppression du workflow PR obsolète `.github/workflows/tmp-vox-cardsim-v091-energy.yml` : ses validations figées sur `versionCode 24` / `versionName 0.9.1` n'étaient plus compatibles avec les versions actuelles.

### Comment
1. Reproduction baseline : le catalogue V1.0.5 renvoyait uniquement le classeur pour les sets `legacy` et les offres quotidiennes V1.0.5 ne choisissaient que `rotation2026`.
2. Vérification des produits 2026 et des portfolios 9 poches existants, puis séparation explicite des rôles `image` (boutique) et `packArt` (ouverture).
3. Smoke test avant modification pour confirmer que les sets legacy étaient exclus des offres du jour.
4. Ajout d'une couche de boot indépendante afin que le sélecteur de mode soit disponible même si l'UI récente n'est pas encore chargée.
5. Ajout d'une couche V1.0.8 additive pour verrouiller la boutique sur 2026 sans modifier les sauvegardes existantes.
6. Validation syntaxique `node --check` et smoke tests sur la rotation 2026, la rareté des Archives, les produits 2026, l'exclusion du faux display ME2.5, le manifeste hors-ligne et l'écriture du mode cible.
7. Après le premier lancement de la PR, diagnostic du check V0.9.1 : les tests fonctionnels passaient, puis le workflow échouait uniquement sur ses `grep` exigeant encore la version `0.9.1`. Le workflow obsolète a donc été retiré plutôt que de conserver un faux check rouge permanent.

### Passages modifiés — état précédent
- Avant V1.0.8, `v105catalog.js` définissait les anciennes collections `legacy` avec seulement un classeur dans `products`, tandis que les collections historiques déjà présentes avant V1.0.5 pouvaient encore exposer leurs anciens produits en mode Créatif.
- Avant V1.0.8, `v105catalog.js` remplaçait `v08DailyEvent()` par une sélection basée uniquement sur `v105RetailIds()`, donc une ancienne collection ne pouvait jamais revenir via l'offre du jour.
- Avant V1.0.8, les nouvelles collections utilisaient des classeurs générés par `v106productart.js` / `v106shopfix.js` lorsqu'aucune image précise n'était définie.
- Avant V1.0.8, `openingPackImage()` reprenait l'image du booster de boutique ; un visuel de blister ou une photo avec marges pouvait donc être affiché directement dans l'animation d'ouverture.
- Avant V1.0.8, le générateur de catalogue appliquait automatiquement à Héros Transcendants le modèle standard `booster + lot6 + ETB + display + classeur`, ce qui créait un display 36 boosters inexistant dans ce catalogue spécial.
- Avant V1.0.8, le sélecteur de mode dépendait des couches `v08ui.js` / `v084mode.js` chargées après le démarrage ; le HTML de base des Réglages ne proposait aucun changement de difficulté.
- Avant V1.0.8, `index.html` enchaînait directement `v063pre.js` puis `v03c.js`, sans garde-fou UI synchrone entre les deux.
- Avant V1.0.8, le workflow `tmp-vox-cardsim-v091-energy.yml` se déclenchait sur tout `cardsim-v03/**` et imposait encore `versionCode = 24` / `versionName = "0.9.1"`.

# Changelog — VOX Card Sim

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

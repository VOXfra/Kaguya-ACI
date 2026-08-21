# Changelog — VOX Card Sim

## 2026-08-21 — V1.0.8 : boutique 2026, offres Archive rares et changement de mode robuste

### Pourquoi
- Les collections antérieures à 2026 ne doivent pas être disponibles librement dans la boutique : elles doivent rester des collections d'archive, accessibles par le Marketplace et, exceptionnellement, par une offre du jour.
- En mode Créatif, les anciennes collections pouvaient encore exposer directement des produits historiques hérités des versions 2021/2023.
- Après un changement de difficulté/mode, il pouvait arriver que l'utilisateur voie le vieux menu de réglages avant le chargement des couches UI récentes, ce qui supprimait temporairement le sélecteur de mode et pouvait bloquer un nouveau changement.

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
  - reconstruction systématique du sélecteur de mode actuel dans les Réglages,
  - `v08SwitchMode` délègue au commutateur de boot robuste au lieu de dépendre d'une ancienne couche UI.
- `app/src/main/assets/index.html` charge maintenant `v108boot.js` de façon synchrone.
- `app/build.gradle.kts` passe à `versionCode 34` / `versionName 1.0.8`.
- Le workflow Android valide les nouveaux scripts, la restriction 2026, la cadence Archive, le garde-fou de mode et produit un APK signé `VOX_CardSim_v1.0.8.apk`.

### Comment
1. Reproduction baseline : le catalogue V1.0.5 renvoyait uniquement le classeur pour les sets `legacy` et les offres quotidiennes V1.0.5 ne choisissaient que `rotation2026`.
2. Smoke test local avant modification pour confirmer que les sets legacy étaient exclus des offres du jour.
3. Ajout d'une couche de boot indépendante afin que le sélecteur de mode soit disponible même si l'UI récente n'est pas encore chargée.
4. Ajout d'une couche V1.0.8 additive pour verrouiller la boutique sur 2026 sans modifier les sauvegardes existantes.
5. Validation syntaxique `node --check` des deux nouveaux scripts et smoke tests locaux sur la rotation 2026, la rareté des Archives et l'écriture du mode cible.
6. Validation CI étendue avant construction/signature de l'APK.

### Passages modifiés — état précédent
- Avant V1.0.8, `v105catalog.js` définissait les anciennes collections `legacy` avec seulement un classeur dans `products`, tandis que les collections historiques déjà présentes avant V1.0.5 pouvaient encore exposer leurs anciens produits en mode Créatif.
- Avant V1.0.8, `v105catalog.js` remplaçait `v08DailyEvent()` par une sélection basée uniquement sur `v105RetailIds()`, donc une ancienne collection ne pouvait jamais revenir via l'offre du jour.
- Avant V1.0.8, le sélecteur de mode dépendait des couches `v08ui.js` / `v084mode.js` chargées après le démarrage ; le HTML de base des Réglages ne proposait aucun changement de difficulté.
- Avant V1.0.8, `index.html` enchaînait directement `v063pre.js` puis `v03c.js`, sans garde-fou UI synchrone entre les deux.

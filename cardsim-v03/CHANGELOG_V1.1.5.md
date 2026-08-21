# VOX Card Sim — V1.1.5

## Pourquoi
- La V1.1.4 rendait toutes les collections physiques accessibles en mode Créatif en créant un `Pack créatif` quand aucun packaging n'était connu.
- Ce fallback était explicitement présenté comme une simulation, mais il restait un faux article dans une boutique qui doit représenter des produits Pokémon réellement commercialisés.
- Les variantes de boosters historiques devaient aussi conserver leur véritable artwork au moment de l'ouverture.

## Changements
- Suppression complète du `Pack créatif` comme produit achetable.
- Ajout de `import_verified_sealed_products.py`, qui construit à chaque release un catalogue séparé de produits physiques vérifiés à partir de Scrydex et des artworks de boosters SealedDex.
- Les visuels produits retenus sont téléchargés au build puis embarqués dans l'APK sous `img/v115/products/`.
- Toutes les collections physiques restent navigables en Créatif, mais seules les références réellement documentées sont proposées à l'achat.
- Lorsqu'aucune source produit fiable n'est disponible, la boutique affiche clairement `Aucun produit physique vérifié` au lieu de fabriquer un booster, un display, une ETB ou un coffret.
- Les variantes de booster achetées conservent leur artwork dans le lot de stock et l'ouverture réutilise cet artwork précis.
- Les produits scellés dont le nombre de boosters n'est pas explicitement documenté restent collectionnables mais ne sont pas détruits par une ouverture approximative.
- Le correctif V1.1.4 qui garde toutes les cartes de la pile d'ouverture en position absolue reste actif.
- Android passe en `versionCode 41` / `versionName 1.1.5`.

## État précédent
- V1.1.4 créait un `v114-creative-pack-*` pour les collections sans produit physique structuré dans TCGdex.
- V1.1.3 ne montrait que les collections disposant déjà d'un ancien `products[]`.

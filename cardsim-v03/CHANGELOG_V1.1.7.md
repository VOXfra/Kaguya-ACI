# VOX Card Sim — V1.1.7

## Pourquoi
- Les variantes d'illustration SealedDex apparaissaient comme des produits différents dans la boutique au lieu d'être de simples wrappers d'un même booster.
- Certaines images SealedDex non destinées à un booster (notamment des logos d'extension au format paysage) étaient importées comme wrappers, provoquant les gros crops/flous visibles à l'ouverture.
- Le système de classeurs physiques dépendait encore d'anciens produits spécifiques à quelques extensions et pouvait afficher le portfolio d'une autre collection.
- Une extension ouverte depuis la boutique Créative pouvait arriver dans `startBooster()` avant que son JSON canonique soit hydraté, particulièrement visible sur les archives 1999.
- L'inventaire affichait « Ouvrir » sur des accessoires et produits dont le contenu interne n'était pas documenté, puis les bloquait avec le toast « Contenu non vérifié ».
- Les énergies de base utilisaient encore des miniatures globales historiques dans le classeur, ce qui pouvait montrer une énergie graphiquement issue d'une autre époque.

## Changements
- Un seul produit `Booster <extension>` est exposé par extension. Les différents artworks sont stockés dans `artworks[]` et tirés aléatoirement au moment où chaque booster est ouvert.
- Le finaliseur V1.1.7 rejette les assets SealedDex non portrait : logos et bannières ne peuvent plus devenir des wrappers de booster.
- Chaque collection possède désormais un classeur générique de rangement propre au simulateur, 9 poches / 360 emplacements. Les portfolios officiels restent des produits de collection mais ne pilotent plus le rangement d'une autre extension.
- Le moteur charge explicitement le JSON canonique du set avant toute ouverture. Les collections 1999 utilisent le même lecteur Android embarqué que les collections modernes.
- Les produits scellés n'affichent le bouton `Ouvrir` que si leur nombre de boosters est documenté ou déterminable de façon sûre. Les accessoires sont identifiés comme tels au lieu de provoquer une erreur de contenu.
- Les displays internationaux classés comme `booster_box`, booster bundles et Build & Battle récupèrent leur nombre de boosters standard ; les produits réellement inconnus restent scellés sans inventer un contenu.
- Les énergies générées conservent maintenant `setId` + année d'extension. Le classeur utilise une représentation neutre marquée de la bonne année au lieu d'une miniature provenant potentiellement d'un autre set.
- Le moteur de collation V1.1.6 reste la source de vérité : aucune carte n'est déplacée d'un set à un autre pour masquer un scan absent.

## Validation release
- 185 collections physiques françaises conservées, Pokémon TCG Pocket toujours exclu.
- Base Set / Jungle / Fossile / Base Set 2 et Neo restent présents avec leurs JSON embarqués.
- Au plus un produit `mode=loose` par extension après finalisation.
- Aucun nom `illustration N` dans la boutique finale.
- Tous les artworks utilisés par les boosters canoniques existent localement dans l'APK et les assets SealedDex utilisés sont portrait.
- Tous les boosters vérifiés restent couverts par un profil de collation V1.1.6.
- Inspection APK avant signature puis signature v1/v2/v3.
- La CI régénère les données depuis leurs sources ; un échec réseau amont est relancé sans modifier les règles du jeu.

## Version Android
- `versionCode 43`
- `versionName 1.1.7`
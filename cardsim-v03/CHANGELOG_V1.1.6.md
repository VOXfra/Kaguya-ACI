# VOX Card Sim — V1.1.6

## Pourquoi
- La V1.1.5 avait enfin un catalogue de vrais produits physiques, mais `generatePack()` restait historiquement conçu autour d'un booster Écarlate & Violet : 4 communes, 3 peu communes, deux slots reverse/hit, une rare puis une énergie.
- Cette structure était fausse pour les générations précédentes et faussait aussi les taux de hits des anciennes collections.
- Un produit réel ne suffit donc pas : son ouverture doit utiliser la composition réelle de son époque.

## Changements
- Ajout de `generate_v116_collation_profiles.py`, qui construit un catalogue séparé de profils de collation à partir du catalogue physique français généré au build.
- Profils distincts pour WOTC, e-Card, EX, Diamant & Perle/Platine, HGSS, Noir & Blanc/XY, Soleil & Lune, Épée & Bouclier, Écarlate & Violet/Méga-Évolution et plusieurs extensions spéciales.
- Le nombre de cartes d'un booster n'est plus supposé être 11 : les profils gèrent notamment les formats 4, 5, 7, 9, 10 et 11 cartes.
- L'ordre physique des slots est stocké dans le profil (`physicalOrder`) et le runtime génère les cartes dans cet ordre avant l'éventuel Card Trick utilisateur.
- Les sous-collections utilisées comme inserts (Shiny Vault, Trainer Gallery, Galarian Gallery, Classic Collection) sont chargées à la demande avant ouverture du booster parent.
- Les taux sont étiquetés par niveau de confiance (`official`, `measured`, `empirical`, `era-empirical`, `structure-only`). Un taux non documenté n'est jamais présenté comme officiel.
- Les profils `structure-only`, actuellement utilisés lorsqu'on connaît le format physique mais pas une répartition de raretés suffisamment fiable, bloquent volontairement l'ouverture au lieu d'inventer un taux.
- Les anciens cas spéciaux conservés hors catalogue français (par exemple Eevee Heroes) continuent d'utiliser leur générateur dédié existant plutôt que le fallback moderne générique.
- Le moteur V1.1.6 ne revient au vieux `generatePack()` que pour un set sans profil V1.1.6 ; la CI interdit ce fallback pour tous les boosters physiques vérifiés du catalogue V1.1.5.
- Correctif final Célébrations : les quatre cartes du mini-booster utilisent un tirage avec remise, car une carte du set principal peut réellement apparaître plusieurs fois dans le même booster. Le verrou anti-doublon reste strict pour toutes les autres familles.
- `xy0` (Bienvenue à Kalos), `basep` (Wizards Black Star Promos) et `wp` (W Promotional) restent visibles comme collections de cartes mais sont explicitement exclus du moteur d'ouverture : ce ne sont pas des extensions à boosters aléatoires et leur attribuer une collation par époque serait faux.

## Validation
- Nouveau test `test_v116_collation_runtime.js` : charge les vrais JSON du build, injecte le catalogue V1.1.6, exécute le moteur et son hotfix final, puis génère chaque profil exploitable 250 fois.
- Chaque génération vérifie la longueur du booster, l'absence de carte nulle, la disponibilité des dépendances et l'absence de retour au vieux générateur générique.
- Le générateur refuse le build si un produit `mode=loose` vérifié n'a aucun profil de collation.
- Les premiers passages CI ont volontairement bloqué sur des défauts réels du nouvel audit : harness qui n'injectait pas ses profils, Célébrations trop strict sur les doublons et fausses entrées booster pour des produits promotionnels. Ces cas sont maintenant couverts explicitement au lieu d'être masqués.
- L'APK est inspecté après Gradle pour vérifier la présence du catalogue de profils et du moteur V1.1.6 avant signature.

## État précédent modifié
- V1.1.5 : vrais produits physiques et vrais artworks, mais collation générique pour la majorité des collections importées.
- Première implémentation V1.1.6 : anti-doublon global appliqué aussi à Célébrations et profil automatique attribué à quelques entrées promotionnelles non distribuées en boosters aléatoires.
- V1.1.4 : correction de la pile d'ouverture et suppression des collections numériques Pocket, sans audit global de collation.

## Version Android
- `versionCode 42`
- `versionName 1.1.6`

# VOX Card Sim 1.1.3 — boutique Créative complète

## Pourquoi
Le mode Créatif est défini depuis V0.8 comme « Argent illimité, tous les produits disponibles, aucun marketplace ». Les corrections V1.0.8/V1.0.9 de la boutique Réaliste avaient cependant réintroduit des restrictions dans ce mode : sélecteur limité à 2026, archives renvoyées vers le Marketplace et blocage des produits `shopHidden`.

## Correction
- Le mode Créatif possède maintenant son propre sélecteur Boutique avec toutes les années et toutes les collections qui ont au moins un produit physique défini dans le catalogue du jeu.
- Tous les produits réellement définis pour ces collections sont ajoutables gratuitement et sans limite de stock, y compris les archives et les produits normalement masqués de la boutique standard.
- Les règles de rotation 2026, de stock horaire, de prix, de Marketplace et d'offre Archive ne s'appliquent plus au mode Créatif.
- Les SKU `retiredCatalog` restent exclus : ils correspondent à des références invalides ou historiques conservées uniquement pour la compatibilité des anciennes sauvegardes, pas à de vrais articles à proposer.
- Le mode Réaliste et le mode Ludique conservent exactement leurs règles actuelles.

## Avant
V1.0.9 remplaçait systématiquement le sélecteur Boutique par les seules collections 2026 et V1.0.8 refusait l'achat direct d'une archive même lorsque `v08Mode()==='creative'`.

## Après
V1.1.3 intercepte le rendu et l'achat uniquement en mode Créatif, puis restaure le comportement prévu depuis V0.8 : coût nul, produits sans stock limité, archives accessibles directement et aucun passage obligatoire par le Marketplace.

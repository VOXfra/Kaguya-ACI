# VOX Unturned — Community Backlog

Dernière passe de recherche : 2026-09-02.

## But

Ce document transforme les plaintes récurrentes de la communauté et les objectifs VOX en backlog concret pour le gros overhaul. Il ne s'agit pas d'une liste de petites features indépendantes : les sous-systèmes restent modulaires en interne, mais la distribution utilisateur doit rester un package cohérent.

Priorités :
- **P0** = impact immédiat, plainte récurrente ou fondation nécessaire au reste du projet.
- **P1** = amélioration majeure d'immersion / QoL à intégrer au gros overhaul.
- **P2** = confort secondaire, compatibilité, polish.

Les éléments marqués **VOX** viennent directement de notre scope même lorsqu'ils ne sont pas une plainte communautaire documentée.

---

# P0 — À traiter dans le gros overhaul

## 1. Performance, stutters et temps de chargement

### Plaintes observées
- Stutters même en solo sur des machines nettement plus puissantes que nécessaire en apparence.
- FPS faibles ou incohérents selon les systèmes.
- Chargements longs et crashs signalés sur certaines cartes.
- Coût CPU main-thread lié à des mises à jour de lumières / requêtes d'eau identifié jusque dans les issues U3-SDK récentes.
- La communauté s'intéresse explicitement à l'upscaling moderne et aux options d'anti-aliasing plus efficaces.

### Sources
- Reddit, mai 2026 — `Problems regarding optimization`: https://www.reddit.com/r/unturned/comments/1t34dek/problems_regarding_optimization/
- Reddit, juillet 2026 — `Unturned running at 30 / 40 FPS on a decent laptop??`: https://www.reddit.com/r/unturned/comments/1v4focf/unturned_running_at_30_40_fps_on_a_decent_laptop/
- U3-SDK issue #5518 — main-thread lights / water queries: https://github.com/SmartlyDressedGames/U3-SDK/issues/5518
- U3-SDK issue #5512 — FSR 3.1 PoC pour BiRP + PPv2: https://github.com/SmartlyDressedGames/U3-SDK/issues/5512
- U3-SDK discussion #5272 — occlusion culling / limites actuelles: https://github.com/SmartlyDressedGames/U3-SDK/discussions/5272

### Cible VOX
- Profiler la frame CPU/GPU avant d'empiler les effets.
- Budgets séparés pour GI, réflexions, volumétriques, météo et matériaux.
- Mise à jour temporelle / amortie des probes et effets coûteux.
- Dynamic resolution / upscaling moderne si intégrable proprement.
- Réduction des allocations runtime et des scans de scène.
- LOD / culling / cache par zones lorsque possible.
- Modes de qualité réellement distincts : Low / Medium / High / Ultra / Experimental RT.

---

## 2. Rendu global vieillissant et incohérent

### Plaintes observées
- Les cartes et assets récents peuvent être beaucoup plus riches que les anciens contenus, créant une forte incohérence visuelle.
- Des discussions communautaires soulignent encore le caractère daté ou trop simple de nombreux bâtiments / environnements.
- La communauté elle-même expérimente en 2026 avec du `proper lighting and partial raytracing`, preuve qu'il existe une demande technique / visuelle pour aller bien plus loin que le rendu vanilla.

### Sources
- Reddit, août 2026 — bâtiments jugés vides / peu crédibles et comparaison favorable à Buak: https://www.reddit.com/r/unturned/comments/1vsmnxl/it_always_pissed_me_off_that_buildings_are_like/
- U3-SDK Show & Tell, juillet 2026 — `Proper lighting and partial raytracing`: https://github.com/SmartlyDressedGames/U3-SDK/discussions/categories/show-and-tell
- Discussion `Environmental teaser`, mars 2026: https://github.com/SmartlyDressedGames/U3-SDK/discussions/5427

### Cible VOX
- Tonemapping / color grading moderne.
- Exposition adaptative contrôlée.
- Ciel et atmosphère dynamiques.
- Brouillard volumétrique / height fog.
- Nuages volumétriques.
- Ombres modernisées et stabilité temporelle.
- Eau améliorée.
- Réflexions hybrides.
- **VOX GI** : screen-space + cache de radiance / probes + accumulation temporelle.
- Chemin `RT-like` / hardware assisté uniquement lorsqu'il existe une voie propre, sans bloquer le fallback logiciel.

---

## 3. Matériaux trop plats / faible différenciation des surfaces

### Problème
La refonte ne doit pas se limiter à recolorer les surfaces. Une route, du métal, du verre, du plastique, du bois, de la terre, de l'eau ou un mur mouillé doivent réagir différemment à la lumière tout en restant dans la DA cubique d'Unturned.

### Cible VOX
- Pipeline de matériaux stylisés PBR-compatible.
- Normal / detail normal sobres et cohérents avec la DA.
- Roughness / metallic / specular différenciés par famille de surface.
- Wetness et variation liée à la météo.
- Dirt / wear léger et procédural lorsque possible.
- Réflexions crédibles sur surfaces lisses / mouillées.
- Ne jamais transformer Unturned en pack photoréaliste générique.

---

## 4. Inventaire et crafting pénibles

### Plaintes observées
- Gestion de l'espace jugée pénible : nécessité de déplacer manuellement des objets alors que de l'espace total existe.
- Demandes de tri / auto-arrangement.
- Frustration sur la nouvelle UI crafting : navigation, recherche, manque d'information sur les matériaux détenus, latence de craft ressentie, workstations jugées trop contraignantes par certains joueurs.
- Les développeurs de serveurs demandent officiellement la possibilité de remplacer / intercepter l'inventaire vanilla.

### Sources
- Reddit, décembre 2025 — `Why is inventory management so dogshit in this game???`: https://www.reddit.com/r/unturned/comments/1pnvo11/why_is_inventory_management_so_dogshit_in_this/
- Steam, mai 2025 — `REVERT UI UPDATE AND REMOVE WORKSTATIONS`: https://steamcommunity.com/app/304930/discussions/0/567001570938459151/
- U3-SDK discussion #5391 — remplacement / interception de l'inventaire: https://github.com/SmartlyDressedGames/U3-SDK/discussions/5391
- U3-SDK discussion #5486 — vêtements 0 capacité et visibilité des slots: https://github.com/SmartlyDressedGames/U3-SDK/discussions/5486

### Cible VOX
- Auto-sort optionnel.
- Auto-compaction / recherche d'espace avant de refuser un loot.
- Transfert rapide cohérent entre inventaire / sol / coffre.
- Affichage clair de la quantité possédée lors du craft.
- Recherche plus tolérante et filtres utiles.
- Favoris / recettes épinglées.
- Craft répété / quantité.
- Workstations rendues lisibles plutôt que simplement supprimées.
- Préserver la logique grid-based emblématique si elle reste agréable.

---

## 5. UI scaling / accessibilité / lisibilité

### Plaintes observées
- Échelle UI pouvant devenir illisible en 4K.
- Valeurs d'échelle pouvant créer des chevauchements ou même rendre certains menus difficilement accessibles.
- Problèmes historiques de persistance de l'échelle entre redémarrages.

### Sources
- U3-SDK issue #3295 — UI Scaling / 4K: https://github.com/SmartlyDressedGames/U3-SDK/issues/3295
- Steam — reset UI size: https://steamcommunity.com/app/304930/discussions/0/5738190785843191994/

### Cible VOX
- UI responsive réellement indépendante de la résolution.
- Bornes sûres pour l'échelle.
- Presets 1080p / 1440p / ultrawide / 4K.
- Taille de texte séparée de la taille globale si possible.
- Safe areas et prévention des chevauchements.

---

## 6. Physique et comportement des véhicules

### Plaintes observées
- Malgré les refontes déjà faites, les comportements absurdes / véhicules projetés restent un gag récurrent de la communauté.
- Les commentaires parlent encore de `normal Unturned vehicle handling` ou de physique cassée.

### Sources
- Reddit, mars 2025 — `Karma By Vehicle Physics`: https://www.reddit.com/r/unturned/comments/1j39y25
- Reddit, mai 2026 — `Unturned Space Program`: https://www.reddit.com/r/unturned/comments/1ts6ixm/unturned_space_program/

### Cible VOX
- Masse / centre de gravité plus crédibles.
- Suspension et pneus plus stables.
- Meilleure réaction aux petits obstacles / trottoirs / collisions latérales.
- Grip longitudinal / latéral cohérent.
- Dégâts mécaniques localisés plus tard : pneus, suspension, moteur, refroidissement, transmission.
- Éviter les impulsions explosives et les catapultages absurdes.
- Base compatible avec le futur `BeamNG-lite` sans prétendre reproduire le node-beam complet.

---

## 7. Zombies trop peu crédibles / trop faciles à exploiter

### Plaintes observées
- Des joueurs estiment que les zombies ne sont plus une menace et que simplement augmenter PV / dégâts ne résout pas le problème.
- L'IA et la détection sont explicitement visées.
- Les zombies passant à travers certaines portes / fenêtres statiques sont encore cités en 2026.

### Sources
- Reddit, août 2024 — `Zombies need a rework`: https://www.reddit.com/r/unturned/comments/1es5wat
- Reddit, août 2026 — zombies traversant portes / fenêtres statiques: https://www.reddit.com/r/unturned/comments/1vsmnxl/it_always_pissed_me_off_that_buildings_are_like/
- Mise à jour 3.25.10.0 — migration pathfinding A* et corrections de bugs: https://steamcommunity.com/app/304930/announcements

### Cible VOX
- Perception vue / bruit séparée.
- Recherche de la dernière position connue.
- Réaction aux tirs, véhicules, portes, vitres, alarmes.
- Hordes / migration / propagation d'alerte graduelle.
- Meilleure navigation autour des obstacles et portes.
- Variantes de comportement plutôt que simples sacs à PV.
- Sons de pas / vocalisations utiles à la lecture de menace.

---

# P1 — Immersion / modernisation forte

## 8. Corps visible en première personne — VOX

### Constat
En regardant vers le bas, le joueur ne voit pas son corps. Ce point a été relevé directement pendant nos tests VOX.

### Cible VOX
- Torse, jambes et pieds visibles en FPS.
- Bras cohérents avec la troisième personne.
- Tête masquée uniquement pour la caméra locale afin d'éviter de voir l'intérieur du mesh.
- Synchronisation sprint / accroupi / prone / saut / chute.
- Équipement et vêtements visibles.
- Gestion caméra pour éviter clipping et nausée.
- IK pieds / mains plus tard.
- Fondation pour blessures localisées, soins visibles et interactions physiques.

---

## 9. Scopes / caméra / confort visuel

### Plaintes observées
- Une refonte des scopes en 2025 a généré des plaintes liées au motion sickness, à la lourdeur de l'animation, aux délais perçus et aux performances.

### Source
- U3-SDK issue #5068: https://github.com/SmartlyDressedGames/U3-SDK/issues/5068

### Cible VOX
- Motion blur désactivable indépendamment.
- Intensité de sway / animation réglable.
- Option `reduced motion`.
- ADS réactif sans supprimer le poids de l'arme.
- Scope rendering optimisé.

---

## 10. Bâtiments / intérieurs trop simples

### Plaintes observées
- Intérieurs parfois décrits comme peu crédibles ou peu `lived-in`.
- Buak est cité positivement pour ses intérieurs plus réalistes, notamment salles de bain et détails fonctionnels.

### Source
- Reddit, août 2026: https://www.reddit.com/r/unturned/comments/1vsmnxl/it_always_pissed_me_off_that_buildings_are_like/

### Cible VOX
- Éclairage intérieur réellement sombre lorsque les sources sont coupées.
- Fenêtres / lampes / éclairage pratique qui comptent.
- Portes / fenêtres avec collisions et interactions cohérentes.
- Props fonctionnels plutôt que décoration pure lorsque faisable.
- Variété contrôlée sans casser les cartes existantes.

---

## 11. Interaction monde / portes / fenêtres

### Cible VOX
- Ouvrir / fermer de manière plus physique.
- Bruit généré par interaction.
- Zombies et IA tenant compte de l'état des ouvertures.
- Verre et obstacles avec comportement cohérent.
- Plus tard : fouille, conteneurs, interrupteurs, générateurs, appareils.

---

## 12. Audio et feedback

### Cible VOX
- Footsteps par matériau.
- Occlusion / atténuation intérieure-extérieure.
- Réverbération légère selon espace.
- Sons de véhicules plus informatifs mécaniquement.
- Feedback des zombies lisible sans devenir arcade.
- Meilleur mix météo / tirs / environnement.

---

## 13. Survie plus systémique — VOX

### Cible VOX
- Température / humidité / exposition.
- Blessures localisées.
- Infection / maladie.
- Sommeil / fatigue si le mode le demande.
- Eau / électricité du monde se dégradant avec le temps.
- Générateurs, batteries, éclairage de secours, bougies.
- Interactions cohérentes avec la nouvelle lumière dynamique.

---

## 14. Végétation / terrain / météo — VOX

### Cible VOX
- Vent cohérent avec météo.
- Végétation plus dense mais scalable.
- Réaction pluie / vent.
- Routes et sols avec matériaux distincts.
- Flaques / wetness si budget acceptable.
- Brouillard et visibilité reliés à la météo.

---

# P2 — QoL / polish / compatibilité

## 15. Workshop et friction pour rejoindre un serveur

### Plaintes / demandes observées
- Conflits de modules Workshop et difficulté à rejoindre certains serveurs sans désabonnement / gestion manuelle.

### Source
- U3-SDK discussion #5198: https://github.com/SmartlyDressedGames/U3-SDK/discussions/5198

### Cible VOX
- Diagnostic clair des conflits.
- Ne jamais supprimer automatiquement des mods tiers sans consentement.
- Profil VOX isolé si nécessaire.
- Installer / updater VOX idempotent et désinstalleur propre.

---

## 16. Anti-aliasing / reconstruction

### Constat
La communauté a déjà démontré un PoC FSR 3.1 fonctionnel sur le Built-in Render Pipeline d'Unturned.

### Source
- U3-SDK issue #5512: https://github.com/SmartlyDressedGames/U3-SDK/issues/5512

### Cible VOX
- SMAA/TAA existants conservés.
- Tester FSR 3.1 / reconstruction temporelle si licence et intégration propres.
- Sharpness séparé.
- Native AA comme option qualité.

---

## 17. Options QoL à ajouter au fur et à mesure

Backlog ouvert :
- tri / stack / compaction inventaire ;
- favoris de crafting ;
- meilleure recherche ;
- quantité de craft ;
- tooltips plus informatifs ;
- taille texte / UI séparée ;
- reduced motion ;
- indicateurs audio / sous-titres utiles ;
- réglages caméra / FOV plus fins ;
- feedback de dégâts mieux localisé ;
- interaction prompt moins envahissant ;
- meilleure distinction objets interactifs / décor ;
- raccourcis configurables pour les fonctions VOX ;
- presets graphiques réels et benchmark simple.

---

# Architecture cible

Le package utilisateur reste unique : **VOX Overhaul**.

Modules internes envisagés :
- `VOX.Graphics`
- `VOX.GI`
- `VOX.Atmosphere`
- `VOX.Materials`
- `VOX.FirstPersonBody`
- `VOX.QoL`
- `VOX.Zombies`
- `VOX.Survival`
- `VOX.Vehicles`
- `VOX.Diagnostics`

Les modules peuvent être activables en interne, mais l'utilisateur ne doit pas avoir à installer dix archives différentes.

---

# Règles de priorisation

1. Ne pas sacrifier les performances pour un effet visuel marginal.
2. Ne pas casser la direction artistique cubique / stylisée.
3. Corriger d'abord les irritants ressentis en permanence : frame pacing, inventaire, caméra, véhicules, zombies, lisibilité.
4. Les effets `Lumen-like` / `RTX-like` doivent avoir un fallback logiciel et des budgets de qualité.
5. Les améliorations QoL doivent rester désactivables lorsqu'elles changent fortement les habitudes de jeu.
6. Toute modification doit rester réversible autant que possible, sans écraser les fichiers vanilla.

---

# Recherche à poursuivre

Cette première passe privilégie les plaintes 2024–2026 et les problèmes historiquement récurrents. À chaque nouvelle version VOX, continuer à scanner :
- r/unturned ;
- Steam General Discussions ;
- U3-SDK Issues / Discussions ;
- retours sous vidéos / showcases pertinents lorsque disponibles ;
- retours directs de nos tests.

Pour chaque nouveau problème : consigner **source, fréquence qualitative, impact, faisabilité, module concerné et statut**.

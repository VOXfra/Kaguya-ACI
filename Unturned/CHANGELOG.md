# Changelog — Unturned VOX

## 2026-09-03 — VOX Overhaul v0.2.0 Full Stack Alpha

### Pourquoi
- Le module client Steam v0.1.4 est validé en jeu : le point d'entrée `IModuleNexus` fonctionne et l'overlay F8 confirme l'exécution runtime.
- VOX demande de ne plus livrer des micro-patches séparés mais d'attaquer directement l'ensemble du rendu et de l'immersion.
- L'absence de corps visible en première personne doit être corrigée dans la même branche de modernisation.

### Quoi
- Passage de `VOX Graphics` à `VOX Overhaul` pour la distribution runtime.
- Tonemapping ACES et color grading injectés dans le Post Processing Stack déjà utilisé par Unturned.
- AO, bloom et SSR renforcés ; renderer deferred forcé par défaut pour la pile de réflexions écran.
- Atmosphère jour/nuit, brouillard, HDR, depth/depth-normal/motion-vector buffers et ombres 4 cascades.
- Première implémentation `VOX GI` : six probes lumineuses locales pilotées par raycasts, couleur des surfaces et environnement, plus `DynamicGI.UpdateEnvironment`.
- `Hybrid Reflections` : SSR + deux ReflectionProbes temps réel autour du joueur avec budgets de mise à jour différents.
- Matériaux stylisés enrichis : metallic, smoothness, occlusion, reflection/light probes et normal maps procédurales pour métal, verre, route, bois, pierre, plastique et surfaces génériques. Les normal maps existantes sont conservées.
- Première implémentation du corps FPS : réactivation du modèle troisième personne local, crâne et épaules/bras TP masqués afin de conserver les bras viewmodel.
- Ajout de toggles runtime : F8 overlay, F7 VOX GI, F6 matériaux.
- Ajout de `overlay/VOXGraphics/VOXGraphics.module`, `graphics.ini` et documentation runtime.
- Mise à jour d'`AGENT.md` : le module Steam devient la milestone runtime prioritaire ; HDRP reste de la R&D historique et n'est plus une dépendance de test.

### Validation effectuée
- Syntaxe du source limitée à C# 5 pour rester compatible avec le `csc.exe` Windows utilisé par l'installateur.
- Manifest `.module` conforme au chargeur officiel : fichier dans le dossier du module et chemin d'assembly relatif `/VOX.Graphics.dll`.
- Protections ajoutées contre le reclonage infini des matériaux VOX.
- Les normal maps déjà présentes ne sont pas écrasées.
- Le corps forcé est explicitement masqué à la mort du joueur.

### Validation restante
- Compilation réelle contre les DLL de l'installation Steam du testeur.
- Test visuel sur une map : post-process, matériaux, GI, probes, performances et clipping du corps FPS dans toutes les stances / véhicules.

## 2026-09-02 — Backlog communauté et modernisation globale

### Pourquoi
- Le scope ne se limite plus au rendu : le projet doit aussi corriger les irritants QoL et systèmes qui font paraître Unturned daté.
- Une première passe de recherche 2024–2026 sur Reddit, Steam et U3-SDK fait ressortir plusieurs thèmes récurrents : performances / stutters, inventaire / crafting, UI scaling, véhicules, zombies / pathfinding, confort des scopes et incohérence visuelle des anciens contenus.
- Pendant le test runtime VOX, l'absence de corps visible en regardant vers le bas a également été ajoutée comme cible d'immersion prioritaire.

### Quoi
- Ajout de `COMMUNITY_BACKLOG.md`.
- Classement en P0 / P1 / P2 avec sources et cibles techniques VOX.
- Ajout officiel du `full first-person body` : torse, jambes, pieds, vêtements / équipement, synchronisation animations et base future pour IK / blessures localisées.
- Intégration du gros overhaul graphique complet : tonemapping, atmosphère, volumétriques, matériaux enrichis, réflexions hybrides, VOX GI et chemin RT-like avec fallback logiciel.
- Ajout des chantiers modernisation : inventaire, UI responsive, zombies, véhicules, audio, interaction monde, survie systémique et Workshop / compatibilité.

### Principes figés
- Un seul package utilisateur `VOX Overhaul`, avec modules internes séparés.
- Ne pas réduire le scope à des micro-patches graphiques isolés.
- Ne pas sacrifier la DA cubique / stylisée pour du photoréalisme générique.
- Effets coûteux budgétés et scalables ; GI / RT avec fallback.
- Installation et désinstallation réversibles autant que possible.

## 2026-09-02 — Premier patch HDRP

### Pourquoi
- Avant de convertir les matériaux ou de créer les nouveaux volumes graphiques, il faut vérifier qu'Unturned peut au minimum charger HDRP et recompiler avec le package présent.
- Unity 2022.3.62f3 utilise la branche HDRP 14 ; la baseline retenue est `14.0.12`.

### Quoi
- Ajout de `patches/001-add-hdrp-package.patch`.
- Le patch ajoute `com.unity.render-pipelines.high-definition` version `14.0.12` au `Packages/manifest.json` officiel.
- Le package historique `com.unity.postprocessing` reste temporairement présent pour éviter de casser prématurément les références existantes du jeu.

### Comment
1. Lecture du `Packages/manifest.json` exact au commit U3-SDK verrouillé.
2. Création d'un patch minimal limité à l'ajout du package HDRP.
3. Validation locale du patch avec `git apply --check` sur une reproduction exacte du manifest.
4. Validation du JSON après application et exécution de `git diff --check`.

### État avant modification
- Le manifest officiel n'incluait aucun Scriptable Render Pipeline.
- Aucun patch de migration HDRP n'existait dans le workspace VOX.

### Validation restante
- Le test décisif reste le premier import Unity : résolution du package, compilation C# et ouverture de `Assets/GameStartup.unity`.

## 2026-09-02 — Initialisation du workspace graphique Unturned

### Pourquoi
- Le dépôt officiel `SmartlyDressedGames/U3-SDK` est en lecture seule pour VOX ; le développement doit donc vivre dans `VOXfra/Kaguya-ACI`.
- Copier tout le SDK officiel dans Kaguya-ACI rendrait les mises à jour amont, les diffs et la maintenance inutilement lourds.
- Le futur chantier HDRP/VOX GI a besoin d'une baseline reproductible avant toute modification graphique.

### Quoi
- Création de la branche `unturned-graphics-overhaul`.
- Création du sous-projet `Unturned/`.
- Ajout de `upstream.lock.json` avec :
  - U3-SDK officiel ;
  - commit verrouillé `6d72628501ee97753a48a0812c64446f3932eefa` ;
  - Unity `2022.3.62f3` ;
  - scène `Assets/GameStartup.unity`.
- Ajout de `bootstrap.ps1` et `bootstrap.cmd` pour cloner automatiquement le SDK dans `Unturned/SDK`, checkout la baseline, appliquer l'overlay et les patches puis valider le workspace.
- Ajout de `tools/Test-Workspace.ps1` pour contrôler commit, version Unity, scène de démarrage et `git diff --check`.
- Ajout des dossiers `overlay/` et `patches/` documentés.
- Mise à jour du `.gitignore` racine afin d'exclure le clone SDK, les builds, logs et caches locaux.
- Ajout de règles spécialisées `Unturned/AGENT.md` pour séparer ce chantier des contraintes propres au projet Kaguya.

### Comment
1. Vérification préalable de l'absence de branche Unturned existante.
2. Lecture des règles du dépôt avant modification.
3. Vérification de la baseline officielle U3-SDK et récupération du commit courant de `main`.
4. Mise en place d'un modèle reproductible `baseline officielle + overlay + patches`.
5. Ajout d'un contrôle automatique du workspace à la fin du bootstrap.

### État avant modification
- Aucun dossier `Unturned/` n'existait dans Kaguya-ACI.
- Aucun SDK Unturned n'était référencé ou verrouillé dans le dépôt.
- Le `.gitignore` ne contenait aucune exclusion spécifique aux fichiers Unity/Unturned.
- Aucune branche dédiée à l'overhaul graphique Unturned n'existait.

### Validation / limites de l'environnement
- Les fichiers GitHub et la baseline amont ont été vérifiés via le dépôt officiel.
- Le runtime de travail utilisé pour cette modification ne dispose pas d'un accès DNS sortant pour exécuter réellement `git clone`; le clonage est donc effectué par le bootstrap sur la machine Windows du testeur, qui dispose de l'accès GitHub.
- La validation complète du bootstrap sera considérée verte lorsque `bootstrap.cmd` aura cloné le SDK et que `Test-Workspace.ps1` aura affiché `[VOX] Validation OK`.
